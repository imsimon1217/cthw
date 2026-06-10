<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$payload = read_json_body();
$username = trim((string)($payload['username'] ?? ''));
$password = (string)($payload['password'] ?? '');
$config = load_config();

if (!verify_admin_login($config, $username, $password)) {
    json_response(['error' => 'Invalid login'], 401);
}

session_regenerate_id(true);
$_SESSION['admin_user'] = $username;

json_response([
    'ok' => true,
    'user' => $username
]);
