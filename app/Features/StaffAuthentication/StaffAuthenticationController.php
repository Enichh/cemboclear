<?php
declare(strict_types=1);

namespace App\Features\StaffAuthentication;

use App\Core\Database;
use App\Core\Response;
use App\Core\Auth;
use App\Core\Logger;

class StaffAuthenticationController
{
    private Database $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    /** POST /api/login */
    public function login(): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $identifier = trim((string)($input['email'] ?? $input['phone'] ?? $input['identifier'] ?? $input['emailOrPhone'] ?? ''));
        $password = $input['password'] ?? '';

        if ($identifier === '' || $password === '') {
            Response::error('Email/Phone and password are required.', 422);
        }

        // Phone normalization logic
        $isPhone = false;
        $phoneVariations = [];
        if (!str_contains($identifier, '@')) {
            $cleaned = preg_replace('/[^\d+]/', '', $identifier);
            $digits = preg_replace('/\D/', '', $cleaned);
            if (strlen($digits) >= 9) {
                $isPhone = true;
                if (str_starts_with($digits, '63') && strlen($digits) > 10) {
                    $base = substr($digits, 2);
                } elseif (str_starts_with($digits, '0') && strlen($digits) > 9) {
                    $base = substr($digits, 1);
                } else {
                    $base = $digits;
                }

                if (strlen($base) === 10) {
                    $phoneVariations = [
                        $identifier,
                        $cleaned,
                        $digits,
                        '0' . $base,
                        '+63' . $base,
                        '63' . $base,
                        $base
                    ];
                } else {
                    $phoneVariations = [
                        $identifier,
                        $cleaned,
                        $digits
                    ];
                }
                $phoneVariations = array_unique(array_filter($phoneVariations));
            }
        }

        // Try staff first, then residents
        if ($isPhone && !empty($phoneVariations)) {
            $placeholders = implode(',', array_fill(0, count($phoneVariations), '?'));
            $user = $this->db->query(
                "SELECT id, email, password_hash, first_name, last_name, position, status
                 FROM staff WHERE email = ? OR phone IN ($placeholders) LIMIT 1",
                array_merge([$identifier], $phoneVariations)
            )->fetch();
        } else {
            $user = $this->db->query(
                'SELECT id, email, password_hash, first_name, last_name, position, status
                 FROM staff WHERE email = ? LIMIT 1',
                [$identifier]
            )->fetch();
        }

        if ($user) {
            if ($user['status'] !== 'active') {
                Response::error('Account is inactive.', 403);
            }
            if (!password_verify($password, $user['password_hash'])) {
                (new Logger($this->db))->log('Failed login attempt', 'unauthorized');
                Response::error('Invalid credentials.', 401);
            }
            Auth::loginStaff((int)$user['id'], $user['position'] ?? '');
            (new Logger($this->db))->activity('Staff login', (int)$user['id']);
            Response::json([
                'message' => 'Login successful',
                'user' => [
                    'id'        => (int)$user['id'],
                    'email'     => $user['email'],
                    'name'      => $user['first_name'] . ' ' . $user['last_name'],
                    'position'  => $user['position'],
                    'type'      => 'staff',
                ],
            ]);
        }

        // Try residents
        if ($isPhone && !empty($phoneVariations)) {
            $placeholders = implode(',', array_fill(0, count($phoneVariations), '?'));
            $resident = $this->db->query(
                "SELECT id, email, password_hash, first_name, last_name, account_status
                 FROM residents WHERE email = ? OR phone IN ($placeholders) LIMIT 1",
                array_merge([$identifier], $phoneVariations)
            )->fetch();
        } else {
            $resident = $this->db->query(
                'SELECT id, email, password_hash, first_name, last_name, account_status
                 FROM residents WHERE email = ? LIMIT 1',
                [$identifier]
            )->fetch();
        }

        if ($resident) {
            if ($resident['account_status'] !== 'active') {
                Response::error('Account is inactive.', 403);
            }
            if (!password_verify($password, $resident['password_hash'])) {
                Response::error('Invalid credentials.', 401);
            }
            Auth::loginResident((int)$resident['id']);
            Response::json([
                'message' => 'Login successful',
                'user' => [
                    'id'    => (int)$resident['id'],
                    'email' => $resident['email'],
                    'name'  => $resident['first_name'] . ' ' . $resident['last_name'],
                    'type'  => 'resident',
                ],
            ]);
        }

        Response::error('Invalid credentials.', 401);
    }

    /** POST /api/logout */
    public function logout(): void
    {
        Auth::requireRole('any');
        Auth::logout();
        Response::json(['message' => 'Logged out']);
    }

    /** GET /api/me */
    public function me(): void
    {
        if (!Auth::check()) {
            Response::unauthorized();
        }

        $id = Auth::id();
        $type = Auth::type();

        if ($type === 'staff') {
            $user = $this->db->query(
                'SELECT id, email, first_name, middle_name, last_name, position, branch, phone, status
                 FROM staff WHERE id = ?',
                [$id]
            )->fetch();
            if (!$user) Response::notFound();
            $user['id'] = (int)$user['id'];
            $user['type'] = 'staff';
            Response::json($user);
        }

        if ($type === 'resident') {
            $user = $this->db->query(
                'SELECT id, email, first_name, middle_name, last_name, suffix, phone, gender, birthdate,
                        civil_status, address, purok, control_no, registry_status, account_status
                 FROM residents WHERE id = ?',
                [$id]
            )->fetch();
            if (!$user) Response::notFound();
            $user['id'] = (int)$user['id'];
            $user['type'] = 'resident';
            Response::json($user);
        }

        Response::unauthorized();
    }
}
