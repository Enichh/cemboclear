<?php
declare(strict_types=1);

namespace App\Features\UserManagement;

use App\Core\Database;
use App\Core\Response;
use App\Core\Auth;
use App\Core\Logger;

class UserManagementController
{
    private Database $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    /** GET /api/staff — List all staff accounts */
    public function index(): void
    {
        Auth::requireRole('staff');

        $staff = $this->db->query(
            'SELECT id, email, first_name, middle_name, last_name, position, branch,
                    phone, is_verified, status, created_at
             FROM staff
             ORDER BY last_name, first_name'
        )->fetchAll();

        foreach ($staff as &$s) {
            $s['id'] = (int)$s['id'];
            $s['is_verified'] = (int)$s['is_verified'];
        }

        Response::json(['data' => $staff]);
    }

    /** POST /api/staff — Create a new staff account */
    public function create(): void
    {
        Auth::requireRole('staff');

        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $required = ['email', 'password', 'first_name', 'last_name'];
        foreach ($required as $field) {
            if (empty($input[$field])) {
                Response::error("Field '{$field}' is required.", 422);
            }
        }

        $email = trim($input['email']);

        // Check uniqueness across both tables
        $existing = $this->db->query(
            'SELECT id FROM staff WHERE email = ? UNION SELECT id FROM residents WHERE email = ?',
            [$email, $email]
        )->fetch();
        if ($existing) {
            Response::error('Email is already registered.', 409);
        }

        $this->db->execute(
            'INSERT INTO staff (email, password_hash, first_name, middle_name, last_name, position, branch, phone, birthdate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $email,
                password_hash($input['password'], PASSWORD_DEFAULT),
                trim($input['first_name']),
                $input['middle_name'] ?? null,
                trim($input['last_name']),
                $input['position'] ?? null,
                $input['branch'] ?? null,
                $input['phone'] ?? null,
                $input['birthdate'] ?? null,
            ]
        );

        (new Logger($this->db))->activity(
            'Created staff account: ' . $email,
            Auth::id()
        );

        Response::json([
            'message' => 'Staff account created',
            'id'      => (int)$this->db->lastInsertId(),
        ], 201);
    }

    /** PUT /api/staff/{id} — Update a staff account */
    public function update(string $id): void
    {
        Auth::requireRole('staff');

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $staffId = (int)$id;

        $existing = $this->db->query('SELECT id FROM staff WHERE id = ?', [$staffId])->fetch();
        if (!$existing) {
            Response::notFound('Staff not found');
        }

        $allowed = [
            'first_name', 'middle_name', 'last_name', 'phone',
            'position', 'branch', 'birthdate',
        ];

        $sets = [];
        $values = [];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $input)) {
                $sets[] = "{$field} = ?";
                $values[] = $input[$field];
            }
        }

        // Handle password separately
        if (!empty($input['password'])) {
            $sets[] = 'password_hash = ?';
            $values[] = password_hash($input['password'], PASSWORD_DEFAULT);
        }

        if (empty($sets)) {
            Response::error('No valid fields to update.', 422);
        }

        $values[] = $staffId;
        $this->db->execute(
            'UPDATE staff SET ' . implode(', ', $sets) . ' WHERE id = ?',
            $values
        );

        (new Logger($this->db))->activity(
            'Updated staff #' . $staffId,
            Auth::id()
        );

        Response::json(['message' => 'Staff updated']);
    }

    /** PUT /api/staff/{id}/status — Update staff status (active/inactive) */
    public function updateStatus(string $id): void
    {
        Auth::requireRole('staff');

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $input['status'] ?? '';

        if (!in_array($status, ['active', 'inactive'], true)) {
            Response::error('Status must be "active" or "inactive".', 422);
        }

        $staffId = (int)$id;
        $existing = $this->db->query('SELECT id FROM staff WHERE id = ?', [$staffId])->fetch();
        if (!$existing) {
            Response::notFound('Staff not found');
        }

        $this->db->execute(
            'UPDATE staff SET status = ? WHERE id = ?',
            [$status, $staffId]
        );

        (new Logger($this->db))->activity(
            'Set staff #' . $staffId . ' status to ' . $status,
            Auth::id()
        );

        Response::json(['message' => 'Status updated']);
    }
}
