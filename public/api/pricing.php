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

function fetchProducts(string $baseUrl, int $page): array
{
    $url = $baseUrl . '/api/guest/product/get_list?' . http_build_query([
        'page' => $page,
        'per_page' => 100,
    ]);
    $body = '';
    $curl = curl_init($url);

    if ($curl === false) {
        failPricing('Unable to initialize cURL.');
    }

    curl_setopt_array($curl, [
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
    ]);

    $result = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if ($result === false) {
        failPricing('FossBilling request failed: ' . $curlError);
    }

    if ($status !== 200) {
        failPricing('FossBilling returned HTTP ' . $status . '.');
    }

    try {
        $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        failPricing('FossBilling returned invalid JSON.');
    }

    if (!is_array($decoded) || ($decoded['error'] ?? null) !== null) {
        failPricing('FossBilling returned an unexpected product-list response.');
    }

    $result = $decoded['result'] ?? null;
    if (
        !is_array($result)
        || !isset($result['list'])
        || !is_array($result['list'])
        || !isset($result['pages'])
        || !is_numeric($result['pages'])
    ) {
        failPricing('FossBilling returned an unexpected product-list response.');
    }

    return $result;
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

$baseUrl = getenv('FOSSBILLING_BASE_URL');
if (!is_string($baseUrl) || trim($baseUrl) === '' || !function_exists('curl_init')) {
    failPricing('FOSSBILLING_BASE_URL is missing or the PHP cURL extension is unavailable.');
}

$baseUrl = rtrim(trim($baseUrl), '/');
$parts = parse_url($baseUrl);
$host = is_array($parts) ? ($parts['host'] ?? '') : '';
$scheme = is_array($parts) ? strtolower((string) ($parts['scheme'] ?? '')) : '';
$isPrivateIp = filter_var($host, FILTER_VALIDATE_IP) !== false
    && filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
$isLoopbackIp = in_array($host, ['127.0.0.1', '::1'], true);

if (
    !is_array($parts)
    || !in_array($scheme, ['https', 'http'], true)
    || ($scheme !== 'https' && !$isPrivateIp && !$isLoopbackIp)
    || isset($parts['user'])
    || isset($parts['pass'])
    || isset($parts['query'])
    || isset($parts['fragment'])
    || !in_array($parts['path'] ?? '', ['', '/'], true)
    || $host === ''
) {
    failPricing('FOSSBILLING_BASE_URL must be HTTPS, or HTTP on a private/loopback IP, with no path or credentials.');
}

$currency = getenv('PRICING_CURRENCY') ?: 'IDR';
if (!preg_match('/^[A-Z]{3}$/', $currency)) {
    failPricing('PRICING_CURRENCY must be a three-letter uppercase currency code.');
}

$productPresentation = [];
$products = [];
$page = 1;
$pages = null;

do {
    $result = fetchProducts($baseUrl, $page);
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

$plans = [];
foreach ($products as $product) {
    $id = $product['id'] ?? null;
    $slug = $product['slug'] ?? null;
    $name = $product['title'] ?? null;
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
        'monthly_price' => $monthlyPrice,
        'annual_price' => $annualPrice,
        'description' => is_string($product['description'] ?? null) ? $product['description'] : '',
        'features' => $details['features'] ?? [],
        'featured' => $details['featured'] ?? false,
    ];

    if (is_string($details['storage'] ?? null) && $details['storage'] !== '') {
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

if ($plans === []) {
    failPricing('FossBilling returned no products with enabled monthly and yearly pricing.');
}

respond([
    'source' => 'fossbilling',
    'currency' => $currency,
    'plans' => $plans,
]);
