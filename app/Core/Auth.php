<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Session-based authentication.
 *
 * Two account tables: 'staff' and 'residents'.
 * After login, $_SESSION holds:
 *   'user_id'   => int
 *   'user_type' => 'staff' | 'resident'
 *   'role'      => position (staff) or 'resident'
 */
class Auth
{
    /** Start the session if not already started. */
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            $lifetime = config('session.lifetime', 7200);
            session_set_cookie_params([
                'lifetime' => $lifetime,
                'path'     => '/',
                'httponly'  => true,
                'samesite' => 'Lax',
            ]);
            session_start();
        }
    }

    /** Log in a staff member. */
    public static function loginStaff(int $staffId, string $position = ''): void
    {
        self::start();
        $_SESSION['user_id']   = $staffId;
        $_SESSION['user_type'] = 'staff';
        $_SESSION['role']      = $position;
    }

    /** Log in a resident. */
    public static function loginResident(int $residentId): void
    {
        self::start();
        $_SESSION['user_id']   = $residentId;
        $_SESSION['user_type'] = 'resident';
        $_SESSION['role']      = 'resident';
    }

    /** Log out the current user. */
    public static function logout(): void
    {
        self::start();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }
        session_destroy();
    }

    /** Check if a user is currently authenticated. */
    public static function check(): bool
    {
        self::start();
        return isset($_SESSION['user_id']) && isset($_SESSION['user_type']);
    }

    /** Get the current user's ID, or null if not logged in. */
    public static function id(): ?int
    {
        self::start();
        return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
    }

    /** Get the current user's type: 'staff', 'resident', or null. */
    public static function type(): ?string
    {
        self::start();
        return $_SESSION['user_type'] ?? null;
    }

    /** Get the current user's role (staff position or 'resident'). */
    public static function role(): ?string
    {
        self::start();
        return $_SESSION['role'] ?? null;
    }

    /**
     * Require a specific user type. Sends 401/403 and exits if not met.
     *
     * @param string $type 'staff', 'resident', or 'any'
     */
    public static function requireRole(string $type = 'any'): void
    {
        if (!self::check()) {
            Response::unauthorized();
        }

        if ($type !== 'any' && self::type() !== $type) {
            Response::forbidden();
        }
    }
}
