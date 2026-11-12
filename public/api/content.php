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

function failContent(string $logMessage): never
{
    error_log('Content API: ' . $logMessage);
    respond(['error' => 'Konten tidak dapat dimuat. Coba lagi nanti.'], 502);
}

function contentBaseUrl(): string
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
        failContent('FOSSBILLING_BASE_URL is invalid.');
    }

    return $baseUrl;
}

function callGuestApi(string $endpoint, array $payload): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is unavailable.');
    }

    $body = '';
    $curl = curl_init(contentBaseUrl() . '/api/guest/' . $endpoint);
    if ($curl === false) {
        throw new RuntimeException('Unable to initialize FossBilling request.');
    }
    curl_setopt_array($curl, [
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR),
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
    if (($decoded['error'] ?? null) !== null) {
        throw new InvalidArgumentException('FossBilling rejected the request.');
    }
    $result = $decoded['result'] ?? null;
    if ($status < 200 || $status >= 300 || !is_array($result)) {
        throw new RuntimeException('FossBilling returned an unexpected response.');
    }

    return $result;
}

function contentText(mixed $value, int $limit = 20000): ?string
{
    if (!is_scalar($value)) {
        return null;
    }
    $text = trim((string) $value);

    return $text === '' ? null : mb_substr($text, 0, $limit);
}

function paginationParams(): array
{
    $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT);
    $perPage = filter_var($_GET['per_page'] ?? 20, FILTER_VALIDATE_INT);

    return [
        'page' => is_int($page) && $page >= 1 && $page <= 1000 ? $page : 1,
        'per_page' => is_int($perPage) && $perPage >= 1 ? min($perPage, 100) : 20,
    ];
}

function newsItem(array $item): ?array
{
    $id = $item['id'] ?? null;
    $title = contentText($item['title'] ?? null, 300);
    if ((!is_int($id) && !(is_string($id) && ctype_digit($id))) || $title === null) {
        return null;
    }

    $author = $item['author'] ?? null;
    $authorName = is_array($author) ? contentText($author['name'] ?? null, 200) : null;

    return [
        'id' => (int) $id,
        'title' => $title,
        'author' => $authorName,
        'description' => contentText($item['description'] ?? null, 2000),
        'content' => contentText($item['content'] ?? null, 200000),
        'slug' => contentText($item['slug'] ?? null, 300),
        'image' => contentText($item['image'] ?? null, 2000),
        'section' => contentText($item['section'] ?? null, 300),
        'published_at' => contentText($item['published_at'] ?? null, 60),
        'created_at' => contentText($item['created_at'] ?? null, 60),
        'excerpt' => contentText($item['excerpt'] ?? null, 2000),
    ];
}

function kbCategory(mixed $category): ?array
{
    if (!is_array($category)) {
        return null;
    }
    $id = $category['id'] ?? null;
    $title = contentText($category['title'] ?? null, 300);
    if ((!is_int($id) && !(is_string($id) && ctype_digit($id))) || $title === null) {
        return null;
    }

    return [
        'id' => (int) $id,
        'slug' => contentText($category['slug'] ?? null, 300),
        'title' => $title,
    ];
}

function kbCategoryEntry(array $category): ?array
{
    $id = $category['id'] ?? null;
    $title = contentText($category['title'] ?? null, 300);
    if ((!is_int($id) && !(is_string($id) && ctype_digit($id))) || $title === null) {
        return null;
    }

    $articles = [];
    foreach (is_array($category['articles'] ?? null) ? $category['articles'] : [] as $article) {
        if (is_array($article) && ($entry = kbArticleItem($article)) !== null) {
            $articles[] = $entry;
        }
    }

    return [
        'id' => (int) $id,
        'slug' => contentText($category['slug'] ?? null, 300),
        'title' => $title,
        'description' => contentText($category['description'] ?? null, 2000),
        'created_at' => contentText($category['created_at'] ?? null, 60),
        'articles' => $articles,
    ];
}

function kbArticleItem(array $item, bool $includeContent = false): ?array
{
    $id = $item['id'] ?? null;
    $title = contentText($item['title'] ?? null, 300);
    if ((!is_int($id) && !(is_string($id) && ctype_digit($id))) || $title === null) {
        return null;
    }

    $article = [
        'id' => (int) $id,
        'slug' => contentText($item['slug'] ?? null, 300),
        'title' => $title,
        'category' => kbCategory($item['category'] ?? null),
        'views' => is_numeric($item['views'] ?? null) ? max(0, (int) $item['views']) : 0,
        'created_at' => contentText($item['created_at'] ?? null, 60),
        'updated_at' => contentText($item['updated_at'] ?? null, 60),
    ];
    if ($includeContent) {
        $article['content'] = contentText($item['content'] ?? null, 200000);
    }

    return $article;
}

$action = $_GET['action'] ?? '';

if ($action === 'news') {
    ['page' => $page, 'per_page' => $perPage] = paginationParams();
    try {
        $result = callGuestApi('news/get_list', [
            'page' => $page,
            'per_page' => $perPage,
            'sort' => 'created_at',
            'direction' => 'DESC',
        ]);
    } catch (InvalidArgumentException $error) {
        respond(['error' => 'Berita tidak dapat dimuat.'], 422);
    } catch (Throwable $error) {
        failContent($error->getMessage());
    }

    $list = is_array($result['list'] ?? null) ? $result['list'] : [];
    $news = [];
    foreach ($list as $item) {
        if (is_array($item) && ($entry = newsItem($item)) !== null) {
            $news[] = $entry;
        }
    }

    respond([
        'news' => $news,
        'total' => is_numeric($result['total'] ?? null) ? (int) $result['total'] : count($news),
        'page' => is_numeric($result['page'] ?? null) ? (int) $result['page'] : $page,
        'pages' => is_numeric($result['pages'] ?? null) ? (int) $result['pages'] : 1,
    ]);
}

if ($action === 'news-article') {
    $slug = trim((string) ($_GET['slug'] ?? ''));
    $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
    $payload = [];
    if ($slug !== '' && mb_strlen($slug) <= 300) {
        $payload['slug'] = $slug;
    } elseif (is_int($id) && $id > 0) {
        $payload['id'] = $id;
    } else {
        respond(['error' => 'Berita tidak ditemukan.'], 404);
    }

    try {
        $result = callGuestApi('news/get', $payload);
    } catch (InvalidArgumentException $error) {
        respond(['error' => 'Berita tidak ditemukan.'], 404);
    } catch (Throwable $error) {
        failContent($error->getMessage());
    }

    $article = newsItem(is_array($result) ? $result : []);
    if ($article === null) {
        respond(['error' => 'Berita tidak ditemukan.'], 404);
    }

    respond(['article' => $article]);
}

if ($action === 'kb-categories') {
    ['page' => $page, 'per_page' => $perPage] = paginationParams();
    $payload = ['page' => $page, 'per_page' => $perPage];
    $search = trim((string) ($_GET['search'] ?? ''));
    if ($search !== '') {
        $payload['q'] = mb_substr($search, 0, 200);
    }

    try {
        $result = callGuestApi('support/kb_category_get_list', $payload);
    } catch (InvalidArgumentException $error) {
        respond(['error' => 'Kategori bantuan tidak dapat dimuat.'], 422);
    } catch (Throwable $error) {
        failContent($error->getMessage());
    }

    // Beberapa versi FossBilling tidak menyertakan `articles` di dalam kategori,
    // jadi ambil daftar artikel terpisah lalu petakan berdasarkan category.id.
    $flatArticles = null;
    try {
        $articlesResult = callGuestApi('support/kb_article_get_list', ['page' => 1, 'per_page' => 100]);
        $flatArticles = [];
        foreach (is_array($articlesResult['list'] ?? null) ? $articlesResult['list'] : [] as $article) {
            if (is_array($article) && ($entry = kbArticleItem($article)) !== null) {
                $flatArticles[] = $entry;
            }
        }
    } catch (Throwable $error) {
        error_log('Content API: unable to load KB article list: ' . $error->getMessage());
    }

    $list = is_array($result['list'] ?? null) ? $result['list'] : [];
    $categories = [];
    foreach ($list as $item) {
        if (!is_array($item) || ($entry = kbCategoryEntry($item)) === null) {
            continue;
        }
        if ($flatArticles !== null) {
            $entry['articles'] = array_values(array_filter(
                $flatArticles,
                static fn (array $article): bool => (int) ($article['category']['id'] ?? 0) === $entry['id'],
            ));
        }
        $categories[] = $entry;
    }

    respond([
        'categories' => $categories,
        'total' => is_numeric($result['total'] ?? null) ? (int) $result['total'] : count($categories),
        'page' => is_numeric($result['page'] ?? null) ? (int) $result['page'] : $page,
        'pages' => is_numeric($result['pages'] ?? null) ? (int) $result['pages'] : 1,
    ]);
}

if ($action === 'kb-article') {
    $slug = trim((string) ($_GET['slug'] ?? ''));
    $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
    $payload = [];
    if ($slug !== '' && mb_strlen($slug) <= 300) {
        $payload['slug'] = $slug;
    } elseif (is_int($id) && $id > 0) {
        $payload['id'] = $id;
    } else {
        respond(['error' => 'Artikel tidak ditemukan.'], 404);
    }

    try {
        $result = callGuestApi('support/kb_article_get', $payload);
    } catch (InvalidArgumentException $error) {
        respond(['error' => 'Artikel tidak ditemukan.'], 404);
    } catch (Throwable $error) {
        failContent($error->getMessage());
    }

    $article = kbArticleItem(is_array($result) ? $result : [], true);
    if ($article === null) {
        respond(['error' => 'Artikel tidak ditemukan.'], 404);
    }

    respond(['article' => $article]);
}

respond(['error' => 'Aksi tidak dikenal.'], 404);
