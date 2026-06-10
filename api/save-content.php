<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

require_admin();

$payload = read_json_body();
$content = $payload['content'] ?? null;
if (!is_array($content)) {
    json_response(['error' => 'Missing content'], 400);
}
validate_content($content);

try {
    $config = load_config();
    $pdo = pdo_connection($config);
    save_site_content($pdo, $content);
    json_response([
        'ok' => true,
        'source' => 'database'
    ]);
} catch (Throwable $error) {
    json_response(['error' => 'Unable to save content'], 500);
}
