<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

try {
    $config = load_config();
    $pdo = pdo_connection($config);
    json_response([
        'content' => get_site_content($pdo),
        'source' => 'database'
    ]);
} catch (Throwable $error) {
    json_response(['error' => 'Unable to load content'], 500);
}
