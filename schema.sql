-- ============================================================================
-- CemboClear: Online and Appointment Services
-- Complete Database Schema (MySQL 8.x / MariaDB, InnoDB, utf8mb4)
--
-- Derived strictly from the frontend:
--   * CCLog-in.html    -> login (email-or-phone + password)
--   * CCSignUp.html    -> resident self-registration
--   * Admin.html       -> staff dashboard + all admin modules
--   * Resident.html    -> resident portal + all resident modules
--
-- STRUCTURE DECISION (research-backed):
--   Two account tables, because the two populations have different data and
--   different lifecycles:
--       staff      : admin + staff. Seeded/created by an admin. No public signup.
--       residents  : barangay residents. Self-register via CCSignUp.html.
--   A single "users" table with a role flag is discouraged here — residents
--   carry census/registry fields staff never have, and staff carry position/
--   branch fields residents never have.
--
-- ACID (InnoDB guarantees these once transactions are used):
--   ATOMICITY    -> wrap multi-step writes in START TRANSACTION ... COMMIT
--                   (e.g. signup creating resident + initial rows; request
--                    + its attachments).
--   CONSISTENCY  -> enforced here by FOREIGN KEY, UNIQUE, NOT NULL, and CHECK
--                   constraints (InnoDB enforces FKs; MyISAM does NOT).
--   ISOLATION    -> InnoDB row-level locking + REPEATABLE READ (default).
--                   Use a SELECT ... FOR UPDATE when booking an appointment to
--                   prevent double-booking the same slot.
--   DURABILITY   -> InnoDB write-ahead (redo) log. Never run with
--                   autocommit=0 permanently; commit per logical unit.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. STAFF  (admin + staff accounts)
--    Login: email + password (CCLog-in.html "Email or Phone No." accepts either;
--           email is the canonical key, phone is also indexed).
--    Profile: position, branch (Admin account/profile panels).
-- ============================================================================
DROP TABLE IF EXISTS staff;
CREATE TABLE staff (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    email         VARCHAR(255)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,               -- password_hash() output only
    phone         VARCHAR(30)   NULL,

    first_name    VARCHAR(100)  NOT NULL,
    middle_name   VARCHAR(100)  NULL,
    last_name     VARCHAR(100)  NOT NULL,
    position      VARCHAR(100)  NULL,                   -- "System Administrator"
    branch        VARCHAR(150)  NULL,                   -- "Cembo Barangay Office"
    birthdate     DATE          NULL,

    is_verified   TINYINT(1)    NOT NULL DEFAULT 1,
    status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_staff_email (email),
    KEY idx_staff_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. RESIDENTS  (resident accounts + registry profile, single table)
--    Signup (CCSignUp.html): first name, M.I name, last name, birthdate,
--        gender (male/female/other), email, phone, password.
--    Registry (Resident Personal Information + RBI): sex, civil status,
--        birth place, address/purok, citizenship, control number, status.
--    Login: email or phone (both usable; email is canonical, phone indexed).
-- ============================================================================
DROP TABLE IF EXISTS residents;
CREATE TABLE residents (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,

    -- login (CCLog-in.html)
    email         VARCHAR(255)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,               -- password_hash() output only
    phone         VARCHAR(30)   NULL,

    -- identity (CCSignUp.html)
    first_name    VARCHAR(100)  NOT NULL,
    middle_name   VARCHAR(100)  NULL,                   -- "M.I Name"
    last_name     VARCHAR(100)  NOT NULL,
    suffix        VARCHAR(20)   NULL,
    birthdate     DATE          NULL,
    gender        ENUM('male','female','other') NULL,   -- signup offers "Other"

    -- registry (Resident Personal Information + RBI)
    civil_status  VARCHAR(40)   NULL,
    birth_place   VARCHAR(150)  NULL,
    address       VARCHAR(255)  NULL,                   -- "#12 Street Name, Purok 4"
    purok         VARCHAR(20)   NULL,
    citizenship   VARCHAR(100)  NULL,
    control_no    VARCHAR(40)   NULL,                   -- "CC-2026-XXXX"

    -- account / registry state
    is_verified   TINYINT(1)    NOT NULL DEFAULT 0,
    registry_status ENUM('pending','verified','outdated') NOT NULL DEFAULT 'pending',
    account_status  ENUM('active','inactive') NOT NULL DEFAULT 'active',
    last_census_at  DATE          NULL,                 -- for Data Freshness Audit
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_residents_email (email),
    UNIQUE KEY uq_residents_control_no (control_no),
    KEY idx_residents_phone (phone),
    KEY idx_residents_name (last_name, first_name),
    KEY idx_residents_registry_status (registry_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. AGENCIES  (Department & Agencies catalog — 6 cards on resident side)
-- ============================================================================
DROP TABLE IF EXISTS agencies;
CREATE TABLE agencies (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100)  NOT NULL,                 -- Administrative, Health, ...
    description TEXT          NULL,
    icon        VARCHAR(100)  NULL,                     -- e.g. Administrator.png
    PRIMARY KEY (id),
    UNIQUE KEY uq_agencies_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. REQUEST_TYPES  (per-agency dropdown options)
--    e.g. Administrative -> "Resident Record Correction", etc.
-- ============================================================================
DROP TABLE IF EXISTS request_types;
CREATE TABLE request_types (
    id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    agency_id INT UNSIGNED  NOT NULL,
    name      VARCHAR(150)  NOT NULL,
    PRIMARY KEY (id),
    KEY idx_request_types_agency (agency_id),
    CONSTRAINT fk_request_types_agency FOREIGN KEY (agency_id)
        REFERENCES agencies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. REQUESTS  (Request & Concern submission + admin compilation box)
-- ============================================================================
DROP TABLE IF EXISTS requests;
CREATE TABLE requests (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id       VARCHAR(40)  NOT NULL,              -- "#REQ-2026-8942"
    resident_id     INT UNSIGNED NOT NULL,
    agency_id       INT UNSIGNED NOT NULL,
    request_type_id INT UNSIGNED NULL,
    subject         VARCHAR(150) NULL,                  -- case nature
    details         TEXT         NULL,
    status          ENUM('pending_review','reviewed','resolved','closed')
                        NOT NULL DEFAULT 'pending_review',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_requests_ticket (ticket_id),
    KEY idx_requests_resident (resident_id),
    KEY idx_requests_agency (agency_id),
    KEY idx_requests_status (status),
    CONSTRAINT fk_requests_resident FOREIGN KEY (resident_id)
        REFERENCES residents(id) ON DELETE CASCADE,
    CONSTRAINT fk_requests_agency FOREIGN KEY (agency_id)
        REFERENCES agencies(id) ON DELETE CASCADE,
    CONSTRAINT fk_requests_type FOREIGN KEY (request_type_id)
        REFERENCES request_types(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. ATTACHMENTS  (Signature / Valid ID uploads + request supporting documents)
-- ============================================================================
DROP TABLE IF EXISTS attachments;
CREATE TABLE attachments (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_id  INT UNSIGNED NULL,                      -- supporting doc for a request
    resident_id INT UNSIGNED NULL,                      -- signature / valid ID
    kind        ENUM('signature','valid_id','supporting_document') NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_path   VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_attachments_request (request_id),
    KEY idx_attachments_resident (resident_id),
    KEY idx_attachments_kind (kind),
    CONSTRAINT fk_attachments_request FOREIGN KEY (request_id)
        REFERENCES requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_attachments_resident FOREIGN KEY (resident_id)
        REFERENCES residents(id) ON DELETE CASCADE,
    CONSTRAINT chk_attachments_target CHECK (request_id IS NOT NULL OR resident_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. CERTIFICATE_PURPOSES  (radio options on Personal Information form)
-- ============================================================================
DROP TABLE IF EXISTS certificate_purposes;
CREATE TABLE certificate_purposes (
    id   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    name VARCHAR(150)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cert_purposes_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. CERTIFICATE_APPLICATIONS  ("Apply" submission on Personal Information)
-- ============================================================================
DROP TABLE IF EXISTS certificate_applications;
CREATE TABLE certificate_applications (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    resident_id INT UNSIGNED NOT NULL,
    purpose_id  INT UNSIGNED NOT NULL,
    status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    applied_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_cert_app_resident (resident_id),
    KEY idx_cert_app_purpose (purpose_id),
    CONSTRAINT fk_cert_app_resident FOREIGN KEY (resident_id)
        REFERENCES residents(id) ON DELETE CASCADE,
    CONSTRAINT fk_cert_app_purpose FOREIGN KEY (purpose_id)
        REFERENCES certificate_purposes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. APPOINTMENTS  (Calendar + time slots)
--    To prevent double-booking, wrap the INSERT in a transaction and use
--    SELECT ... FOR UPDATE on the (appt_date, time_slot) combination.
-- ============================================================================
DROP TABLE IF EXISTS appointments;
CREATE TABLE appointments (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    resident_id INT UNSIGNED NOT NULL,
    appt_date   DATE         NOT NULL,
    time_slot   VARCHAR(30)  NOT NULL,                  -- "8:00 - 9:00"
    status      ENUM('booked','available','cancelled') NOT NULL DEFAULT 'booked',
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_appointments_resident (resident_id),
    KEY idx_appointments_date (appt_date),
    KEY idx_appointments_slot (appt_date, time_slot),
    CONSTRAINT fk_appointments_resident FOREIGN KEY (resident_id)
        REFERENCES residents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. MAIL  (in-app Mail Box. Messages flow between staff and residents.)
--     sender / recipient can each be EITHER a staff or a resident, so each
--     side holds a pair of nullable FKs with a CHECK that exactly one is set.
-- ============================================================================
DROP TABLE IF EXISTS mail;
CREATE TABLE mail (
    id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    sender_staff_id        INT UNSIGNED NULL,
    sender_resident_id     INT UNSIGNED NULL,
    recipient_staff_id     INT UNSIGNED NULL,
    recipient_resident_id  INT UNSIGNED NULL,
    subject                VARCHAR(255) NULL,
    body                   TEXT         NULL,
    is_read                TINYINT(1)   NOT NULL DEFAULT 0,
    is_archived            TINYINT(1)   NOT NULL DEFAULT 0,
    created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_mail_sender_staff (sender_staff_id),
    KEY idx_mail_sender_resident (sender_resident_id),
    KEY idx_mail_recipient_staff (recipient_staff_id),
    KEY idx_mail_recipient_resident (recipient_resident_id),
    CONSTRAINT fk_mail_sender_staff FOREIGN KEY (sender_staff_id)
        REFERENCES staff(id) ON DELETE CASCADE,
    CONSTRAINT fk_mail_sender_resident FOREIGN KEY (sender_resident_id)
        REFERENCES residents(id) ON DELETE CASCADE,
    CONSTRAINT fk_mail_recipient_staff FOREIGN KEY (recipient_staff_id)
        REFERENCES staff(id) ON DELETE CASCADE,
    CONSTRAINT fk_mail_recipient_resident FOREIGN KEY (recipient_resident_id)
        REFERENCES residents(id) ON DELETE CASCADE,
    CONSTRAINT chk_mail_sender CHECK
        ((sender_staff_id IS NOT NULL AND sender_resident_id IS NULL)
          OR (sender_staff_id IS NULL AND sender_resident_id IS NOT NULL)),
    CONSTRAINT chk_mail_recipient CHECK
        ((recipient_staff_id IS NOT NULL AND recipient_resident_id IS NULL)
          OR (recipient_staff_id IS NULL AND recipient_resident_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. NOTIFICATIONS  (notifications panel on both sides)
--     A notification belongs to either a staff or a resident account.
-- ============================================================================
DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    staff_id        INT UNSIGNED NULL,
    resident_id     INT UNSIGNED NULL,
    message         VARCHAR(255) NOT NULL,
    is_read         TINYINT(1)   NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_notifications_staff (staff_id),
    KEY idx_notifications_resident (resident_id),
    CONSTRAINT fk_notifications_staff FOREIGN KEY (staff_id)
        REFERENCES staff(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_resident FOREIGN KEY (resident_id)
        REFERENCES residents(id) ON DELETE CASCADE,
    CONSTRAINT chk_notifications_target CHECK
        ((staff_id IS NOT NULL AND resident_id IS NULL)
          OR (staff_id IS NULL AND resident_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. AUDIT_LOGS  (Security Monitoring + admin "View Activity")
--     Logs staff actions. "Unknown" actor => staff_id NULL.
-- ============================================================================
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    staff_id        INT UNSIGNED NULL,                  -- NULL = "Unknown" actor
    action          VARCHAR(255) NOT NULL,              -- "Accessed Audit Trail"
    ip_address      VARCHAR(45)  NULL,                  -- IPv6-safe
    security_status ENUM('authorized','unauthorized') NOT NULL DEFAULT 'authorized',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_audit_staff (staff_id),
    KEY idx_audit_created (created_at),
    CONSTRAINT fk_audit_staff FOREIGN KEY (staff_id)
        REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 13. TRANSACTIONS  (Financial Reports -> Transaction lookup)
-- ============================================================================
DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
    id             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    resident_id    INT UNSIGNED    NOT NULL,
    description    VARCHAR(255)    NULL,
    amount         DECIMAL(12,2)   NULL,
    transacted_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_transactions_resident (resident_id),
    CONSTRAINT fk_transactions_resident FOREIGN KEY (resident_id)
        REFERENCES residents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- NOTES
--  * Dashboard analytics (Gender chart, Age chart, Pending/Verified counters)
--    are DERIVED at query time from `residents` (GROUP BY gender / status),
--    not stored as separate tables.
--  * "End-to-End Encryption" is a UI-only demo form; no table required.
--  * "RBAC" frontend shows 3 static cards; the only roles in this schema are
--    staff vs resident (separate tables). Granular staff permissions would be
--    an optional add-on (roles/permissions join tables) if requested.
-- ============================================================================
