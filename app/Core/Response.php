<?php
declare(strict_types=1);

namespace App\Core;

/**
 * HTTP response helpers.
 */
class Response
{
    /** Send a JSON response and terminate. */
    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /** Send a JSON error response and terminate. */
    public static function error(string $message, int $status = 400, mixed $extra = null): never
    {
        $payload = ['error' => true, 'message' => $message];
        if ($extra !== null) {
            $payload = array_merge($payload, is_array($extra) ? $extra : ['detail' => $extra]);
        }
        self::json($payload, $status);
    }

    /** Send a 401 Unauthorized response. */
    public static function unauthorized(string $message = 'Authentication required'): never
    {
        self::json(['error' => true, 'message' => $message], 401);
    }

    /** Send a 403 Forbidden response. */
    public static function forbidden(string $message = 'Insufficient permissions'): never
    {
        self::json(['error' => true, 'message' => $message], 403);
    }

    /** Send a 404 Not Found response. */
    public static function notFound(string $message = 'Resource not found'): never
    {
        self::json(['error' => true, 'message' => $message], 404);
    }

    /** Send a 204 No Content response. */
    public static function noContent(): never
    {
        http_response_code(204);
        exit;
    }

    /** Set CORS headers for the API. */
    public static function cors(): void
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
        header('Access-Control-Max-Age: 86400');
    }
}
