<?php
declare(strict_types=1);

namespace App\Core;

/**
 * File-based rate limiter to protect sensitive endpoints from brute-force and request abuse.
 */
class RateLimiter
{
    /**
     * Check rate limit for a key.
     * Sends HTTP 429 response and terminates execution if limit is exceeded.
     *
     * @param string $action Name of the action (e.g. 'login', 'signup', 'submit_request')
     * @param int $maxAttempts Maximum allowed attempts within the time window
     * @param int $decaySeconds Time window duration in seconds
     */
    public static function check(string $action, int $maxAttempts = 5, int $decaySeconds = 60): void
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $key = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $action . '_' . $ip);
        $storageDir = storage_path('rate_limits');

        if (!is_dir($storageDir)) {
            @mkdir($storageDir, 0755, true);
        }

        $filePath = $storageDir . '/' . md5($key) . '.json';
        $now = time();

        $data = ['attempts' => 0, 'reset' => $now + $decaySeconds];
        if (file_exists($filePath)) {
            $content = @file_get_contents($filePath);
            if ($content !== false) {
                $decoded = json_decode($content, true);
                if (is_array($decoded) && isset($decoded['reset']) && $decoded['reset'] > $now) {
                    $data = $decoded;
                }
            }
        }

        if ($data['attempts'] >= $maxAttempts) {
            $retryAfter = max(1, $data['reset'] - $now);
            header('Retry-After: ' . $retryAfter);
            Response::error('Too many requests. Please try again later.', 429, [
                'retry_after' => $retryAfter,
            ]);
        }

        $data['attempts']++;
        @file_put_contents($filePath, json_encode($data), LOCK_EX);
    }
}
