<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function failGuestSupport(string $logMessage, int $status = 502): never
{
    error_log('Guest support API: ' . $logMessage);
    respond(['error' => 'Layanan tiket dukungan sedang tidak tersedia. Coba lagi nanti.'], $status);
}

function fossBillingBaseUrl(): string
{
    $baseUrl = rtrim(trim((string) (getenv('FOSSBILLING_BASE_URL') ?: 'http://localhost:8086')), '/');
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
        failGuestSupport('FOSSBILLING_BASE_URL is invalid.');
    }

    return $baseUrl;
}

function callFossBillingGuest(string $method, array $payload): mixed
{
    if (!function_exists('curl_init')) {
        failGuestSupport('The PHP cURL extension is unavailable.');
    }

    $body = '';
    $curl = curl_init(fossBillingBaseUrl() . '/api/guest/support/' . $method);
    if ($curl === false) {
        failGuestSupport('Unable to initialize cURL.');
    }

    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    curl_setopt_array($curl, [
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/json',
            'X-Forwarded-For: ' . $clientIp,
            'X-Real-IP: ' . $clientIp,
        ],
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
    curl_close($curl);

    if ($result === false) {
        failGuestSupport('FossBilling request failed: ' . $curlError);
    }

    try {
        $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        failGuestSupport('FossBilling returned invalid JSON (HTTP ' . $status . ').');
    }

    if (!is_array($decoded)) {
        failGuestSupport('FossBilling returned an unexpected response (HTTP ' . $status . ').');
    }

    if (($decoded['error'] ?? null) !== null) {
        $error = $decoded['error'];
        $message = is_string($error)
            ? $error
            : (is_array($error) && is_string($error['message'] ?? null)
                ? $error['message']
                : 'Permintaan tidak dapat diproses.');
        respond(['error' => substr($message, 0, 500)], 422);
    }

    if ($status < 200 || $status >= 300 || !array_key_exists('result', $decoded)) {
        failGuestSupport('FossBilling returned an unexpected response (HTTP ' . $status . ').');
    }

    return $decoded['result'];
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 65536);
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    try {
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        respond(['error' => 'Body permintaan tidak valid.'], 400);
    }

    return is_array($decoded) ? $decoded : [];
}

function cleanString(mixed $value, int $maxLength): ?string
{
    if (!is_string($value)) {
        return null;
    }

    $value = trim($value);
    if ($value === '') {
        return null;
    }

    return mb_substr($value, 0, $maxLength);
}

function validTicketHash(mixed $value): ?string
{
    $hash = cleanString($value, 128);
    if ($hash === null || preg_match('/^[a-f0-9]{30,64}$/', $hash) !== 1) {
        return null;
    }

    return $hash;
}

$action = $_GET['action'] ?? '';

if ($action === 'helpdesks') {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        respond(['error' => 'Metode tidak diizinkan.'], 405);
    }

    $pairs = callFossBillingGuest('helpdesk_get_pairs', []);
    $helpdesks = [];
    if (is_array($pairs)) {
        foreach ($pairs as $id => $name) {
            if ((is_int($id) || ctype_digit((string) $id)) && is_string($name) && $name !== '') {
                $helpdesks[] = ['id' => (string) $id, 'name' => mb_substr($name, 0, 200)];
            }
        }
    }

    respond(['helpdesks' => $helpdesks]);
}

if (!in_array($action, ['ticket-create', 'ticket-get', 'ticket-reply', 'ticket-close'], true)) {
    respond(['error' => 'Aksi tidak dikenal.'], 404);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Metode tidak diizinkan.'], 405);
}

$input = readJsonBody();

if ($action === 'ticket-create') {
    $name = cleanString($input['name'] ?? null, 255);
    $email = cleanString($input['email'] ?? null, 255);
    $subject = cleanString($input['subject'] ?? null, 255);
    $content = cleanString($input['content'] ?? $input['message'] ?? null, 20000);
    $helpdeskId = $input['support_helpdesk_id'] ?? $input['helpdesk_id'] ?? null;

    if ($name === null || $email === null || $subject === null || $content === null) {
        respond(['error' => 'Nama, email, subjek, dan pesan wajib diisi.'], 422);
    }
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        respond(['error' => 'Alamat email tidak valid.'], 422);
    }
    if (mb_strlen($content) < 4) {
        respond(['error' => 'Pesan terlalu pendek.'], 422);
    }

    $payload = [
        'name' => $name,
        'email' => $email,
        'subject' => $subject,
        'content' => $content,
    ];

    if ($helpdeskId !== null && $helpdeskId !== '') {
        if (!is_int($helpdeskId) && !(is_string($helpdeskId) && ctype_digit($helpdeskId))) {
            respond(['error' => 'Helpdesk tidak valid.'], 422);
        }
        $payload['support_helpdesk_id'] = (int) $helpdeskId;
    }

    $hash = callFossBillingGuest('ticket_create', $payload);
    if (!is_string($hash) || preg_match('/^[a-f0-9]{30,64}$/', $hash) !== 1) {
        failGuestSupport('FossBilling returned an unexpected ticket hash.');
    }

    respond(['hash' => $hash]);
}

$hash = validTicketHash($input['hash'] ?? null);
if ($hash === null) {
    respond(['error' => 'Hash tiket tidak valid.'], 422);
}

if ($action === 'ticket-get') {
    $ticket = callFossBillingGuest('ticket_get', ['hash' => $hash]);
    if (!is_array($ticket)) {
        failGuestSupport('FossBilling returned an invalid ticket.');
    }

    respond(['ticket' => $ticket]);
}

if ($action === 'ticket-reply') {
    $content = cleanString($input['content'] ?? $input['message'] ?? null, 20000);
    if ($content === null || mb_strlen($content) < 1) {
        respond(['error' => 'Balasan tidak boleh kosong.'], 422);
    }

    $messageId = callFossBillingGuest('ticket_reply', ['hash' => $hash, 'content' => $content]);
    respond(['result' => is_int($messageId) || is_string($messageId) ? (string) $messageId : null]);
}

if ($action === 'ticket-close') {
    callFossBillingGuest('ticket_close', ['hash' => $hash]);
    respond(['closed' => true]);
}
