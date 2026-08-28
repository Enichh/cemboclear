<?php
declare(strict_types=1);

namespace App\Features\AppointmentManagement;

use App\Core\Database;
use App\Core\Response;
use App\Core\Auth;

class AppointmentManagementController
{
    private Database $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    /** GET /api/appointments — List appointments (all for staff, own for resident) */
    public function index(): void
    {
        Auth::requireRole();

        if (Auth::type() === 'staff') {
            $appointments = $this->db->query(
                'SELECT a.id, a.appt_date, a.time_slot, a.status, a.created_at,
                        r.id as resident_id, r.first_name, r.last_name, r.phone
                 FROM appointments a
                 JOIN residents r ON r.id = a.resident_id
                 ORDER BY a.appt_date DESC, a.time_slot'
            )->fetchAll();
            foreach ($appointments as &$appt) {
                $appt['id'] = (int)$appt['id'];
                $appt['resident_id'] = (int)$appt['resident_id'];
            }
        } else {
            $appointments = $this->db->query(
                'SELECT id, appt_date, time_slot, status, created_at
                 FROM appointments WHERE resident_id = ?
                 ORDER BY appt_date DESC, time_slot',
                [Auth::id()]
            )->fetchAll();
            foreach ($appointments as &$appt) {
                $appt['id'] = (int)$appt['id'];
            }
        }

        Response::json(['data' => $appointments]);
    }

    /** PUT /api/appointments/{id}/cancel — Cancel an appointment */
    public function cancel(string $id): void
    {
        Auth::requireRole();

        $appointmentId = (int)$id;
        $appointment = $this->db->query(
            'SELECT id, resident_id, status FROM appointments WHERE id = ?',
            [$appointmentId]
        )->fetch();

        if (!$appointment) {
            Response::notFound('Appointment not found');
        }

        // Residents can only cancel their own
        if (Auth::type() === 'resident' && (int)$appointment['resident_id'] !== Auth::id()) {
            Response::forbidden();
        }

        if ($appointment['status'] === 'cancelled') {
            Response::error('Appointment is already cancelled.', 409);
        }

        $this->db->execute(
            "UPDATE appointments SET status = 'cancelled' WHERE id = ?",
            [$appointmentId]
        );

        Response::json(['message' => 'Appointment cancelled']);
    }

    /** GET /api/appointments/resident/{id} — Get appointments for a specific resident (staff) */
    public function byResident(string $id): void
    {
        Auth::requireRole('staff');

        $appointments = $this->db->query(
            'SELECT id, appt_date, time_slot, status, created_at
             FROM appointments WHERE resident_id = ?
             ORDER BY appt_date DESC',
            [(int)$id]
        )->fetchAll();

        foreach ($appointments as &$appt) {
            $appt['id'] = (int)$appt['id'];
        }

        Response::json(['data' => $appointments]);
    }
}
