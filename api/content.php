<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

try {
    $config = load_config();
    $pdo = pdo_connection($config);
    $content = get_site_content($pdo);
    if (!is_admin()) {
        $visible = [];
        foreach ($content['categories'] ?? [] as $category) $visible[$category['id']] = $category;
        $isVisible = function (string $id) use ($visible): bool {
            $seen = [];
            while (isset($visible[$id])) {
                if (($visible[$id]['visible'] ?? true) === false || isset($seen[$id])) return false;
                $seen[$id] = true;
                $id = $visible[$id]['parentId'] ?? '';
            }
            return true;
        };
        $content['categories'] = array_values(array_filter($content['categories'] ?? [], fn ($category) => $isVisible($category['id'])));
        $content['news']['items'] = array_values(array_filter($content['news']['items'] ?? [], fn ($item) => ($item['status'] ?? 'published') !== 'draft' && $isVisible($item['categoryId'] ?? '')));
    }
    header('Cache-Control: no-store');
    json_response([
        'content' => $content,
        'source' => 'database'
    ]);
} catch (Throwable $error) {
    json_response(['error' => 'Unable to load content'], 500);
}
