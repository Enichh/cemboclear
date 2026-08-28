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
require_once dirname(__DIR__, 2) . '/app/Core/helpers.php';

// Autoload PSR-4 classes from app/
spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    $baseDir = dirname(__DIR__, 2) . '/app/';

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
use App\Core\Csrf;
use App\Core\ErrorHandler;

// Register central error & exception handler to prevent leaking technical details
ErrorHandler::register();

// Start session
Auth::start();

// Handle CORS preflight
Response::cors();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    Response::noContent();
}

// Validate CSRF token for mutating HTTP methods
Csrf::check();

// Load routes
$router = new Router();
require dirname(__DIR__, 2) . '/app/routes.php';

// Parse the URI (strip query string, get path relative to project root)
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

// Normalize the path so routes (defined with a leading /api) match regardless
// of where the app is mounted. REQUEST_URI is absolute; SCRIPT_NAME is the URL
// path to this front controller, so we strip everything up to public/.
$scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
$base = rtrim(str_replace('\\', '/', dirname(dirname($scriptPath))), '/');
if ($base !== '' && $base !== '/' && str_starts_with($path, $base . '/')) {
    $path = substr($path, strlen($base));
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Dispatch with try-catch boundary to sanitize uncaught exceptions
try {
    $matched = $router->dispatch($method, $path);

    if (!$matched) {
        Response::notFound('The requested endpoint could not be found.');
    }
} catch (\Throwable $e) {
    ErrorHandler::handleException($e);
}
