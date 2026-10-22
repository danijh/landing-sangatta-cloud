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

$contentFile = getenv('SITE_CONTENT_FILE') ?: dirname(__DIR__, 2) . '/storage/site-content.json';
$storageDirectory = dirname($contentFile);

function adminCredentials(): array
{
    $username = getenv('ADMIN_USERNAME') ?: '';
    $passwordHash = getenv('ADMIN_PASSWORD_HASH') ?: '';

    if (PHP_SAPI === 'cli-server' && ($username === '' || $passwordHash === '')) {
        $credentialsFile = dirname(__DIR__, 2) . '/storage/admin-credentials.php';
        if (is_file($credentialsFile)) {
            $credentials = require $credentialsFile;
            if (!is_array($credentials)) {
                throw new RuntimeException('Local admin credentials have an invalid format');
            }
            $username = $username ?: ($credentials['username'] ?? '');
            $passwordHash = $passwordHash ?: ($credentials['password_hash'] ?? '');
        }
    }

    if (!is_string($username) || !is_string($passwordHash)) {
        throw new RuntimeException('Admin credentials must be strings');
    }

    return [$username, $passwordHash];
}

function ensureStorageDirectory(string $directory): void
{
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create content storage directory');
    }
}

function loginIsRateLimited(string $storageDirectory): bool
{
    ensureStorageDirectory($storageDirectory);
    $address = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $storageDirectory . '/.login-' . hash('sha256', $address);
    $handle = fopen($file, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Unable to check login rate limit');
    }

    try {
        chmod($file, 0600);
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Unable to lock login rate limit');
        }
        $attempts = json_decode(stream_get_contents($handle) ?: '[]', true);
        if (!is_array($attempts)) {
            $attempts = [];
        }
        $attempts = array_values(array_filter($attempts, static fn ($time) => is_int($time) && $time > time() - 900));
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
    ensureStorageDirectory($storageDirectory);
    $address = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $storageDirectory . '/.login-' . hash('sha256', $address);
    $handle = fopen($file, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        throw new RuntimeException('Unable to record login attempt');
    }

    try {
        chmod($file, 0600);
        $attempts = json_decode(stream_get_contents($handle) ?: '[]', true);
        if (!is_array($attempts)) {
            $attempts = [];
        }
        $attempts = array_values(array_filter($attempts, static fn ($time) => is_int($time) && $time > time() - 900));
        $attempts[] = time();
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($attempts));
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

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

function readContent(string $contentFile): ?array
{
    if (!is_file($contentFile)) {
        return null;
    }

    $contents = file_get_contents($contentFile);
    if ($contents === false) {
        throw new RuntimeException('Unable to read saved content');
    }

    $decoded = json_decode($contents, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($decoded)) {
        throw new RuntimeException('Saved content has an invalid format');
    }
    return $decoded;
}

function validateContent(mixed $content): array
{
    if (!is_array($content) || !isset($content['contacts'], $content['pages'])) {
        throw new InvalidArgumentException('Konten tidak lengkap.');
    }

    $contactFields = ['email' => 254, 'whatsapp' => 40, 'address' => 500, 'officeHours' => 200];
    foreach ($contactFields as $field => $maxLength) {
        $value = $content['contacts'][$field] ?? null;
        if (!is_string($value) || strlen($value) > $maxLength) {
            throw new InvalidArgumentException('Data kontak tidak valid.');
        }
    }
    if ($content['contacts']['email'] !== '' && !filter_var($content['contacts']['email'], FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Format email tidak valid.');
    }
    if (preg_match('/^[0-9+(). -]*$/', $content['contacts']['whatsapp']) !== 1) {
        throw new InvalidArgumentException('Format WhatsApp tidak valid.');
    }

    $validatedPages = [];
    foreach (['id', 'en'] as $language) {
        if (!isset($content['pages'][$language]) || !is_array($content['pages'][$language])) {
            throw new InvalidArgumentException('Terjemahan halaman tidak lengkap.');
        }
        foreach (['about', 'contact', 'terms', 'privacy'] as $page) {
            $pageContent = $content['pages'][$language][$page] ?? null;
            if (!is_array($pageContent)) {
                throw new InvalidArgumentException('Struktur halaman tidak valid.');
            }
            $title = $pageContent['title'] ?? null;
            $subtitle = $pageContent['subtitle'] ?? null;
            if (!is_string($title) || $title === '' || strlen($title) > 200
                || !is_string($subtitle) || $subtitle === '' || strlen($subtitle) > 1000) {
                throw new InvalidArgumentException('Judul atau deskripsi halaman tidak valid.');
            }

            $validatedPage = ['title' => $title, 'subtitle' => $subtitle];
            if ($page !== 'contact') {
                $pageSections = $pageContent['sections'] ?? null;
                $maxSections = $page === 'about' ? 8 : 16;
                if (!is_array($pageSections) || !array_is_list($pageSections)
                    || count($pageSections) === 0 || count($pageSections) > $maxSections) {
                    throw new InvalidArgumentException('Bagian halaman tidak valid.');
                }

                $validatedSections = [];
                foreach ($pageSections as $item) {
                    if (!is_array($item)
                        || !is_string($item['title'] ?? null) || $item['title'] === ''
                        || strlen($item['title']) > 200
                        || !is_string($item['body'] ?? null) || $item['body'] === ''
                        || strlen($item['body']) > 5000) {
                        throw new InvalidArgumentException('Isi bagian halaman tidak valid.');
                    }
                    $validatedSections[] = ['title' => $item['title'], 'body' => $item['body']];
                }
                $validatedPage['sections'] = $validatedSections;
            }
            $validatedPages[$language][$page] = $validatedPage;
        }
    }

    return ['contacts' => $content['contacts'], 'pages' => $validatedPages];
}

$action = $_GET['action'] ?? '';

try {
    if ($action === 'public' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        respond(['content' => readContent($contentFile)]);
    }

    if ($action === 'status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $_SESSION['csrf_token'] ??= bin2hex(random_bytes(32));
        $authenticated = !empty($_SESSION['admin_authenticated']);
        respond([
            'authenticated' => $authenticated,
            'csrfToken' => $_SESSION['csrf_token'],
            'content' => $authenticated ? readContent($contentFile) : null,
        ]);
    }

    if (!in_array($action, ['login', 'save', 'logout'], true)
        || $_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['error' => 'Permintaan tidak valid.'], 405);
    }

    if (!csrfIsValid()) {
        respond(['error' => 'Sesi kedaluwarsa. Muat ulang halaman lalu coba lagi.'], 403);
    }

    if ($action === 'login') {
        $rawBody = file_get_contents('php://input');
        if ($rawBody === false || strlen($rawBody) > 4096) {
            respond(['error' => 'Permintaan masuk tidak valid.'], 413);
        }
        $credentials = json_decode($rawBody ?: '', true);
        [$expectedUsername, $passwordHash] = adminCredentials();
        if (!is_array($credentials) || $expectedUsername === '' || $passwordHash === '') {
            respond(['error' => 'Konfigurasi admin belum tersedia di server.'], 503);
        }
        if (loginIsRateLimited($storageDirectory)) {
            header('Retry-After: 900');
            respond(['error' => 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'], 429);
        }
        $username = $credentials['username'] ?? '';
        $password = $credentials['password'] ?? '';
        if (!is_string($username) || !is_string($password)
            || !hash_equals($expectedUsername, $username)
            || !password_verify($password, $passwordHash)) {
            recordLoginFailure($storageDirectory);
            usleep(350000);
            respond(['error' => 'Nama pengguna atau kata sandi salah.'], 401);
        }

        session_regenerate_id(true);
        $_SESSION['admin_authenticated'] = true;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        respond([
            'authenticated' => true,
            'csrfToken' => $_SESSION['csrf_token'],
            'content' => readContent($contentFile),
        ]);
    }

    if (empty($_SESSION['admin_authenticated'])) {
        respond(['error' => 'Sesi admin tidak valid. Silakan masuk kembali.'], 401);
    }

    if ($action === 'logout') {
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        respond(['authenticated' => false, 'csrfToken' => $_SESSION['csrf_token']]);
    }

    $rawBody = file_get_contents('php://input');
    if ($rawBody === false || strlen($rawBody) > 131072) {
        respond(['error' => 'Ukuran konten melebihi batas.'], 413);
    }
    $validatedContent = validateContent(json_decode($rawBody, true, 32, JSON_THROW_ON_ERROR));

    ensureStorageDirectory($storageDirectory);
    $temporaryFile = tempnam($storageDirectory, 'content-');
    if ($temporaryFile === false) {
        throw new RuntimeException('Unable to create temporary content file');
    }
    try {
        $json = json_encode(
            $validatedContent,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR
        );
        if (file_put_contents($temporaryFile, $json, LOCK_EX) === false
            || !chmod($temporaryFile, 0640)
            || !rename($temporaryFile, $contentFile)) {
            throw new RuntimeException('Unable to save content');
        }
    } finally {
        if (is_file($temporaryFile)) {
            unlink($temporaryFile);
        }
    }

    respond(['saved' => true]);
} catch (InvalidArgumentException $error) {
    respond(['error' => $error->getMessage()], 422);
} catch (JsonException $error) {
    respond(['error' => 'Format data tidak valid.'], 400);
} catch (Throwable $error) {
    error_log('Admin content API error: ' . $error->getMessage());
    respond(['error' => 'Terjadi kesalahan server saat memproses konten.'], 500);
}
