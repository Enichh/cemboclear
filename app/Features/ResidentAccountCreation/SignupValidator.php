<?php
declare(strict_types=1);

namespace App\Features\ResidentAccountCreation;

use App\Core\PhoneNormalizer;

class SignupValidator
{
    /**
     * Validate resident signup input array strictly.
     * Returns an array of error messages (empty if valid).
     *
     * @param array $input
     * @return array<string>
     */
    public static function validate(array $input): array
    {
        $errors = [];

        // 1. First Name
        $firstName = trim((string)($input['first_name'] ?? ''));
        if ($firstName === '') {
            $errors[] = 'First name is required.';
        } elseif (mb_strlen($firstName) < 2 || mb_strlen($firstName) > 50) {
            $errors[] = 'First name must be between 2 and 50 characters.';
        } elseif (!preg_match("/^[a-zA-Z\s\-\'\.]+$/u", $firstName)) {
            $errors[] = 'First name contains invalid characters.';
        }

        // 2. Last Name
        $lastName = trim((string)($input['last_name'] ?? ''));
        if ($lastName === '') {
            $errors[] = 'Last name is required.';
        } elseif (mb_strlen($lastName) < 2 || mb_strlen($lastName) > 50) {
            $errors[] = 'Last name must be between 2 and 50 characters.';
        } elseif (!preg_match("/^[a-zA-Z\s\-\'\.]+$/u", $lastName)) {
            $errors[] = 'Last name contains invalid characters.';
        }

        // 3. Middle Name (optional) — a single middle initial, e.g. "M" or "M."
        $middleName = trim((string)($input['middle_name'] ?? ''));
        if ($middleName !== '') {
            if (!preg_match("/^[a-zA-Z]\.?$/u", $middleName)) {
                $errors[] = 'Middle initial must be a single letter (e.g. M or M.).';
            }
        }

        // 4. Email
        $email = strtolower(trim((string)($input['email'] ?? '')));
        if ($email === '') {
            $errors[] = 'Email address is required.';
        } elseif (mb_strlen($email) > 255) {
            $errors[] = 'Email address must not exceed 255 characters.';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Please enter a valid email address.';
        }

        // 5. Phone (required)
        $phone = trim((string)($input['phone'] ?? ''));
        if ($phone === '') {
            $errors[] = 'Phone number is required.';
        } elseif (!PhoneNormalizer::isValid($phone)) {
            $errors[] = 'Please enter a valid Philippine mobile number (e.g. 09171234567 or +639171234567).';
        }

        // 6. Birthdate
        $birthdate = trim((string)($input['birthdate'] ?? ''));
        if ($birthdate === '') {
            $errors[] = 'Birthdate is required.';
        } else {
            $d = \DateTime::createFromFormat('Y-m-d', $birthdate);
            if (!($d && $d->format('Y-m-d') === $birthdate)) {
                $errors[] = 'Birthdate must be a valid date in YYYY-MM-DD format.';
            } else {
                $now = new \DateTime('today');
                if ($d > $now) {
                    $errors[] = 'Birthdate cannot be in the future.';
                } elseif ($d < new \DateTime('1900-01-01')) {
                    $errors[] = 'Birthdate looks unreasonably old (must be on or after 1900).';
                }
            }
        }

        // 7. Gender
        $gender = strtolower(trim((string)($input['gender'] ?? '')));
        if ($gender === '') {
            $errors[] = 'Gender is required.';
        } elseif (!in_array($gender, ['male', 'female', 'other'], true)) {
            $errors[] = 'Gender must be "male", "female", or "other".';
        }

        // 8. Password
        $password = (string)($input['password'] ?? '');
        if ($password === '') {
            $errors[] = 'Password is required.';
        } elseif (strlen($password) > 72) {
            // PHP's default bcrypt (PASSWORD_DEFAULT) truncates at 72 BYTES.
            // Silently truncating creates a serious bug where two different long
            // passwords hash identically, so we reject over-length passwords.
            $errors[] = 'Password must not exceed 72 characters.';
        } else {
            if (mb_strlen($password) < 8) {
                $errors[] = 'Password must be at least 8 characters long.';
            }
            if (!preg_match('/[A-Z]/', $password)) {
                $errors[] = 'Password must contain at least one uppercase letter.';
            }
            if (!preg_match('/[a-z]/', $password)) {
                $errors[] = 'Password must contain at least one lowercase letter.';
            }
            if (!preg_match('/[0-9]/', $password)) {
                $errors[] = 'Password must contain at least one number.';
            }
            if (!preg_match('/[\W_]/', $password)) {
                $errors[] = 'Password must contain at least one special character.';
            }
        }

        // 9. Password Confirm (optional check if present in payload)
        if (isset($input['password_confirm'])) {
            $passwordConfirm = (string)$input['password_confirm'];
            if ($passwordConfirm !== $password) {
                $errors[] = 'Passwords do not match.';
            }
        }

        return $errors;
    }
}
