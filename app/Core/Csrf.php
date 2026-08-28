<?php
declare(strict_types=1);

namespace App\Core;

/**
 * CSRF token generation and validation for form submissions.
 * Not used for pure JSON API calls (handled by session auth instead),
 * but available for any future server-rendered forms.
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
}
