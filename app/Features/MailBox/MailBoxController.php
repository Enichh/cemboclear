<?php
declare(strict_types=1);

namespace App\Features\MailBox;

use App\Core\Database;
use App\Core\Response;
use App\Core\Auth;

class MailBoxController
{
    private Database $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    /** GET /api/mail — Inbox for current user */
    public function index(): void
    {
        Auth::requireRole();

        $id = Auth::id();
        $type = Auth::type();

        if ($type === 'staff') {
            $messages = $this->db->query(
                'SELECT m.id, m.subject, m.body, m.is_read, m.created_at,
                        COALESCE(s.first_name, r.first_name) as sender_first,
                        COALESCE(s.last_name, r.last_name) as sender_last
                 FROM mail m
                 LEFT JOIN staff s ON s.id = m.sender_staff_id
                 LEFT JOIN residents r ON r.id = m.sender_resident_id
                 WHERE m.recipient_staff_id = ?
                 ORDER BY m.created_at DESC',
                [$id]
            )->fetchAll();
        } else {
            $messages = $this->db->query(
                'SELECT m.id, m.subject, m.body, m.is_read, m.created_at,
                        COALESCE(s.first_name, r.first_name) as sender_first,
                        COALESCE(s.last_name, r.last_name) as sender_last
                 FROM mail m
                 LEFT JOIN staff s ON s.id = m.sender_staff_id
                 LEFT JOIN residents r ON r.id = m.sender_resident_id
                 WHERE m.recipient_resident_id = ?
                 ORDER BY m.created_at DESC',
                [$id]
            )->fetchAll();
        }

        foreach ($messages as &$msg) {
            $msg['id'] = (int)$msg['id'];
            $msg['is_read'] = (int)$msg['is_read'];
        }

        Response::json(['data' => $messages]);
    }

    /** POST /api/mail — Send a message */
    public function send(): void
    {
        Auth::requireRole();

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = Auth::id();
        $type = Auth::type();

        $recipientId = (int)($input['recipient_id'] ?? 0);
        $recipientType = $input['recipient_type'] ?? '';
        $subject = trim((string)($input['subject'] ?? ''));
        $body = trim((string)($input['body'] ?? ''));

        if ($recipientId <= 0 || !in_array($recipientType, ['staff', 'resident'], true)) {
            Response::error('Valid recipient_id and recipient_type are required.', 422);
        }
        if ($subject === '' && $body === '') {
            Response::error('Subject or body is required.', 422);
        }

        // Recipient existence validation
        if ($recipientType === 'staff') {
            $exists = $this->db->query('SELECT id FROM staff WHERE id = ?', [$recipientId])->fetch();
            if (!$exists) {
                Response::error('Recipient staff account not found.', 422);
            }
        } else {
            $exists = $this->db->query('SELECT id FROM residents WHERE id = ?', [$recipientId])->fetch();
            if (!$exists) {
                Response::error('Recipient resident account not found.', 422);
            }
        }

        $senderStaff = $type === 'staff' ? $id : null;
        $senderResident = $type === 'resident' ? $id : null;
        $recipientStaff = $recipientType === 'staff' ? $recipientId : null;
        $recipientResident = $recipientType === 'resident' ? $recipientId : null;

        $this->db->execute(
            'INSERT INTO mail (sender_staff_id, sender_resident_id, recipient_staff_id, recipient_resident_id, subject, body)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$senderStaff, $senderResident, $recipientStaff, $recipientResident, $subject, $body]
        );

        Response::json(['message' => 'Message sent', 'id' => (int)$this->db->lastInsertId()], 201);
    }

    /** PUT /api/mail/{id}/read — Mark a message as read */
    public function markRead(string $id): void
    {
        Auth::requireRole();

        $userId = Auth::id();
        $userType = Auth::type();
        $mailId = (int)$id;

        $recipientColumn = ($userType === 'staff') ? 'recipient_staff_id' : 'recipient_resident_id';

        $existing = $this->db->query(
            "SELECT id FROM mail WHERE id = ? AND {$recipientColumn} = ?",
            [$mailId, $userId]
        )->fetch();

        if (!$existing) {
            Response::notFound('Mail not found');
        }

        $this->db->execute(
            "UPDATE mail SET is_read = 1 WHERE id = ? AND {$recipientColumn} = ?",
            [$mailId, $userId]
        );

        Response::json(['message' => 'Marked as read']);
    }

    /**
     * GET /api/mail/recipients/search?q=... — Search possible mail recipients by name
     * (staff only). Returns a unified list of residents and staff.
     */
    public function searchRecipients(): void
    {
        Auth::requireRole('staff');

        $q = trim($_GET['q'] ?? '');
        if ($q === '') {
            Response::json(['data' => []]);
            return;
        }

        $like = "%{$q}%";

        $residents = $this->db->query(
            "SELECT id, first_name, middle_name, last_name, control_no
             FROM residents
             WHERE first_name LIKE ? OR last_name LIKE ? OR CONCAT(first_name, ' ', last_name) LIKE ? OR control_no LIKE ?
             ORDER BY last_name, first_name
             LIMIT 25",
            [$like, $like, $like, $like]
        )->fetchAll();

        $staff = $this->db->query(
            "SELECT id, first_name, middle_name, last_name, position
             FROM staff
             WHERE first_name LIKE ? OR last_name LIKE ? OR CONCAT(first_name, ' ', last_name) LIKE ?
             ORDER BY last_name, first_name
             LIMIT 25",
            [$like, $like, $like]
        )->fetchAll();

        $results = [];
        foreach ($residents as $r) {
            $results[] = [
                'id'         => (int)$r['id'],
                'type'       => 'resident',
                'name'       => trim(($r['first_name'] ?? '') . ' ' . ($r['middle_name'] ?? '') . ' ' . ($r['last_name'] ?? '')),
                'first_name' => $r['first_name'] ?? '',
                'last_name'  => $r['last_name'] ?? '',
                'control_no' => $r['control_no'] ?? null,
            ];
        }
        foreach ($staff as $s) {
            $results[] = [
                'id'         => (int)$s['id'],
                'type'       => 'staff',
                'name'       => trim(($s['first_name'] ?? '') . ' ' . ($s['middle_name'] ?? '') . ' ' . ($s['last_name'] ?? '')),
                'first_name' => $s['first_name'] ?? '',
                'last_name'  => $s['last_name'] ?? '',
                'control_no' => $s['position'] ?? null,
            ];
        }

        Response::json(['data' => $results]);
    }
}
