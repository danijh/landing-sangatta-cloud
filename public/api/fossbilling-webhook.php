<?php
declare(strict_types=1);

// Receives signed webhooks from the FOSSBilling "Webhook" module and stores them
// as per-client notifications for the dashboard (see the "notifications" action
// in fossbilling-auth.php).

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reject(int $status): never
{
    http_response_code($status);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    reject(405);
}

$secret = getenv('FOSSBILLING_WEBHOOK_SECRET') ?: '';
if ($secret === '') {
    error_log('FossBilling webhook rejected: FOSSBILLING_WEBHOOK_SECRET is not configured.');
    reject(503);
}

$raw = file_get_contents('php://input', false, null, 0, 65537);
if ($raw === false || strlen($raw) > 65536) {
    reject(413);
}

$signature = $_SERVER['HTTP_X_FOSSBILLING_SIGNATURE'] ?? '';
if (!hash_equals('sha256=' . hash_hmac('sha256', $raw, $secret), $signature)) {
    reject(401);
}

$payload = json_decode($raw, true);
if (!is_array($payload)
    || ($payload['event'] ?? '') !== 'onAfterAdminReplyTicket'
    || !is_int($payload['timestamp'] ?? null)
    || abs(time() - $payload['timestamp']) > 300
    || !is_array($payload['data'] ?? null)) {
    reject(400);
}

$data = $payload['data'];
$clientId = $data['client_id'] ?? null;
$ticketId = $data['ticket_id'] ?? null;
if (!is_int($clientId) || $clientId < 1 || !is_int($ticketId) || $ticketId < 1) {
    reject(400);
}

$directory = dirname(__DIR__, 2) . '/storage/notifications';
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
    error_log('FossBilling webhook: cannot create notification storage.');
    reject(500);
}

$handle = fopen($directory . '/' . $clientId . '.json', 'c+');
if ($handle === false || !flock($handle, LOCK_EX)) {
    reject(500);
}

$items = json_decode(stream_get_contents($handle) ?: '[]', true);
$items = is_array($items) ? $items : [];
$lastId = $items === [] ? 0 : (int) end($items)['id'];

$items[] = [
    'id' => $lastId + 1,
    'ticketId' => $ticketId,
    'subject' => substr(is_string($data['subject'] ?? null) ? $data['subject'] : '', 0, 200),
    'createdAt' => time(),
];
$items = array_slice($items, -50);

ftruncate($handle, 0);
rewind($handle);
fwrite($handle, json_encode($items, JSON_THROW_ON_ERROR));
fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);

http_response_code(204);
