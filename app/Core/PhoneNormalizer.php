<?php
declare(strict_types=1);

namespace App\Core;

/**
 * PhoneNormalizer
 *
 * Single Responsibility: Normalizes Philippine mobile numbers into canonical formats
 * and generates lookup variations for authentication and registration.
 */
class PhoneNormalizer
{
    /**
     * Extract clean 10-digit base for Philippine mobile number starting with 9.
     * Returns null if string cannot be normalized into a valid PH mobile number.
     *
     * Handles inputs like:
     * - "+639171234567"
     * - "09171234567"
     * - "639171234567"
     * - "9171234567"
     * - "+63 | 917 123 4567"
     * - "0917-123-4567"
     */
    public static function extractBase(string $phone): ?string
    {
        // Strip all non-digit characters
        $digits = preg_replace('/\D/', '', $phone);
        if ($digits === null || $digits === '') {
            return null;
        }

        // Standard 10-digit base starting with 9
        $base = null;
        if (str_starts_with($digits, '639') && strlen($digits) === 12) {
            $base = substr($digits, 2); // '9171234567'
        } elseif (str_starts_with($digits, '09') && strlen($digits) === 11) {
            $base = substr($digits, 1); // '9171234567'
        } elseif (str_starts_with($digits, '9') && strlen($digits) === 10) {
            $base = $digits;
        }

        return $base;
    }

    /**
     * Check if a phone string is a valid Philippine mobile number.
     */
    public static function isValid(?string $phone): bool
    {
        if ($phone === null || trim($phone) === '') {
            return false;
        }
        return self::extractBase($phone) !== null;
    }

    /**
     * Normalize to E.164 international format: "+639171234567".
     * Returns original trimmed string if invalid.
     */
    public static function toE164(string $phone): string
    {
        $base = self::extractBase($phone);
        if ($base !== null) {
            return '+63' . $base;
        }
        return trim($phone);
    }

    /**
     * Normalize to national 11-digit format: "09171234567".
     * Returns original trimmed string if invalid.
     */
    public static function toNational(string $phone): string
    {
        $base = self::extractBase($phone);
        if ($base !== null) {
            return '0' . $base;
        }
        return trim($phone);
    }

    /**
     * Get all possible database search variations for a given phone input.
     * Useful for login queries matching '+639171234567', '09171234567', '639171234567', '9171234567', etc.
     *
     * @param string $phone
     * @return array<string>
     */
    public static function getVariations(string $phone): array
    {
        $raw = trim($phone);
        $variations = [$raw];

        $cleaned = preg_replace('/[^\d+]/', '', $raw);
        if ($cleaned) {
            $variations[] = $cleaned;
        }

        $base = self::extractBase($raw);
        if ($base !== null) {
            $variations[] = $base;            // "9171234567"
            $variations[] = '0' . $base;       // "09171234567"
            $variations[] = '+63' . $base;     // "+639171234567"
            $variations[] = '63' . $base;      // "639171234567"
        }

        return array_values(array_unique(array_filter($variations)));
    }
}
