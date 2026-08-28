<?php
declare(strict_types=1);

/**
 * CemboClear — Single API Entry Point
 *
 * All requests go through here. Apache rewrites /api/* to this file.
 * Static files (HTML, CSS, JS, images) are served directly by Apache.
 *
 * .htaccess in public/ handles rewriting:
 *   RewriteEngine On
 *   RewriteRule ^api/(.*)$ api/index.php [QSA,L]
 */

// Load helpers (global functions)
require_once dirname(__DIR__) . '/app/Core/helpers.php';

// Autoload PSR-4 classes from app/
spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    $baseDir = dirname(__DIR__) . '/app/';

    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

use App\Core\Router;
use App\Core\Response;
use App\Core\Auth;

// Global exception handler to prevent SQL error or stack trace leakage
set_exception_handler(function (\Throwable $e): void {
    Response::error('An internal error occurred.', 500);
});

// Start session
Auth::start();

// Handle CORS preflight
Response::cors();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    Response::noContent();
}

// Load routes
$router = new Router();
require dirname(__DIR__) . '/app/routes.php';

// Parse the URI (strip query string, get path relative to project root)
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Dispatch with try-catch boundary to sanitize uncaught exceptions
try {
    $matched = $router->dispatch($method, $path);

    if (!$matched) {
        Response::notFound('Endpoint not found: ' . $method . ' ' . $path);
    }
} catch (\Throwable $e) {
    Response::error('An internal error occurred.', 500);
}
