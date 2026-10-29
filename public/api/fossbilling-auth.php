<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

$secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
ini_set('session.use_strict_mode', '1');
session_set_cookie_params([
    'httponly' => true,
    'secure' => $secure,
    'samesite' => 'Strict',
    'path' => '/',
]);
session_start();

function respond(array $body, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function csrfIsValid(): bool
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    return is_string($provided)
        && isset($_SESSION['csrf_token'])
        && hash_equals($_SESSION['csrf_token'], $provided);
}

function authBaseUrl(): string
{
    $baseUrl = rtrim(trim(getenv('FOSSBILLING_BASE_URL') ?: 'http://localhost:8086'), '/');
    $parts = parse_url($baseUrl);
    $host = is_array($parts) ? ($parts['host'] ?? '') : '';
    $scheme = is_array($parts) ? strtolower((string) ($parts['scheme'] ?? '')) : '';
    $isPrivateIp = filter_var($host, FILTER_VALIDATE_IP) !== false
        && filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    $isLoopbackHost = in_array(strtolower((string) $host), ['localhost', '127.0.0.1', '::1'], true);

    if (
        !is_array($parts)
        || !in_array($scheme, ['https', 'http'], true)
        || ($scheme !== 'https' && !$isPrivateIp && !$isLoopbackHost)
        || isset($parts['user'])
        || isset($parts['pass'])
        || isset($parts['query'])
        || isset($parts['fragment'])
        || !in_array($parts['path'] ?? '', ['', '/'], true)
        || $host === ''
    ) {
        throw new RuntimeException('FOSSBILLING_BASE_URL is invalid.');
    }

    return $baseUrl;
}

function loginIsRateLimited(string $storageDirectory): bool
{
    if (!is_dir($storageDirectory) && !mkdir($storageDirectory, 0750, true) && !is_dir($storageDirectory)) {
        throw new RuntimeException('Unable to create auth storage directory.');
    }

    $address = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $storageDirectory . '/.auth-login-' . hash('sha256', $address);
    $handle = fopen($file, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Unable to check auth login rate limit.');
    }

    try {
        chmod($file, 0600);
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Unable to lock auth login rate limit.');
        }
        $attempts = json_decode(stream_get_contents($handle) ?: '[]', true);
        if (!is_array($attempts)) {
            $attempts = [];
        }
        $attempts = array_values(array_filter(
            $attempts,
            static fn ($time) => is_int($time) && $time > time() - 900
        ));
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($attempts));
        return count($attempts) >= 5;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function recordLoginFailure(string $storageDirectory): void
{
    if (!is_dir($storageDirectory) && !mkdir($storageDirectory, 0750, true) && !is_dir($storageDirectory)) {
        throw new RuntimeException('Unable to create auth storage directory.');
    }

    $address = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $storageDirectory . '/.auth-login-' . hash('sha256', $address);
    $handle = fopen($file, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        throw new RuntimeException('Unable to record auth login attempt.');
    }

    try {
        chmod($file, 0600);
        $attempts = json_decode(stream_get_contents($handle) ?: '[]', true);
        if (!is_array($attempts)) {
            $attempts = [];
        }
        $attempts = array_values(array_filter(
            $attempts,
            static fn ($time) => is_int($time) && $time > time() - 900
        ));
        $attempts[] = time();
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($attempts));
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function fossBillingCookies(CurlHandle $curl): array
{
    $cookies = [];
    foreach (curl_getinfo($curl, CURLINFO_COOKIELIST) ?: [] as $cookie) {
        $parts = explode("\t", $cookie);
        if (count($parts) !== 7 || !in_array($parts[5], ['fossbilling_session', 'fossbilling_csrf'], true)) {
            continue;
        }

        $value = $parts[6];
        if ($value !== '' && strlen($value) <= 4096 && preg_match('/[\x00-\x20\x7f;,]/', $value) !== 1) {
            $cookies[$parts[5]] = $value;
        }
    }

    return $cookies;
}

function callFossBilling(string $baseUrl, string $action, array $payload): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is unavailable.');
    }

    $body = '';
    $curl = curl_init($baseUrl . '/');
    if ($curl === false) {
        throw new RuntimeException('Unable to initialize FossBilling request.');
    }

    curl_setopt_array($curl, [
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_COOKIEFILE => '',
        CURLOPT_HTTPGET => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > 1048576) {
                return 0;
            }

            $body .= $chunk;
            return strlen($chunk);
        },
    ]);

    $result = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);

    if ($result === false) {
        curl_close($curl);
        throw new RuntimeException('FossBilling request failed: ' . $curlError);
    }

    if ($status !== 200) {
        curl_close($curl);
        throw new RuntimeException('FossBilling CSRF bootstrap returned HTTP ' . $status . '.');
    }

    $csrfToken = null;
    foreach (curl_getinfo($curl, CURLINFO_COOKIELIST) ?: [] as $cookie) {
        $parts = explode("\t", $cookie);
        if (count($parts) === 7 && $parts[5] === 'fossbilling_csrf') {
            $csrfToken = rawurldecode($parts[6]);
            break;
        }
    }
    if (!is_string($csrfToken) || $csrfToken === '' || strlen($csrfToken) > 4096
        || preg_match('/[\r\n]/', $csrfToken) === 1) {
        curl_close($curl);
        throw new RuntimeException('FossBilling did not provide a valid CSRF cookie.');
    }

    $body = '';
    curl_setopt_array($curl, [
        CURLOPT_URL => $baseUrl . '/api/guest/client/' . $action,
        CURLOPT_POST => true,
        CURLOPT_HTTPGET => false,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/json',
            'X-CSRF-Token: ' . $csrfToken,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR),
    ]);

    $result = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    $cookies = fossBillingCookies($curl);
    curl_close($curl);

    if ($result === false) {
        throw new RuntimeException('FossBilling request failed: ' . $curlError);
    }

    try {
        $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new RuntimeException('FossBilling returned invalid JSON.');
    }

    if (!is_array($decoded)) {
        throw new RuntimeException('FossBilling returned an unexpected response.');
    }

    if (!empty($decoded['error'])) {
        $error = $decoded['error'];
        $message = is_string($error)
            ? $error
            : (is_array($error) && is_string($error['message'] ?? null)
                ? $error['message']
                : 'Permintaan tidak dapat diproses.');
        $errorStatus = $status >= 500
            ? 502
            : ($action === 'login' ? 401 : 422);
        throw new DomainException(substr($message, 0, 500), $errorStatus);
    }

    $loginResult = $decoded['result'] ?? null;
    $validLoginName = is_array($loginResult)
        && (is_string($loginResult['name'] ?? null)
            || (is_string($loginResult['first_name'] ?? null)
                && is_string($loginResult['last_name'] ?? null)));
    $validResult = $action === 'login'
        ? is_array($loginResult)
            && (is_int($loginResult['id'] ?? null) || is_string($loginResult['id'] ?? null))
            && trim((string) $loginResult['id']) !== ''
            && is_string($loginResult['email'] ?? null)
            && filter_var($loginResult['email'], FILTER_VALIDATE_EMAIL)
            && $validLoginName
            && ($decoded['error'] ?? null) === null
        : (($decoded['result'] ?? null) === true
            || (is_int($decoded['result'] ?? null) && $decoded['result'] > 0)
            || (is_string($decoded['result'] ?? null) && ctype_digit($decoded['result'])));

    if (($status !== 200 && $status !== 201) || !$validResult) {
        if ($action === 'login' && $status === 401) {
            throw new DomainException('Email atau kata sandi tidak valid.', 401);
        }
        if (!$validResult) {
            throw new DomainException('Permintaan tidak dapat diproses. Periksa kembali data yang dimasukkan.', 422);
        }
        throw new RuntimeException('FossBilling returned an unexpected auth response.');
    }

    return ['response' => $decoded, 'cookies' => $cookies];
}

function callFossBillingClient(string $endpoint, array $payload): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is unavailable.');
    }

    $cookies = $_SESSION['fossbilling_cookies'] ?? [];
    if (!is_array($cookies) || !isset($cookies['fossbilling_session'])) {
        throw new DomainException('Sesi FossBilling tidak tersedia. Silakan masuk kembali.', 401);
    }

    $cookieHeader = [];
    foreach (['fossbilling_session', 'fossbilling_csrf'] as $name) {
        $value = $cookies[$name] ?? null;
        if (is_string($value) && $value !== ''
            && strlen($value) <= 4096
            && preg_match('/[\x00-\x20\x7f;,]/', $value) !== 1) {
            $cookieHeader[] = $name . '=' . $value;
        }
    }
    if (!isset($cookies['fossbilling_session']) || $cookieHeader === []) {
        throw new DomainException('Sesi FossBilling tidak valid. Silakan masuk kembali.', 401);
    }

    $headers = ['Accept: application/json', 'Content-Type: application/json'];
    if (isset($cookies['fossbilling_csrf'])) {
        $csrfToken = rawurldecode($cookies['fossbilling_csrf']);
        if ($csrfToken !== '' && strlen($csrfToken) <= 4096 && preg_match('/[\r\n]/', $csrfToken) !== 1) {
            $headers[] = 'X-CSRF-Token: ' . $csrfToken;
        }
    }

    $body = '';
    $curl = curl_init(authBaseUrl() . '/api/client/profile/' . $endpoint);
    if ($curl === false) {
        throw new RuntimeException('Unable to initialize FossBilling request.');
    }
    curl_setopt_array($curl, [
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_COOKIEFILE => '',
        CURLOPT_COOKIE => implode('; ', $cookieHeader),
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode((object) $payload, JSON_THROW_ON_ERROR),
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > 1048576) {
                return 0;
            }
            $body .= $chunk;
            return strlen($chunk);
        },
    ]);

    $result = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    $updatedCookies = fossBillingCookies($curl);
    curl_close($curl);

    if ($result === false) {
        throw new RuntimeException('FossBilling request failed: ' . $curlError);
    }

    try {
        $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new RuntimeException('FossBilling returned invalid JSON.');
    }
    if (!is_array($decoded)) {
        throw new RuntimeException('FossBilling returned an unexpected response.');
    }
    if ($status === 401 || $status === 403) {
        throw new DomainException('Sesi FossBilling tidak valid. Silakan masuk kembali.', 401);
    }
    if ($status < 200 || $status >= 300 || !array_key_exists('result', $decoded)
        || ($decoded['error'] ?? null) !== null) {
        $error = $decoded['error'] ?? null;
        $message = is_string($error)
            ? $error
            : (is_array($error) && is_string($error['message'] ?? null)
                ? $error['message']
                : 'Permintaan profil ke FossBilling gagal.');
        throw new DomainException(substr($message, 0, 500), $status >= 500 ? 502 : 422);
    }

    if ($updatedCookies !== []) {
        $_SESSION['fossbilling_cookies'] = array_merge($cookies, $updatedCookies);
    }

    return $decoded;
}

function profileBelongsToSession(array $profile): bool
{
    $ownerId = $_SESSION['fossbilling_client']['id'] ?? null;
    $profileId = $profile['id'] ?? null;
    return (is_int($ownerId) || is_string($ownerId))
        && trim((string) $ownerId) !== ''
        && (is_int($profileId) || is_string($profileId))
        && trim((string) $profileId) !== ''
        && hash_equals((string) $ownerId, (string) $profileId);
}

function profileResponse(): array
{
    $response = callFossBillingClient('get', []);
    $profile = $response['result'] ?? null;
    if (!is_array($profile) || !profileBelongsToSession($profile)) {
        throw new DomainException('Profil yang diterima tidak sesuai dengan akun yang sedang masuk.', 403);
    }

    if (!is_string($profile['email'] ?? null) || !filter_var($profile['email'], FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('FossBilling returned an invalid client profile.');
    }

    $fields = [
        'id', 'email', 'email_approved', 'type', 'first_name', 'last_name', 'gender',
        'birthday', 'phone_cc', 'phone', 'company', 'company_vat', 'company_number',
        'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'currency',
        'lang', 'timezone', 'billing_email', 'balance',
    ];
    $numericFields = ['id', 'balance'];
    $normalized = [];
    foreach ($fields as $field) {
        $value = $profile[$field] ?? null;
        $validType = $value === null
            || ($field === 'email_approved' && is_bool($value))
            || (in_array($field, $numericFields, true)
                && (is_string($value) || is_int($value) || is_float($value)))
            || (!in_array($field, $numericFields, true)
                && $field !== 'email_approved'
                && is_string($value));
        if (!$validType) {
            throw new RuntimeException('FossBilling returned an invalid client profile field.');
        }
        $normalized[$field] = $value;
    }

    return $normalized;
}

function validateProfileInput(array $input): array
{
    $textLimits = [
        'first_name' => 100,
        'last_name' => 100,
        'phone_cc' => 8,
        'phone' => 32,
        'company' => 255,
        'company_vat' => 64,
        'company_number' => 64,
        'address_1' => 255,
        'address_2' => 255,
        'city' => 100,
        'state' => 100,
        'postcode' => 32,
        'country' => 2,
    ];
    $payload = [];
    foreach ($textLimits as $field => $limit) {
        $value = $input[$field] ?? '';
        if (!is_string($value) || strlen($value) > $limit || preg_match('/[\x00-\x1f\x7f]/', $value) === 1) {
            throw new DomainException('Periksa kembali format data profil.', 422);
        }
        $value = trim($value);
        if ($field === 'first_name' && $value === '') {
            throw new DomainException('Nama depan wajib diisi.', 422);
        }
        if ($field === 'phone' && $value !== '' && preg_match('/^[+0-9() .-]+$/', $value) !== 1) {
            throw new DomainException('Format nomor telepon tidak valid.', 422);
        }
        if ($field === 'phone_cc' && $value !== '' && preg_match('/^\+?[0-9]{1,7}$/', $value) !== 1) {
            throw new DomainException('Kode negara nomor telepon tidak valid.', 422);
        }
        if ($field === 'country' && $value !== '' && preg_match('/^[A-Za-z]{2}$/', $value) !== 1) {
            throw new DomainException('Pilih kode negara yang valid (2 huruf).', 422);
        }
        $payload[$field] = $value === '' ? null : $value;
    }

    foreach (['email', 'billing_email'] as $field) {
        $value = $input[$field] ?? '';
        if (!is_string($value) || strlen($value) > 254 || preg_match('/[\x00-\x20\x7f]/', $value) === 1) {
            throw new DomainException('Format email tidak valid.', 422);
        }
        $value = trim($value);
        if (($field === 'email' || $value !== '') && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            throw new DomainException('Masukkan alamat email yang valid.', 422);
        }
        $payload[$field] = $value === '' ? null : $value;
    }

    $birthday = $input['birthday'] ?? '';
    if (!is_string($birthday) || ($birthday !== '' && (
        preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthday) !== 1
        || !checkdate((int) substr($birthday, 5, 2), (int) substr($birthday, 8, 2), (int) substr($birthday, 0, 4))
    ))) {
        throw new DomainException('Tanggal lahir tidak valid.', 422);
    }
    $payload['birthday'] = $birthday === '' ? null : $birthday;

    $gender = $input['gender'] ?? '';
    if (!is_string($gender) || !in_array($gender, ['', 'male', 'female', 'other'], true)) {
        throw new DomainException('Pilih jenis kelamin yang valid.', 422);
    }
    $payload['gender'] = $gender === '' ? null : $gender;

    $timezone = $input['timezone'] ?? '';
    if (!is_string($timezone) || !in_array($timezone, DateTimeZone::listIdentifiers(), true)) {
        throw new DomainException('Pilih zona waktu yang valid.', 422);
    }
    $payload['timezone'] = $timezone;

    return $payload;
}

$action = $_GET['action'] ?? '';
$storageDirectory = dirname(__DIR__, 2) . '/storage';

if ($action === 'status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $_SESSION['csrf_token'] ??= bin2hex(random_bytes(32));
    respond([
        'authenticated' => !empty($_SESSION['fossbilling_authenticated']),
        'client' => $_SESSION['fossbilling_authenticated']
            ? ($_SESSION['fossbilling_client'] ?? null)
            : null,
        'csrfToken' => $_SESSION['csrf_token'],
    ]);
}

if ($action === 'profile' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    try {
        respond(['profile' => profileResponse()]);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling profile API error: ' . $error->getMessage());
        respond(['error' => 'Profil tidak dapat dimuat dari server akun. Coba lagi nanti.'], 502);
    }
}

if (!in_array($action, ['login', 'create', 'logout', 'profile-update', 'password-change'], true)
    || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Permintaan tidak valid.'], 405);
}

if (!csrfIsValid()) {
    respond(['error' => 'Sesi kedaluwarsa. Muat ulang halaman lalu coba lagi.'], 403);
}

if (in_array($action, ['logout', 'profile-update', 'password-change'], true)
    && empty($_SESSION['fossbilling_authenticated'])) {
    respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
}

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }
    session_destroy();
    respond(['result' => true, 'error' => null]);
}

try {
    if ($action === 'password-change') {
        $rawBody = file_get_contents('php://input');
        if ($rawBody === false || strlen($rawBody) > 8192) {
            respond(['error' => 'Permintaan terlalu besar.'], 413);
        }
        $input = json_decode($rawBody ?: '', true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($input)) {
            respond(['error' => 'Format data tidak valid.'], 400);
        }

        $allowedFields = ['current_password', 'new_password', 'confirm_password'];
        if (array_diff(array_keys($input), $allowedFields) !== []) {
            respond(['error' => 'Permintaan berisi field yang tidak didukung.'], 422);
        }
        $currentPassword = $input['current_password'] ?? null;
        $newPassword = $input['new_password'] ?? null;
        $confirmPassword = $input['confirm_password'] ?? null;
        if (!is_string($currentPassword) || $currentPassword === '' || strlen($currentPassword) > 4096
            || !is_string($newPassword) || strlen($newPassword) > 4096
            || !is_string($confirmPassword) || strlen($confirmPassword) > 4096) {
            respond(['error' => 'Data password tidak valid.'], 422);
        }
        if (strlen($newPassword) < 8
            || preg_match('/[A-Z]/', $newPassword) !== 1
            || preg_match('/[a-z]/', $newPassword) !== 1
            || preg_match('/[^A-Za-z0-9]/', $newPassword) !== 1) {
            respond(['error' => 'Password baru harus minimal 8 karakter dan memiliki huruf uppercase, huruf lowercase, serta simbol.'], 422);
        }
        if (!hash_equals($newPassword, $confirmPassword)) {
            respond(['error' => 'Konfirmasi password baru belum sama.'], 422);
        }

        $result = callFossBillingClient('change_password', [
            'current_password' => $currentPassword,
            'new_password' => $newPassword,
            'confirm_password' => $confirmPassword,
        ]);
        if (($result['result'] ?? null) !== true) {
            throw new RuntimeException('FossBilling returned an unexpected password update response.');
        }
        respond(['result' => true, 'error' => null]);
    }

    if ($action === 'profile-update') {
        $rawBody = file_get_contents('php://input');
        if ($rawBody === false || strlen($rawBody) > 16384) {
            respond(['error' => 'Permintaan terlalu besar.'], 413);
        }
        $input = json_decode($rawBody ?: '', true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($input)) {
            respond(['error' => 'Format data tidak valid.'], 400);
        }

        $allowedFields = [
            'first_name', 'last_name', 'phone_cc', 'phone', 'company', 'company_vat',
            'company_number', 'address_1', 'address_2', 'city', 'state', 'postcode',
            'country', 'email', 'billing_email', 'birthday', 'gender', 'timezone',
        ];
        if (array_diff(array_keys($input), $allowedFields) !== []) {
            respond(['error' => 'Permintaan berisi field profil yang tidak didukung.'], 422);
        }
        $payload = validateProfileInput($input);

        $currentProfile = profileResponse();
        if (!profileBelongsToSession($currentProfile)) {
            respond(['error' => 'Profil tidak dimiliki oleh akun yang sedang masuk.'], 403);
        }
        callFossBillingClient('update', $payload);
        $updatedProfile = profileResponse();
        if (!profileBelongsToSession($updatedProfile)) {
            respond(['error' => 'Profil hasil pembaruan tidak sesuai dengan akun yang sedang masuk.'], 403);
        }
        respond(['profile' => $updatedProfile]);
    }

    if ($action === 'login' && loginIsRateLimited($storageDirectory)) {
        header('Retry-After: 900');
        respond(['error' => 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.'], 429);
    }

    $rawBody = file_get_contents('php://input');
    if ($rawBody === false || strlen($rawBody) > 8192) {
        respond(['error' => 'Permintaan terlalu besar.'], 413);
    }

    $input = json_decode($rawBody ?: '', true, 16, JSON_THROW_ON_ERROR);
    if (!is_array($input)) {
        respond(['error' => 'Format data tidak valid.'], 400);
    }

    $email = $input['email'] ?? null;
    $password = $input['password'] ?? null;
    if (!is_string($email) || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)
        || !is_string($password) || $password === '' || strlen($password) > 4096) {
        respond(['error' => 'Email atau kata sandi tidak valid.'], 422);
    }

    if ($action === 'login') {
        try {
            $login = callFossBilling(authBaseUrl(), 'login', ['email' => $email, 'password' => $password]);
        } catch (DomainException $error) {
            recordLoginFailure($storageDirectory);
            usleep(350000);
            respond(['error' => $error->getMessage()], $error->getCode());
        }

        $client = $login['response']['result'];
        if (!isset($login['cookies']['fossbilling_session'])) {
            throw new RuntimeException('FossBilling did not provide an authenticated session cookie.');
        }
        session_regenerate_id(true);
        $_SESSION['fossbilling_authenticated'] = true;
        $_SESSION['fossbilling_client'] = [
            'id' => $client['id'],
            'name' => $client['name'] ?? trim(($client['first_name'] ?? '') . ' ' . ($client['last_name'] ?? '')),
            'first_name' => $client['first_name'] ?? '',
            'last_name' => $client['last_name'] ?? '',
            'email' => $client['email'],
        ];
        $_SESSION['fossbilling_cookies'] = $login['cookies'];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        respond(['result' => true, 'error' => null]);
    }

    $firstName = $input['first_name'] ?? null;
    $lastName = $input['last_name'] ?? '';
    $passwordConfirm = $input['password_confirm'] ?? null;
    if (
        !is_string($firstName) || trim($firstName) === '' || strlen($firstName) > 100
        || !is_string($lastName) || strlen($lastName) > 100
        || strlen($password) < 8
        || !is_string($passwordConfirm) || !hash_equals($password, $passwordConfirm)
    ) {
        respond(['error' => 'Periksa kembali data pendaftaran.'], 422);
    }

    callFossBilling(authBaseUrl(), 'create', [
        'first_name' => trim($firstName),
        'last_name' => trim($lastName),
        'email' => $email,
        'password' => $password,
        'password_confirm' => $passwordConfirm,
    ]);
    $login = callFossBilling(authBaseUrl(), 'login', ['email' => $email, 'password' => $password]);
    $client = $login['response']['result'];
    if (!isset($login['cookies']['fossbilling_session'])) {
        throw new RuntimeException('FossBilling did not provide an authenticated session cookie.');
    }
    session_regenerate_id(true);
    $_SESSION['fossbilling_authenticated'] = true;
    $_SESSION['fossbilling_client'] = [
        'id' => $client['id'],
        'name' => $client['name'] ?? trim(($client['first_name'] ?? '') . ' ' . ($client['last_name'] ?? '')),
        'first_name' => $client['first_name'] ?? '',
        'last_name' => $client['last_name'] ?? '',
        'email' => $client['email'],
    ];
    $_SESSION['fossbilling_cookies'] = $login['cookies'];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    respond(['result' => true, 'error' => null]);
} catch (DomainException $error) {
    respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
} catch (JsonException $error) {
    respond(['error' => 'Format data tidak valid.'], 400);
} catch (Throwable $error) {
    error_log('FossBilling auth API error: ' . $error->getMessage());
    respond(['error' => 'Server akun tidak dapat dihubungi. Coba lagi beberapa saat lagi.'], 502);
}
