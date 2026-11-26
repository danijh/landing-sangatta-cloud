<?php
// Helper CLI untuk provisioning bucket & kredensial di provider non-MinIO
// (Cloudflare R2, Backblaze B2). Dipanggil oleh nextcloud-storage-sync.sh.
//
// Pemakaian:
//   php storage-provider.php <spec-file> <provider> <action> [args...]
//
// Spec provider (dari nextcloud-mounts.json -> providers.<name>):
//   type        — 'cloudflare' | 'b2' | 's3-admin'
//   account_id  — (cloudflare) Cloudflare account ID
//   api_url     — (b2) B2 API base, default https://api.backblazeb2.com
//   s3          — {hostname, region, use_ssl, use_path_style} untuk mount NC
//
// Kredensial diambil dari env (BUKAN disimpan di spec):
//   cloudflare: CLOUDFLARE_API_TOKEN  — user API token dgn izin API Tokens Edit
//   b2:         B2_KEY_ID, B2_APP_KEY — master application key
//
// Aksi:
//   bucket-exists <bucket>                  → exit 0 ada / 1 tidak ada
//   ensure-bucket <bucket>                  → buat bucket (idempotent)
//   remove-bucket <bucket>                  → hapus bucket
//   ensure-credentials <ncUser> <b1,b2,..>  → JSON {access_key,secret_key}
//   revoke-credentials <ncUser>             → cabut kredensial provider tsb
//   usage <credUser> <bucket>               → JSON {"bytes": N} via S3 ListObjectsV2
//
// Kredensial user disimpan di <storage>/s3-credentials.json dengan format:
//   {"fb_4": {"r2": {"access_key": "...", "secret_key": "...", "token_id": "..."}}}

declare(strict_types=1);

$specFile = $argv[1] ?? '';
$providerName = $argv[2] ?? '';
$action = $argv[3] ?? '';
$args = array_slice($argv, 4);

if ($specFile === '' || $providerName === '' || $action === '') {
    fwrite(STDERR, "Usage: php storage-provider.php <spec> <provider> <action> [args]\n");
    exit(2);
}

$spec = json_decode((string) @file_get_contents($specFile), true);
$provider = $spec['providers'][$providerName] ?? null;
if (!is_array($provider)) {
    fwrite(STDERR, "Provider '$providerName' tidak ada di spec\n");
    exit(2);
}
$type = (string) ($provider['type'] ?? 's3-admin');
$storageDir = dirname($specFile);
$credsFile = $storageDir . '/s3-credentials.json';

function httpJson(string $method, string $url, ?array $body = null, array $headers = [], ?string $basicAuth = null): array
{
    $curl = curl_init($url);
    $h = ['Accept: application/json'];
    if ($body !== null) {
        $h[] = 'Content-Type: application/json';
    }
    $h = array_merge($h, $headers);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $h,
    ]);
    if ($basicAuth !== null) {
        curl_setopt($curl, CURLOPT_USERPWD, $basicAuth);
    }
    if ($body !== null) {
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $err = curl_error($curl);
    curl_close($curl);
    $json = is_string($raw) ? json_decode($raw, true) : null;
    return ['status' => $status, 'json' => is_array($json) ? $json : null,
            'body' => is_string($raw) ? $raw : '', 'error' => $err];
}

function credsLoad(string $file): array
{
    $data = is_file($file) ? json_decode((string) @file_get_contents($file), true) : null;
    return is_array($data) ? $data : [];
}

function credsSave(string $file, array $data): void
{
    $tmp = $file . '.tmp';
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if (@file_put_contents($tmp, $json, LOCK_EX) === false
        || !@rename($tmp, $file)) {
        @unlink($tmp);
        throw new RuntimeException('Gagal menulis kredensial ke ' . $file . ' (permission?)');
    }
}

// --- Cloudflare R2 ---

function cfApi(string $method, string $path, ?array $body = null): array
{
    global $providerAccountId;
    $token = trim((string) getenv('CLOUDFLARE_API_TOKEN'));
    if ($token === '') {
        throw new RuntimeException('CLOUDFLARE_API_TOKEN belum diset');
    }
    $accountId = $providerAccountId !== '' ? $providerAccountId : (string) (getenv('R2_ACCOUNT_ID') ?: '');
    if ($accountId === '') {
        throw new RuntimeException('R2_ACCOUNT_ID belum diset (spec.account_id / env)');
    }
    $res = httpJson($method, 'https://api.cloudflare.com/client/v4' . $path, $body, [
        'Authorization: Bearer ' . $token,
    ]);
    $ok = is_array($res['json']) && ($res['json']['success'] ?? false) === true;
    if (!$ok && $res['status'] !== 404) {
        $msg = $res['json']['errors'][0]['message'] ?? ($res['error'] ?: 'HTTP ' . $res['status']);
        throw new RuntimeException('Cloudflare API: ' . $msg);
    }
    return $res;
}

function cfBucketPath(string $bucket): string
{
    global $providerAccountId;
    $accountId = $providerAccountId !== '' ? $providerAccountId : (string) (getenv('R2_ACCOUNT_ID') ?: '');
    return '/accounts/' . $accountId . '/r2/buckets/' . rawurlencode($bucket);
}

function r2BucketExists(string $bucket): bool
{
    $res = cfApi('GET', cfBucketPath($bucket));
    return $res['status'] === 200;
}

function r2EnsureBucket(string $bucket): void
{
    if (r2BucketExists($bucket)) {
        return;
    }
    $res = cfApi('PUT', cfBucketPath($bucket));
    // Beberapa response CF mengembalikan sukses walau bucket sudah ada.
    if ($res['status'] >= 400) {
        throw new RuntimeException('Gagal membuat bucket R2 ' . $bucket . ' (HTTP ' . $res['status'] . ')');
    }
}

function r2RemoveBucket(string $bucket): void
{
    if (!r2BucketExists($bucket)) {
        return;
    }
    $res = cfApi('DELETE', cfBucketPath($bucket));
    if ($res['status'] >= 400) {
        throw new RuntimeException('Gagal menghapus bucket R2 ' . $bucket);
    }
}

// Permission group "Workers R2 Storage Bucket Item Read/Write" di-resolve
// dinamis via API — ID di Cloudflare tidak stabil antar akun/region.
function r2PermissionGroupIds(): array
{
    global $providerAccountId;
    $accountId = $providerAccountId !== '' ? $providerAccountId : (string) (getenv('R2_ACCOUNT_ID') ?: '');
    $res = cfApi('GET', '/accounts/' . $accountId . '/tokens/permission_groups');
    $groups = $res['json']['result'] ?? [];
    $read = $write = null;
    foreach ((array) $groups as $g) {
        $name = strtolower((string) ($g['name'] ?? ''));
        $id = (string) ($g['id'] ?? '');
        if ($id === '') { continue; }
        if ($read === null && str_contains($name, 'r2') && str_contains($name, 'item') && str_contains($name, 'read')) {
            $read = $id;
        }
        if ($write === null && str_contains($name, 'r2') && str_contains($name, 'item') && str_contains($name, 'write')) {
            $write = $id;
        }
    }
    if ($read === null || $write === null) {
        throw new RuntimeException('Permission group R2 Item Read/Write tidak ditemukan — pastikan API token punya izin membaca permission groups');
    }
    return [$read, $write];
}

function r2TokenCreate(string $name, array $bucketNames): array
{
    global $providerAccountId;
    $accountId = $providerAccountId !== '' ? $providerAccountId : (string) (getenv('R2_ACCOUNT_ID') ?: '');
    [$pgRead, $pgWrite] = r2PermissionGroupIds();
    $resources = [];
    foreach ($bucketNames as $b) {
        $resources['com.cloudflare.edge.r2.bucket.' . $accountId . '_default_' . $b] = '*';
    }
    $res = cfApi('POST', '/accounts/' . $accountId . '/tokens', [
        'name' => $name,
        'policies' => [[
            'effect' => 'allow',
            'resources' => $resources,
            'permission_groups' => [
                ['id' => $pgRead],
                ['id' => $pgWrite],
            ],
        ]],
    ]);
    $result = $res['json']['result'] ?? null;
    if (!is_array($result) || empty($result['id']) || empty($result['value'])) {
        throw new RuntimeException('Gagal membuat R2 API token');
    }
    return $result;
}

function r2TokenDelete(string $tokenId): void
{
    global $providerAccountId;
    $accountId = $providerAccountId !== '' ? $providerAccountId : (string) (getenv('R2_ACCOUNT_ID') ?: '');
    try {
        cfApi('DELETE', '/accounts/' . $accountId . '/tokens/' . rawurlencode($tokenId));
    } catch (Throwable $e) {
        fwrite(STDERR, 'warn: gagal revoke R2 token ' . $tokenId . ': ' . $e->getMessage() . "\n");
    }
}

// --- Backblaze B2 ---

function b2Auth(): array
{
    $keyId = trim((string) getenv('B2_KEY_ID'));
    $appKey = trim((string) getenv('B2_APP_KEY'));
    if ($keyId === '' || $appKey === '') {
        throw new RuntimeException('B2_KEY_ID / B2_APP_KEY belum diset');
    }
    $apiUrl = rtrim((string) (getenv('B2_API_URL') ?: 'https://api.backblazeb2.com'), '/');
    $res = httpJson('GET', $apiUrl . '/b2api/v4/b2_authorize_account', null, [], $keyId . ':' . $appKey);
    $json = $res['json'] ?? null;
    if (!is_array($json) || empty($json['authorizationToken']) || empty($json['apiInfo']['storageApi']['apiUrl'])) {
        throw new RuntimeException('B2 authorize gagal: ' . ($res['error'] ?: 'respons tidak valid'));
    }
    $info = $json['apiInfo']['storageApi'];
    return [
        'token' => $json['authorizationToken'],
        'account_id' => (string) $json['accountId'],
        'api_url' => rtrim((string) $info['apiUrl'], '/'),
        'download_url' => (string) ($info['downloadUrl'] ?? ''),
    ];
}

function b2Api(array $auth, string $action, array $body = []): array
{
    // b2_delete_key menolak field accountId — cukup applicationKeyId.
    if ($action !== 'b2_delete_key') {
        $body['accountId'] = $auth['account_id'];
    }
    $res = httpJson('POST', $auth['api_url'] . '/b2api/v4/' . $action, $body, [
        'Authorization: ' . $auth['token'],
    ]);
    $json = $res['json'] ?? null;
    if (is_array($json) && isset($json['code'])) {
        throw new RuntimeException('B2 ' . $action . ': ' . $json['code'] . ' — ' . ($json['message'] ?? ''));
    }
    if ($res['status'] >= 400 || !is_array($json)) {
        throw new RuntimeException('B2 ' . $action . ' gagal (HTTP ' . $res['status'] . ')');
    }
    return $json;
}

function b2BucketMap(array $auth): array
{
    $res = b2Api($auth, 'b2_list_buckets');
    $map = [];
    foreach ((array) ($res['buckets'] ?? []) as $b) {
        if (isset($b['bucketName'], $b['bucketId'])) {
            $map[(string) $b['bucketName']] = (string) $b['bucketId'];
        }
    }
    return $map;
}

function b2EnsureBucket(string $bucket): void
{
    $auth = b2Auth();
    $map = b2BucketMap($auth);
    if (isset($map[$bucket])) {
        return;
    }
    try {
        b2Api($auth, 'b2_create_bucket', [
            'bucketName' => $bucket,
            'bucketType' => 'allPrivate',
        ]);
    } catch (Throwable $e) {
        // bucket_name_in_use / duplicate → dianggap sudah ada
        if (stripos($e->getMessage(), 'bucket_name_in_use') === false
            && stripos($e->getMessage(), 'duplicate') === false) {
            throw $e;
        }
    }
}

function b2RemoveBucket(string $bucket): void
{
    $auth = b2Auth();
    $map = b2BucketMap($auth);
    $bucketId = $map[$bucket] ?? null;
    if ($bucketId === null) {
        return;
    }
    b2Api($auth, 'b2_delete_bucket', ['bucketId' => $bucketId]);
}

function b2EnsureCredentials(string $ncUser, array $buckets, string $credsFile): array
{
    global $providerNameGlobal;
    $auth = b2Auth();
    $map = b2BucketMap($auth);
    $bucketIds = [];
    foreach ($buckets as $b) {
        if (!isset($map[$b])) {
            throw new RuntimeException('Bucket B2 ' . $b . ' tidak ditemukan');
        }
        $bucketIds[] = $map[$b];
    }
    sort($bucketIds);

    // listBuckets wajib ada: B2 S3 API menolak key tanpa capability ini
    // (Access Denied saat list/head bucket), walau native API tetap jalan.
    $capabilities = ['listBuckets', 'listFiles', 'readFiles', 'writeFiles', 'deleteFiles'];

    $creds = credsLoad($credsFile);
    $existing = $creds[$ncUser][$providerNameGlobal] ?? null;
    $wantHash = md5(implode(',', $bucketIds) . '|' . implode(',', $capabilities));
    if (is_array($existing)
        && ($existing['buckets_hash'] ?? '') === $wantHash
        && !empty($existing['access_key'])
        && !empty($existing['secret_key'])) {
        return $existing;
    }

    // Cabut key lama bila bucket berubah.
    if (is_array($existing) && !empty($existing['key_id'])) {
        try {
            b2Api($auth, 'b2_delete_key', ['applicationKeyId' => $existing['key_id']]);
        } catch (Throwable $e) {
            fwrite(STDERR, 'warn: gagal revoke B2 key lama: ' . $e->getMessage() . "\n");
        }
    }

    $res = b2Api($auth, 'b2_create_key', [
        'keyName' => 'fb-' . preg_replace('/[^a-zA-Z0-9]/', '-', $ncUser) . '-' . substr(md5($ncUser . microtime()), 0, 6),
        'capabilities' => $capabilities,
        'bucketIds' => $bucketIds,
    ]);
    $key = [
        'access_key' => (string) ($res['applicationKeyId'] ?? ''),
        'secret_key' => (string) ($res['applicationKey'] ?? ''),
        'key_id' => (string) ($res['applicationKeyId'] ?? ''),
        'buckets_hash' => $wantHash,
    ];
    if ($key['access_key'] === '' || $key['secret_key'] === '') {
        throw new RuntimeException('b2_create_key tidak mengembalikan key');
    }
    $creds[$ncUser][$providerNameGlobal] = $key;
    credsSave($credsFile, $creds);
    return $key;
}

function b2RevokeCredentials(string $ncUser, string $credsFile): void
{
    global $providerNameGlobal;
    $creds = credsLoad($credsFile);
    $existing = $creds[$ncUser][$providerNameGlobal] ?? null;
    if (!is_array($existing)) {
        return;
    }
    if (!empty($existing['key_id'])) {
        try {
            b2Api(b2Auth(), 'b2_delete_key', ['applicationKeyId' => $existing['key_id']]);
        } catch (Throwable $e) {
            fwrite(STDERR, 'warn: ' . $e->getMessage() . "\n");
        }
    }
    unset($creds[$ncUser][$providerNameGlobal]);
    if (($creds[$ncUser] ?? []) === []) {
        unset($creds[$ncUser]);
    }
    credsSave($credsFile, $creds);
}

// --- Cloudflare R2 credentials ---

function r2EnsureCredentials(string $ncUser, array $buckets, string $credsFile): array
{
    global $providerNameGlobal;
    $creds = credsLoad($credsFile);
    $existing = $creds[$ncUser][$providerNameGlobal] ?? null;
    $wantHash = md5(implode(',', $buckets));
    if (is_array($existing)
        && ($existing['buckets_hash'] ?? '') === $wantHash
        && !empty($existing['access_key'])
        && !empty($existing['secret_key'])) {
        return $existing;
    }
    if (is_array($existing) && !empty($existing['token_id'])) {
        r2TokenDelete((string) $existing['token_id']);
    }

    $tokenName = 'fb-' . preg_replace('/[^a-zA-Z0-9-]/', '-', $ncUser) . '-' . substr(md5($ncUser . microtime()), 0, 8);
    $token = r2TokenCreate($tokenName, $buckets);
    $key = [
        'access_key' => (string) $token['id'],
        'secret_key' => hash('sha256', (string) $token['value']),
        'token_id' => (string) $token['id'],
        'buckets_hash' => $wantHash,
    ];
    $creds[$ncUser][$providerNameGlobal] = $key;
    credsSave($credsFile, $creds);
    return $key;
}

function r2RevokeCredentials(string $ncUser, string $credsFile): void
{
    global $providerNameGlobal;
    $creds = credsLoad($credsFile);
    $existing = $creds[$ncUser][$providerNameGlobal] ?? null;
    if (!is_array($existing)) {
        return;
    }
    if (!empty($existing['token_id'])) {
        r2TokenDelete((string) $existing['token_id']);
    }
    unset($creds[$ncUser][$providerNameGlobal]);
    if (($creds[$ncUser] ?? []) === []) {
        unset($creds[$ncUser]);
    }
    credsSave($credsFile, $creds);
}

// --- Usage storage: S3 ListObjectsV2 + AWS SigV4 ---
// Berfungsi untuk semua provider S3-compatible (R2, B2, MinIO) karena
// ketiganya bicara S3 API untuk operasi object.

function s3CredsFor(string $credUser, string $credsFile, string $type): ?array
{
    global $providerNameGlobal;
    $creds = credsLoad($credsFile);
    $c = $creds[$credUser][$providerNameGlobal] ?? $creds[$credUser]['minio'] ?? $creds[$credUser]['default'] ?? null;
    if (!is_array($c) || empty($c['access_key']) || empty($c['secret_key'])) {
        // legacy flat {user:{access_key,secret_key}} — hanya provider s3-admin
        if ($type === 's3-admin' && isset($creds[$credUser]['access_key'], $creds[$credUser]['secret_key'])) {
            $c = $creds[$credUser];
        }
    }
    return is_array($c) && !empty($c['access_key']) && !empty($c['secret_key']) ? $c : null;
}

// GET bertanda tangan SigV4. $host boleh "host" atau "host:port".
// $virtualHost=true → bucket jadi subdomain ({bucket}.{host}), uri=/.
// $virtualHost=false → path-style ({host}/{bucket}), uri=/{bucket}.
function s3SignedGet(string $scheme, string $host, string $region, string $ak, string $sk,
                     string $bucket, bool $virtualHost, string $query): array
{
    $hostname = preg_replace('/:\d+$/', '', $host);
    $canonicalHost = $virtualHost ? $bucket . '.' . $hostname : $host;
    if ($virtualHost && preg_match('/:\d+$/', $host, $m)) {
        $canonicalHost .= $m[0];
    }
    $uri = $virtualHost ? '/' : '/' . $bucket;

    $amzDate = gmdate('Ymd\THis\Z');
    $dateStamp = gmdate('Ymd');
    $payloadHash = hash('sha256', '');

    $headers = [
        'host' => $canonicalHost,
        'x-amz-content-sha256' => $payloadHash,
        'x-amz-date' => $amzDate,
    ];
    ksort($headers);
    $canonicalHeaders = '';
    $signedHeaders = '';
    foreach ($headers as $k => $v) {
        $canonicalHeaders .= $k . ':' . trim($v) . "\n";
        $signedHeaders .= ($signedHeaders === '' ? '' : ';') . $k;
    }

    $canonicalRequest = "GET\n" . $uri . "\n" . $query . "\n" . $canonicalHeaders . "\n" . $signedHeaders . "\n" . $payloadHash;
    $scope = $dateStamp . '/' . $region . '/s3/aws4_request';
    $stringToSign = "AWS4-HMAC-SHA256\n" . $amzDate . "\n" . $scope . "\n" . hash('sha256', $canonicalRequest);

    $kDate = hash_hmac('sha256', $dateStamp, 'AWS4' . $sk, true);
    $kRegion = hash_hmac('sha256', $region, $kDate, true);
    $kService = hash_hmac('sha256', 's3', $kRegion, true);
    $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
    $signature = hash_hmac('sha256', $stringToSign, $kSigning);

    $auth = 'AWS4-HMAC-SHA256 Credential=' . $ak . '/' . $scope
        . ', SignedHeaders=' . $signedHeaders . ', Signature=' . $signature;

    $path = $virtualHost ? '/' : '/' . rawurlencode($bucket);
    return httpJson('GET', $scheme . '://' . $canonicalHost . $path . '?' . $query, null, [
        'Authorization: ' . $auth,
        'x-amz-date: ' . $amzDate,
        'x-amz-content-sha256: ' . $payloadHash,
    ]);
}

// Jumlahkan Size semua object di bucket via ListObjectsV2 (paginated).
// Return bytes; lempar exception bila bucket tidak bisa diakses.
function s3BucketUsage(array $s3, string $bucket, string $ak, string $sk): int
{
    $host = trim((string) ($s3['hostname'] ?? ''));
    if ($host === '') {
        throw new RuntimeException('hostname provider kosong');
    }
    $ssl = filter_var($s3['use_ssl'] ?? true, FILTER_VALIDATE_BOOLEAN);
    $scheme = $ssl ? 'https' : 'http';
    $region = (string) ($s3['region'] ?? 'us-east-1');
    if ($region === '') { $region = 'us-east-1'; }
    // R2 memakai region 'auto' untuk signing.
    $pathStyle = filter_var($s3['use_path_style'] ?? true, FILTER_VALIDATE_BOOLEAN);

    $total = 0;
    $token = '';
    $triedAlt = false;
    do {
        $params = ['list-type' => '2', 'max-keys' => '1000'];
        if ($token !== '') { $params['continuation-token'] = $token; }
        // canonical query harus sorted by name dan URI-encoded
        ksort($params);
        $query = implode('&', array_map(
            fn($k, $v) => rawurlencode($k) . '=' . rawurlencode($v),
            array_keys($params), array_values($params)
        ));

        $res = s3SignedGet($scheme, $host, $region, $ak, $sk, $bucket, !$pathStyle, $query);

        // fallback ke style satunya bila style konfigurasi ditolak provider
        if ($res['status'] >= 400 && !$triedAlt) {
            $triedAlt = true;
            $pathStyle = !$pathStyle;
            continue;
        }
        if ($res['status'] >= 400) {
            $snippet = is_string($res['body'] ?? null) ? substr(strip_tags((string) $res['body']), 0, 160) : '';
            throw new RuntimeException('ListObjects ' . $bucket . ' HTTP ' . $res['status'] . ' ' . $snippet);
        }
        $body = (string) ($res['body'] ?? '');
        if (preg_match_all('/<Size>(\d+)<\/Size>/', $body, $mm)) {
            foreach ($mm[1] as $s) { $total += (int) $s; }
        }
        $truncated = str_contains($body, '<IsTruncated>true</IsTruncated>');
        $token = '';
        if ($truncated && preg_match('/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/', $body, $tm)) {
            $token = $tm[1];
        } else {
            $truncated = false;
        }
    } while ($truncated);
    return $total;
}

// Dipakai fungsi di atas — di-set setelah parsing argumen.
$providerNameGlobal = $providerName;
$providerAccountId = trim((string) ($provider['account_id'] ?? ''));

$bucketsArg = static function (string $csv): array {
    return array_values(array_filter(array_map('trim', explode(',', $csv))));
};

try {
    // usage berlaku untuk semua tipe provider (murni S3 API + kredensial
    // tersimpan) — tidak bergantung pada mekanisme admin bucket-nya.
    if ($action === 'usage') {
        $credUser = (string) ($args[0] ?? '');
        $bucket = (string) ($args[1] ?? '');
        $s3 = is_array($provider['s3'] ?? null) ? $provider['s3'] : [];
        $creds = s3CredsFor($credUser, $credsFile, $type);
        if ($creds === null) {
            fwrite(STDERR, "usage: kredensial $credUser/$providerName tidak ada\n");
            exit(1);
        }
        $bytes = s3BucketUsage($s3, $bucket, (string) $creds['access_key'], (string) $creds['secret_key']);
        echo json_encode(['bucket' => $bucket, 'bytes' => $bytes]);
        exit(0);
    }

    switch ($type) {
        case 'cloudflare':
            switch ($action) {
                case 'bucket-exists':
                    exit(r2BucketExists($args[0] ?? '') ? 0 : 1);
                case 'ensure-bucket':
                    r2EnsureBucket($args[0] ?? '');
                    break;
                case 'remove-bucket':
                    r2RemoveBucket($args[0] ?? '');
                    break;
                case 'ensure-credentials':
                    echo json_encode(r2EnsureCredentials($args[0] ?? '', $bucketsArg($args[1] ?? ''), $credsFile));
                    break;
                case 'revoke-credentials':
                    r2RevokeCredentials($args[0] ?? '', $credsFile);
                    break;
                default:
                    fwrite(STDERR, "Aksi cloudflare tidak dikenal: $action\n");
                    exit(2);
            }
            break;

        case 'b2':
            switch ($action) {
                case 'bucket-exists':
                    $auth = b2Auth();
                    exit(isset(b2BucketMap($auth)[$args[0] ?? '']) ? 0 : 1);
                case 'ensure-bucket':
                    b2EnsureBucket($args[0] ?? '');
                    break;
                case 'remove-bucket':
                    b2RemoveBucket($args[0] ?? '');
                    break;
                case 'ensure-credentials':
                    echo json_encode(b2EnsureCredentials($args[0] ?? '', $bucketsArg($args[1] ?? ''), $credsFile));
                    break;
                case 'revoke-credentials':
                    b2RevokeCredentials($args[0] ?? '', $credsFile);
                    break;
                default:
                    fwrite(STDERR, "Aksi b2 tidak dikenal: $action\n");
                    exit(2);
            }
            break;

        default:
            fwrite(STDERR, "Tipe provider '$type' tidak didukung helper ini (gunakan mc di shell)\n");
            exit(2);
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'storage-provider error: ' . $e->getMessage() . "\n");
    exit(1);
}
