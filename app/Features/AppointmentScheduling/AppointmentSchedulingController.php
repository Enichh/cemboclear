<?php
declare(strict_types=1);

namespace App\Features\AppointmentScheduling;

use App\Core\Database;
use App\Core\Response;
use App\Core\Auth;

class AppointmentSchedulingController
{
    private Database $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    /** GET /api/appointments/slots?date=YYYY-MM-DD — Available slots for a date */
    public function availableSlots(): void
    {
        Auth::requireRole('resident');

        $date = $_GET['date'] ?? '';
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            Response::error('Valid date parameter is required (YYYY-MM-DD).', 422);
        }

        // All possible time slots, keyed by start hour for elapsed-time checks.
        // 12:00 shifts to hour 12 so it sorts after 11:00 and before 13:00.
        $allSlots = [
            '8:00 - 9:00'     => 8,
            '9:00 - 10:00'    => 9,
            '10:00 - 11:00'   => 10,
            '11:00 - 12:00'   => 11,
            '1:00 - 2:00'     => 13,
            '2:00 - 3:00'     => 14,
            '3:00 - 4:00'     => 15,
            '4:00 - 5:00'     => 16,
        ];

        // Authority for "today" and "current hour": always Asia/Manila (UTC+8),
        // regardless of the server's local timezone. All slot comparisons must
        // use this single source of truth so resident-facing times stay correct.
        $now = new \DateTimeImmutable('now', new \DateTimeZone('Asia/Manila'));

        // Booked slots for the date
        $booked = $this->db->query(
            "SELECT time_slot FROM appointments WHERE appt_date = ? AND status = 'booked'",
            [$date]
        )->fetchAll(\PDO::FETCH_COLUMN);

        // A slot that already started (or passed) for the selected date is not
        // bookable. Compare the slot's start hour against the current hour when
        // the date being shown is today.
        $isToday = ($date === $now->format('Y-m-d'));
        $currentHour = (int)$now->format('H');

        $available = [];
        foreach ($allSlots as $slot => $startHour) {
            $alreadyStarted = $isToday && $currentHour >= $startHour;
            $available[] = [
                'time_slot' => $slot,
                'available' => !in_array($slot, $booked, true) && !$alreadyStarted,
                'expired'   => (bool)$alreadyStarted,
            ];
        }

        Response::json(['date' => $date, 'slots' => $available]);
    }

    /** POST /api/appointments — Book an appointment (resident, with double-booking prevention) */
    public function book(): void
    {
        Auth::requireRole('resident');

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $date = $input['date'] ?? '';
        $timeSlot = $input['time_slot'] ?? '';

        if ($date === '' || $timeSlot === '') {
            Response::error('Date and time_slot are required.', 422);
        }

        $this->db->beginTransaction();

        try {
            // Authority for "today" and "current hour": always Asia/Manila (UTC+8).
            $now = new \DateTimeImmutable('now', new \DateTimeZone('Asia/Manila'));

            // Reject bookings for time slots that have already started today
            $slotStartHours = [
                '8:00 - 9:00' => 8, '9:00 - 10:00' => 9, '10:00 - 11:00' => 10, '11:00 - 12:00' => 11,
                '1:00 - 2:00' => 13, '2:00 - 3:00' => 14, '3:00 - 4:00' => 15, '4:00 - 5:00' => 16,
            ];
            if ($date === $now->format('Y-m-d')) {
                $startHour = $slotStartHours[$timeSlot] ?? null;
                if ($startHour !== null && (int)$now->format('H') >= $startHour) {
                    $this->db->rollBack();
                    Response::error('This time slot has already started and can no longer be booked.', 422);
                }
            }

            // Lock the slot to prevent double-booking
            $existing = $this->db->query(
                "SELECT id FROM appointments
                 WHERE appt_date = ? AND time_slot = ? AND status = 'booked'
                 FOR UPDATE",
                [$date, $timeSlot]
            )->fetch();

            if ($existing) {
                $this->db->rollBack();
                Response::error('This time slot is already booked.', 409);
            }

            $this->db->execute(
                'INSERT INTO appointments (resident_id, appt_date, time_slot) VALUES (?, ?, ?)',
                [Auth::id(), $date, $timeSlot]
            );

            $id = (int)$this->db->lastInsertId();
            $this->db->commit();

            Response::json([
                'message'   => 'Appointment booked',
                'id'        => $id,
                'date'      => $date,
                'time_slot' => $timeSlot,
            ], 201);

        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error('Failed to book appointment.', 500);
        }
    }
}
