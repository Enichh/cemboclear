<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Audit and activity logging.
 *
 * audit_logs   — staff actions (Security Monitoring panel)
 * activity_logs — general activity (if/when needed)
 *
 * For now both write to the same audit_logs table defined in schema.sql.
 */
class Logger
{
    private Database $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    /**
     * Log an action to audit_logs.
     *
     * @param string      $action         Description of the action
     * @param string      $securityStatus 'authorized' or 'unauthorized'
     * @param int|null    $staffId        Staff member performing the action
     */
    public function log(
        string $action,
        string $securityStatus = 'authorized',
        ?int $staffId = null
    ): void {
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;

        $this->db->execute(
            'INSERT INTO audit_logs (staff_id, action, ip_address, security_status)
             VALUES (?, ?, ?, ?)',
            [$staffId, $action, $ip, $securityStatus]
        );
    }

    /**
     * Log an activity to audit_logs (alias for log()).
     * Kept for semantic clarity in feature controllers.
     */
    public function activity(string $action, ?int $staffId = null): void
    {
        $this->log($action, 'authorized', $staffId);
    }

    /**
     * Retrieve recent audit log entries.
     */
    public function recent(int $limit = 50): array
    {
        return $this->db->query(
            'SELECT a.*, s.first_name, s.last_name, s.email
             FROM audit_logs a
             LEFT JOIN staff s ON s.id = a.staff_id
             ORDER BY a.created_at DESC
             LIMIT ?',
            [$limit]
        )->fetchAll();
    }
}
