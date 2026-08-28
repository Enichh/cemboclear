<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Simple HTTP router.
 *
 * Usage:
 *   $router = new Router();
 *   $router->get('/api/residents', [ResidentReadController::class, 'index']);
 *   $router->post('/api/login', [StaffAuthController::class, 'login']);
 *   $router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
 */
class Router
{
    /** @var array<string, array{pattern: string, handler: callable, method: string}> */
    private array $routes = [];

    public function get(string $path, callable $handler): void
    {
        $this->addRoute('GET', $path, $handler);
    }

    public function post(string $path, callable $handler): void
    {
        $this->addRoute('POST', $path, $handler);
    }

    public function put(string $path, callable $handler): void
    {
        $this->addRoute('PUT', $path, $handler);
    }

    public function delete(string $path, callable $handler): void
    {
        $this->addRoute('DELETE', $path, $handler);
    }

    private function addRoute(string $method, string $path, callable $handler): void
    {
        // Convert {param} to named regex groups
        $pattern = preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $path);
        $pattern = '#^' . $pattern . '$#';

        $this->routes[] = [
            'method'  => $method,
            'pattern' => $pattern,
            'handler' => $handler,
        ];
    }

    /**
     * Match the request against registered routes and invoke the handler.
     * Returns true if a route matched, false otherwise.
     */
    public function dispatch(string $method, string $uri): bool
    {
        // Strip query string
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        // Remove /api prefix if present (the front controller already strips it)
        // But keep it for matching since routes are defined with /api prefix

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            if (preg_match($route['pattern'], $path, $matches)) {
                // Extract only named groups
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                call_user_func_array($route['handler'], array_values($params));
                return true;
            }
        }

        return false;
    }
}
