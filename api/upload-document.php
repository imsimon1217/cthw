<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(['error' => 'Method not allowed'], 405);
require_admin();
$file = $_FILES['document'] ?? null;
if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) json_response(['error' => 'No document uploaded'], 400);
if ($file['size'] > 6 * 1024 * 1024) json_response(['error' => 'Document must be smaller than 6 MB'], 422);
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
$handle = fopen($file['tmp_name'], 'rb');
$header = fread($handle, 5);
fclose($handle);
if ($mime !== 'application/pdf' || $header !== '%PDF-') json_response(['error' => 'Only PDF documents are supported'], 422);
$directory = __DIR__ . '/../assets/uploads';
if (!is_dir($directory)) mkdir($directory, 0755, true);
$name = 'document-' . date('Ymd-His') . '-' . bin2hex(random_bytes(8)) . '.pdf';
if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $name)) json_response(['error' => 'Unable to save document'], 500);
json_response(['ok' => true, 'src' => 'assets/uploads/' . $name]);
