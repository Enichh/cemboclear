<?php
declare(strict_types=1);

namespace App\Features\ResidentAccountCreation;

use App\Core\Database;
use App\Core\Response;
use App\Core\Auth;
use App\Core\RateLimiter;
use App\Core\PhoneNormalizer;
use App\Core\Logger;

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
        RateLimiter::check('signup', 5, 300);

        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        // Normalize what the backend relies on for storage & uniqueness checks
        // so the stored data matches what was validated and is case-consistent.
        if (isset($input['email']) && is_string($input['email'])) {
            $input['email'] = strtolower(trim($input['email']));
        }
        foreach (['first_name', 'middle_name', 'last_name'] as $nameField) {
            if (isset($input[$nameField]) && is_string($input[$nameField])) {
                $input[$nameField] = trim($input[$nameField]);
            }
        }

        // Strict Signup Validation via SignupValidator (SRP)
        $errors = SignupValidator::validate($input);
        if (!empty($errors)) {
            Response::error(implode(' ', $errors), 422);
        }

        $email = $input['email'];
        $password = $input['password'];
        $rawPhone = trim((string)($input['phone'] ?? ''));
        $normalizedPhone = PhoneNormalizer::toNational($rawPhone);

        // Check if email already exists across both tables
        $existing = $this->db->query(
            'SELECT id FROM staff WHERE email = ? UNION SELECT id FROM residents WHERE email = ?',
            [$email, $email]
        )->fetch();
        if ($existing) {
            Response::error('Email is already registered.', 409);
        }

        // Check if the phone is already taken by another resident registration.
        // Phones are matched via normalized search variations so the same number
        // entered in different formats is still detected.
        $phoneVariations = PhoneNormalizer::getVariations($rawPhone);
        if (!empty($phoneVariations)) {
            $phoneIn = implode(',', array_fill(0, count($phoneVariations), '?'));
            $phoneExists = $this->db->query(
                'SELECT id FROM residents WHERE phone IN (' . $phoneIn . ') LIMIT 1',
                $phoneVariations
            )->fetch();
            if ($phoneExists) {
                Response::error('This phone number is already registered.', 409);
            }
        }

        $this->db->execute(
            'INSERT INTO residents (email, password_hash, first_name, middle_name, last_name, suffix, phone, gender, birthdate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $email,
                password_hash($password, PASSWORD_DEFAULT),
                $input['first_name'],
                $input['middle_name'] ?? null,
                $input['last_name'],
                $input['suffix'] ?? null,
                $normalizedPhone,
                strtolower(trim($input['gender'] ?? '')),
                $input['birthdate'] ?? null,
            ]
        );

        Response::json(['message' => 'Account created', 'id' => (int)$this->db->lastInsertId()], 201);
    }

    /** GET /api/requests — Role-aware: staff sees all, resident sees own */
    public function myRequests(): void
    {
        Auth::requireRole();

        if (Auth::type() === 'staff') {
            $requests = $this->db->query(
                'SELECT r.id, r.ticket_id, r.resident_id, r.subject, r.details, r.status, r.created_at,
                        CONCAT(res.first_name, " ", res.last_name) AS resident_name,
                        res.control_no,
                        a.name AS agency_name,
                        rt.name AS request_type
                 FROM requests r
                 JOIN residents res ON res.id = r.resident_id
                 JOIN agencies a ON a.id = r.agency_id
                 LEFT JOIN request_types rt ON rt.id = r.request_type_id
                 ORDER BY r.created_at DESC'
            )->fetchAll();
            foreach ($requests as &$req) {
                $req['id'] = (int)$req['id'];
                $req['resident_id'] = (int)$req['resident_id'];
            }
        } else {
            $requests = $this->db->query(
                'SELECT r.id, r.ticket_id, r.subject, r.details, r.status, r.created_at,
                        a.name as agency_name
                 FROM requests r
                 JOIN agencies a ON a.id = r.agency_id
                 WHERE r.resident_id = ?
                 ORDER BY r.created_at DESC',
                [Auth::id()]
            )->fetchAll();
            foreach ($requests as &$req) {
                $req['id'] = (int)$req['id'];
            }
        }

        Response::json(['data' => $requests]);
    }

    /** POST /api/requests — Submit a request/concern (resident) */
    public function submitRequest(): void
    {
        Auth::requireRole('resident');
        RateLimiter::check('submit_request', 10, 60);

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

    /** PUT /api/requests/{id}/status — Update a request's status (staff only) */
    public function updateStatus(string $id): void
    {
        Auth::requireRole('staff');

        $requestId = (int)$id;
        $existing = $this->db->query('SELECT id FROM requests WHERE id = ?', [$requestId])->fetch();
        if (!$existing) {
            Response::notFound('Request not found');
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $input['status'] ?? '';
        $allowed = ['pending_review', 'reviewed', 'resolved', 'closed'];
        if (!in_array($status, $allowed, true)) {
            Response::error('Status must be one of: ' . implode(', ', $allowed), 422);
        }

        $this->db->execute(
            'UPDATE requests SET status = ? WHERE id = ?',
            [$status, $requestId]
        );

        (new Logger($this->db))->activity(
            'Set request #' . $requestId . ' status to ' . $status,
            Auth::id()
        );

        Response::json(['message' => 'Request status updated']);
    }

    /** GET /api/attachments/{id} — Download an attachment */
    public function downloadAttachment(string $id): void
    {
        Auth::requireRole();

        $attachmentId = (int)$id;

        if (Auth::type() === 'staff') {
            $attachment = $this->db->query(
                'SELECT file_name, file_path, kind FROM attachments WHERE id = ?',
                [$attachmentId]
            )->fetch();
        } else {
            $userId = Auth::id();
            $attachment = $this->db->query(
                'SELECT a.file_name, a.file_path, a.kind
                 FROM attachments a
                 LEFT JOIN requests r ON a.request_id = r.id
                 WHERE a.id = ? AND (a.resident_id = ? OR r.resident_id = ?)',
                [$attachmentId, $userId, $userId]
            )->fetch();
        }

        if (!$attachment) {
            Response::notFound('Attachment not found');
        }

        $fullPath = storage_path('uploads/' . $attachment['file_path']);
        if (!file_exists($fullPath)) {
            Response::notFound('File not found on disk');
        }

        // Inline serving (e.g. <img src=".../attachments/{id}?inline=1">): render
        // image files directly instead of forcing a download. Staff-only auth is
        // already enforced above.
        $inline = !empty($_GET['inline']);
        $mime = null;
        if ($inline) {
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($fullPath);
            if ($mime && strpos($mime, 'image/') === 0) {
                header('Content-Type: ' . $mime);
                header('Content-Disposition: inline; filename="' . $attachment['file_path'] . '"');
                header('Content-Length: ' . filesize($fullPath));
                header('Cache-Control: private, max-age=3600');
                readfile($fullPath);
                exit;
            }
        }

        // Sanitize filename to prevent header injection and traversal
        $cleanFileName = preg_replace('/[\r\n"\\\\]/', '', basename($attachment['file_name']));
        if ($cleanFileName === '') {
            $cleanFileName = 'download';
        }

        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $cleanFileName . '"');
        header('Content-Length: ' . filesize($fullPath));
        readfile($fullPath);
        exit;
    }
}
