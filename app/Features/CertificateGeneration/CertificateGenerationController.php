<?php
declare(strict_types=1);

namespace App\Features\CertificateGeneration;

use App\Core\Database;
use App\Core\Response;
use App\Core\Auth;
use App\Core\Logger;

class CertificateGenerationController
{
    private Database $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    /** GET /api/certificates — List all certificate applications (staff) or own (resident) */
    public function index(): void
    {
        Auth::requireRole();

        if (Auth::type() === 'staff') {
            $certs = $this->db->query(
                'SELECT c.id, c.status, c.applied_at,
                        r.id as resident_id, r.first_name, r.last_name, r.control_no,
                        p.name as purpose
                 FROM certificate_applications c
                 JOIN residents r ON r.id = c.resident_id
                 JOIN certificate_purposes p ON p.id = c.purpose_id
                 ORDER BY c.applied_at DESC'
            )->fetchAll();
        } else {
            $certs = $this->db->query(
                'SELECT c.id, c.status, c.applied_at, p.name as purpose
                 FROM certificate_applications c
                 JOIN certificate_purposes p ON p.id = c.purpose_id
                 WHERE c.resident_id = ?
                 ORDER BY c.applied_at DESC',
                [Auth::id()]
            )->fetchAll();
        }

        Response::json(['data' => $certs]);
    }

    /** GET /api/certificate-purposes — List available purposes */
    public function purposes(): void
    {
        Auth::requireRole();

        $purposes = $this->db->query(
            'SELECT id, name FROM certificate_purposes ORDER BY name'
        )->fetchAll();

        Response::json(['data' => $purposes]);
    }

    /** POST /api/certificates — Apply for a certificate (resident only) */
    public function apply(): void
    {
        Auth::requireRole('resident');

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $purposeId = (int)($input['purpose_id'] ?? 0);

        if ($purposeId <= 0) {
            Response::error('Purpose is required.', 422);
        }

        // Verify purpose exists
        $purpose = $this->db->query(
            'SELECT id FROM certificate_purposes WHERE id = ?',
            [$purposeId]
        )->fetch();
        if (!$purpose) {
            Response::error('Invalid purpose.', 422);
        }

        $residentId = Auth::id();
        $this->db->execute(
            'INSERT INTO certificate_applications (resident_id, purpose_id) VALUES (?, ?)',
            [$residentId, $purposeId]
        );

        Response::json(['message' => 'Application submitted', 'id' => (int)$this->db->lastInsertId()], 201);
    }

    /** PUT /api/certificates/{id}/approve — Approve a certificate (staff) */
    public function approve(string $id): void
    {
        Auth::requireRole('staff');

        $this->db->execute(
            "UPDATE certificate_applications SET status = 'approved' WHERE id = ?",
            [(int)$id]
        );

        (new Logger($this->db))->activity(
            'Approved certificate #' . $id,
            Auth::id()
        );

        Response::json(['message' => 'Certificate approved']);
    }

    /** PUT /api/certificates/{id}/reject — Reject a certificate (staff) */
    public function reject(string $id): void
    {
        Auth::requireRole('staff');

        $this->db->execute(
            "UPDATE certificate_applications SET status = 'rejected' WHERE id = ?",
            [(int)$id]
        );

        (new Logger($this->db))->activity(
            'Rejected certificate #' . $id,
            Auth::id()
        );

        Response::json(['message' => 'Certificate rejected']);
    }
}
