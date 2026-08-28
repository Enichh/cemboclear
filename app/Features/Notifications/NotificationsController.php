<?php
declare(strict_types=1);

namespace App\Features\Notifications;

use App\Core\Database;
use App\Core\Response;
use App\Core\Auth;

class NotificationsController
{
    private Database $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    /** GET /api/notifications — Notifications for current user */
    public function index(): void
    {
        Auth::requireRole();

        $id = Auth::id();
        $type = Auth::type();

        if ($type === 'staff') {
            $notifications = $this->db->query(
                'SELECT id, message, is_read, created_at
                 FROM notifications WHERE staff_id = ?
                 ORDER BY created_at DESC
                 LIMIT 50',
                [$id]
            )->fetchAll();
        } else {
            $notifications = $this->db->query(
                'SELECT id, message, is_read, created_at
                 FROM notifications WHERE resident_id = ?
                 ORDER BY created_at DESC
                 LIMIT 50',
                [$id]
            )->fetchAll();
        }

        Response::json(['data' => $notifications]);
    }

    /** PUT /api/notifications/{id}/read — Mark a notification as read */
    public function markRead(string $id): void
    {
        Auth::requireRole();

        $this->db->execute(
            'UPDATE notifications SET is_read = 1 WHERE id = ?',
            [(int)$id]
        );

        Response::json(['message' => 'Marked as read']);
    }
}
