# CemboClear — API Contract

> **Audience:** the implementing AI/developer.
> **Source of truth:** the frontend (`public/*.html`, `public/*.js`) and this contract.
> **Do NOT invent endpoints, fields, or behaviors that are not listed here** unless the UI itself requires them (and if so, note it explicitly in a reply).

This document defines the exact HTTP surface the frontend expects. Match it precisely: paths, methods, request shape, response shape, status codes, and auth rules.

---

## 1. Global conventions

### Base
- All API endpoints live under `/api`.
- The front controller is `public/api/index.php`. Apache rewrites `/api/*` to it (see `public/.htaccess`).
- Static frontend files (`Admin.html`, `Resident.html`, `CCLog-in.html`, `CCSignUp.html`, CSS/JS/images) are served directly by Apache — never via these endpoints.

### Content type
- Requests with a body: `application/json` (raw JSON body, read via `php://input`).
- **Exception:** `POST /api/upload` uses `multipart/form-data`.

### CSRF protection (REQUIRED)
All mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`) are protected by a synchronizer CSRF token,
**except** the session-establishing routes `POST /api/login` and `POST /api/signup` (they have no
session/token yet). The backend enforces this in `Csrf::check()` before routing; a missing/mismatched
token returns `403 { "error": true, "message": "CSRF token validation failed." }`.

- **How the client obtains the token:** the backend returns it in the JSON field `csrf_token` on
  `POST /api/login` (success) and `GET /api/me`. The client MUST persist it (e.g. `localStorage`)
  and re-send it as the request header `X-CSRF-Token` on every subsequent mutating request.
- **Accepted token locations (server checks in order):**
  1. `X-CSRF-Token` header (also accepts `X-XSRF-Token`),
  2. `$_POST['csrf_token']` / `$_POST['_csrf']` (form/multipart), or
  3. JSON body field `csrf_token` / `_csrf`.
  > Prefer the `X-CSRF-Token` header; the body fallbacks exist only for `multipart/form-data` flows
  > that cannot set the header.
- The frontend MUST call the API only through `public/api-client.js` (`CemboClear.client()`), which
  handles the token automatically. Do **not** hand-write `fetch` calls that bypass it.
- The token is stored in the session (`$_SESSION['csrf_token']`); it is single-session, not shared
  across devices. When the session expires and `re-login` occurs, a fresh token is issued — update it.

### Response envelope
Every response is JSON.

**Success** — the exact shape varies per endpoint (see below). Never wrap success in an extra object unless specified.

**Error** — always this shape:
```json
{ "error": true, "message": "Human-readable reason" }
```

### Status codes
| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Resource created |
| 204 | No content (no body) |
| 400 | Bad request |
| 401 | Unauthenticated (missing/invalid session) |
| 403 | Authenticated but wrong role / forbidden |
| 404 | Not found |
| 409 | Conflict (duplicate email, already-booked slot, already cancelled) |
| 422 | Validation error (missing/invalid field) |
| 429 | Too many requests (rate-limited) |
| 500 | Server error |

### Auth model
- Session-based. Two account tables: `staff` and `residents`.
- `$_SESSION['user_id']` (int) and `$_SESSION['user_type']` (`'staff'` | `'resident'`).
- **Role rules are stated per endpoint.** Three access levels:
  - `staff only`
  - `resident only`
  - `any authenticated` (staff or resident)
- Unauthenticated → `401`. Wrong role → `403`. Do not swap these.

### Identifier for login
- Login accepts **email OR phone** in a single field. The UI (`CCLog-in.html`) shows one "Email or Phone No." input.
- Normalize phone inputs (`+63`, leading `0`, `63` prefix, bare 10-digit) and match against the `phone` column when the identifier is phone-like (no `@`). Email remains the canonical unique key.

### Naming
- Table and column names are fixed by `schema.sql`. Do not rename them.
- JSON field names are `snake_case` and must match exactly what the frontend/`Admin.js`/`Resident.js` will consume.

---

## 2. Endpoints

### 2.1 Health

#### `GET /api/health`
- **Auth:** none.
- **Response (200):**
```json
{ "status": "ok", "time": "2026-08-28T12:00:00+00:00" }
```

---

### 2.2 Authentication

#### `POST /api/login`
- **Auth:** none.
- **Request body:**
```json
{ "email": "juan@example.com", "password": "secret" }
```
  - `email` may also be a phone number. (Accept `email`, `phone`, or `identifier` as the key for the single identifier field; `password` is required.)
- **Checks:** try `staff` first, then `residents`. Verify inactive status before password. Use `password_verify`.
- **Success (200):**
```json
{
  "message": "Login successful",
  "csrf_token": "<64 hex chars>",
  "user": {
    "id": 1,
    "email": "juan@example.com",
    "name": "Juan Dela Cruz",
    "position": "System Administrator",   // staff only, omitted for resident
    "type": "staff"                        // or "resident"
  }
}
```
  - `csrf_token` is REQUIRED by the frontend: persist it and send it as `X-CSRF-Token` on all later mutating calls.
- **Errors:**
  - `422` missing identifier/password.
  - `401` invalid credentials, inactive account, or unknown user — a single uniform message (no account/status enumeration).
  - `429` too many attempts (rate-limited via `RateLimiter`; retry after `Retry-After`).

#### `POST /api/logout`
- **Auth:** any authenticated.
- **Response (200):** `{ "message": "Logged out" }`

#### `GET /api/me`
- **Auth:** any authenticated.
- **Response (200):** the current user's row **plus** `csrf_token` and `"type"`.
  - `staff`: `id, email, first_name, middle_name, last_name, position, branch, phone, status`, `"type": "staff"`, `"csrf_token": "..."`.
  - `resident`: `id, email, first_name, middle_name, last_name, suffix, phone, gender, birthdate, civil_status, address, purok, control_no, registry_status, account_status`, `"type": "resident"`, `"csrf_token": "..."`.
  - **Do NOT return `password_hash`.**
- **Errors:** `401` if not logged in.

#### `POST /api/signup` (resident self-registration)
- **Auth:** none.
- **Request body:**
```json
{
  "first_name": "Juan",
  "middle_name": "M",
  "last_name": "Dela Cruz",
  "suffix": "Jr",
  "birthdate": "1990-01-15",
  "gender": "male",           // "male" | "female" | "other"
  "email": "juan@example.com",
  "phone": "+639171234567",
  "password": "secret"
}
```
- **Required:** `email`, `password`, `first_name`, `last_name`.
- **Validations:** `gender` in (`male`,`female`,`other`); email must not already exist in `staff` OR `residents` → `409`.
- **Success (201):** `{ "message": "Account created", "id": 1 }`

> Note: `CCSignUp.html` also has a "Confirm Password" field. The API receives `password`; confirm the match is enforced **client-side** (or if you want server-side, accept an optional `password_confirm` and validate equality — but do not store it).

---

### 2.3 Resident Registry (RBI)

#### `GET /api/residents`
- **Auth:** staff only.
- **Query:** `page` (default 1, min 1), `limit` (default 25, max 100).
- **Response (200):**
```json
{
  "data": [ { "id":1, "email":"..", "first_name":"..", "middle_name":"..", "last_name":"..", "suffix":"..", "phone":"..", "gender":"..", "birthdate":"..", "civil_status":"..", "address":"..", "purok":"..", "control_no":"..", "registry_status":"..", "account_status":"..", "created_at":".." } ],
  "total": 128,
  "page": 1,
  "limit": 25
}
```

#### `GET /api/residents/{id}`
- **Auth:** any authenticated.
- **Response (200):** full resident row (include `birth_place`, `citizenship`, `last_census_at`, `updated_at`). `404` if missing.

#### `GET /api/residents/search?q=...`
- **Auth:** staff only.
- **Query:** `q` (required; empty → `422`).
- **Searches:** first_name, last_name, control_no, phone (LIKE).
- **Response (200):** `{ "data": [ ... ] }`

#### `PUT /api/residents/{id}`
- **Auth:** staff only.
- **Request body:** partial update; only these keys are honored:
  `first_name, middle_name, last_name, suffix, phone, gender, birthdate, civil_status, birth_place, address, purok, citizenship, control_no, registry_status`.
- **Response (200):** `{ "message": "Resident updated" }`
- `422` if no valid fields; `404` if resident missing.

#### `PUT /api/residents/{id}/verify`
- **Auth:** staff only.
- **Effect:** set `is_verified = 1`, `registry_status = 'verified'`.
- **Response (200):** `{ "message": "Resident verified" }`

#### `PUT /api/residents/{id}/status`
- **Auth:** staff only.
- **Request body:** `{ "status": "active" | "inactive" }` (else `422`).
- **Response (200):** `{ "message": "Status updated" }`

#### `GET /api/dashboard/stats`
- **Auth:** staff only.
- **Response (200):**
```json
{
  "total_residents": 128,
  "verified_residents": 60,
  "pending_residents": 68,
  "gender_distribution": [ { "gender": "male", "cnt": 49 } ],
  "age_distribution": [ { "age_group": "18-30", "cnt": 40 } ],
  "pending_requests": 24,
  "upcoming_appointments": 3
}
```
- Age groups are fixed buckets: `Under 18`, `18-30`, `31-50`, `51+` (ordered in that sequence).

---

### 2.4 Certificates (Personal Information → "Purpose of Certificate")

> The UI calls these **certificates**, NOT "clearance". Keep the `/api/certificates` naming.

#### `GET /api/certificates`
- **Auth:** any authenticated.
- **staff:** list all applications (join residents + purposes).
- **resident:** list only their own.
- **Response (200):** `{ "data": [ ... ] }`

#### `GET /api/certificate-purposes`
- **Auth:** any authenticated.
- **Response (200):** `{ "data": [ { "id":1, "name":"Barangay Certificate of Residency" } ] }`

#### `POST /api/certificates`
- **Auth:** resident only.
- **Request body:** `{ "purpose_id": 1 }`
- **Validation:** purpose must exist → else `422`.
- **Response (201):** `{ "message": "Application submitted", "id": 1 }`

#### `PUT /api/certificates/{id}/approve`
- **Auth:** staff only.
- **Response (200):** `{ "message": "Certificate approved" }`

#### `PUT /api/certificates/{id}/reject`
- **Auth:** staff only.
- **Response (200):** `{ "message": "Certificate rejected" }`

---

### 2.5 Requests / Concerns (ticketing)

#### `POST /api/requests` (submit a request — resident)
- **Auth:** resident only.
- **Request body:**
```json
{
  "agency_id": 3,
  "request_type_id": 7,
  "subject": "Drainage Clogging Issue",
  "details": "..."
}
```
- **Validation:** `agency_id` required and must exist → else `422`.
- **Effect:** generate unique ticket id `#REQ-YYYY-####`.
- **Response (201):** `{ "message": "Request submitted", "ticket_id": "#REQ-2026-8942", "id": 1 }`

#### `GET /api/requests` (role-aware list)
- **Auth:** any authenticated.
- **staff:** list **all** requests, joined with resident + agency.
- **resident:** list **only their own** requests.
- **Response (200):**
  - resident:
    ```json
    { "data": [ { "id":1, "ticket_id":"..", "subject":"..", "status":"..", "created_at":"..", "agency_name":".." } ] }
    ```
  - staff (join residents + agencies; include resident name + control_no):
    ```json
    { "data": [ { "id":1, "ticket_id":"..", "resident_id":1, "resident_name":"Juan Dela Cruz", "control_no":"CC-2026-0101", "agency_name":"Environment & Sanitation", "subject":"..", "status":"pending_review", "created_at":".." } ] }
    ```

> This powers the admin "Resident Collection Box" (request compilation) screen, so the staff branch MUST return all requests, not just the caller's.

---

### 2.6 Appointments

#### `GET /api/appointments/slots?date=YYYY-MM-DD`
- **Auth:** resident only.
- **Query:** `date` (required, `YYYY-MM-DD` else `422`).
- **Response (200):**
```json
{
  "date": "2026-04-06",
  "slots": [
    { "time_slot": "8:00 - 9:00", "available": false },
    { "time_slot": "9:00 - 10:00", "available": true }
  ]
}
```
- **Fixed slot list (order matters):**
  `8:00 - 9:00`, `9:00 - 10:00`, `10:00 - 11:00`, `11:00 - 12:00`, `1:00 - 2:00`, `2:00 - 3:00`, `3:00 - 4:00`, `4:00 - 5:00`.

#### `POST /api/appointments` (book)
- **Auth:** resident only.
- **Request body:** `{ "date": "YYYY-MM-DD", "time_slot": "8:00 - 9:00" }`
- **Validation:** both required.
- **Atomicity:** wrap in a transaction, `SELECT ... FOR UPDATE` on `(appt_date, time_slot)` where `status='booked'` to prevent double-booking. If taken → `409`.
- **Response (201):** `{ "message": "Appointment booked", "id": 1, "date": "..", "time_slot": ".." }`

#### `GET /api/appointments`
- **Auth:** any authenticated.
- **staff:** all appointments (join residents). **resident:** own only.
- **Response (200):** `{ "data": [ ... ] }`

#### `PUT /api/appointments/{id}/cancel`
- **Auth:** any authenticated. Residents may only cancel their own (`403` otherwise).
- **Response (200):** `{ "message": "Appointment cancelled" }`
- `409` if already cancelled; `404` if missing.

#### `GET /api/appointments/resident/{id}`
- **Auth:** staff only.
- **Response (200):** `{ "data": [ ... ] }`

---

### 2.7 Transactions (Financial Reports → Transaction)

> UI says **"Transaction"**, not "payment". Keep `/api/transactions`.

#### `GET /api/transactions`
- **Auth:** any authenticated.
- **staff:** all (join residents). **resident:** own only.
- **Response (200):** `{ "data": [ ... ] }`

#### `GET /api/transactions/{id}`
- **Auth:** any authenticated. Residents may only view their own (`403` otherwise).
- **Response (200):** single transaction (join residents).
- `404` if missing.

#### `POST /api/transactions`
- **Auth:** staff only.
- **Request body:** `{ "resident_id": 1, "description": "...", "amount": 100.00 }`
- **Validation:** `resident_id` required and must exist → else `422`/`404`.
- **Response (201):** `{ "message": "Transaction recorded", "id": 1 }`

---

### 2.8 Staff (User Management)

#### `GET /api/staff`
- **Auth:** staff only.
- **Response (200):** `{ "data": [ { "id":1, "email":"..", "first_name":"..", "middle_name":"..", "last_name":"..", "position":"..", "branch":"..", "phone":"..", "is_verified":1, "status":"active", "created_at":".." } ] }`

#### `POST /api/staff`
- **Auth:** staff only.
- **Request body:**
```json
{ "email":"..", "password":"..", "first_name":"..", "last_name":"..", "middle_name":"..", "position":"..", "branch":"..", "phone":"..", "birthdate":".." }
```
- **Required:** `email`, `password`, `first_name`, `last_name`.
- **Email must be unique across `staff` and `residents`** → else `409`.
- **Response (201):** `{ "message": "Staff account created", "id": 1 }`

#### `PUT /api/staff/{id}`
- **Auth:** staff only.
- **Partial update.** Allowed keys: `first_name, middle_name, last_name, phone, position, branch, birthdate`. Plus optional `password` (hashed).
- **Response (200):** `{ "message": "Staff updated" }`
- `422` if no valid fields; `404` if missing.

#### `PUT /api/staff/{id}/status`
- **Auth:** staff only.
- **Request body:** `{ "status": "active" | "inactive" }` (else `422`).
- **Response (200):** `{ "message": "Status updated" }`

---

### 2.9 Audit Log (Security Monitoring / Activity)

#### `GET /api/audit-logs`
- **Auth:** staff only.
- **Query:** `page` (default 1), `limit` (default 50, max 100).
- **Response (200):**
```json
{
  "data": [ { "id":1, "action":"..", "ip_address":"..", "security_status":"authorized", "created_at":"..", "staff_id":1, "first_name":"..", "last_name":"..", "email":".." } ],
  "total": 50,
  "page": 1,
  "limit": 50
}
```

---

### 2.10 File Uploads

#### `POST /api/upload`
- **Auth:** any authenticated.
- **Content type:** `multipart/form-data`.
- **Fields:**
  - `file` (required file)
  - `kind` = `signature` | `valid_id` | `supporting_document` (default `supporting_document`)
  - `request_id` (optional)
  - `resident_id` (optional)
- **Validation:**
  - invalid `kind` → `422`.
  - max size 5 MB → `422`.
  - allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `application/pdf` (detect via `finfo`, not extension) → `422`.
- **Effect:** store file with a random safe name in `storage/uploads`, insert `attachments` row.
- **Response (201):**
```json
{ "message": "File uploaded", "id": 1, "file_name": "original.pdf", "kind": "supporting_document" }
```

#### `GET /api/attachments/{id}`
- **Auth:** any authenticated.
- **Effect:** stream the file as download (`Content-Disposition: attachment`).
- `404` if record or file missing.

---

### 2.11 Mail (in-app inbox)

> Sender/recipient can each be either staff or resident (paired nullable FKs).

#### `GET /api/mail`
- **Auth:** any authenticated.
- **Returns:** inbox messages where the current user is the recipient.
- **Response (200):** `{ "data": [ { "id":1, "subject":"..", "body":"..", "is_read":0, "created_at":"..", "sender_first":"..", "sender_last":".." } ] }`

#### `POST /api/mail`
- **Auth:** any authenticated.
- **Request body:**
```json
{ "recipient_id": 5, "recipient_type": "resident", "subject": "..", "body": ".." }
```
  - `recipient_type` = `staff` | `resident`.
- **Validation:** `recipient_id > 0` and valid `recipient_type`; at least one of `subject`/`body` → else `422`.
- **Response (201):** `{ "message": "Message sent", "id": 1 }`

#### `PUT /api/mail/{id}/read`
- **Auth:** any authenticated.
- **Response (200):** `{ "message": "Marked as read" }`

---

### 2.12 Notifications

#### `GET /api/notifications`
- **Auth:** any authenticated.
- **Response (200):** `{ "data": [ { "id":1, "message":"..", "is_read":0, "created_at":".." } ] }`

#### `PUT /api/notifications/{id}/read`
- **Auth:** any authenticated.
- **Response (200):** `{ "message": "Marked as read" }`

---

## 3. Frontend integration (single source of truth)

The frontend and backend are wired together ONLY through `public/api-client.js`.

- **One client instance:** `const client = CemboClear.client();`
- **Load it first** in every page that talks to the API (before any page-specific script):
  ```html
  <script src="/api-client.js"></script>
  ```
- **All calls go through the client** — never a bare `fetch`:
  ```js
  await client.login(identifier, password); // stores session + csrf_token
  await client.me();                         // refreshes user + csrf_token
  const list = await client.get('/residents');
  const created = await client.post('/requests', { agency_id: 1, subject: 'Hi' });
  await client.put('/residents/12', { first_name: 'Maria' });
  await client.logout();
  ```
- **CSRF is automatic.** The client reads the `csrf_token` returned by login/`me`, stores it in
  `localStorage`, and attaches `X-CSRF-Token` to every `POST`/`PUT`/`DELETE`/`PATCH`. Page code
  never needs to (and should not) manage it manually.
- **Handling responses:** the client returns the parsed JSON object on `2xx`. On non-`2xx` it throws
  an `Error` whose `.status` is the HTTP code and `.message` is the backend's `message` field.
  ```js
  try {
    await client.post('/requests', {...});
  } catch (err) {
    if (err.status === 429) alert('Try again later');
  }
  ```
- **Session expiry:** on `401` the client calls `window.redirectToLogin()` if you define it; otherwise
  define that global to send the user back to `CCLog-in.html`.
- **File uploads** use `FormData` (the client auto-detects it and sends `multipart/form-data`):
  ```js
  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  fd.append('kind', 'valid_id');
  await client.post('/upload', fd);
  ```

> The backend is the security authority; the client is a convenience layer. The token is still
> validated server-side on every mutating request regardless of what the client sends.

---

## 4. What NOT to do

1. **Do not rename tables/columns** from `schema.sql`.
2. **Do not invent new endpoints** absent from this list unless the UI clearly requires one — and if you add one, call it out explicitly in your reply with the UI evidence.
3. **Do not return `password_hash`** in any response (login, `me`, lists). Verify it only via `password_verify`.
4. **Do not swap 401 vs 403.** 401 = not logged in; 403 = logged in but wrong type/ownership.
5. **Do not hardcode secrets or use plaintext passwords.** Always `password_hash()` / `password_verify()`.
6. **Do not disable transactions for appointment booking.** Keep `SELECT ... FOR UPDATE` to prevent double-booking.
7. **Do not change JSON field casing** — everything is `snake_case` and consistent with the PHP column names.
8. **Do not rename `/api/certificates` to "clearance"** or `/api/transactions` to "payments" — match the UI wording.
9. **Do not relax email uniqueness** — `email` must be unique across BOTH `staff` and `residents`.
10. **Do not touch real credentials** — keep `config.php` ignored; use `config.example.php` as the reference.

---

## 5. Schema reference (authoritative tables)

`staff`, `residents`, `agencies`, `request_types`, `requests`, `attachments`, `certificate_purposes`, `certificate_applications`, `appointments`, `mail`, `notifications`, `audit_logs`, `transactions`.

See `schema.sql` — it is the single source of truth for all column names, types, NULLability, and foreign keys. The endpoint field names above mirror those columns.
