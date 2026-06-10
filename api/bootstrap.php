<?php

declare(strict_types=1);

session_name('YCHCTHWPSCMS');
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Strict',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'path' => '/'
]);
session_start();

function load_config(): array
{
    $configPath = __DIR__ . '/config.php';
    if (!file_exists($configPath)) {
        $configPath = __DIR__ . '/config.example.php';
    }

    $config = require $configPath;
    if (!is_array($config)) {
        json_response(['error' => 'Invalid server configuration'], 500);
    }

    return $config;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        json_response(['error' => 'Invalid JSON body'], 400);
    }

    return $payload;
}

function pdo_connection(array $config): PDO
{
    $database = $config['database'] ?? [];
    $driver = $database['driver'] ?? 'sqlite';

    if ($driver === 'mysql') {
        $charset = $database['charset'] ?? 'utf8mb4';
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            $database['host'] ?? 'localhost',
            $database['database'] ?? '',
            $charset
        );
        $pdo = new PDO($dsn, $database['username'] ?? '', $database['password'] ?? '');
    } else {
        $path = $database['path'] ?? (__DIR__ . '/../data/school-site.sqlite');
        $directory = dirname($path);
        if (!is_dir($directory)) {
            mkdir($directory, 0755, true);
        }
        $pdo = new PDO('sqlite:' . $path);
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

function ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS site_content (
            id VARCHAR(64) PRIMARY KEY,
            content TEXT NOT NULL,
            updated_at VARCHAR(32) NOT NULL
        )'
    );
}

function default_content(): array
{
    $path = __DIR__ . '/../data/site-content.json';
    $content = json_decode(file_get_contents($path) ?: '', true);
    if (!is_array($content)) {
        json_response(['error' => 'Default content file is missing or invalid'], 500);
    }
    return $content;
}

function get_site_content(PDO $pdo): array
{
    ensure_schema($pdo);
    $statement = $pdo->prepare('SELECT content FROM site_content WHERE id = :id');
    $statement->execute(['id' => 'homepage']);
    $row = $statement->fetch();

    if ($row && isset($row['content'])) {
        $content = json_decode($row['content'], true);
        if (is_array($content)) {
            return $content;
        }
    }

    $content = default_content();
    save_site_content($pdo, $content);
    return $content;
}

function save_site_content(PDO $pdo, array $content): void
{
    ensure_schema($pdo);
    $statement = $pdo->prepare(
        'REPLACE INTO site_content (id, content, updated_at)
        VALUES (:id, :content, :updated_at)'
    );
    $statement->execute([
        'id' => 'homepage',
        'content' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'updated_at' => gmdate('c')
    ]);
}

function is_admin(): bool
{
    return !empty($_SESSION['admin_user']);
}

function require_admin(): void
{
    if (!is_admin()) {
        json_response(['error' => 'Not logged in'], 401);
    }
}

function verify_admin_login(array $config, string $username, string $password): bool
{
    $users = $config['security']['users'] ?? [];
    $user = $users[$username] ?? null;
    if (!$user || empty($user['password_hmac'])) {
        return false;
    }

    $salt = $config['security']['password_salt'] ?? '';
    $candidate = hash_hmac('sha256', $password, $salt);
    return hash_equals($user['password_hmac'], $candidate);
}

function validate_content(array $content): void
{
    $required = [
        'hero.title',
        'hero.copy',
        'about.heading',
        'news.heading',
        'news.featured.title',
        'campus.heading',
        'tender.title',
        'admission.heading',
        'contact.heading',
        'contact.address',
        'contact.phone',
        'contact.email'
    ];

    foreach ($required as $path) {
        $value = $content;
        foreach (explode('.', $path) as $key) {
            $value = is_array($value) && array_key_exists($key, $value) ? $value[$key] : null;
        }
        if (!is_string($value) || trim($value) === '') {
            json_response(['error' => 'Missing required field: ' . $path], 422);
        }
    }

    if (!isset($content['news']['items']) || !is_array($content['news']['items'])) {
        json_response(['error' => 'News items must be an array'], 422);
    }
}
