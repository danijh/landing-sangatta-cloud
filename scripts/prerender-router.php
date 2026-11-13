<?php
// Router untuk `php -S` saat prerender: sajikan file statis apa adanya,
// fallback ke index.html (app shell) untuk path yang belum punya HTML statis.
$docroot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? getcwd()), '/');
$path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
$file = $docroot . $path;

if ($path !== '/' && file_exists($file) && !is_dir($file)) {
    return false;
}
if (is_dir($file) && file_exists($file . '/index.html')) {
    return false;
}
if (preg_match('/\.php$/', $path)) {
    return false;
}

http_response_code(200);
header('Content-Type: text/html; charset=utf-8');
readfile($docroot . '/index.html');
