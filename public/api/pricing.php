<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function failPricing(string $logMessage): never
{
    error_log('Pricing API: ' . $logMessage);
    respond(['error' => 'Pricing service is unavailable.'], 502);
}

function fetchJson(string $url, ?string $adminToken = null): array
{
    $body = '';
    $curl = curl_init($url);

    if ($curl === false) {
        throw new RuntimeException('Unable to initialize cURL.');
    }

    $options = [
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > 1048576) {
                return 0;
            }

            $body .= $chunk;
            return strlen($chunk);
        },
    ];
    if ($adminToken !== null) {
        $options[CURLOPT_HTTPAUTH] = CURLAUTH_BASIC;
        $options[CURLOPT_USERPWD] = 'admin:' . $adminToken;
    }
    curl_setopt_array($curl, $options);

    $result = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if ($result === false) {
        throw new RuntimeException('FossBilling request failed: ' . $curlError);
    }

    if ($status !== 200) {
        throw new RuntimeException('FossBilling returned HTTP ' . $status . '.');
    }

    try {
        $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new RuntimeException('FossBilling returned invalid JSON.');
    }

    if (!is_array($decoded) || ($decoded['error'] ?? null) !== null || !is_array($decoded['result'] ?? null)) {
        throw new RuntimeException('FossBilling returned an unexpected response.');
    }

    return $decoded['result'];
}

function fetchProducts(string $baseUrl, int $page, ?string $adminToken): array
{
    $area = $adminToken === null ? 'guest' : 'admin';
    try {
        $result = fetchJson($baseUrl . '/api/' . $area . '/product/get_list?' . http_build_query([
            'page' => $page,
            'per_page' => 100,
        ]), $adminToken);
    } catch (RuntimeException $exception) {
        failPricing($exception->getMessage());
    }

    if (!isset($result['list']) || !is_array($result['list']) || !isset($result['pages']) || !is_numeric($result['pages'])) {
        failPricing('FossBilling returned an unexpected product-list response.');
    }

    return $result;
}

function fetchCategoryNames(string $baseUrl): array
{
    $names = [];
    foreach (fetchJson($baseUrl . '/api/guest/product/category_get_pairs') as $id => $title) {
        if (is_string($title) && $title !== '') {
            $names[(string) $id] = $title;
        }
    }

    return $names;
}

function validPrice(mixed $value): int|float|null
{
    if (!is_numeric($value)) {
        return null;
    }

    $price = $value + 0;
    if (!is_finite((float) $price) || $price <= 0 || $price > 1000000000000) {
        return null;
    }

    return $price;
}

$baseUrl = getenv('FOSSBILLING_BASE_URL') ?: 'http://localhost:8086';
if (!function_exists('curl_init')) {
    failPricing('The PHP cURL extension is unavailable.');
}

$baseUrl = rtrim(trim($baseUrl), '/');
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
    failPricing('FOSSBILLING_BASE_URL must be HTTPS, or HTTP on a private IP or loopback host, with no path or credentials.');
}

$currency = getenv('PRICING_CURRENCY') ?: 'IDR';
if (!preg_match('/^[A-Z]{3}$/', $currency)) {
    failPricing('PRICING_CURRENCY must be a three-letter uppercase currency code.');
}

$adminToken = null;
if (($_GET['scope'] ?? '') === 'dashboard') {
    session_start(['read_and_close' => true, 'use_strict_mode' => 1]);
    if (empty($_SESSION['fossbilling_authenticated'])) {
        respond(['error' => 'Sesi akun tidak valid. Silakan masuk kembali.'], 401);
    }

    $token = trim((string) getenv('FOSSBILLING_ADMIN_TOKEN'));
    if ($token !== '') {
        $adminToken = $token;
    }
}

$productPresentation = [];
$products = [];
$page = 1;
$pages = null;

do {
    $result = fetchProducts($baseUrl, $page, $adminToken);
    $reportedPages = (int) $result['pages'];

    if ($reportedPages < 1 || $reportedPages > 20 || ($pages !== null && $pages !== $reportedPages)) {
        failPricing('FossBilling returned an unsupported page count.');
    }

    $pages = $reportedPages;
    foreach ($result['list'] as $product) {
        if (is_array($product)) {
            $products[] = $product;
        }
    }

    $page++;
} while ($page <= $pages);

$categoryNames = [];
try {
    $categoryNames = fetchCategoryNames($baseUrl);
} catch (Throwable $exception) {
    error_log('Pricing API: unable to load product categories: ' . $exception->getMessage());
}

$plans = [];
foreach ($products as $product) {
    if (($product['status'] ?? null) === 'disabled') {
        continue;
    }

    $id = $product['id'] ?? null;
    $slug = $product['slug'] ?? null;
    $name = $product['title'] ?? null;
    $categoryId = $product['product_category_id'] ?? null;
    $productPricing = $product['pricing'] ?? null;
    $pricing = is_array($productPricing) ? ($productPricing['recurrent'] ?? null) : null;

    if (
        (!is_string($id) && !is_int($id))
        || !is_string($slug)
        || $slug === ''
        || !is_string($name)
        || $name === ''
        || !is_array($pricing)
    ) {
        continue;
    }

    $monthly = $pricing['1M'] ?? null;
    $annual = $pricing['1Y'] ?? null;
    if (
        !is_array($monthly)
        || ($monthly['enabled'] ?? false) !== true
        || !is_array($annual)
        || ($annual['enabled'] ?? false) !== true
    ) {
        continue;
    }

    $monthlyPrice = validPrice($monthly['price'] ?? null);
    $annualPrice = validPrice($annual['price'] ?? null);
    if ($monthlyPrice === null || $annualPrice === null) {
        continue;
    }

    $details = $productPresentation[$slug] ?? [];
    $plan = [
        'id' => (string) $id,
        'name' => $name,
        'category_id' => is_int($categoryId) || is_string($categoryId) ? (string) $categoryId : null,
        'monthly_price' => $monthlyPrice,
        'annual_price' => $annualPrice,
        'description' => is_string($product['description'] ?? null) ? $product['description'] : '',
        'features' => $details['features'] ?? [],
        'featured' => $details['featured'] ?? false,
    ];

    $configuredStorage = is_array($product['config'] ?? null) ? ($product['config']['storage'] ?? null) : null;
    if (is_string($configuredStorage) && trim($configuredStorage) !== '') {
        $plan['storage'] = substr(trim($configuredStorage), 0, 50);
    } elseif (is_string($details['storage'] ?? null) && $details['storage'] !== '') {
        $plan['storage'] = $details['storage'];
    }
    if (is_int($details['users'] ?? null) && $details['users'] > 0) {
        $plan['users'] = $details['users'];
    }
    if (isset($details['translations']) && is_array($details['translations'])) {
        $plan['translations'] = $details['translations'];
    }

    $plans[] = $plan;
}

$usedCategories = [];
foreach ($plans as $plan) {
    $categoryId = $plan['category_id'];
    if ($categoryId !== null && !isset($usedCategories[$categoryId])) {
        $usedCategories[$categoryId] = ['id' => $categoryId, 'name' => $categoryNames[$categoryId] ?? 'Kategori ' . $categoryId];
    }
}

if ($plans === []) {
    failPricing('FossBilling returned no products with enabled monthly and yearly pricing.');
}

respond([
    'source' => 'fossbilling',
    'currency' => $currency,
    'categories' => array_values($usedCategories),
    'plans' => $plans,
]);
