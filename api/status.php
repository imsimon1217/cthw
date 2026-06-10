<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

json_response([
    'ok' => true,
    'loggedIn' => is_admin(),
    'user' => $_SESSION['admin_user'] ?? null
]);
