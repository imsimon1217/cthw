<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

require_admin();

if (empty($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    json_response(['error' => 'No image uploaded'], 400);
}

$file = $_FILES['image'];
if (($file['size'] ?? 0) > 6 * 1024 * 1024) {
    json_response(['error' => 'Image is too large'], 422);
}

$info = getimagesize($file['tmp_name']);
if (!$info || empty($info['mime'])) {
    json_response(['error' => 'Invalid image file'], 422);
}

$extensions = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp'
];

$extension = $extensions[$info['mime']] ?? null;
if (!$extension) {
    json_response(['error' => 'Only JPG, PNG and WebP images are supported'], 422);
}

$directory = __DIR__ . '/../assets/uploads';
if (!is_dir($directory)) {
    mkdir($directory, 0755, true);
}

$name = 'upload-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $extension;
$destination = $directory . '/' . $name;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    json_response(['error' => 'Unable to save uploaded image'], 500);
}

json_response([
    'ok' => true,
    'src' => 'assets/uploads/' . $name
]);
