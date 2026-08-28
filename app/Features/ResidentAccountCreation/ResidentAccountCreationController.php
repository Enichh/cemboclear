<?php
declare(strict_types=1);

namespace App\Features\ResidentAccountCreation;

use App\Core\Database;
use App\Core\Response;
use App\Core\Auth;

class ResidentAccountCreationController
{
    private Database $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    /** POST /api/signup — Resident self-registration */
    public function signup(): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        $required = ['email', 'password', 'first_name', 'last_name'];
        foreach ($required as $field) {
            if (empty($input[$field])) {
                Response::error("Field '{$field}' is required.", 422);
            }
        }

        $email = trim($input['email']);
        $password = $input['password'];

        // Check if email already exists
        $existing = $this->db->query(
            'SELECT id FROM staff WHERE email = ? UNION SELECT id FROM residents WHERE email = ?',
            [$email, $email]
        )->fetch();
        if ($existing) {
            Response::error('Email is already registered.', 409);
        }

        $this->db->execute(
            'INSERT INTO residents (email, password_hash, first_name, middle_name, last_name, suffix, phone, gender, birthdate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $email,
                password_hash($password, PASSWORD_DEFAULT),
                trim($input['first_name']),
                $input['middle_name'] ?? null,
                trim($input['last_name']),
                $input['suffix'] ?? null,
                $input['phone'] ?? null,
                $input['gender'] ?? null,
                $input['birthdate'] ?? null,
            ]
        );

        Response::json(['message' => 'Account created', 'id' => (int)$this->db->lastInsertId()], 201);
    }

    /** GET /api/requests — Resident's own requests */
    public function myRequests(): void
    {
        Auth::requireRole('resident');

        $requests = $this->db->query(
            'SELECT r.id, r.ticket_id, r.subject, r.status, r.created_at,
                    a.name as agency_name
             FROM requests r
             JOIN agencies a ON a.id = r.agency_id
             WHERE r.resident_id = ?
             ORDER BY r.created_at DESC',
            [Auth::id()]
        )->fetchAll();

        Response::json(['data' => $requests]);
    }

    /** POST /api/requests — Submit a request/concern (resident) */
    public function submitRequest(): void
    {
        Auth::requireRole('resident');

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $agencyId = (int)($input['agency_id'] ?? 0);

        if ($agencyId <= 0) {
            Response::error('Agency is required.', 422);
        }

        // Verify agency exists
        $agency = $this->db->query('SELECT id FROM agencies WHERE id = ?', [$agencyId])->fetch();
        if (!$agency) {
            Response::error('Invalid agency.', 422);
        }

        $ticketId = generate_ticket_id();
        // Ensure uniqueness
        while ($this->db->query('SELECT id FROM requests WHERE ticket_id = ?', [$ticketId])->fetch()) {
            $ticketId = generate_ticket_id();
        }

        $this->db->execute(
            'INSERT INTO requests (ticket_id, resident_id, agency_id, request_type_id, subject, details)
             VALUES (?, ?, ?, ?, ?, ?)',
            [
                $ticketId,
                Auth::id(),
                $agencyId,
                $input['request_type_id'] ?? null,
                $input['subject'] ?? null,
                $input['details'] ?? null,
            ]
        );

        Response::json([
            'message'   => 'Request submitted',
            'ticket_id' => $ticketId,
            'id'        => (int)$this->db->lastInsertId(),
        ], 201);
    }

    /** GET /api/attachments/{id} — Download an attachment */
    public function downloadAttachment(string $id): void
    {
        Auth::requireRole();

        $attachment = $this->db->query(
            'SELECT file_name, file_path, kind FROM attachments WHERE id = ?',
            [(int)$id]
        )->fetch();

        if (!$attachment) {
            Response::notFound('Attachment not found');
        }

        $fullPath = storage_path('uploads/' . $attachment['file_path']);
        if (!file_exists($fullPath)) {
            Response::notFound('File not found on disk');
        }

        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $attachment['file_name'] . '"');
        header('Content-Length: ' . filesize($fullPath));
        readfile($fullPath);
        exit;
    }
}
