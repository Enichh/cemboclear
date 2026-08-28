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

        $mailId = (int)$id;
        $existing = $this->db->query('SELECT id FROM mail WHERE id = ?', [$mailId])->fetch();
        if (!$existing) {
            Response::notFound('Mail not found');
        }

        $this->db->execute(
            'UPDATE mail SET is_read = 1 WHERE id = ?',
            [$mailId]
        );

        Response::json(['message' => 'Marked as read']);
    }
}
