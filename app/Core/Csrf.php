<?php
declare(strict_types=1);

namespace App\Core;

/**
 * CSRF token generation and validation for form and API submissions.
 */
class Csrf
{
    /** Generate a new CSRF token and store it in the session. */
    public static function token(): string
    {
        Auth::start();

        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }

        return $_SESSION['csrf_token'];
    }

    /** Validate a submitted CSRF token against the session token. */
    public static function validate(?string $submittedToken): bool
    {
        Auth::start();

        if (empty($submittedToken) || empty($_SESSION['csrf_token'])) {
            return false;
        }

        return hash_equals($_SESSION['csrf_token'], $submittedToken);
    }

    /** Get the token and immediately invalidate the old one (single-use). */
    public static function rotate(): string
    {
        Auth::start();
        $old = $_SESSION['csrf_token'] ?? '';
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        return $old;
    }

    /**
     * Enforce CSRF token validation on state-changing requests (POST, PUT, DELETE, PATCH).
     */
    public static function check(): void
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if (!in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'], true)) {
            return;
        }

        $uri = $_SERVER['REQUEST_URI'] ?? '';
        $path = parse_url($uri, PHP_URL_PATH) ?: '';

        // Exclude initial login and signup routes where session is established
        if (str_ends_with($path, '/login') || str_ends_with($path, '/signup')) {
            return;
        }

        // Check X-CSRF-Token header first
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_SERVER['HTTP_X_XSRF_TOKEN'] ?? null;

        if (empty($token) && isset($_POST)) {
            $token = $_POST['csrf_token'] ?? $_POST['_csrf'] ?? null;
        }

        if (empty($token)) {
            $rawInput = file_get_contents('php://input');
            if ($rawInput) {
                $input = json_decode($rawInput, true);
                if (is_array($input)) {
                    $token = $input['csrf_token'] ?? $input['_csrf'] ?? null;
                }
            }
        }

        if (!self::validate($token)) {
            Response::forbidden('CSRF token validation failed.');
        }
    }
}
