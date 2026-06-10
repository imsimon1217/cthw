<?php

return [
    'database' => [
        // Use sqlite for the simplest school-server deployment.
        'driver' => 'sqlite',
        'path' => __DIR__ . '/../data/school-site.sqlite',

        // If the school server provides MySQL, change driver to mysql and fill in:
        // 'driver' => 'mysql',
        // 'host' => 'localhost',
        // 'database' => 'school_website',
        // 'username' => 'db_user',
        // 'password' => 'db_password',
        // 'charset' => 'utf8mb4',
    ],
    'security' => [
        'password_salt' => 'ychcthwps-admin-v1',
        'users' => [
            // Demo login: teacher / ych2026
            // Ask school IT to replace this hash before production launch.
            'teacher' => [
                'password_hmac' => 'efd996856afaa079e3e570910d1439f2f2668331f5a35859b0975d6951c3c900',
                'display_name' => 'Teacher'
            ]
        ]
    ]
];
