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

function notificationStatePath(string $storageDirectory, int $clientId): string
{
    return $storageDirectory . '/notifications/' . $clientId . '.state.json';
}

function readNotificationState(string $storageDirectory, int $clientId): array
{
    $file = notificationStatePath($storageDirectory, $clientId);
    $state = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
    $read = is_array($state) && is_array($state['read'] ?? null) ? $state['read'] : [];
    return [
        'read' => (object) $read,
        'cleared' => is_array($state) ? (int) ($state['cleared'] ?? 0) : 0,
    ];
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

function callFossBillingClient(string $endpoint, array $payload, string $area = 'client'): array
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
    $curl = curl_init(authBaseUrl() . '/api/' . $area . '/' . $endpoint);
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

function fetchFossBillingInvoicePdf(string $hash): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is unavailable.');
    }

    if (preg_match('/^[a-f0-9]{30,60}$/', $hash) !== 1) {
        throw new DomainException('Tagihan ini tidak memiliki tautan unduhan yang valid.', 422);
    }

    $cookies = $_SESSION['fossbilling_cookies'] ?? [];
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
        throw new DomainException('Sesi FossBilling tidak tersedia. Silakan masuk kembali.', 401);
    }

    $body = '';
    $contentType = '';
    $contentDisposition = '';
    $curl = curl_init(authBaseUrl() . '/invoice/pdf/' . rawurlencode($hash));
    if ($curl === false) {
        throw new RuntimeException('Unable to initialize FossBilling request.');
    }
    curl_setopt_array($curl, [
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_COOKIEFILE => '',
        CURLOPT_COOKIE => implode('; ', $cookieHeader),
        CURLOPT_HTTPGET => true,
        CURLOPT_HTTPHEADER => ['Accept: application/pdf'],
        CURLOPT_HEADERFUNCTION => static function ($handle, string $header) use (&$contentType, &$contentDisposition): int {
            $parts = explode(':', $header, 2);
            if (count($parts) === 2) {
                $name = strtolower(trim($parts[0]));
                $value = trim($parts[1]);
                if ($name === 'content-type') {
                    $contentType = $value;
                } elseif ($name === 'content-disposition') {
                    $contentDisposition = $value;
                }
            }

            return strlen($header);
        },
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > 16777216) {
                return 0;
            }

            $body .= $chunk;
            return strlen($chunk);
        },
    ]);

    $result = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if ($result === false) {
        throw new RuntimeException('FossBilling request failed: ' . $curlError);
    }
    if ($status === 401 || $status === 403) {
        throw new DomainException('Sesi FossBilling tidak valid. Silakan masuk kembali.', 401);
    }
    if ($status !== 200
        || stripos($contentType, 'application/pdf') !== 0
        || strlen($body) < 64
        || strncmp($body, '%PDF-', 5) !== 0) {
        throw new DomainException('File PDF tagihan belum tersedia.', 422);
    }

    return ['body' => $body, 'disposition' => $contentDisposition];
}

function findClientInvoiceById(string $invoiceId): array
{
    $response = callFossBillingClient('invoice/get_list', ['per_page' => 100]);
    $list = $response['result']['list'] ?? null;
    if (!is_array($list)) {
        throw new RuntimeException('FossBilling returned an invalid invoice list.');
    }

    foreach ($list as $invoice) {
        if (is_array($invoice) && isset($invoice['id']) && (string) $invoice['id'] === $invoiceId) {
            return $invoice;
        }
    }

    throw new DomainException('Tagihan tidak ditemukan pada akun ini.', 404);
}

function buildInvoiceDetail(array $invoice): array
{
    if (!is_array($invoice)
        || (!is_int($invoice['id'] ?? null) && !is_string($invoice['id'] ?? null))
        || trim((string) $invoice['id']) === ''
        || !is_string($invoice['status'] ?? null)
        || trim($invoice['status']) === ''
        || (isset($invoice['currency']) && !is_string($invoice['currency']))) {
        throw new RuntimeException('FossBilling returned an invalid invoice record.');
    }

    $status = strtolower(trim($invoice['status']));
    $currency = is_string($invoice['currency'] ?? null) && preg_match('/^[A-Za-z]{3}$/', $invoice['currency']) === 1
        ? strtoupper($invoice['currency'])
        : null;
    $hash = is_string($invoice['hash'] ?? null) && preg_match('/^[a-f0-9]{30,60}$/', $invoice['hash']) === 1
        ? $invoice['hash']
        : null;

    $lines = [];
    $titles = [];
    $period = null;
    foreach (is_array($invoice['lines'] ?? null) ? $invoice['lines'] : [] as $line) {
        if (!is_array($line)) {
            continue;
        }
        $title = trim((string) ($line['title'] ?? ''));
        if ($title === '') {
            continue;
        }
        $quantity = is_numeric($line['quantity'] ?? null) ? (float) $line['quantity'] : 1.0;
        $price = is_numeric($line['price'] ?? null) ? (float) $line['price'] : 0.0;
        $lineTotal = is_numeric($line['total'] ?? null) ? (float) $line['total'] : $price * $quantity;
        $linePeriod = is_string($line['period'] ?? null) && $line['period'] !== '' ? $line['period'] : null;
        if ($period === null && $linePeriod !== null) {
            $period = $linePeriod;
        }
        $titles[] = $title;
        $lines[] = [
            'title' => $title,
            'period' => $linePeriod,
            'quantity' => $quantity,
            'unit' => is_string($line['unit'] ?? null) && $line['unit'] !== '' ? $line['unit'] : null,
            'price' => $price,
            'total' => $lineTotal,
            'taxed' => (int) ($line['taxed'] ?? 0) === 1,
        ];
    }

    $text = static function ($value): ?string {
        if (!is_string($value)) {
            return null;
        }
        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    };
    $date = static function ($value): ?string {
        if (!is_string($value)) {
            return null;
        }
        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    };

    $buyer = is_array($invoice['buyer'] ?? null) ? $invoice['buyer'] : [];
    $seller = is_array($invoice['seller'] ?? null) ? $invoice['seller'] : [];

    return [
        'id' => (string) $invoice['id'],
        'number' => is_string($invoice['serie_nr'] ?? null) && $invoice['serie_nr'] !== ''
            ? $invoice['serie_nr']
            : (string) $invoice['id'],
        'hash' => $hash,
        'status' => $status,
        'currency' => $currency,
        'subtotal' => is_numeric($invoice['subtotal'] ?? null) ? (float) $invoice['subtotal'] : null,
        'tax' => is_numeric($invoice['tax'] ?? null) ? (float) $invoice['tax'] : null,
        'taxrate' => is_numeric($invoice['taxrate'] ?? null) ? (float) $invoice['taxrate'] : null,
        'taxname' => $text($invoice['taxname'] ?? null),
        'total' => is_numeric($invoice['total'] ?? null) ? (float) $invoice['total'] : null,
        'notes' => $text($invoice['notes'] ?? null),
        'text_1' => $text($invoice['text_1'] ?? null),
        'text_2' => $text($invoice['text_2'] ?? null),
        'due_at' => $date($invoice['due_at'] ?? null),
        'paid_at' => $date($invoice['paid_at'] ?? null),
        'created_at' => $date($invoice['created_at'] ?? null),
        'period' => $period,
        'title' => $titles === [] ? null : implode(', ', array_slice($titles, 0, 3)),
        'lines' => $lines,
        'buyer' => [
            'first_name' => $text($buyer['first_name'] ?? null),
            'last_name' => $text($buyer['last_name'] ?? null),
            'company' => $text($buyer['company'] ?? null),
            'company_vat' => $text($buyer['company_vat'] ?? null),
            'company_number' => $text($buyer['company_number'] ?? null),
            'address' => $text($buyer['address'] ?? null),
            'city' => $text($buyer['city'] ?? null),
            'state' => $text($buyer['state'] ?? null),
            'country' => $text($buyer['country'] ?? null),
            'zip' => $text($buyer['zip'] ?? null),
            'phone' => $text($buyer['phone'] ?? null),
            'email' => $text($buyer['email'] ?? null),
        ],
        'seller' => [
            'company' => $text($seller['company'] ?? null),
            'company_vat' => $text($seller['company_vat'] ?? null),
            'company_number' => $text($seller['company_number'] ?? null),
            'address' => $text($seller['address'] ?? null),
            'phone' => $text($seller['phone'] ?? null),
            'email' => $text($seller['email'] ?? null),
        ],
    ];
}

function cancelFossBillingInvoice(int $invoiceId, string $reason): bool
{
    $token = trim((string) getenv('FOSSBILLING_ADMIN_TOKEN'));
    if ($token === '') {
        return false;
    }
    $baseUrl = rtrim(trim(getenv('FOSSBILLING_BASE_URL') ?: 'http://localhost:8086'), '/');
    $curl = curl_init($baseUrl . '/api/admin/invoice/cancel');
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_POST => true,
        CURLOPT_USERPWD => 'admin:' . $token,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['id' => $invoiceId, 'reason' => 'Dibatalkan pelanggan: ' . $reason]),
    ]);
    $body = curl_exec($curl);
    curl_close($curl);
    $json = is_string($body) ? json_decode($body, true) : null;

    return is_array($json) && ($json['result'] ?? null) === true && empty($json['error']);
}

function payFossBillingInvoiceWithCredits(int $invoiceId): bool
{
    $token = trim((string) getenv('FOSSBILLING_ADMIN_TOKEN'));
    if ($token === '') {
        return false;
    }
    $baseUrl = rtrim(trim(getenv('FOSSBILLING_BASE_URL') ?: 'http://localhost:8086'), '/');
    $curl = curl_init($baseUrl . '/api/admin/invoice/pay_with_credits');
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_POST => true,
        CURLOPT_USERPWD => 'admin:' . $token,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['id' => $invoiceId]),
    ]);
    $body = curl_exec($curl);
    curl_close($curl);
    $json = is_string($body) ? json_decode($body, true) : null;

    return is_array($json) && ($json['result'] ?? null) === true && empty($json['error']);
}

function callFossBillingAdmin(string $action, array $payload): array
{
    $token = trim((string) getenv('FOSSBILLING_ADMIN_TOKEN'));
    if ($token === '' || !function_exists('curl_init')) {
        return [];
    }
    $baseUrl = rtrim(trim(getenv('FOSSBILLING_BASE_URL') ?: 'http://localhost:8086'), '/');
    $curl = curl_init($baseUrl . '/api/admin/' . ltrim($action, '/'));
    if ($curl === false) {
        return [];
    }
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_POST => true,
        CURLOPT_USERPWD => 'admin:' . $token,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
    ]);
    $body = curl_exec($curl);
    curl_close($curl);
    $json = is_string($body) ? json_decode($body, true) : null;

    return is_array($json) ? $json : [];
}

const QRISLY_PREFIX = 'QRISLY-';
const GOPAY_PREFIX = 'GOPAY-';

function gopayRequest(string $method, string $path, array $query = []): array
{
    $baseUrl = rtrim(trim(getenv('GOPAY_GATEWAY_URL') ?: 'http://localhost:3000'), '/');
    if (preg_match('#^https?://#', $baseUrl) !== 1) {
        respond(['error' => 'GOPAY_GATEWAY_URL tidak valid.'], 500);
    }
    $apiKey = trim((string) getenv('GOPAY_API_KEY'));
    $url = $baseUrl . $path . ($query === [] ? '' : '?' . http_build_query($query));

    $headers = ['Accept: application/json'];
    if ($apiKey !== '') {
        $headers[] = 'X-Api-Key: ' . $apiKey;
    }
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    $json = is_string($body) ? json_decode($body, true) : null;
    if (!is_array($json)) {
        respond(['error' => 'Gateway QRIS GoPay tidak merespons dengan benar.'], 502);
    }
    if ($status < 200 || $status >= 300) {
        $message = is_string($json['message'] ?? null) ? $json['message'] : 'Permintaan ke gateway QRIS GoPay ditolak.';
        respond(['error' => $message], $status === 409 ? 409 : 502);
    }

    return $json;
}

function normalizeGopayStatus(array $data, string $paymentId, ?string $orderId): array
{
    $status = match (strtoupper((string) ($data['status'] ?? ''))) {
        'PAID' => 'PAID',
        'PENDING' => 'PENDING',
        'EXPIRED' => 'EXPIRED',
        default => strtoupper((string) ($data['status'] ?? 'EXPIRED')),
    };
    $transaction = is_array($data['transaction'] ?? null) ? $data['transaction'] : [];

    return [
        'payment_id' => $paymentId,
        'order_id' => $orderId,
        'payment_type' => 'gopay',
        'amount' => $data['total_amount'] ?? $data['amount'] ?? null,
        'currency' => 'IDR',
        'status' => $status,
        'sender_name' => $transaction['payer_issuer'] ?? null,
        'paid_at' => $data['paid_at'] ?? null,
        'created_at' => $data['created_at'] ?? null,
        'expired_at' => $data['expires_at'] ?? null,
    ];
}

function qrisFee(int $subtotal): int
{
    return (int) round(($subtotal > 100000 ? $subtotal * 0.007 : 0) + $subtotal * 0.0029);
}

function normalizeQrislyStatus(array $data, string $paymentId, ?string $orderId): array
{
    $status = match (strtolower((string) ($data['payment_status'] ?? ''))) {
        'paid' => 'PAID',
        'unpaid', 'pending' => 'PENDING',
        'cancelled', 'canceled' => 'CANCELED',
        default => strtoupper((string) ($data['payment_status'] ?? '')),
    };

    return [
        'payment_id' => $paymentId,
        'order_id' => $orderId,
        'payment_type' => 'qris',
        'amount' => $data['amount'] ?? null,
        'currency' => 'IDR',
        'status' => $status,
        'sender_name' => $data['name'] ?? null,
        'paid_at' => $data['paid_at'] ?? null,
        'created_at' => $data['created_at'] ?? null,
    ];
}

// QRISLY tidak punya webhook, jadi saat status PAID terlihat kita memicu IPN FossBilling
// sendiri. Adapter tetap memverifikasi ulang ke Komerce sebelum melunasi invoice.
function notifyFossBillingPaid(string $paymentId, int $gatewayId, int $invoiceId, ?string $orderId): bool
{
    $apiKey = trim((string) getenv('KOMERCE_API_KEY'));
    $baseUrl = rtrim(trim(getenv('FOSSBILLING_BASE_URL') ?: 'http://localhost:8086'), '/');
    if ($apiKey === '' || preg_match('#^https?://#', $baseUrl) !== 1) {
        return false;
    }
    $body = json_encode(['payment_id' => $paymentId, 'order_id' => $orderId], JSON_UNESCAPED_SLASHES);
    $curl = curl_init($baseUrl . '/ipn.php?' . http_build_query(['gateway_id' => $gatewayId, 'invoice_id' => $invoiceId]));
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Callback-Api-Key: ' . hash_hmac('sha256', (string) $body, $apiKey)],
    ]);
    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    $json = is_string($response) ? json_decode($response, true) : null;
    if ($status < 200 || $status >= 300 || !is_array($json) || !empty($json['error'])) {
        error_log('FossBilling IPN sync failed for ' . $paymentId . ': ' . (is_string($response) ? substr($response, 0, 300) : 'no response'));

        return false;
    }

    return true;
}

function komerceRequest(string $method, string $path, ?array $payload = null): array
{
    $apiKey = trim((string) getenv('KOMERCE_API_KEY'));
    if ($apiKey === '') {
        respond(['error' => 'KOMERCE_API_KEY belum diatur di server.'], 503);
    }
    $baseUrl = rtrim(trim(getenv('KOMERCE_BASE_URL') ?: 'https://api-sandbox.collaborator.komerce.id/user'), '/');
    if (preg_match('#^https://#', $baseUrl) !== 1) {
        respond(['error' => 'KOMERCE_BASE_URL harus HTTPS.'], 500);
    }

    $headers = ['x-api-key: ' . $apiKey, 'Accept: application/json'];
    $options = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CUSTOMREQUEST => $method];
    if ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
        $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_SLASHES);
    }
    $options[CURLOPT_HTTPHEADER] = $headers;

    $curl = curl_init($baseUrl . $path);
    curl_setopt_array($curl, $options);
    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    $json = is_string($body) ? json_decode($body, true) : null;
    if (!is_array($json)) {
        respond(['error' => 'Komerce tidak merespons dengan benar.'], 502);
    }
    if ($status < 200 || $status >= 300) {
        $message = is_string($json['meta']['message'] ?? null) ? $json['meta']['message'] : 'Permintaan ke Komerce ditolak.';
        respond(['error' => $message], $status === 429 ? 429 : 502);
    }

    return $json;
}

function cartResponse(array $response): array
{
    $cart = $response['result'] ?? null;
    if (!is_array($cart) || !is_array($cart['items'] ?? null)) {
        throw new RuntimeException('FossBilling returned an invalid cart.');
    }

    $items = [];
    foreach ($cart['items'] as $item) {
        if (!is_array($item) || !is_scalar($item['id'] ?? null) || !is_string($item['title'] ?? null)) {
            continue;
        }
        $items[] = [
            'id' => (string) $item['id'],
            'product_id' => is_scalar($item['product_id'] ?? null) ? (string) $item['product_id'] : null,
            'title' => $item['title'],
            'period' => is_string($item['period'] ?? null) ? $item['period'] : null,
            'quantity' => is_numeric($item['quantity'] ?? null) ? (int) $item['quantity'] : 1,
            'price' => is_numeric($item['price'] ?? null) ? $item['price'] + 0 : null,
            'total' => is_numeric($item['total'] ?? null) ? $item['total'] + 0 : null,
        ];
    }

    $currency = $cart['currency']['code'] ?? null;

    return [
        'items' => $items,
        'total' => is_numeric($cart['total'] ?? null) ? $cart['total'] + 0 : 0,
        'currency' => is_string($currency) && preg_match('/^[A-Z]{3}$/', $currency) === 1 ? $currency : 'IDR',
    ];
}

function fetchHelpdesks(): array
{
    if (!function_exists('curl_init') || !class_exists('DOMDocument')) {
        throw new RuntimeException('Required PHP extensions are unavailable.');
    }

    $cookies = $_SESSION['fossbilling_cookies'] ?? [];
    $cookieHeader = [];
    foreach (['fossbilling_session', 'fossbilling_csrf'] as $name) {
        $value = is_array($cookies) ? ($cookies[$name] ?? null) : null;
        if (is_string($value) && $value !== '' && strlen($value) <= 4096
            && preg_match('/[\x00-\x20\x7f;,]/', $value) !== 1) {
            $cookieHeader[] = $name . '=' . $value;
        }
    }
    if (!isset($cookies['fossbilling_session']) || $cookieHeader === []) {
        throw new DomainException('Sesi FossBilling tidak valid. Silakan masuk kembali.', 401);
    }

    $body = '';
    $curl = curl_init(authBaseUrl() . '/support');
    if ($curl === false) {
        throw new RuntimeException('Unable to initialize FossBilling request.');
    }
    curl_setopt_array($curl, [
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_COOKIE => implode('; ', $cookieHeader),
        CURLOPT_HTTPHEADER => ['Accept: text/html'],
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > 2097152) {
                return 0;
            }
            $body .= $chunk;
            return strlen($chunk);
        },
    ]);
    $result = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if ($result === false) {
        throw new RuntimeException('FossBilling support page request failed.');
    }
    if ($status >= 300 && $status < 400 || $status === 401 || $status === 403) {
        throw new DomainException('Sesi FossBilling tidak valid. Silakan masuk kembali.', 401);
    }
    if ($status !== 200) {
        throw new RuntimeException('FossBilling support page returned HTTP ' . $status);
    }

    $document = new DOMDocument();
    $previous = libxml_use_internal_errors(true);
    $document->loadHTML('<?xml encoding="UTF-8">' . $body);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    $select = (new DOMXPath($document))->query('//select[@name="support_helpdesk_id"]')->item(0);
    if (!$select instanceof DOMElement) {
        throw new RuntimeException('Helpdesk select was not found.');
    }

    $helpdesks = [];
    foreach ($select->getElementsByTagName('option') as $option) {
        $helpdesks[] = [
            'value' => $option->getAttribute('value'),
            'label' => trim($option->textContent),
        ];
    }

    return $helpdesks;
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
    $response = callFossBillingClient('profile/get', []);
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

function fossbillingPublicUrl(): string
{
    $url = trim((string) getenv('FOSSBILLING_PUBLIC_URL'));
    if ($url === '') {
        // Fallback deployment default; env FOSSBILLING_PUBLIC_URL tetap diprioritaskan.
        $url = 'https://fossbilling.danijh.my.id';
    }

    return rtrim($url, '/');
}

function parsePaymentMethod(string $method): array
{
    [$methodType, $bankCode] = array_pad(explode(':', $method, 2), 2, '');
    $isGopay = $methodType === 'gopay';
    $isQris = $methodType === 'qris';
    $isVa = $methodType === 'va';

    if (!$isGopay && !$isQris && !$isVa) {
        respond(['error' => 'Metode ini belum tersedia. Pilih bank Virtual Account atau QRIS.'], 422);
    }
    if ($isVa && ($bankCode === '' || $bankCode === null)) {
        respond(['error' => 'Pilih bank Virtual Account terlebih dahulu.'], 422);
    }

    return [$methodType, $bankCode, $isGopay, $isQris, $isVa];
}

function currentFossClientId(): int
{
    $id = $_SESSION['fossbilling_client']['id'] ?? null;

    return is_scalar($id) ? (int) $id : 0;
}

function nextcloudConfig(): array
{
    static $config = null;
    if ($config === null) {
        $file = dirname(__DIR__, 2) . '/storage/nextcloud.php';
        $config = is_file($file) ? (array) include $file : [];
        $config += [
            'url' => 'https://nextcloud.local',
            'admin_user' => 'admin',
            'admin_app_password' => '',
            'verify_tls' => true,
            'product_groups' => [],
            'products' => [],
        ];
    }

    return $config;
}

function fossProductConfigs(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $cache = [];
    $token = trim((string) getenv('FOSSBILLING_ADMIN_TOKEN'));
    if ($token === '' || !function_exists('curl_init')) {
        return $cache;
    }
    $baseUrl = rtrim(trim(getenv('FOSSBILLING_BASE_URL') ?: 'http://localhost:8086'), '/');
    $curl = curl_init($baseUrl . '/api/admin/product/get_list');
    if ($curl === false) {
        return $cache;
    }
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_POST => true,
        CURLOPT_USERPWD => 'admin:' . $token,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['per_page' => 100]),
    ]);
    $body = curl_exec($curl);
    curl_close($curl);
    $json = is_string($body) ? json_decode($body, true) : null;
    $list = $json['result']['list'] ?? null;
    if (!is_array($list)) {
        return $cache;
    }
    foreach ($list as $product) {
        if (!is_array($product) || !isset($product['id'])) {
            continue;
        }
        $cache[(string) $product['id']] = $product;
    }

    return $cache;
}

function storageProductInfo(array $order): ?array
{
    $productId = isset($order['product_id']) ? (string) $order['product_id'] : null;

    // Sumber utama: config produk di FossBilling admin API.
    // Field yang dikenali di product.config:
    //   storage            — kuota, mis. "100 GB" (wajib untuk produk storage)
    //   storage_group      — grup Nextcloud (default: slug produk)
    //   storage_bucket     — prefix bucket S3 (default: slug produk)
    //   storage_mount      — nama mount/folder (default: judul produk)
    //   storage_grace_hours— grace period setelah expired (default: 720)
    if ($productId !== null) {
        $fbProduct = fossProductConfigs()[$productId] ?? null;
        if (is_array($fbProduct)) {
            $fbConfig = is_array($fbProduct['config'] ?? null) ? $fbProduct['config'] : [];
            $quota = $fbConfig['storage'] ?? null;
            if ((is_string($quota) || is_int($quota) || is_float($quota)) && trim((string) $quota) !== '') {
                $slug = trim((string) ($fbProduct['slug'] ?? ''));
                $title = trim((string) ($fbProduct['title'] ?? ''));
                $group = isset($fbConfig['storage_group']) && trim((string) $fbConfig['storage_group']) !== ''
                    ? trim((string) $fbConfig['storage_group']) : $slug;
                $bucket = isset($fbConfig['storage_bucket']) && trim((string) $fbConfig['storage_bucket']) !== ''
                    ? trim((string) $fbConfig['storage_bucket']) : $slug;
                $mount = isset($fbConfig['storage_mount']) && trim((string) $fbConfig['storage_mount']) !== ''
                    ? trim((string) $fbConfig['storage_mount']) : $title;
                if ($group !== '' && $bucket !== '' && $mount !== '') {
                    $info = [
                        'group' => $group,
                        'bucket' => $bucket,
                        'mount' => $mount,
                        'quota' => trim((string) $quota),
                    ];
                    if (isset($fbConfig['storage_grace_hours'])
                        && is_numeric($fbConfig['storage_grace_hours'])) {
                        $info['grace_hours'] = (float) $fbConfig['storage_grace_hours'];
                    }
                    $info['quota_bytes'] = storageQuotaBytes($info['quota']);
                    return $info;
                }
            }
        }
    }

    // Fallback: map manual di storage/nextcloud.php.
    $products = nextcloudConfig()['products'];
    if (!is_array($products) || $products === []) {
        return null;
    }

    $title = isset($order['title']) && is_string($order['title'])
        ? mb_strtolower(trim($order['title']))
        : null;

    foreach ($products as $key => $info) {
        if (!is_array($info)) {
            continue;
        }
        $normalizedKey = is_int($key)
            ? (string) $key
            : mb_strtolower(trim((string) $key));
        if (($productId !== null && $normalizedKey === $productId)
            || ($title !== null && $normalizedKey === $title)) {
            $info['quota_bytes'] = storageQuotaBytes($info['quota'] ?? null);
            return $info;
        }
    }

    return null;
}

function storageQuotaBytes($quota): int
{
    if (!is_string($quota) && !is_int($quota) && !is_float($quota)) {
        return 0;
    }
    if (preg_match('/^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb|kib|mib|gib|tib)?\s*$/i', (string) $quota, $m) !== 1) {
        return 0;
    }
    $unit = strtolower($m[2] ?? 'b');
    $factor = match ($unit) {
        'tb', 'tib' => 1099511627776,
        'gb', 'gib' => 1073741824,
        'mb', 'mib' => 1048576,
        'kb', 'kib' => 1024,
        default => 1,
    };

    return (int) round(((float) $m[1]) * $factor);
}


function nextcloudOcs(string $method, string $path, ?string $query = null): array
{
    $config = nextcloudConfig();
    $password = trim((string) $config['admin_app_password']);
    if ($password === '') {
        throw new DomainException('Nextcloud admin belum dikonfigurasi (NEXTCLOUD_ADMIN_APP_PASSWORD).', 503);
    }
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is unavailable.');
    }

    $verifyTls = (bool) $config['verify_tls'];
    $isRead = in_array(strtoupper($method), ['GET', 'HEAD'], true);
    $url = rtrim((string) $config['url'], '/') . '/ocs/v1.php/' . ltrim($path, '/') . '?format=json';
    if ($isRead && $query !== null && $query !== '') {
        $url .= '&' . ltrim($query, '&');
    }

    $curl = curl_init($url);
    if ($curl === false) {
        throw new RuntimeException('Unable to initialize Nextcloud request.');
    }
    curl_setopt_array($curl, [
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_USERPWD => $config['admin_user'] . ':' . $password,
        CURLOPT_HTTPHEADER => ['OCS-APIRequest: true', 'Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => $verifyTls,
        CURLOPT_SSL_VERIFYHOST => $verifyTls ? 2 : 0,
        CURLOPT_RETURNTRANSFER => true,
    ]);
    if (!$isRead && $query !== null) {
        curl_setopt($curl, CURLOPT_POSTFIELDS, $query);
    }

    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if ($raw === false) {
        throw new RuntimeException('Nextcloud tidak dapat dihubungi: ' . $curlError);
    }
    $data = json_decode((string) $raw, true);
    if (!is_array($data) || !isset($data['ocs']['data'])) {
        throw new RuntimeException('Nextcloud API error (HTTP ' . $status . ').');
    }
    $meta = is_array($data['ocs']['meta'] ?? null) ? $data['ocs']['meta'] : [];
    if ((int) ($meta['statuscode'] ?? 200) >= 400) {
        throw new RuntimeException('Nextcloud API: ' . (string) ($meta['message'] ?? 'request gagal'));
    }

    return $data['ocs']['data'];
}

function nextcloudSyncClientStorage(array $activeOrders, ?int $clientId = null): array
{
    $clientId = $clientId ?? currentFossClientId();
    if ($clientId <= 0) {
        return ['configured' => false, 'groups' => [], 'quota' => null];
    }
    $config = nextcloudConfig();
    $managedGroups = array_values(array_filter(array_map('strval', (array) ($config['product_groups'] ?? []))));
    // Sertakan grup dari produk storage di FossBilling agar produk baru
    // langsung dikelola tanpa update file config.
    foreach (fossProductConfigs() as $fbProduct) {
        if (!is_array($fbProduct)) {
            continue;
        }
        $fbConfig = is_array($fbProduct['config'] ?? null) ? $fbProduct['config'] : [];
        $quota = $fbConfig['storage'] ?? null;
        if (!is_scalar($quota) || trim((string) $quota) === '') {
            continue;
        }
        $group = isset($fbConfig['storage_group']) && trim((string) $fbConfig['storage_group']) !== ''
            ? trim((string) $fbConfig['storage_group'])
            : trim((string) ($fbProduct['slug'] ?? ''));
        if ($group !== '') {
            $managedGroups[] = $group;
        }
    }
    $managedGroups = array_values(array_unique($managedGroups));
    $ncUser = 'fb_' . $clientId;

    $desiredGroups = [];
    $matched = false;
    foreach ($activeOrders as $order) {
        $info = storageProductInfo($order);
        if ($info === null) {
            continue;
        }
        $matched = true;
        if (is_string($info['group'] ?? null) && $info['group'] !== '') {
            $desiredGroups[] = $info['group'];
        }
    }
    $desiredGroups = array_values(array_unique($desiredGroups));

    // Nextcloud 35 mewajibkan password confirmation untuk mengubah grup/kuota
    // via Provisioning API, jadi mutasi dilakukan script provisioning lewat
    // occ (jalan sebagai www-data). Di sini kita hanya menghitung state
    // keinginan lalu menuliskannya ke spec.
    $homeQuota = trim((string) ($config['home_quota'] ?? '0 B'));
    if ($homeQuota === '') {
        $homeQuota = '0 B';
    }

    $user = null;
    try {
        $user = nextcloudOcs('GET', 'cloud/users/' . rawurlencode($ncUser));
    } catch (Throwable $error) {
        error_log('Nextcloud user info error ' . $ncUser . ': ' . $error->getMessage());
    }
    $currentGroups = is_array($user) ? array_values(array_map('strval', (array) ($user['groups'] ?? []))) : [];
    $kept = array_values(array_diff($currentGroups, $managedGroups));
    $newGroups = array_values(array_unique(array_merge($kept, array_intersect($desiredGroups, $managedGroups))));

    $specFile = dirname(__DIR__, 2) . '/storage/nextcloud-mounts.json';
    $spec = is_file($specFile) ? json_decode((string) @file_get_contents($specFile), true) : null;
    if (is_array($spec)) {
        if (!is_array($spec['users'][$ncUser] ?? null)) {
            $spec['users'][$ncUser] = [
                'mounts' => [],
                'retained_buckets' => [],
                'decommission_buckets' => [],
            ];
        }
        $spec['users'][$ncUser]['groups'] = $desiredGroups;
        $spec['users'][$ncUser]['home_quota'] = $homeQuota;
        $spec['managed_groups'] = $managedGroups;
        $tmp = $specFile . '.tmp';
        $payload = json_encode($spec, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if (@file_put_contents($tmp, $payload, LOCK_EX) !== false) {
            @rename($tmp, $specFile);
        }
    }

    return [
        'configured' => $matched || trim((string) nextcloudConfig()['admin_app_password']) !== '',
        'groups' => $newGroups,
        'quota' => is_array($user['quota'] ?? null) ? $user['quota'] : null,
    ];
}

function writeNextcloudMountSpec(array $orders, ?int $clientId = null): void
{
    $clientId = $clientId ?? currentFossClientId();
    if ($clientId <= 0) {
        return;
    }
    $ncUser = 'fb_' . $clientId;
    $now = time();
    $startOfToday = strtotime('today');

    // bucket => state: mount (aktif) > retained (grace) > decommission
    $mounts = [];
    $retained = [];
    $decommission = [];
    foreach ($orders as $order) {
        $info = storageProductInfo($order);
        if ($info === null || !is_string($info['group'] ?? null) || $info['group'] === '') {
            continue;
        }
        $bucketBase = is_string($info['bucket'] ?? null) && $info['bucket'] !== '' ? $info['bucket'] : $info['group'];
        $bucket = $bucketBase . '-' . $clientId;

        $status = strtolower((string) ($order['status'] ?? ''));
        $expiresAt = $order['expires_at'] ?? null;
        $expiry = is_string($expiresAt) && $expiresAt !== '' ? strtotime($expiresAt) : null;
        $isActive = in_array($status, ['active', 'paid'], true)
            && ($expiry === null || $expiry >= $startOfToday);

        if ($isActive) {
            $name = is_string($info['mount'] ?? null) && $info['mount'] !== '' ? $info['mount'] : $info['group'];
            $mounts[$bucket] = [
                'name' => $name,
                'group' => $info['group'],
                'bucket' => $bucket,
                'credentials_key' => $ncUser,
                'expires_at' => is_string($expiresAt) ? $expiresAt : null,
            ];
            unset($retained[$bucket], $decommission[$bucket]);
            continue;
        }
        if (isset($mounts[$bucket]) || isset($retained[$bucket]) || isset($decommission[$bucket])) {
            continue;
        }

        // order non-aktif: tentukan akhir grace period
        $anchor = $expiry;
        if ($anchor === null) {
            $anchorCandidate = $order['canceled_at'] ?? $order['created_at'] ?? null;
            $anchor = is_string($anchorCandidate) && $anchorCandidate !== '' ? strtotime($anchorCandidate) : $now;
        }
        $graceHours = (float) ($info['grace_hours'] ?? 720);
        if ($anchor + $graceHours * 3600 > $now) {
            $retained[$bucket] = $bucket;
        } else {
            $decommission[$bucket] = $bucket;
        }
    }

    $dir = dirname(__DIR__, 2) . '/storage';
    if (!is_dir($dir)) {
        @mkdir($dir, 0770, true);
    }
    $file = $dir . '/nextcloud-mounts.json';
    $existing = is_file($file) ? json_decode((string) @file_get_contents($file), true) : null;
    $all = is_array($existing) && is_array($existing['users'] ?? null) ? $existing['users'] : [];

    $entry = array_merge(is_array($all[$ncUser] ?? null) ? $all[$ncUser] : [], [
        'mounts' => array_values($mounts),
        'retained_buckets' => array_values($retained),
        'decommission_buckets' => array_values($decommission),
    ]);
    $hadEntry = isset($all[$ncUser]);
    if ($entry['mounts'] !== [] || $entry['retained_buckets'] !== [] || $entry['decommission_buckets'] !== [] || $hadEntry) {
        $all[$ncUser] = $entry;
    } else {
        unset($all[$ncUser]);
    }
    $tmp = $file . '.tmp';
    // Pertahankan key top-level lain (mis. managed_groups) yang ditulis
    // nextcloudSyncClientStorage.
    $payload = json_encode(array_merge(is_array($existing) ? $existing : [], [
        's3' => is_array(nextcloudConfig()['s3'] ?? null) ? nextcloudConfig()['s3'] : [],
        'users' => $all,
    ]), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if (@file_put_contents($tmp, $payload, LOCK_EX) !== false) {
        @rename($tmp, $file);
    }
}

function clientPaymentsFilePath(int $clientId): string
{
    return dirname(__DIR__, 2) . '/storage/payments/' . $clientId . '.json';
}

function readStoredClientPayments(): array
{
    $clientId = currentFossClientId();
    if ($clientId <= 0) {
        return [];
    }
    $file = clientPaymentsFilePath($clientId);
    $data = is_file($file) ? json_decode((string) @file_get_contents($file), true) : null;
    $payments = is_array($data) && is_array($data['payments'] ?? null) ? $data['payments'] : [];
    $result = [];
    foreach ($payments as $paymentId => $entry) {
        if (is_string($paymentId) && is_array($entry)) {
            $result[$paymentId] = $entry;
        }
    }

    return $result;
}

function writeStoredClientPayment(string $paymentId, array $entry): void
{
    $clientId = currentFossClientId();
    if ($clientId <= 0 || preg_match('#^[A-Za-z0-9._/-]{1,100}$#', $paymentId) !== 1) {
        return;
    }
    if (!is_int($entry['created_at'] ?? null)) {
        $entry['created_at'] = time();
    }

    $payments = readStoredClientPayments();
    // Pangkas entri yang sudah sangat lama — pembayaran gateway tidak berlaku selama itu.
    $cutoff = time() - 30 * 86400;
    foreach ($payments as $existingId => $existing) {
        $created = is_int($existing['created_at'] ?? null) ? $existing['created_at'] : 0;
        if ($created > 0 && $created < $cutoff) {
            unset($payments[$existingId]);
        }
    }
    $payments[$paymentId] = $entry;

    $file = clientPaymentsFilePath($clientId);
    $directory = dirname($file);
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        return;
    }
    $json = json_encode(['payments' => $payments], JSON_UNESCAPED_SLASHES);
    $tmp = $file . '.tmp.' . bin2hex(random_bytes(4));
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) {
        @unlink($tmp);
        return;
    }
    rename($tmp, $file);
}

// Simpan pembayaran gateway ke sesi DAN ke file akun, supaya status pembayaran
// (VA/QRIS) tetap bisa dibuka dari browser atau perangkat lain.
function storeKomercePayment(string $paymentId, array $entry): void
{
    $_SESSION['komerce_payments'][$paymentId] = $entry;
    writeStoredClientPayment($paymentId, $entry);
}

function hydrateKomercePayment(string $paymentId): void
{
    if (isset($_SESSION['komerce_payments'][$paymentId]) && is_array($_SESSION['komerce_payments'][$paymentId])) {
        return;
    }
    $stored = readStoredClientPayments()[$paymentId] ?? null;
    if (is_array($stored)) {
        $_SESSION['komerce_payments'][$paymentId] = $stored;
    }
}

function mergeStoredClientPayments(): void
{
    foreach (readStoredClientPayments() as $paymentId => $entry) {
        if (!isset($_SESSION['komerce_payments'][$paymentId])) {
            $_SESSION['komerce_payments'][$paymentId] = $entry;
        }
    }
}

function markKomercePaymentSynced(string $paymentId): void
{
    $entry = $_SESSION['komerce_payments'][$paymentId] ?? null;
    if (!is_array($entry)) {
        $entry = readStoredClientPayments()[$paymentId] ?? null;
    }
    if (!is_array($entry)) {
        return;
    }
    $entry['synced'] = true;
    storeKomercePayment($paymentId, $entry);
}

function paymentExpiryTimestamp($value): ?int
{
    if (is_int($value)) {
        return $value;
    }
    if (is_string($value) && $value !== '') {
        if (preg_match('/^\d{9,11}$/', $value) === 1) {
            return (int) $value;
        }
        $time = strtotime($value);
        return $time === false ? null : $time;
    }

    return null;
}

function gatewayPaymentLiveStatus(string $paymentId, array $stored): ?array
{
    try {
        if (str_starts_with($paymentId, GOPAY_PREFIX)) {
            $query = ['qris_id' => substr($paymentId, strlen(GOPAY_PREFIX))];
            if (is_string($stored['trx_id'] ?? null) && $stored['trx_id'] !== '') {
                $query['trx_id'] = $stored['trx_id'];
            }
            $data = gopayRequest('GET', '/check-payment', $query);
            $payment = normalizeGopayStatus($data, $paymentId, null);

            return ['status' => $payment['status'], 'expired_at' => $payment['expired_at'], 'raw' => $data];
        }
        if (str_starts_with($paymentId, QRISLY_PREFIX)) {
            $data = komerceRequest('GET', '/api/v1/qrisly/payment-status/' . rawurlencode(substr($paymentId, strlen(QRISLY_PREFIX))))['data'] ?? null;
            if (!is_array($data)) {
                return null;
            }
            $payment = normalizeQrislyStatus($data, $paymentId, null);
            $expiredAt = $data['expiry_time'] ?? $data['expired_at'] ?? null;

            return ['status' => $payment['status'], 'expired_at' => is_string($expiredAt) ? $expiredAt : null, 'raw' => $data];
        }
        $data = komerceRequest('GET', '/api/v1/user/payment/status/' . rawurlencode($paymentId))['data'] ?? null;
        if (!is_array($data)) {
            return null;
        }
        $expiredAt = $data['expired_at'] ?? $data['expired_time'] ?? $data['expiry_time'] ?? null;

        return [
            'status' => strtoupper((string) ($data['status'] ?? '')),
            'expired_at' => is_string($expiredAt) || is_int($expiredAt) ? $expiredAt : null,
            'raw' => $data,
        ];
    } catch (Throwable) {
        return null;
    }
}

function qrisStringFromGatewayData(array $data): ?string
{
    foreach (['qris_string', 'qr_string', 'qris_code', 'qr_code', 'qris'] as $key) {
        $value = $data[$key] ?? null;
        if (is_string($value) && trim($value) !== '') {
            return $value;
        }
    }

    return null;
}

// Untuk entri lama yang belum menyimpan payload payment, susun ulang payload
// tampilan dari respons status gateway. Return null bila tidak memungkinkan.
// $bankCode kosong berarti tidak ada pilihan bank — verifikasi bank dilewati.
function legacyGatewayPaymentPayload(string $paymentId, array $stored, array $live, string $methodType, string $bankCode): ?array
{
    $raw = is_array($live['raw'] ?? null) ? $live['raw'] : [];
    $orderRef = is_string($stored['order_ref'] ?? null) ? $stored['order_ref'] : null;

    if (str_starts_with($paymentId, GOPAY_PREFIX)) {
        $qrisString = qrisStringFromGatewayData($raw);
        if ($qrisString === null) {
            return null;
        }

        return [
            'payment_id' => $paymentId,
            'payment_type' => 'gopay',
            'qris_string' => $qrisString,
            'amount' => $raw['total_amount'] ?? $raw['amount'] ?? null,
            'expired_at' => $live['expired_at'] ?? null,
            'status' => 'PENDING',
            'order_id' => $orderRef,
        ];
    }
    if (str_starts_with($paymentId, QRISLY_PREFIX)) {
        $qrisString = qrisStringFromGatewayData($raw);
        if ($qrisString === null) {
            return null;
        }

        return [
            'payment_id' => $paymentId,
            'payment_type' => 'qris',
            'qris_string' => $qrisString,
            'amount' => $raw['amount'] ?? $raw['final_amount'] ?? null,
            'expired_at' => $live['expired_at'] ?? null,
            'status' => 'PENDING',
            'order_id' => $orderRef,
        ];
    }
    // VA Komerce: respons status dipakai apa adanya, tapi bank harus cocok
    // dengan metode yang dipilih ulang oleh pengguna.
    $rawBank = $raw['bank_code'] ?? $raw['channel_code'] ?? $raw['bank'] ?? $raw['channel'] ?? $raw['payment_channel'] ?? $raw['va_bank'] ?? null;
    if ($bankCode !== '' && (!is_string($rawBank) || strtoupper($rawBank) !== strtoupper($bankCode))) {
        return null;
    }
    $payment = $raw;
    $payment['payment_id'] = $paymentId;
    $payment['status'] = 'PENDING';
    if ($live['expired_at'] !== null) {
        $payment['expired_at'] = $live['expired_at'];
    }

    return $payment;
}

// Cari pembayaran gateway yang masih PENDING untuk invoice + metode yang sama
// (sesi + file akun), supaya tombol Bayar melanjutkan pembayaran lama alih-alih
// membuat payment_id Komerce baru. Return null bila tidak ada yang masih berlaku.
function resumeInvoiceGatewayPayment(array $invoice, ?string $method = null): ?array
{
    mergeStoredClientPayments();
    $payments = $_SESSION['komerce_payments'] ?? null;
    if (!is_array($payments)) {
        return null;
    }
    $invoiceId = (int) $invoice['id'];
    // $method null = resume pembayaran pending apa pun untuk invoice ini.
    [$methodType, $bankCode] = $method !== null ? parsePaymentMethod($method) : [null, ''];

    foreach (array_reverse($payments, true) as $paymentId => $stored) {
        if (!is_string($paymentId) || !is_array($stored)
            || (int) ($stored['invoice_id'] ?? 0) !== $invoiceId
            || !empty($stored['synced'])) {
            continue;
        }

        $storedMethod = $stored['method'] ?? null;
        $isLegacy = $storedMethod === null;
        if ($method !== null && !$isLegacy && $storedMethod !== $method) {
            continue;
        }
        // Tipe/metode kandidat untuk payload legacy & penyimpanan ulang.
        $candidateType = str_starts_with($paymentId, GOPAY_PREFIX) ? 'gopay'
            : (str_starts_with($paymentId, QRISLY_PREFIX) ? 'qris' : 'va');
        $candidateBank = '';
        if ($method !== null) {
            if ($isLegacy) {
                // Entri lama tanpa method: cocokkan lewat prefix payment_id;
                // untuk VA bank diverifikasi dari respons status gateway.
                if ($candidateType === 'gopay' && $methodType !== 'gopay') {
                    continue;
                }
                if ($candidateType === 'qris' && $methodType !== 'qris') {
                    continue;
                }
                if ($candidateType === 'va' && $methodType !== 'va') {
                    continue;
                }
                $candidateBank = $bankCode;
            }
        }

        $payment = is_array($stored['payment'] ?? null) ? $stored['payment'] : null;
        if ($payment !== null && !is_string($payment['payment_id'] ?? null)) {
            $payment = null;
        }

        // Buang kandidat yang jelas sudah kedaluwarsa sebelum memanggil gateway.
        if ($payment !== null) {
            $expired = false;
            $expiryTime = paymentExpiryTimestamp($payment['expired_at'] ?? null);
            if ($expiryTime !== null) {
                $expired = $expiryTime <= time();
            }
            if (!$expired && is_int($stored['created_at'] ?? null)
                && !str_starts_with($paymentId, GOPAY_PREFIX)
                && !str_starts_with($paymentId, QRISLY_PREFIX)) {
                // VA Komerce dibuat dengan expiry_duration 86400 detik.
                $expired = $stored['created_at'] + 86400 <= time();
            }
            if ($expired) {
                continue;
            }
        }

        $live = gatewayPaymentLiveStatus($paymentId, $stored);
        if ($live === null || $live['status'] !== 'PENDING') {
            continue;
        }
        $expiryTime = paymentExpiryTimestamp($live['expired_at'] ?? null);
        if ($expiryTime !== null && $expiryTime <= time()) {
            continue;
        }

        if ($payment === null) {
            $payment = legacyGatewayPaymentPayload($paymentId, $stored, $live, $candidateType, $candidateBank);
            if ($payment === null) {
                continue;
            }
        }
        $payment['status'] = 'PENDING';
        if ($live['expired_at'] !== null) {
            $payment['expired_at'] = $live['expired_at'];
        }

        // Lengkapi entri lama agar berikutnya bisa di-resume dari perangkat lain.
        if ($isLegacy || !is_int($stored['created_at'] ?? null) || !is_string($stored['method'] ?? null)) {
            $resolvedMethod = $method;
            if ($resolvedMethod === null) {
                if ($candidateType === 'va') {
                    $payBank = strtoupper((string) ($payment['bank_code'] ?? $payment['channel_code'] ?? $payment['bank'] ?? $payment['channel'] ?? $payment['va_bank'] ?? ''));
                    $resolvedMethod = $payBank !== '' ? 'va:' . $payBank : null;
                } else {
                    $resolvedMethod = $candidateType . ':';
                }
            }
            if ($resolvedMethod !== null) {
                $stored['method'] = $resolvedMethod;
            }
            $stored['created_at'] = is_int($stored['created_at'] ?? null) ? $stored['created_at'] : time();
            $stored['payment'] = $payment;
            storeKomercePayment($paymentId, $stored);
        }

        return [
            'payment' => $payment,
            'invoice' => ['id' => $invoiceId, 'total' => (int) round((float) ($invoice['total'] ?? 0))],
            'error' => null,
            'resumed' => true,
        ];
    }

    return null;
}

function respondInvoiceGatewayPayment(array $invoice, string $method, array $extra = []): never
{
    [$methodType, $bankCode, $isGopay, $isQris, $isVa] = parsePaymentMethod($method);

    $profile = callFossBillingClient('profile/get', [])['result'] ?? null;
    $phone = preg_replace('/[^0-9]/', '', (string) ($profile['phone'] ?? ''));
    $phoneCc = preg_replace('/[^0-9]/', '', (string) ($profile['phone_cc'] ?? ''));
    if ($phone !== '' && $phone[0] !== '0') {
        $phone = ($phoneCc === '62' || $phoneCc === '') ? '0' . $phone : '+' . $phoneCc . $phone;
    }
    if ($phone === '') {
        respond(['error' => 'Lengkapi nomor telepon di menu Profil sebelum melakukan pembayaran.'], 422);
    }
    if (preg_match('/^[0-9]{5,15}$/', preg_replace('/[^0-9]/', '', $phone)) !== 1) {
        respond(['error' => 'Format nomor telepon di profil tidak valid.'], 422);
    }

    // Cari gateway ID Komerce dari FossBilling (sama seperti flow checkout)
    $gateways = callFossBillingClient('invoice/gateways', [], 'guest')['result'] ?? [];
    $gatewayId = null;
    foreach (is_array($gateways) ? $gateways : [] as $gateway) {
        if (is_array($gateway) && ($gateway['code'] ?? null) === 'Komerce' && is_scalar($gateway['id'] ?? null)) {
            $gatewayId = (int) $gateway['id'];
        }
    }
    if (!$isGopay && $gatewayId === null) {
        respond(['error' => 'Gateway pembayaran Komerce belum aktif di sistem.'], 503);
    }

    // Validasi bank VA tersedia di Komerce (khusus VA)
    if ($isVa) {
        $blockedBanks = ['BJB', 'SMBC', 'DBS'];
        if (in_array(strtoupper($bankCode), $blockedBanks, true)) {
            respond(['error' => 'Bank yang dipilih tidak tersedia.'], 422);
        }
        $available = komerceRequest('GET', '/api/v1/user/methods')['data'] ?? [];
        $validBank = false;
        foreach (is_array($available) ? $available : [] as $item) {
            if (is_array($item) && ($item['payment_type'] ?? null) === 'va' && strtoupper((string) ($item['bank_code'] ?? '')) === strtoupper($bankCode)) {
                $validBank = true;
            }
        }
        if (!$validBank) {
            respond(['error' => 'Bank yang dipilih tidak tersedia.'], 422);
        }
    }

    $invoiceTotal = (int) round((float) $invoice['total']);
    $vaFee = 4440;
    $fee = $isGopay ? 0 : ($isQris ? qrisFee($invoiceTotal) : $vaFee);
    $amount = $invoiceTotal + $fee;
    if ($amount < 10000) {
        respond(['error' => 'Nominal pembayaran minimal Rp 10.000.'], 422);
    }

    $invoiceNumber = is_string($invoice['serie_nr'] ?? null) && $invoice['serie_nr'] !== ''
        ? $invoice['serie_nr']
        : 'INV' . $invoice['id'];

    if ($isGopay) {
        $generated = gopayRequest('POST', '/create-qris', ['amount' => $amount, 'unique_code' => 'true']);
        $qris = is_array($generated['data'] ?? null) ? $generated['data'] : null;
        if ($qris === null || !is_string($qris['qris_id'] ?? null) || preg_match('/^[A-Za-z0-9._-]{1,64}$/', $qris['qris_id']) !== 1
            || !is_string($qris['qris_code'] ?? null) || $qris['qris_code'] === '') {
            throw new RuntimeException('Gateway QRIS GoPay mengembalikan respons yang tidak dikenali.');
        }
        $paymentId = GOPAY_PREFIX . $qris['qris_id'];
        $paymentPayload = [
            'payment_id' => $paymentId,
            'payment_type' => 'gopay',
            'qris_string' => $qris['qris_code'],
            'amount' => (int) ($qris['total_amount'] ?? $amount),
            'original_amount' => (int) ($qris['amount'] ?? $amount),
            'unique_code' => $qris['unique_code'] ?? null,
            'trx_id' => $qris['trx_id'] ?? null,
            'expired_at' => $qris['expires_at'] ?? null,
            'status' => 'PENDING',
            'order_id' => mb_substr($invoiceNumber, 0, 100),
        ];
        storeKomercePayment($paymentId, [
            'invoice_id' => (int) $invoice['id'],
            'order_id' => null,
            'order_ref' => mb_substr($invoiceNumber, 0, 100),
            'gateway_id' => 0,
            'trx_id' => is_string($qris['trx_id'] ?? null) ? $qris['trx_id'] : null,
            'method' => $method,
            'created_at' => time(),
            'payment' => $paymentPayload,
        ]);
        respond([
            'payment' => $paymentPayload,
            'invoice' => ['id' => (int) $invoice['id'], 'total' => $invoiceTotal],
            'error' => null,
        ] + $extra);
    }

    if ($isQris) {
        $qrisId = (int) (getenv('KOMERCE_QRIS_ID') ?: 1438);
        $generated = komerceRequest('POST', '/api/v1/qrisly/generate-qris', [
            'qris_id' => $qrisId,
            'amount' => $amount,
            'output_type' => 'string',
            'unique_amount' => true,
        ]);
        $qris = $generated['data'] ?? null;
        if (!is_array($qris) || !is_numeric($qris['history_id'] ?? null) || !is_string($qris['qris_string'] ?? null) || $qris['qris_string'] === '') {
            throw new RuntimeException('Komerce returned an unexpected QRIS response.');
        }
        $paymentId = QRISLY_PREFIX . (int) $qris['history_id'];
        $paymentPayload = [
            'payment_id' => $paymentId,
            'payment_type' => 'qris',
            'qris_string' => $qris['qris_string'],
            'amount' => (int) ($qris['final_amount'] ?? $amount),
            'original_amount' => (int) ($qris['original_amount'] ?? $amount),
            'expired_at' => $qris['expiry_time'] ?? null,
            'status' => 'PENDING',
            'order_id' => mb_substr($invoiceNumber, 0, 100),
        ];
        storeKomercePayment($paymentId, [
            'invoice_id' => (int) $invoice['id'],
            'order_id' => null,
            'order_ref' => mb_substr($invoiceNumber, 0, 100),
            'gateway_id' => $gatewayId,
            'method' => $method,
            'created_at' => time(),
            'payment' => $paymentPayload,
        ]);
        respond([
            'payment' => $paymentPayload,
            'invoice' => ['id' => (int) $invoice['id'], 'total' => $invoiceTotal],
            'error' => null,
        ] + $extra);
    }

    // Virtual Account
    $buyer = is_array($invoice['buyer'] ?? null) ? $invoice['buyer'] : [];
    $sessionClient = $_SESSION['fossbilling_client'] ?? [];
    $name = trim((string) ($buyer['first_name'] ?? '') . ' ' . (string) ($buyer['last_name'] ?? ''));
    if ($name === '') {
        $name = trim((string) ($sessionClient['first_name'] ?? '') . ' ' . (string) ($sessionClient['last_name'] ?? ''));
    }
    if ($name === '') {
        $name = (string) ($sessionClient['name'] ?? '');
    }
    $email = (string) ($buyer['email'] ?? ($sessionClient['email'] ?? ($_SESSION['fossbilling_client']['email'] ?? '')));
    $lines = is_array($invoice['lines'] ?? null) ? $invoice['lines'] : [];
    $items = [];
    foreach ($lines as $line) {
        if (!is_array($line)) {
            continue;
        }
        $lineTitle = mb_substr(trim((string) ($line['title'] ?? 'Item')), 0, 100);
        $items[] = [
            'name' => $lineTitle !== '' ? $lineTitle : 'Item',
            'quantity' => max(1, (int) ($line['quantity'] ?? 1)),
            'price' => (int) round((float) ($line['price'] ?? 0)),
        ];
    }
    if ($items === []) {
        $items[] = ['name' => mb_substr($invoiceNumber, 0, 100), 'quantity' => 1, 'price' => $invoiceTotal];
    }
    $items[] = ['name' => 'Biaya transaksi virtual account', 'quantity' => 1, 'price' => $vaFee];

    $payload = [
        'order_id' => mb_substr($invoiceNumber, 0, 100),
        'payment_type' => 'bank_transfer',
        'channel_code' => $bankCode,
        'amount' => $amount,
        'customer' => [
            'name' => $name !== '' ? $name : 'Pelanggan',
            'email' => $email,
            'phone' => $phone,
        ],
        'items' => $items,
        'expiry_duration' => 86400,
    ];

    $publicUrl = fossbillingPublicUrl();
    if ($publicUrl !== '' && preg_match('#^https://#', $publicUrl) === 1) {
        $payload['callback_url'] = $publicUrl . '/ipn.php?' . http_build_query(['gateway_id' => $gatewayId, 'invoice_id' => (int) $invoice['id']]);
        $payload['callback_api_key'] = hash_hmac('sha256', 'komerce-callback', trim((string) getenv('KOMERCE_API_KEY')));
    }

    $created = komerceRequest('POST', '/api/v1/user/payment/create', $payload);
    $payment = $created['data'] ?? null;
    $paymentId = is_array($payment) ? ($payment['payment_id'] ?? null) : null;
    if (!is_string($paymentId) || preg_match('#^[A-Za-z0-9._/-]{1,100}$#', $paymentId) !== 1) {
        throw new RuntimeException('Komerce returned an unexpected payment response.');
    }
    storeKomercePayment($paymentId, [
        'invoice_id' => (int) $invoice['id'],
        'order_id' => null,
        'order_ref' => mb_substr($invoiceNumber, 0, 100),
        'gateway_id' => $gatewayId,
        'method' => $method,
        'created_at' => time(),
        'payment' => is_array($payment) ? $payment : [],
    ]);

    respond(['payment' => $payment, 'invoice' => ['id' => (int) $invoice['id'], 'total' => $invoiceTotal], 'error' => null] + $extra);
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

if ($action === 'services' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    try {
        $response = callFossBillingClient('order/get_list', ['per_page' => 100]);
        $list = $response['result']['list'] ?? null;
        if (!is_array($list)) {
            throw new RuntimeException('FossBilling returned an invalid order list.');
        }

        $orders = [];
        foreach ($list as $order) {
            if (!is_array($order)
                || (!is_int($order['id'] ?? null) && !is_string($order['id'] ?? null))
                || trim((string) $order['id']) === ''
                || !is_string($order['title'] ?? null)
                || !is_string($order['status'] ?? null)
                || (isset($order['currency']) && !is_string($order['currency']))
                || (isset($order['price'])
                    && ((!is_string($order['price'])
                            && !is_int($order['price'])
                            && !is_float($order['price']))
                        || !is_numeric((string) $order['price'])))
                || (isset($order['period']) && !is_string($order['period']))
                || (isset($order['expires_at']) && !is_string($order['expires_at']))
                || (isset($order['product_id']) && !is_scalar($order['product_id']))
                || (isset($order['activated_at']) && !is_string($order['activated_at']))
                || (isset($order['created_at']) && !is_string($order['created_at']))
                || (isset($order['canceled_at']) && !is_string($order['canceled_at']))
                || (isset($order['reason']) && !is_string($order['reason']))
                || (isset($order['notes']) && !is_string($order['notes']))
                || (isset($order['service_type']) && !is_string($order['service_type']))
                || (isset($order['unpaid_invoice_id']) && !is_scalar($order['unpaid_invoice_id']))
                || (isset($order['active_tickets'])
                    && !is_int($order['active_tickets'])
                    && !(is_string($order['active_tickets']) && ctype_digit($order['active_tickets'])))
                || (isset($order['total'])
                    && ((!is_string($order['total'])
                            && !is_int($order['total'])
                            && !is_float($order['total']))
                        || !is_numeric((string) $order['total'])))) {
                throw new RuntimeException('FossBilling returned an invalid order record.');
            }

            $orders[] = [
                'id' => (string) $order['id'],
                'title' => $order['title'],
                'status' => $order['status'],
                'currency' => $order['currency'] ?? null,
                'price' => $order['price'] ?? null,
                'period' => $order['period'] ?? null,
                'expires_at' => $order['expires_at'] ?? null,
                'product_id' => isset($order['product_id']) ? (string) $order['product_id'] : null,
                'activated_at' => $order['activated_at'] ?? null,
                'created_at' => $order['created_at'] ?? null,
                'canceled_at' => $order['canceled_at'] ?? null,
                'reason' => $order['reason'] ?? null,
                'notes' => $order['notes'] ?? null,
                'service_type' => $order['service_type'] ?? null,
                'unpaid_invoice_id' => isset($order['unpaid_invoice_id']) ? (string) $order['unpaid_invoice_id'] : null,
                'active_tickets' => isset($order['active_tickets']) ? (int) $order['active_tickets'] : 0,
                'total' => $order['total'] ?? null,
                'storage' => storageProductInfo($order),
            ];
        }

        $activeForStorage = array_values(array_filter($orders, static function (array $order): bool {
            if (!in_array($order['status'], ['active', 'paid'], true)) {
                return false;
            }
            $expiresAt = $order['expires_at'] ?? null;
            return !is_string($expiresAt) || $expiresAt === '' || strtotime($expiresAt) > time();
        }));
        try {
            writeNextcloudMountSpec($orders);
        } catch (Throwable $error) {
            error_log('Nextcloud mount spec error: ' . $error->getMessage());
        }
        $storageSummary = null;
        try {
            $storageSummary = nextcloudSyncClientStorage($activeForStorage);
        } catch (Throwable $error) {
            error_log('Nextcloud storage sync error: ' . $error->getMessage());
        }

        respond(['orders' => $orders, 'storage' => $storageSummary]);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling order API error: ' . $error->getMessage());
        respond(['error' => 'Daftar layanan tidak dapat dimuat dari server akun. Coba lagi nanti.'], 502);
    }
}

// Refresh storage spec untuk SEMUA client FossBilling — dipakai cron/admin
// job agar paket expired tetap dicabut tanpa menunggu user login.
// Akses: GET ?action=storage-refresh&token=<FOSSBILLING_ADMIN_TOKEN>
// Opsional: &client_id=<id> untuk refresh satu client saja.
if ($action === 'storage-refresh' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $adminToken = trim((string) getenv('FOSSBILLING_ADMIN_TOKEN'));
    // Header diprioritaskan agar token tidak tercatat di access log web server.
    $givenToken = (string) ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? $_GET['token'] ?? '');
    if ($adminToken === '' || $givenToken === '' || !hash_equals($adminToken, $givenToken)) {
        respond(['error' => 'Token tidak valid.'], 403);
    }

    $onlyClientId = isset($_GET['client_id']) && ctype_digit((string) $_GET['client_id'])
        ? (int) $_GET['client_id'] : null;

    // Kumpulkan semua order admin, dikelompokkan per client_id.
    $ordersByClient = [];
    $page = 1;
    $perPage = 100;
    $maxPages = 100;
    while ($page <= $maxPages) {
        $response = callFossBillingAdmin('order/get_list', [
            'per_page' => $perPage,
            'page' => $page,
        ]);
        $list = $response['result']['list'] ?? null;
        if (!is_array($list) || $list === []) {
            break;
        }
        foreach ($list as $order) {
            if (!is_array($order)) {
                continue;
            }
            $cid = $order['client_id'] ?? null;
            if ($cid === null || !is_numeric($cid)) {
                continue;
            }
            $cid = (int) $cid;
            if ($onlyClientId !== null && $cid !== $onlyClientId) {
                continue;
            }
            $ordersByClient[$cid][] = $order;
        }
        if (count($list) < $perPage) {
            break;
        }
        $page++;
    }

    $processed = 0;
    $errors = 0;
    foreach ($ordersByClient as $cid => $clientOrders) {
        try {
            writeNextcloudMountSpec($clientOrders, $cid);
        } catch (Throwable $error) {
            $errors++;
            error_log('storage-refresh spec error client ' . $cid . ': ' . $error->getMessage());
        }
        $activeForStorage = array_values(array_filter($clientOrders, static function (array $order): bool {
            if (!in_array(strtolower((string) ($order['status'] ?? '')), ['active', 'paid'], true)) {
                return false;
            }
            $expiresAt = $order['expires_at'] ?? null;
            return !is_string($expiresAt) || $expiresAt === '' || strtotime($expiresAt) > time();
        }));
        try {
            nextcloudSyncClientStorage($activeForStorage, $cid);
        } catch (Throwable $error) {
            $errors++;
            error_log('storage-refresh sync error client ' . $cid . ': ' . $error->getMessage());
        }
        $processed++;
    }

    respond([
        'ok' => true,
        'clients' => $processed,
        'errors' => $errors,
        'orders_seen' => array_sum(array_map('count', $ordersByClient)),
    ]);
}

if ($action === 'invoices' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    try {
        $response = callFossBillingClient('invoice/get_list', ['per_page' => 100]);
        $list = $response['result']['list'] ?? null;
        if (!is_array($list)) {
            throw new RuntimeException('FossBilling returned an invalid invoice list.');
        }

        $invoices = [];
        foreach ($list as $invoice) {
            if (!is_array($invoice)
                || (!is_int($invoice['id'] ?? null) && !is_string($invoice['id'] ?? null))
                || trim((string) $invoice['id']) === ''
                || !is_string($invoice['status'] ?? null)
                || (isset($invoice['currency']) && !is_string($invoice['currency']))
                || (isset($invoice['total']) && !is_numeric($invoice['total']))
                || (isset($invoice['due_at']) && !is_string($invoice['due_at']))
                || (isset($invoice['paid_at']) && !is_string($invoice['paid_at']))
                || (isset($invoice['created_at']) && !is_string($invoice['created_at']))) {
                throw new RuntimeException('FossBilling returned an invalid invoice record.');
            }

            $status = strtolower(trim($invoice['status']));
            if ($status === '') {
                throw new RuntimeException('FossBilling returned an invalid invoice status.');
            }

            $lines = is_array($invoice['lines'] ?? null) ? $invoice['lines'] : [];
            $titles = [];
            $period = null;
            foreach ($lines as $line) {
                if (!is_array($line)) {
                    continue;
                }
                $title = trim((string) ($line['title'] ?? ''));
                if ($title !== '') {
                    $titles[] = $title;
                }
                if ($period === null && is_string($line['period'] ?? null) && $line['period'] !== '') {
                    $period = $line['period'];
                }
            }

            $invoices[] = [
                'id' => (string) $invoice['id'],
                'number' => is_string($invoice['serie_nr'] ?? null) && $invoice['serie_nr'] !== ''
                    ? $invoice['serie_nr']
                    : (string) $invoice['id'],
                'status' => $status,
                'currency' => is_string($invoice['currency'] ?? null) ? strtoupper($invoice['currency']) : null,
                'total' => is_numeric($invoice['total'] ?? null) ? (float) $invoice['total'] : null,
                'subtotal' => is_numeric($invoice['subtotal'] ?? null) ? (float) $invoice['subtotal'] : null,
                'due_at' => is_string($invoice['due_at'] ?? null) && $invoice['due_at'] !== '' ? $invoice['due_at'] : null,
                'paid_at' => is_string($invoice['paid_at'] ?? null) && $invoice['paid_at'] !== '' ? $invoice['paid_at'] : null,
                'created_at' => is_string($invoice['created_at'] ?? null) && $invoice['created_at'] !== '' ? $invoice['created_at'] : null,
                'period' => $period,
                'title' => $titles === [] ? null : implode(', ', array_slice($titles, 0, 3)),
            ];
        }

        respond(['invoices' => $invoices]);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling invoice API error: ' . $error->getMessage());
        respond(['error' => 'Daftar tagihan tidak dapat dimuat dari server akun. Coba lagi nanti.'], 502);
    }
}

if ($action === 'wallet' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    try {
        $totalResponse = callFossBillingClient('client/balance_get_total', []);
        $balance = $totalResponse['result'] ?? null;
        if ((!is_int($balance) && !is_float($balance) && !is_string($balance))
            || !is_numeric((string) $balance)) {
            throw new RuntimeException('FossBilling returned an invalid balance.');
        }

        $listResponse = callFossBillingClient('client/balance_get_list', ['per_page' => 50]);
        $list = $listResponse['result']['list'] ?? null;
        if (!is_array($list)) {
            throw new RuntimeException('FossBilling returned an invalid balance list.');
        }

        $transactions = [];
        $currency = null;
        foreach ($list as $entry) {
            if (!is_array($entry)
                || (!is_int($entry['id'] ?? null) && !is_string($entry['id'] ?? null))
                || trim((string) $entry['id']) === ''
                || !is_numeric($entry['amount'] ?? null)
                || !is_string($entry['created_at'] ?? null)) {
                throw new RuntimeException('FossBilling returned an invalid balance record.');
            }
            $entryCurrency = is_string($entry['currency'] ?? null)
                && preg_match('/^[A-Za-z]{3}$/', $entry['currency']) === 1
                ? strtoupper($entry['currency'])
                : null;
            if ($currency === null) {
                $currency = $entryCurrency;
            }
            $transactions[] = [
                'id' => (string) $entry['id'],
                'description' => is_string($entry['description'] ?? null) ? $entry['description'] : '',
                'amount' => (float) $entry['amount'],
                'currency' => $entryCurrency,
                'created_at' => $entry['created_at'],
            ];
        }

        respond([
            'balance' => (float) $balance,
            'currency' => $currency ?? 'IDR',
            'transactions' => $transactions,
        ]);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling wallet API error: ' . $error->getMessage());
        respond(['error' => 'Dompet tidak dapat dimuat dari server akun. Coba lagi nanti.'], 502);
    }
}

if ($action === 'invoice' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    $invoiceId = isset($_GET['id']) && is_string($_GET['id']) ? trim($_GET['id']) : '';
    if (preg_match('/^[0-9]{1,18}$/', $invoiceId) !== 1) {
        respond(['error' => 'Nomor tagihan tidak valid.'], 422);
    }

    try {
        $invoice = findClientInvoiceById($invoiceId);
        respond(['invoice' => buildInvoiceDetail($invoice)]);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling invoice detail API error: ' . $error->getMessage());
        respond(['error' => 'Rincian tagihan tidak dapat dimuat dari server akun. Coba lagi nanti.'], 502);
    }
}

if ($action === 'invoice-pdf' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    $invoiceId = isset($_GET['id']) && is_string($_GET['id']) ? trim($_GET['id']) : '';
    if (preg_match('/^[0-9]{1,18}$/', $invoiceId) !== 1) {
        respond(['error' => 'Nomor tagihan tidak valid.'], 422);
    }

    try {
        $invoice = findClientInvoiceById($invoiceId);
        $hash = is_string($invoice['hash'] ?? null) ? $invoice['hash'] : '';
        if (preg_match('/^[a-f0-9]{30,60}$/', $hash) !== 1) {
            throw new DomainException('Tautan PDF untuk tagihan ini belum tersedia.', 422);
        }

        $pdf = fetchFossBillingInvoicePdf($hash);
        $number = is_string($invoice['serie_nr'] ?? null) && $invoice['serie_nr'] !== ''
            ? $invoice['serie_nr']
            : $invoiceId;
        $filename = trim((string) preg_replace('/[^A-Za-z0-9._-]/', '-', $number), '.-');
        if ($filename === '') {
            $filename = 'invoice-' . $invoiceId;
        }
        if (!str_ends_with(strtolower($filename), '.pdf')) {
            $filename .= '.pdf';
        }

        http_response_code(200);
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($pdf['body']));
        header('Cache-Control: private, no-store');
        echo $pdf['body'];
        exit;
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling invoice PDF API error: ' . $error->getMessage());
        respond(['error' => 'File PDF tagihan tidak dapat dibuat. Coba lagi nanti.'], 502);
    }
}

// Cek apakah invoice unpaid ini punya pembayaran gateway yang masih PENDING,
// supaya frontend bisa langsung ke halaman status tanpa pilih metode dulu.
if ($action === 'invoice-payment' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    $invoiceId = isset($_GET['id']) && is_string($_GET['id']) ? trim($_GET['id']) : '';
    if (preg_match('/^[0-9]{1,18}$/', $invoiceId) !== 1) {
        respond(['error' => 'Nomor tagihan tidak valid.'], 422);
    }

    try {
        $invoice = findClientInvoiceById($invoiceId);
        if (strtolower((string) ($invoice['status'] ?? '')) !== 'unpaid') {
            respond(['payment' => null, 'error' => 'Tagihan tidak dalam status belum dibayar.'], 422);
        }
        $resumed = resumeInvoiceGatewayPayment($invoice);
        if ($resumed === null) {
            respond(['payment' => null]);
        }
        respond($resumed);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling invoice payment lookup error: ' . $error->getMessage());
        respond(['error' => 'Status pembayaran tagihan tidak dapat diperiksa. Coba lagi nanti.'], 502);
    }
}

if ($action === 'payment-methods' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }
    session_write_close();

    $json = komerceRequest('GET', '/api/v1/user/methods');
    respond(['methods' => $json['data'] ?? $json]);
}

if ($action === 'payment-status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }
    $paymentId = $_GET['payment_id'] ?? null;
    if (is_string($paymentId)) {
        hydrateKomercePayment($paymentId);
    }
    if (!is_string($paymentId) || preg_match('#^[A-Za-z0-9._/-]{1,100}$#', $paymentId) !== 1
        || empty($_SESSION['komerce_payments'][$paymentId])) {
        respond(['error' => 'Pembayaran tidak ditemukan.'], 404);
    }
    $stored = $_SESSION['komerce_payments'][$paymentId];
    if (str_starts_with($paymentId, GOPAY_PREFIX)) {
        $qrisId = substr($paymentId, strlen(GOPAY_PREFIX));
        $orderId = is_array($stored) && is_string($stored['order_ref'] ?? null) ? $stored['order_ref'] : null;
        $trxId = is_array($stored) && is_string($stored['trx_id'] ?? null) ? $stored['trx_id'] : null;
        $query = ['qris_id' => $qrisId];
        if ($trxId !== null) {
            $query['trx_id'] = $trxId;
        }
        $data = gopayRequest('GET', '/check-payment', $query);
        $payment = normalizeGopayStatus($data, $paymentId, $orderId);
        if ($payment['status'] === 'PAID' && is_array($stored) && empty($stored['synced'])) {
            $synced = notifyFossBillingPaid($paymentId, (int) ($stored['gateway_id'] ?? 0), (int) ($stored['invoice_id'] ?? 0), $orderId);
            if ($synced) {
                markKomercePaymentSynced($paymentId);
            }
            $payment['invoice_synced'] = $synced;
        }
        session_write_close();
        respond(['payment' => $payment]);
    }
    if (str_starts_with($paymentId, QRISLY_PREFIX)) {
        $historyId = substr($paymentId, strlen(QRISLY_PREFIX));
        $orderId = is_array($stored) && is_string($stored['order_ref'] ?? null) ? $stored['order_ref'] : null;
        $data = komerceRequest('GET', '/api/v1/qrisly/payment-status/' . rawurlencode($historyId))['data'] ?? null;
        if (!is_array($data)) {
            respond(['error' => 'Status pembayaran QRIS tidak dapat dimuat.'], 502);
        }
        $payment = normalizeQrislyStatus($data, $paymentId, $orderId);
        if ($payment['status'] === 'PAID' && is_array($stored) && empty($stored['synced'])) {
            $synced = notifyFossBillingPaid($paymentId, (int) ($stored['gateway_id'] ?? 0), (int) ($stored['invoice_id'] ?? 0), $orderId);
            if ($synced) {
                markKomercePaymentSynced($paymentId);
            }
            $payment['invoice_synced'] = $synced;
        }
        session_write_close();
        respond(['payment' => $payment]);
    }
    $json = komerceRequest('GET', '/api/v1/user/payment/status/' . rawurlencode($paymentId));
    $data = $json['data'] ?? null;
    $payment = is_array($data) ? $data : null;
    // VA Komerce tetap disinkronkan di sini bila status sudah PAID, sebagai
    // cadangan jika webhook callback_url tidak sampai ke FossBilling.
    if (is_array($payment)
        && strtoupper((string) ($payment['status'] ?? '')) === 'PAID'
        && is_array($stored) && empty($stored['synced'])) {
        $orderId = is_string($stored['order_ref'] ?? null) ? $stored['order_ref'] : null;
        $gatewayId = (int) ($stored['gateway_id'] ?? 0);
        // Sesi lama mungkin belum menyimpan gateway_id; cari gateway Komerce.
        if ($gatewayId <= 0) {
            $gateways = callFossBillingClient('invoice/gateways', [], 'guest')['result'] ?? [];
            foreach (is_array($gateways) ? $gateways : [] as $gateway) {
                if (is_array($gateway) && ($gateway['code'] ?? null) === 'Komerce' && is_scalar($gateway['id'] ?? null)) {
                    $gatewayId = (int) $gateway['id'];
                }
            }
        }
        $synced = $gatewayId > 0
            && notifyFossBillingPaid($paymentId, $gatewayId, (int) ($stored['invoice_id'] ?? 0), $orderId);
        if ($synced) {
            markKomercePaymentSynced($paymentId);
        }
        $payment['invoice_synced'] = $synced;
        session_write_close();
        respond(['payment' => $payment]);
    }
    session_write_close();

    respond(['payment' => $payment]);
}

if ($action === 'cart' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    try {
        respond(['cart' => cartResponse(callFossBillingClient('cart/get', [], 'guest'))]);
    } catch (DomainException $error) {
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling cart error: ' . $error->getMessage());
        respond(['error' => 'Keranjang tidak dapat dimuat. Coba lagi nanti.'], 502);
    }
}

if ($action === 'helpdesks' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    try {
        respond(['helpdesks' => fetchHelpdesks()]);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling helpdesk error: ' . $error->getMessage());
        respond(['error' => 'Daftar helpdesk tidak dapat dimuat. Coba lagi nanti.'], 502);
    }
}

if ($action === 'tickets' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    try {
        $response = callFossBillingClient('support/ticket_get_list', ['per_page' => 100]);
        $result = $response['result'] ?? null;
        if (!is_array($result) || !is_array($result['list'] ?? null)) {
            throw new RuntimeException('FossBilling returned an invalid ticket list.');
        }
        $text = static fn ($value): string => is_scalar($value) ? substr((string) $value, 0, 500) : '';

        $tickets = [];
        foreach ($result['list'] as $ticket) {
            if (!is_array($ticket) || !is_scalar($ticket['id'] ?? null)) {
                continue;
            }
            $tickets[] = [
                'id' => $text($ticket['id']),
                'subject' => $text($ticket['subject'] ?? ''),
                'status' => $text($ticket['status'] ?? ''),
                'helpdesk' => $text(is_array($ticket['helpdesk'] ?? null) ? ($ticket['helpdesk']['name'] ?? '') : ''),
                'created_at' => $text($ticket['created_at'] ?? ''),
            ];
        }

        respond(['total' => (int) ($result['total'] ?? count($tickets)), 'tickets' => $tickets]);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling ticket list error: ' . $error->getMessage());
        respond(['error' => 'Daftar tiket tidak dapat dimuat. Coba lagi nanti.'], 502);
    }
}

if ($action === 'notifications' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $clientId = $_SESSION['fossbilling_client']['id'] ?? null;
    if (empty($_SESSION['fossbilling_authenticated'])
        || !(is_int($clientId) || is_string($clientId))
        || preg_match('/^[0-9]{1,18}$/', (string) $clientId) !== 1) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }
    session_write_close();

    $file = $storageDirectory . '/notifications/' . (int) $clientId . '.json';
    $stored = is_file($file) ? json_decode((string) file_get_contents($file), true) : [];
    $stored = is_array($stored) ? $stored : [];
    $lastId = $stored === [] ? 0 : (int) end($stored)['id'];
    $state = readNotificationState($storageDirectory, (int) $clientId);

    if (!isset($_GET['after']) || !is_string($_GET['after']) || preg_match('/^[0-9]{1,18}$/', $_GET['after']) !== 1) {
        respond(['items' => [], 'lastId' => $lastId, 'state' => $state]);
    }

    $after = (int) $_GET['after'];
    // The first poll (after=0) returns the full history so read/cleared state can be applied to it.
    $items = array_values(array_filter($stored, static fn ($item) => (int) $item['id'] > $after));
    respond(['items' => $items, 'lastId' => max($lastId, $after), 'state' => $state]);
}

if ($action === 'ticket' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    $ticketId = $_GET['id'] ?? '';
    if (!is_string($ticketId) || preg_match('/^[0-9]{1,18}$/', $ticketId) !== 1) {
        respond(['error' => 'ID tiket tidak valid.'], 422);
    }

    try {
        $response = callFossBillingClient('support/ticket_get', ['id' => (int) $ticketId]);
        $ticket = $response['result'] ?? null;
        if (!is_array($ticket) || !is_array($ticket['messages'] ?? null)) {
            throw new RuntimeException('FossBilling returned an invalid ticket.');
        }
        $text = static fn ($value): string => is_scalar($value) ? substr((string) $value, 0, 100000) : '';

        $messages = [];
        foreach ($ticket['messages'] as $message) {
            if (!is_array($message)) {
                continue;
            }
            $author = is_array($message['author'] ?? null) ? $message['author'] : [];
            $messages[] = [
                'id' => $text($message['id'] ?? ''),
                'content' => $text($message['content'] ?? ''),
                'author' => $text($author['name'] ?? ''),
                'is_staff' => ($author['role'] ?? 'client') !== 'client',
                'created_at' => $text($message['created_at'] ?? ''),
            ];
        }

        respond(['ticket' => [
            'id' => $text($ticket['id'] ?? $ticketId),
            'subject' => $text($ticket['subject'] ?? ''),
            'status' => $text($ticket['status'] ?? ''),
            'helpdesk' => $text(is_array($ticket['helpdesk'] ?? null) ? ($ticket['helpdesk']['name'] ?? '') : ''),
            'created_at' => $text($ticket['created_at'] ?? ''),
            'messages' => $messages,
        ]]);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling ticket error: ' . $error->getMessage());
        respond(['error' => 'Tiket tidak dapat dimuat. Coba lagi nanti.'], 502);
    }
}

if ($action === 'emails' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    try {
        $response = callFossBillingClient('email/get_list', ['per_page' => 20]);
        $result = $response['result'] ?? null;
        if (!is_array($result) || !is_array($result['list'] ?? null)) {
            throw new RuntimeException('FossBilling returned an invalid email list.');
        }
        $text = static fn ($value, int $max = 500): string => is_scalar($value) ? substr((string) $value, 0, $max) : '';

        $emails = [];
        foreach ($result['list'] as $email) {
            if (!is_array($email) || !is_scalar($email['id'] ?? null)) {
                continue;
            }
            $emails[] = [
                'id' => $text($email['id'], 20),
                'subject' => $text($email['subject'] ?? ''),
                'sender' => $text($email['sender'] ?? ''),
                'recipients' => $text($email['recipients'] ?? ''),
                'created_at' => $text($email['created_at'] ?? '', 40),
                'has_attachment' => !empty($email['has_attachment']),
            ];
        }

        respond(['total' => (int) ($result['total'] ?? count($emails)), 'emails' => $emails]);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling email list error: ' . $error->getMessage());
        respond(['error' => 'Daftar email tidak dapat dimuat. Coba lagi nanti.'], 502);
    }
}

if ($action === 'email' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    $emailId = $_GET['id'] ?? '';
    if (!is_string($emailId) || preg_match('/^[0-9]{1,18}$/', $emailId) !== 1) {
        respond(['error' => 'ID email tidak valid.'], 422);
    }

    try {
        $response = callFossBillingClient('email/get', ['id' => (int) $emailId]);
        $email = $response['result'] ?? null;
        if (!is_array($email)) {
            throw new RuntimeException('FossBilling returned an invalid email.');
        }
        $text = static fn ($value, int $max = 500): string => is_scalar($value) ? substr((string) $value, 0, $max) : '';

        respond(['email' => [
            'id' => $text($email['id'] ?? $emailId, 20),
            'subject' => $text($email['subject'] ?? ''),
            'sender' => $text($email['sender'] ?? ''),
            'recipients' => $text($email['recipients'] ?? ''),
            'content_html' => is_string($email['content_html'] ?? null) ? substr($email['content_html'], 0, 500000) : '',
            'content_text' => is_string($email['content_text'] ?? null) ? substr($email['content_text'], 0, 100000) : '',
            'has_attachment' => !empty($email['has_attachment']),
            'created_at' => $text($email['created_at'] ?? '', 40),
            'updated_at' => $text($email['updated_at'] ?? '', 40),
        ]]);
    } catch (DomainException $error) {
        if ($error->getCode() === 401) {
            $_SESSION = [];
        }
        respond(['error' => $error->getMessage()], $error->getCode() ?: 422);
    } catch (Throwable $error) {
        error_log('FossBilling email detail error: ' . $error->getMessage());
        respond(['error' => 'Isi email tidak dapat dimuat. Coba lagi nanti.'], 502);
    }
}

if (!in_array($action, ['login', 'create', 'logout', 'profile-update', 'password-change', 'ticket-create', 'ticket-reply', 'ticket-close', 'storage-url', 'notification-state', 'cart-add', 'cart-remove', 'checkout', 'checkout-balance', 'pay-invoice', 'wallet-topup', 'pay-invoice-balance', 'payment-cancel', 'email-resend', 'email-delete'], true)
    || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Permintaan tidak valid.'], 405);
}

if (!csrfIsValid()) {
    respond(['error' => 'Sesi kedaluwarsa. Muat ulang halaman lalu coba lagi.'], 403);
}

if (in_array($action, ['logout', 'profile-update', 'password-change', 'ticket-create', 'ticket-reply', 'ticket-close', 'storage-url', 'notification-state', 'cart-add', 'cart-remove', 'checkout', 'checkout-balance', 'pay-invoice', 'wallet-topup', 'pay-invoice-balance', 'payment-cancel', 'email-resend', 'email-delete'], true)
    && empty($_SESSION['fossbilling_authenticated'])) {
    respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
}

if ($action === 'notification-state') {
    $clientId = $_SESSION['fossbilling_client']['id'] ?? null;
    if (!(is_int($clientId) || is_string($clientId)) || preg_match('/^[0-9]{1,18}$/', (string) $clientId) !== 1) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }
    $clientId = (int) $clientId;
    session_write_close();

    $body = json_decode((string) file_get_contents('php://input', false, null, 0, 65537), true);
    if (!is_array($body)) {
        respond(['error' => 'Permintaan tidak valid.'], 422);
    }

    $directory = $storageDirectory . '/notifications';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        respond(['error' => 'Status notifikasi tidak dapat disimpan.'], 500);
    }
    $handle = fopen(notificationStatePath($storageDirectory, $clientId), 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        respond(['error' => 'Status notifikasi tidak dapat disimpan.'], 500);
    }

    $state = json_decode(stream_get_contents($handle) ?: '{}', true);
    $read = is_array($state) && is_array($state['read'] ?? null) ? $state['read'] : [];
    $cleared = is_array($state) ? (int) ($state['cleared'] ?? 0) : 0;

    // Values only move forward, so a stale device cannot un-read or restore notifications.
    if (is_array($body['read'] ?? null)) {
        foreach ($body['read'] as $ticketId => $id) {
            if (preg_match('/^[0-9]{1,18}$/', (string) $ticketId) === 1 && is_int($id) && $id > 0) {
                $read[(string) $ticketId] = max((int) ($read[(string) $ticketId] ?? 0), $id);
            }
        }
        $read = array_slice($read, -200, null, true);
    }
    if (is_int($body['cleared'] ?? null)) {
        $cleared = max($cleared, $body['cleared']);
    }

    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode(['read' => (object) $read, 'cleared' => $cleared]));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    respond(['read' => (object) $read, 'cleared' => $cleared]);
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
    if ($action === 'ticket-create') {
        $rawBody = file_get_contents('php://input');
        if ($rawBody === false || strlen($rawBody) > 65536) {
            respond(['error' => 'Permintaan terlalu besar.'], 413);
        }
        $input = json_decode($rawBody ?: '', true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($input) || array_diff(array_keys($input), ['support_helpdesk_id', 'subject', 'content', 'rel_type', 'rel_id']) !== []) {
            respond(['error' => 'Format data tidak valid.'], 400);
        }
        $helpdeskId = $input['support_helpdesk_id'] ?? null;
        $subject = $input['subject'] ?? null;
        $content = $input['content'] ?? null;
        $relType = $input['rel_type'] ?? null;
        $relId = $input['rel_id'] ?? null;
        if (!is_string($helpdeskId) || preg_match('/^[0-9]{1,18}$/', $helpdeskId) !== 1) {
            respond(['error' => 'Helpdesk tidak valid.'], 422);
        }
        if (!is_string($subject) || trim($subject) === '' || strlen($subject) > 255) {
            respond(['error' => 'Subjek wajib diisi (maksimal 255 karakter).'], 422);
        }
        if (!is_string($content) || trim($content) === '' || strlen($content) > 50000) {
            respond(['error' => 'Pesan wajib diisi.'], 422);
        }
        if (($relType === null) !== ($relId === null)
            || ($relType !== null && $relType !== 'order')
            || ($relId !== null && (!is_string($relId) && !is_int($relId) || preg_match('/^[0-9]{1,18}$/', (string) $relId) !== 1))) {
            respond(['error' => 'Relasi tiket tidak valid.'], 422);
        }

        $ticketPayload = [
            'support_helpdesk_id' => (int) $helpdeskId,
            'subject' => trim($subject),
            'content' => $content,
        ];
        if ($relType !== null) {
            // FossBilling memverifikasi rel_id order milik client sesi ini.
            $ticketPayload['rel_type'] = $relType;
            $ticketPayload['rel_id'] = (int) $relId;
        }
        $response = callFossBillingClient('support/ticket_create', $ticketPayload);
        $ticketId = $response['result'] ?? null;
        if (!is_int($ticketId) && !(is_string($ticketId) && ctype_digit($ticketId))) {
            throw new RuntimeException('FossBilling returned an unexpected ticket response.');
        }
        respond(['result' => (int) $ticketId, 'error' => null]);
    }

    if ($action === 'cart-add') {
        $rawBody = file_get_contents('php://input');
        $input = json_decode($rawBody === false ? '' : substr($rawBody, 0, 1024), true, 16, JSON_THROW_ON_ERROR);
        $productId = is_array($input) ? ($input['product_id'] ?? null) : null;
        $period = is_array($input) ? ($input['period'] ?? null) : null;
        $replace = is_array($input) ? ($input['replace'] ?? false) : false;
        if (!is_array($input) || array_diff(array_keys($input), ['product_id', 'period', 'replace']) !== []
            || !is_string($productId) || preg_match('/^[0-9]{1,18}$/', $productId) !== 1
            || !is_string($period) || !in_array($period, ['1M', '1Y'], true)
            || !is_bool($replace)) {
            respond(['error' => 'Produk atau periode tidak valid.'], 422);
        }

        // Produk yang sama dengan periode berbeda saling menggantikan, bukan menumpuk.
        $current = cartResponse(callFossBillingClient('cart/get', [], 'guest'));
        $conflicts = [];
        foreach ($current['items'] as $item) {
            if ($item['product_id'] === $productId && $item['period'] !== $period) {
                $conflicts[] = $item;
            }
        }
        if ($conflicts !== [] && !$replace) {
            respond([
                'error' => 'Produk ini sudah ada di keranjang dengan durasi berbeda.',
                'conflict' => [
                    'product_id' => $productId,
                    'title' => $conflicts[0]['title'],
                    'existing_period' => $conflicts[0]['period'],
                    'new_period' => $period,
                    'count' => count($conflicts),
                ],
            ], 409);
        }
        foreach ($conflicts as $item) {
            callFossBillingClient('cart/remove_item', ['id' => (int) $item['id']], 'guest');
        }

        callFossBillingClient('cart/add_item', ['id' => (int) $productId, 'period' => $period, 'quantity' => 1, 'multiple' => true], 'guest');
        respond(['cart' => cartResponse(callFossBillingClient('cart/get', [], 'guest'))]);
    }

    if ($action === 'cart-remove') {
        $rawBody = file_get_contents('php://input');
        $input = json_decode($rawBody === false ? '' : substr($rawBody, 0, 1024), true, 16, JSON_THROW_ON_ERROR);
        $itemId = is_array($input) ? ($input['id'] ?? null) : null;
        if (!is_array($input) || array_diff(array_keys($input), ['id']) !== []
            || !is_string($itemId) || preg_match('/^[0-9]{1,18}$/', $itemId) !== 1) {
            respond(['error' => 'Item keranjang tidak valid.'], 422);
        }

        callFossBillingClient('cart/remove_item', ['id' => (int) $itemId], 'guest');
        respond(['cart' => cartResponse(callFossBillingClient('cart/get', [], 'guest'))]);
    }

    if ($action === 'payment-cancel') {
        $rawBody = file_get_contents('php://input');
        $input = json_decode($rawBody === false ? '' : substr($rawBody, 0, 2048), true, 16, JSON_THROW_ON_ERROR);
        $paymentId = is_array($input) ? ($input['payment_id'] ?? null) : null;
        $reason = is_array($input) ? ($input['reason'] ?? null) : null;
        if (is_string($paymentId)) {
            hydrateKomercePayment($paymentId);
        }
        if (!is_array($input) || array_diff(array_keys($input), ['payment_id', 'reason']) !== []
            || !is_string($paymentId) || preg_match('#^[A-Za-z0-9._/-]{1,100}$#', $paymentId) !== 1
            || empty($_SESSION['komerce_payments'][$paymentId])) {
            respond(['error' => 'Pembayaran tidak ditemukan.'], 404);
        }
        if (!is_string($reason) || trim($reason) === '' || mb_strlen($reason) > 200) {
            respond(['error' => 'Alasan pembatalan wajib diisi (maksimal 200 karakter).'], 422);
        }
        $stored = $_SESSION['komerce_payments'][$paymentId];
        $invoiceId = is_array($stored) ? ($stored['invoice_id'] ?? null) : null;
        $orderId = is_array($stored) ? ($stored['order_id'] ?? null) : null;
        session_write_close();

        $isGopay = str_starts_with($paymentId, GOPAY_PREFIX);
        $isQrisly = str_starts_with($paymentId, QRISLY_PREFIX);
        if ($isGopay) {
            $current = gopayRequest('GET', '/api/qr-status/' . rawurlencode(substr($paymentId, strlen(GOPAY_PREFIX))));
            $currentStatus = normalizeGopayStatus($current, $paymentId, null)['status'];
        } elseif ($isQrisly) {
            $current = komerceRequest('GET', '/api/v1/qrisly/payment-status/' . rawurlencode(substr($paymentId, strlen(QRISLY_PREFIX))))['data'] ?? null;
            $currentStatus = is_array($current) ? normalizeQrislyStatus($current, $paymentId, null)['status'] : '';
        } else {
            $current = komerceRequest('GET', '/api/v1/user/payment/status/' . rawurlencode($paymentId))['data'] ?? null;
            $currentStatus = is_array($current) ? strtoupper((string) ($current['status'] ?? '')) : '';
        }
        if ($currentStatus !== 'PENDING') {
            respond(['error' => 'Hanya pembayaran berstatus PENDING yang dapat dibatalkan.', 'status' => $currentStatus], 409);
        }

        // QRIS kedaluwarsa sendiri dan tidak punya API pembatalan.
        $cancelled = ($isQrisly || $isGopay)
            ? ['data' => ['payment_id' => $paymentId, 'status' => 'CANCELED']]
            : komerceRequest('POST', '/api/v1/user/payment/cancel', ['payment_id' => $paymentId, 'reason' => trim($reason)]);
        $invoiceCancelled = is_int($invoiceId) && cancelFossBillingInvoice($invoiceId, trim($reason));
        if (is_int($orderId)) {
            try {
                callFossBillingClient('order/delete', ['id' => $orderId]);
            } catch (Throwable) {
                // Pesanan yang sudah berjalan tidak bisa dihapus; invoice tetap dibatalkan.
            }
        }

        respond(['result' => $cancelled['data'] ?? true, 'invoice_cancelled' => $invoiceCancelled, 'error' => null]);
    }

    if ($action === 'checkout') {
        $rawBody = file_get_contents('php://input');
        $input = json_decode($rawBody === false ? '' : substr($rawBody, 0, 1024), true, 16, JSON_THROW_ON_ERROR);
        $method = is_array($input) ? ($input['method'] ?? null) : null;
        if (!is_array($input) || array_diff(array_keys($input), ['method']) !== []
            || !is_string($method) || preg_match('/^(va|qris|gopay):[A-Z_]{0,32}$/', $method) !== 1) {
            respond(['error' => 'Pilih metode pembayaran terlebih dahulu.'], 422);
        }
        [$methodType, $bankCode] = explode(':', $method, 2);
        $isQris = $methodType === 'qris';
        $isGopay = $methodType === 'gopay';
        if ((($isQris || $isGopay) && $bankCode !== '') || (!$isQris && !$isGopay && $bankCode === '')) {
            respond(['error' => 'Pilih metode pembayaran terlebih dahulu.'], 422);
        }

        if (!$isQris && !$isGopay) {
            $blockedBanks = ['BJB', 'SMBC', 'DBS'];
            if (in_array($bankCode, $blockedBanks, true)) {
                respond(['error' => 'Bank yang dipilih tidak tersedia.'], 422);
            }
            $available = komerceRequest('GET', '/api/v1/user/methods')['data'] ?? [];
            $validBank = false;
            foreach (is_array($available) ? $available : [] as $item) {
                if (is_array($item) && ($item['payment_type'] ?? null) === 'va' && ($item['bank_code'] ?? null) === $bankCode) {
                    $validBank = true;
                }
            }
            if (!$validBank) {
                respond(['error' => 'Bank yang dipilih tidak tersedia.'], 422);
            }
        }

        $cart = cartResponse(callFossBillingClient('cart/get', [], 'guest'));
        if ($cart['items'] === []) {
            respond(['error' => 'Keranjang kosong.'], 422);
        }

        $profile = callFossBillingClient('profile/get', [])['result'] ?? [];
        $phone = preg_replace('/[^0-9]/', '', (string) ($profile['phone'] ?? ''));
        $phoneCc = preg_replace('/[^0-9]/', '', (string) ($profile['phone_cc'] ?? ''));
        if ($phone !== '' && $phone[0] !== '0') {
            $phone = ($phoneCc === '62' || $phoneCc === '') ? '0' . $phone : '+' . $phoneCc . $phone;
        }
        if ($phone === '') {
            respond(['error' => 'Lengkapi nomor telepon di menu Profil sebelum checkout.'], 422);
        }

        $gateways = callFossBillingClient('invoice/gateways', [], 'guest')['result'] ?? [];
        $gatewayId = null;
        foreach (is_array($gateways) ? $gateways : [] as $gateway) {
            if (is_array($gateway) && ($gateway['code'] ?? null) === 'Komerce' && is_scalar($gateway['id'] ?? null)) {
                $gatewayId = (int) $gateway['id'];
            }
        }
        if ($gatewayId === null) {
            respond(['error' => 'Gateway pembayaran Komerce belum aktif.'], 503);
        }

        $order = callFossBillingClient('cart/checkout', ['gateway_id' => $gatewayId])['result'] ?? null;
        $hash = is_array($order) ? ($order['invoice_hash'] ?? null) : null;
        if (!is_string($hash) || preg_match('/^[a-z0-9]{1,64}$/i', $hash) !== 1) {
            throw new RuntimeException('FossBilling returned an unexpected checkout response.');
        }

        $invoice = callFossBillingClient('invoice/get', ['hash' => $hash])['result'] ?? null;
        if (!is_array($invoice) || !is_numeric($invoice['total'] ?? null) || !is_scalar($invoice['id'] ?? null)) {
            throw new RuntimeException('FossBilling returned an unexpected invoice.');
        }

        // FossBilling otomatis melunasi invoice dari saldo (use_credits) bila
        // saldo mencukupi — jangan buat pembayaran gateway untuk invoice yang
        // sudah lunas agar tidak terjadi bayar ganda.
        if (strtolower((string) ($invoice['status'] ?? '')) === 'paid') {
            respond([
                'result' => true,
                'paid_with_credits' => true,
                'invoice' => ['id' => (int) $invoice['id'], 'hash' => $hash, 'total' => (int) round((float) $invoice['total'])],
                'error' => null,
            ]);
        }

        $invoiceTotal = (int) round((float) $invoice['total']);
        $vaFee = 4440;
        $fee = $isGopay ? 0 : ($isQris ? qrisFee($invoiceTotal) : $vaFee);
        $amount = $invoiceTotal + $fee;
        if ($amount < 10000) {
            respond(['error' => 'Nominal pembayaran minimal Rp 10.000.'], 422);
        }

        if ($isGopay) {
            $orderRef = mb_substr(is_string($invoice['serie_nr'] ?? null) && $invoice['serie_nr'] !== '' ? $invoice['serie_nr'] : 'INV' . $invoice['id'], 0, 100);
            $generated = gopayRequest('POST', '/create-qris', ['amount' => $amount, 'unique_code' => 'true']);
            $qris = is_array($generated['data'] ?? null) ? $generated['data'] : null;
            if ($qris === null || !is_string($qris['qris_id'] ?? null) || preg_match('/^[A-Za-z0-9._-]{1,64}$/', $qris['qris_id']) !== 1
                || !is_string($qris['qris_code'] ?? null) || $qris['qris_code'] === '') {
                throw new RuntimeException('Gateway QRIS GoPay mengembalikan respons yang tidak dikenali.');
            }
            $paymentId = GOPAY_PREFIX . $qris['qris_id'];
            $paymentPayload = [
                'payment_id' => $paymentId,
                'payment_type' => 'gopay',
                'qris_string' => $qris['qris_code'],
                'amount' => (int) ($qris['total_amount'] ?? $amount),
                'original_amount' => (int) ($qris['amount'] ?? $amount),
                'unique_code' => $qris['unique_code'] ?? null,
                'trx_id' => $qris['trx_id'] ?? null,
                'expired_at' => $qris['expires_at'] ?? null,
                'status' => 'PENDING',
                'order_id' => $orderRef,
            ];
            storeKomercePayment($paymentId, [
                'invoice_id' => (int) $invoice['id'],
                'order_id' => is_scalar($order['order_id'] ?? null) ? (int) $order['order_id'] : null,
                'order_ref' => $orderRef,
                'gateway_id' => $gatewayId,
                'trx_id' => is_string($qris['trx_id'] ?? null) ? $qris['trx_id'] : null,
                'method' => $method,
                'created_at' => time(),
                'payment' => $paymentPayload,
            ]);

            respond([
                'payment' => $paymentPayload,
                'invoice' => ['id' => (int) $invoice['id'], 'hash' => $hash, 'total' => $invoiceTotal],
                'error' => null,
            ]);
        }

        if ($isQris) {
            $qrisId = (int) (getenv('KOMERCE_QRIS_ID') ?: 1438);
            $generated = komerceRequest('POST', '/api/v1/qrisly/generate-qris', [
                'qris_id' => $qrisId,
                'amount' => $amount,
                'output_type' => 'string',
                'unique_amount' => true,
            ]);
            $qris = $generated['data'] ?? null;
            if (!is_array($qris) || !is_numeric($qris['history_id'] ?? null) || !is_string($qris['qris_string'] ?? null) || $qris['qris_string'] === '') {
                throw new RuntimeException('Komerce returned an unexpected QRIS response.');
            }
            $paymentId = QRISLY_PREFIX . (int) $qris['history_id'];
            $orderRef = mb_substr(is_string($invoice['serie_nr'] ?? null) && $invoice['serie_nr'] !== '' ? $invoice['serie_nr'] : 'INV' . $invoice['id'], 0, 100);
            $paymentPayload = [
                'payment_id' => $paymentId,
                'payment_type' => 'qris',
                'qris_string' => $qris['qris_string'],
                'amount' => (int) ($qris['final_amount'] ?? $amount),
                'original_amount' => (int) ($qris['original_amount'] ?? $amount),
                'expired_at' => $qris['expiry_time'] ?? null,
                'status' => 'PENDING',
                'order_id' => $orderRef,
            ];
            storeKomercePayment($paymentId, [
                'invoice_id' => (int) $invoice['id'],
                'order_id' => is_scalar($order['order_id'] ?? null) ? (int) $order['order_id'] : null,
                'order_ref' => $orderRef,
                'gateway_id' => $gatewayId,
                'method' => $method,
                'created_at' => time(),
                'payment' => $paymentPayload,
            ]);

            respond([
                'payment' => $paymentPayload,
                'invoice' => ['id' => (int) $invoice['id'], 'hash' => $hash, 'total' => $invoiceTotal],
                'error' => null,
            ]);
        }

        $items = [];
        foreach ($cart['items'] as $item) {
            $items[] = ['name' => mb_substr((string) $item['title'], 0, 100), 'quantity' => max(1, (int) $item['quantity']), 'price' => (int) round((float) $item['price'])];
        }
        $items[] = ['name' => 'Biaya transaksi virtual account', 'quantity' => 1, 'price' => $vaFee];

        $buyer = is_array($invoice['buyer'] ?? null) ? $invoice['buyer'] : [];
        $name = trim((string) ($buyer['first_name'] ?? '') . ' ' . (string) ($buyer['last_name'] ?? ''));
        $payload = [
            'order_id' => mb_substr(is_string($invoice['serie_nr'] ?? null) && $invoice['serie_nr'] !== '' ? $invoice['serie_nr'] : 'INV' . $invoice['id'], 0, 100),
            'payment_type' => 'bank_transfer',
            'channel_code' => $bankCode,
            'amount' => $amount,
            'customer' => [
                'name' => $name !== '' ? $name : 'Pelanggan',
                'email' => (string) ($buyer['email'] ?? ($_SESSION['fossbilling_client']['email'] ?? '')),
                'phone' => $phone,
            ],
            'items' => $items,
            'expiry_duration' => 86400,
        ];

        $publicUrl = fossbillingPublicUrl();
        if ($publicUrl !== '' && preg_match('#^https://#', $publicUrl) === 1) {
            $payload['callback_url'] = $publicUrl . '/ipn.php?' . http_build_query(['gateway_id' => $gatewayId, 'invoice_id' => (int) $invoice['id']]);
            $payload['callback_api_key'] = hash_hmac('sha256', 'komerce-callback', trim((string) getenv('KOMERCE_API_KEY')));
        }

        $created = komerceRequest('POST', '/api/v1/user/payment/create', $payload);
        $payment = $created['data'] ?? null;
        $paymentId = is_array($payment) ? ($payment['payment_id'] ?? null) : null;
        if (!is_string($paymentId) || preg_match('#^[A-Za-z0-9._/-]{1,100}$#', $paymentId) !== 1) {
            throw new RuntimeException('Komerce returned an unexpected payment response.');
        }
        storeKomercePayment($paymentId, [
            'invoice_id' => (int) $invoice['id'],
            'order_id' => is_scalar($order['order_id'] ?? null) ? (int) $order['order_id'] : null,
            'order_ref' => mb_substr(is_string($invoice['serie_nr'] ?? null) && $invoice['serie_nr'] !== '' ? $invoice['serie_nr'] : 'INV' . $invoice['id'], 0, 100),
            'gateway_id' => $gatewayId,
            'method' => $method,
            'created_at' => time(),
            'payment' => is_array($payment) ? $payment : [],
        ]);

        respond(['payment' => $payment, 'invoice' => ['id' => (int) $invoice['id'], 'hash' => $hash, 'total' => (int) round((float) $invoice['total'])], 'error' => null]);
    }

    if ($action === 'checkout-balance') {
        $rawBody = file_get_contents('php://input');
        if ($rawBody === false || strlen($rawBody) > 2048) {
            respond(['error' => 'Permintaan terlalu besar.'], 413);
        }
        $input = json_decode($rawBody === false ? '' : $rawBody, true, 16, JSON_THROW_ON_ERROR);

        $password = is_array($input) ? ($input['password'] ?? null) : null;
        if (!is_string($password) || $password === '' || strlen($password) > 200) {
            respond(['error' => 'Masukkan password akun untuk konfirmasi.'], 422);
        }

        // Verifikasi password dulu — sebelum invoice/order apa pun dibuat.
        $email = (string) ($_SESSION['fossbilling_client']['email'] ?? '');
        if ($email === '') {
            respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
        }
        try {
            callFossBilling(authBaseUrl(), 'login', ['email' => $email, 'password' => $password]);
        } catch (DomainException $error) {
            respond(['error' => 'Password salah. Periksa kembali password akun Anda.'], 401);
        }

        $cart = cartResponse(callFossBillingClient('cart/get', [], 'guest'));
        if ($cart['items'] === []) {
            respond(['error' => 'Keranjang masih kosong.'], 422);
        }

        $balance = callFossBillingClient('client/balance_get_total', [])['result'] ?? null;
        if (!is_numeric($balance) || (float) $balance < (float) $cart['total']) {
            respond(['error' => 'Saldo tidak mencukupi untuk total pesanan ini.'], 422);
        }

        $order = callFossBillingClient('cart/checkout', [])['result'] ?? null;
        $hash = is_array($order) ? ($order['invoice_hash'] ?? null) : null;
        if (!is_string($hash) || preg_match('/^[a-z0-9]{1,64}$/i', $hash) !== 1) {
            throw new RuntimeException('FossBilling returned an unexpected checkout response.');
        }

        $invoice = callFossBillingClient('invoice/get', ['hash' => $hash])['result'] ?? null;
        if (!is_array($invoice) || !is_numeric($invoice['total'] ?? null) || !is_scalar($invoice['id'] ?? null)) {
            throw new RuntimeException('FossBilling returned an unexpected invoice.');
        }

        $invoiceId = (int) $invoice['id'];
        if (strtolower((string) ($invoice['status'] ?? '')) !== 'paid') {
            if (!payFossBillingInvoiceWithCredits($invoiceId)) {
                cancelFossBillingInvoice($invoiceId, 'Checkout dengan saldo gagal diproses.');
                respond(['error' => 'Pembayaran dengan saldo gagal diproses. Coba lagi atau gunakan metode lain.'], 502);
            }
            $invoice = callFossBillingClient('invoice/get', ['hash' => $hash])['result'] ?? $invoice;
        }

        if (strtolower((string) ($invoice['status'] ?? '')) !== 'paid') {
            cancelFossBillingInvoice($invoiceId, 'Checkout dengan saldo gagal diproses.');
            respond(['error' => 'Pembayaran dengan saldo gagal diproses. Coba lagi atau gunakan metode lain.'], 502);
        }

        respond([
            'result' => true,
            'invoice' => ['id' => (int) $invoice['id'], 'total' => (float) $invoice['total']],
            'order_id' => is_scalar($order['order_id'] ?? null) ? (int) $order['order_id'] : null,
            'error' => null,
        ]);
    }

    if ($action === 'pay-invoice') {
        $rawBody = file_get_contents('php://input');
        $input = json_decode($rawBody === false ? '' : substr($rawBody, 0, 2048), true, 16, JSON_THROW_ON_ERROR);

        $invoiceId = is_array($input) ? ($input['invoice_id'] ?? null) : null;
        $method = is_array($input) ? ($input['method'] ?? null) : null;

        if (!is_string($invoiceId) && !is_int($invoiceId)) {
            respond(['error' => 'ID tagihan tidak valid.'], 422);
        }
        $invoiceId = (string) $invoiceId;
        if (preg_match('/^[0-9]{1,18}$/', $invoiceId) !== 1) {
            respond(['error' => 'ID tagihan tidak valid.'], 422);
        }
        if (!is_string($method) || $method === '') {
            respond(['error' => 'Pilih metode pembayaran terlebih dahulu.'], 422);
        }
        parsePaymentMethod($method);

        $invoice = null;
        $listResponse = callFossBillingClient('invoice/get_list', ['per_page' => 100, 'status' => 'unpaid'])['result'] ?? null;
        $list = is_array($listResponse) ? ($listResponse['list'] ?? null) : null;
        if (is_array($list)) {
            foreach ($list as $item) {
                if (is_array($item) && is_scalar($item['id'] ?? null) && (string) $item['id'] === $invoiceId) {
                    $invoice = $item;
                    break;
                }
            }
        }
        if (!is_array($invoice) || !is_numeric($invoice['total'] ?? null) || !is_scalar($invoice['id'] ?? null)) {
            respond(['error' => 'Tagihan tidak ditemukan.'], 404);
        }
        if (strtolower((string) ($invoice['status'] ?? '')) !== 'unpaid') {
            respond(['error' => 'Tagihan ini tidak dapat dibayar (sudah lunas atau dibatalkan).'], 422);
        }

        $ownerId = $_SESSION['fossbilling_client']['id'] ?? null;
        $invoiceClientId = $invoice['client_id'] ?? null;
        // client_id mungkin tidak ada di list response; kalau ada, validasi kepemilikan.
        // Kalau tidak ada, invoice/get_list sudah membatasi ke sesi aktif.
        if ($invoiceClientId !== null) {
            if (!is_scalar($ownerId) || !is_scalar($invoiceClientId)
                || trim((string) $ownerId) === '' || trim((string) $invoiceClientId) === ''
                || !hash_equals((string) $ownerId, (string) $invoiceClientId)) {
                respond(['error' => 'Tagihan tidak ditemukan.'], 404);
            }
        }

        $resumed = resumeInvoiceGatewayPayment($invoice, $method);
        if ($resumed !== null) {
            respond($resumed);
        }

        respondInvoiceGatewayPayment($invoice, $method);
    }

    if ($action === 'pay-invoice-balance') {
        $rawBody = file_get_contents('php://input');
        if ($rawBody === false || strlen($rawBody) > 2048) {
            respond(['error' => 'Permintaan terlalu besar.'], 413);
        }
        $input = json_decode($rawBody === false ? '' : $rawBody, true, 16, JSON_THROW_ON_ERROR);

        $invoiceId = is_array($input) ? ($input['invoice_id'] ?? null) : null;
        $password = is_array($input) ? ($input['password'] ?? null) : null;

        if (!is_string($invoiceId) && !is_int($invoiceId)) {
            respond(['error' => 'ID tagihan tidak valid.'], 422);
        }
        $invoiceId = (string) $invoiceId;
        if (preg_match('/^[0-9]{1,18}$/', $invoiceId) !== 1) {
            respond(['error' => 'ID tagihan tidak valid.'], 422);
        }
        if (!is_string($password) || $password === '' || strlen($password) > 200) {
            respond(['error' => 'Masukkan password akun untuk konfirmasi.'], 422);
        }

        // Scope ke invoice unpaid milik sesi (sama seperti pay-invoice) — anti BOLA/IDOR.
        $invoice = null;
        $listResponse = callFossBillingClient('invoice/get_list', ['per_page' => 100, 'status' => 'unpaid'])['result'] ?? null;
        $list = is_array($listResponse) ? ($listResponse['list'] ?? null) : null;
        if (is_array($list)) {
            foreach ($list as $item) {
                if (is_array($item) && is_scalar($item['id'] ?? null) && (string) $item['id'] === $invoiceId) {
                    $invoice = $item;
                    break;
                }
            }
        }
        if (!is_array($invoice) || !is_numeric($invoice['total'] ?? null) || !is_scalar($invoice['id'] ?? null)) {
            respond(['error' => 'Tagihan tidak ditemukan.'], 404);
        }
        if (strtolower((string) ($invoice['status'] ?? '')) !== 'unpaid') {
            respond(['error' => 'Tagihan ini tidak dapat dibayar (sudah lunas atau dibatalkan).'], 422);
        }

        $ownerId = $_SESSION['fossbilling_client']['id'] ?? null;
        $invoiceClientId = $invoice['client_id'] ?? null;
        if ($invoiceClientId !== null) {
            if (!is_scalar($ownerId) || !is_scalar($invoiceClientId)
                || trim((string) $ownerId) === '' || trim((string) $invoiceClientId) === ''
                || !hash_equals((string) $ownerId, (string) $invoiceClientId)) {
                respond(['error' => 'Tagihan tidak ditemukan.'], 404);
            }
        }

        // Invoice deposit (top-up) tidak boleh dibayar dari saldo — itu akan
        // membakar saldo tanpa menambah saldo.
        $lines = is_array($invoice['lines'] ?? null) ? $invoice['lines'] : [];
        foreach ($lines as $line) {
            if (is_array($line) && ($line['type'] ?? null) === 'deposit') {
                respond(['error' => 'Tagihan penambahan saldo tidak dapat dibayar dengan saldo.'], 422);
            }
        }

        // Verifikasi password dengan login ulang ke FossBilling (guest scope,
        // tidak mengganggu sesi yang sedang aktif).
        $email = (string) ($_SESSION['fossbilling_client']['email'] ?? '');
        if ($email === '') {
            respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
        }
        try {
            callFossBilling(authBaseUrl(), 'login', ['email' => $email, 'password' => $password]);
        } catch (DomainException $error) {
            respond(['error' => 'Password salah. Periksa kembali password akun Anda.'], 401);
        }

        // Cek saldo cukup sebelum memotong.
        $balance = callFossBillingClient('client/balance_get_total', [])['result'] ?? null;
        $total = (float) $invoice['total'];
        if (!is_numeric($balance) || (float) $balance < $total) {
            respond(['error' => 'Saldo tidak mencukupi untuk tagihan ini.'], 422);
        }

        if (!payFossBillingInvoiceWithCredits((int) $invoice['id'])) {
            respond(['error' => 'Pembayaran dengan saldo gagal diproses. Coba lagi atau gunakan metode lain.'], 502);
        }

        respond(['result' => true, 'invoice' => ['id' => (int) $invoice['id'], 'total' => $total], 'error' => null]);
    }

    if ($action === 'wallet-topup') {
        $rawBody = file_get_contents('php://input');
        if ($rawBody === false || strlen($rawBody) > 2048) {
            respond(['error' => 'Permintaan terlalu besar.'], 413);
        }
        $input = json_decode($rawBody === false ? '' : $rawBody, true, 16, JSON_THROW_ON_ERROR);

        $amount = is_array($input) ? ($input['amount'] ?? null) : null;
        $method = is_array($input) ? ($input['method'] ?? null) : null;

        $amountValue = null;
        if (is_int($amount)) {
            $amountValue = $amount;
        } elseif (is_string($amount) && preg_match('/^[0-9]{1,12}$/', $amount) === 1) {
            $amountValue = (int) $amount;
        }
        if ($amountValue === null || $amountValue < 10000 || $amountValue > 100000000) {
            respond(['error' => 'Nominal penambahan saldo harus antara Rp 10.000 dan Rp 100.000.000.'], 422);
        }
        if (!is_string($method) || $method === '') {
            respond(['error' => 'Pilih metode pembayaran terlebih dahulu.'], 422);
        }
        parsePaymentMethod($method);

        // Cegah invoice deposit menumpuk: satu top-up pending per akun.
        $listResponse = callFossBillingClient('invoice/get_list', ['per_page' => 100, 'status' => 'unpaid'])['result'] ?? null;
        $list = is_array($listResponse) ? ($listResponse['list'] ?? null) : null;
        if (is_array($list)) {
            foreach ($list as $item) {
                $lines = is_array($item) && is_array($item['lines'] ?? null) ? $item['lines'] : [];
                foreach ($lines as $line) {
                    if (is_array($line) && ($line['type'] ?? null) === 'deposit') {
                        respond(['error' => 'Masih ada penambahan saldo yang belum dibayar. Selesaikan atau batalkan pembayaran tersebut terlebih dahulu.'], 409);
                    }
                }
            }
        }

        // Buat invoice deposit "Add Funds" di FossBilling; saldo dikredit otomatis
        // oleh adapter gateway saat invoice lunas (markAsPaid -> addFunds).
        $hash = callFossBillingClient('invoice/funds_invoice', ['amount' => $amountValue])['result'] ?? null;
        if (!is_string($hash) || preg_match('/^[A-Za-z0-9]{8,128}$/', $hash) !== 1) {
            throw new RuntimeException('FossBilling returned an unexpected funds invoice.');
        }

        $invoice = callFossBillingClient('invoice/get', ['hash' => $hash])['result'] ?? null;
        if (!is_array($invoice)
            || !is_numeric($invoice['total'] ?? null)
            || !is_scalar($invoice['id'] ?? null)
            || strtolower((string) ($invoice['status'] ?? '')) !== 'unpaid') {
            throw new RuntimeException('FossBilling returned an invalid funds invoice.');
        }

        // BOLA/IDOR: pastikan invoice benar milik sesi yang sedang login.
        $ownerId = $_SESSION['fossbilling_client']['id'] ?? null;
        $invoiceClientId = $invoice['client_id'] ?? null;
        if (!is_scalar($ownerId) || !is_scalar($invoiceClientId)
            || trim((string) $ownerId) === '' || trim((string) $invoiceClientId) === ''
            || !hash_equals((string) $ownerId, (string) $invoiceClientId)) {
            respond(['error' => 'Tagihan tidak ditemukan.'], 404);
        }

        // Hanya invoice deposit murni dan hanya untuk IDR (Komerce).
        $lines = is_array($invoice['lines'] ?? null) ? $invoice['lines'] : [];
        $depositOnly = $lines !== [];
        foreach ($lines as $line) {
            if (!is_array($line) || ($line['type'] ?? null) !== 'deposit') {
                $depositOnly = false;
                break;
            }
        }
        if (!$depositOnly || strtoupper((string) ($invoice['currency'] ?? '')) !== 'IDR') {
            respond(['error' => 'Tagihan tidak valid untuk penambahan saldo.'], 422);
        }

        respondInvoiceGatewayPayment($invoice, $method, ['wallet_topup' => true]);
    }

    if ($action === 'storage-url') {
        $result = callFossBillingClient('nextcloud/sso_url', []);
        $url = $result['result']['url'] ?? null;
        if (!is_string($url) || preg_match('#^https?://#', $url) !== 1) {
            respond(['error' => 'Storage Area tidak tersedia saat ini.'], 502);
        }

        respond(['result' => true, 'url' => $url, 'error' => null]);
    }

    if ($action === 'ticket-close') {
        $rawBody = file_get_contents('php://input');
        $input = json_decode($rawBody === false ? '' : substr($rawBody, 0, 1024), true, 16, JSON_THROW_ON_ERROR);
        $ticketId = is_array($input) ? ($input['id'] ?? null) : null;
        if (!is_array($input) || array_diff(array_keys($input), ['id']) !== []
            || !is_string($ticketId) || preg_match('/^[0-9]{1,18}$/', $ticketId) !== 1) {
            respond(['error' => 'ID tiket tidak valid.'], 422);
        }

        callFossBillingClient('support/ticket_close', ['id' => (int) $ticketId]);
        respond(['result' => true, 'error' => null]);
    }

    if ($action === 'email-resend' || $action === 'email-delete') {
        $rawBody = file_get_contents('php://input');
        $input = json_decode($rawBody === false ? '' : substr($rawBody, 0, 1024), true, 16, JSON_THROW_ON_ERROR);
        $emailId = is_array($input) ? ($input['id'] ?? null) : null;
        if (!is_array($input) || array_diff(array_keys($input), ['id']) !== []
            || !is_string($emailId) || preg_match('/^[0-9]{1,18}$/', $emailId) !== 1) {
            respond(['error' => 'ID email tidak valid.'], 422);
        }

        $endpoint = $action === 'email-resend' ? 'email/resend' : 'email/delete';
        callFossBillingClient($endpoint, ['id' => (int) $emailId]);
        respond(['result' => true, 'error' => null]);
    }

    if ($action === 'ticket-reply') {
        $rawBody = file_get_contents('php://input');
        if ($rawBody === false || strlen($rawBody) > 65536) {
            respond(['error' => 'Permintaan terlalu besar.'], 413);
        }
        $input = json_decode($rawBody ?: '', true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($input) || array_diff(array_keys($input), ['id', 'content']) !== []) {
            respond(['error' => 'Format data tidak valid.'], 400);
        }
        $ticketId = $input['id'] ?? null;
        $content = $input['content'] ?? null;
        if (!is_string($ticketId) || preg_match('/^[0-9]{1,18}$/', $ticketId) !== 1) {
            respond(['error' => 'ID tiket tidak valid.'], 422);
        }
        if (!is_string($content) || trim($content) === '' || strlen($content) > 50000) {
            respond(['error' => 'Pesan wajib diisi.'], 422);
        }

        callFossBillingClient('support/ticket_reply', ['id' => (int) $ticketId, 'content' => $content]);
        respond(['result' => true, 'error' => null]);
    }

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

        $result = callFossBillingClient('profile/change_password', [
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
        callFossBillingClient('profile/update', $payload);
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
