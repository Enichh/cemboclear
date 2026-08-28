<?php
/**
 * CemboClear Configuration
 *
 * Copy this file to config.php and fill in your values.
 * config.php is git-ignored and never committed.
 */

return [
    'db' => [
        'host'    => getenv('DB_HOST')    ?: '127.0.0.1',
        'port'    => getenv('DB_PORT')    ?: '3306',
        'name'    => getenv('DB_NAME')    ?: 'cemboclear',
        'user'    => getenv('DB_USER')    ?: 'root',
        'pass'    => getenv('DB_PASS')    ?: '',
        'charset' => 'utf8mb4',
    ],

    'app' => [
        'name'     => 'CemboClear',
        'env'      => getenv('APP_ENV')   ?: 'production',
        'debug'    => getenv('APP_DEBUG') ?: false,
        'base_url' => getenv('APP_URL')   ?: 'http://localhost',
    ],

    'session' => [
        'lifetime' => 7200, // 2 hours
    ],

    'upload' => [
        'max_size'      => 5 * 1024 * 1024, // 5 MB
        'allowed_types' => ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        'directory'     => __DIR__ . '/storage/uploads',
    ],
];
