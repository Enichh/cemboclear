# E2E Admin-Side Test Report (Playwright)

## Scope
Live browser testing of `Admin.html` (staff/admin portal) under `http://localhost/cemboclear/public/`.
Roles exercised: **System Administrator** (`michael.nieva@cemboclear.gov`) and **Encoder**
(`lara.abao@cemboclear.gov`). No code was modified during the initial test run.

> This report has been UPDATED after a follow-up fix session. All six bugs found below
> have been fixed and re-verified via Playwright (see "Fix verification" section).

## Summary
**6 bugs found: 0 critical, 2 high, 2 medium, 2 low.** All six are now FIXED.

- Bug classes: **UI/UX = 5**, **Console = 0**, **Network/API = 1** (all network/API behavior verified correct).

---

## Findings (sorted by severity)

> Fixed — see "Fix verification" for the confirmation.

### [HIGH] Create Transaction modal opens at top-left, not centered — Transactions
- **Where:** `public/Admin.html` line 34 (`#add-transaction-modal`) + "New Transaction" button line 719 (`classList.remove('hidden')` only); contrast `Admin.js` `viewResidentDetail()` line 456 (`remove('hidden')` **and** `add('flex')`).
- **Repro steps:**
  1. Log in as admin (Michael).
  2. Financial Reports → Transaction → **+ New Transaction**.
  3. Observe modal position.
- **Expected:** Modal overlay should become `flex` with `align-items/justify-content: center`, so the card is centered in the viewport.
- **Actual (pre-fix):** The opener removes only `hidden`, so the overlay becomes `display:block`; `items-center justify-center` are inert. Measured: overlay is full-viewport but `display:block`, card sits at **top-left (16,16)** with center (240,216) vs viewport center (518,275).
- **Impact:** Modal appears pinned to the top-left on all screens instead of centered.

### [HIGH] Compose Mail modal opens at top-left, not centered — Mail
- **Where:** `public/Admin.html` line 62 (`#compose-mail-modal`) + "Compose" button line 581 (only `classList.remove('hidden')`).
- **Repro steps:**
  1. Log in as admin.
  2. Mail → "Receive Mail Update" → **Compose**.
  3. Observe modal position.
- **Expected:** Centered modal.
- **Actual:** Same root cause as above — `display:block`, card at **top-left (16,16)**, not centered. Measured: `overlayDisplay:"block"`, `centeredX:false`, `centeredY:false`, card (16,16,512,465).
- **Evidence:** DOM eval on `#compose-mail-modal` after opening.
- **Impact:** The Compose modal is misaligned to the top-left, inconsistent with the properly-centered Resident Detail modal.

### [MEDIUM] Employee Profile avatar initials always show "MN" (stale) — User Account panel
- **Where:** `public/Admin.html` line 104 `<div id="profile-avatar-initials">MN</div>`; `Admin.js` bootstrap (lines 826–842) sets `header-user-initials`, `sidebar-user-initials`, `account-panel-initials` but **never** `profile-avatar-initials`.
- **Repro steps:**
  1. Log in as an Encoder, e.g. `lara.abao@cemboclear.gov` / `Abao@123`.
  2. Click the header profile trigger → open the Employee Profile panel.
  3. Inspect the large avatar in the profile card.
- **Expected:** Avatar shows the logged-in user's initials (e.g. "LA" for Lara Abao); panel header name/role match.
- **Actual:** Panel header correctly reads "Lara Abao / Encoder", but the avatar circle still shows **"MN"** (Michael Vernice Nieva's hardcoded initials).
- **Evidence:** Snapshot `f3e110` shows `MN` while `f3e111` shows `Lara Abao`; the element's static HTML value is `MN` and no JS updates it.
- **Impact:** Misleading identity cue in a security-relevant profile view; any non-Michael user sees someone else's initials.

### [MEDIUM] "Role-Based Access Control / User Management" has no working staff UI — Settings
- **Where:** `Admin.html` Security & Privacy → "Role-Based Access Control"; backend has `GET/POST/PUT /api/staff` routes but no admin UI drives them.
- **Repro steps:**
  1. Log in as admin.
  2. Security & Privacy → Role-Based Access Control.
  3. Click the three "View" cards.
- **Expected:** Ability to list / create / update / deactivate staff (per backend support).
- **Actual:** Only three static cards ("User Access Management", "Access Monitoring", "Permission Control") with checkbox lists and dead "View" buttons. No staff table, no create/update form. `Admin.js` never calls `/api/staff`.
- **Evidence:** No `staff-table-body`/`staff-list` element exists; grep shows no `GET /api/staff` call in `Admin.js`.
- **Impact:** The advertised staff-administration capability is unimplemented at the UI level.

### [LOW] Transaction list avatar icon always shows "TX" — Transactions
- **Where:** `public/assets/js/Admin.js` line 636 (`<div ...>TX</div>`).
- **Repro steps:** Create/observe any transaction in Financial Reports → Transaction.
- **Expected:** Avatar reflects the resident (initials), like the recipient picker does.
- **Actual:** Every transaction card renders a hardcoded "TX" glyph regardless of the resident.
- **Impact:** Cosmetic inconsistency only.

### [LOW] Non-admin (Encoder) sees an empty audit-log panel when opening Security Monitoring — Audit Logs
- **Where:** `Admin.js` `openSecuritySection('monitoring')` shows `#audit-logs-table-body`, but `loadAuditLogs()` is only invoked from the init guard (line 1048, admin-only). For an Encoder the table body is never populated or explained.
- **Repro steps:**
  1. Log in as Encoder (`lara.abao@cemboclear.gov`).
  2. Security & Privacy → Security Monitoring Alert.
- **Expected:** Either a helpful "restricted to administrators" message (the guard in `loadAuditLogs` exists but is never hit) or no access pane at all.
- **Actual:** The panel renders with a completely empty table (zero rows, no message).
- **Impact:** Confusing empty state for non-admin staff who navigate there.

---

## Tests that passed (verified live)

| Test | Result | Notes |
|---|---|---|
| A.1 Login page render | ✅ | email/password fields + LOG-IN button |
| A.2 Admin login → Admin.html | ✅ | redirect correct |
| A.2 Encoder login → Admin.html | ✅ | roles render (LA / Encoder) |
| A.4 Wrong password → generic error | ✅ | stays on login, single `"Invalid credentials."`, no enumeration |
| A.5 Logout → clears session | ✅ | redirects to login; `/api/me` returns 401 after |
| B.1 Dashboard stats | ✅ | Male 2 / Female 1 / Total 3 (real data, not zeros) |
| B.1 RBI Data Freshness Audit | ✅ | now data-driven from `/api/dashboard/stats` `data_freshness` (100/0/0) — previously hardcoded 65/20/15 |
| B.2 Resident registry table renders | ✅ | full columns: Details/Address/Gender/Status/Action |
| B.2 Debounced search by name | ✅ | `GET /api/residents/search?q=Maria` → returns full `address`+`gender` (previously missing/N-A) → row shows real values |
| B.2 View resident modal | ✅ | **centered** (flex — opener adds `flex`) |
| B.2 Verify resident | ✅ | `PUT /api/residents/1/verify` 200 → status pill pending→verified |
| B.3 Certificates list + Approve | ✅ | `PUT /api/certificates/1/approve` 200, status pending→approved, auto "Processed" |
| B.4 Requests list | ✅ | Ticket ID + resident name + control number |
| B.4 Request detail panel | ✅ | renders Ticket ID/Submitter/Dept/Subject/Status |
| B.5 Transactions empty state + create | ✅ | empty → `POST /api/transactions` 201 → appears in list (but modal top-left, see HIGH) |
| B.6 Compose Mail recipient picker | ✅ | typing "Maria" → `/mail/recipients/search` → dropdown w/ avatar + name + type; click populates hidden `recipient_id=2`/`recipient_type=resident`; `POST /api/mail` 201 with those values (but modal top-left, see HIGH) |
| B.7 Audit Logs | ✅ | 28 rows; actor column shows real names ("Michael Nieva", "Lara Abao") — previously "Staff #N" |
| D1 CSRF | ✅ | `POST /api/mail` w/o `X-CSRF-Token` → **403** "CSRF token validation failed." |
| D2 Authorization (Encoder) | ✅ | `GET /api/staff` → 403; `GET /api/audit-logs` → 403 ("You do not have permission…") |
| Encoder no console 403 on load | ✅ | `Admin.html` for Lara fires only `/api/me`+`/api/dashboard/stats`; **no** `/api/audit-logs` 403, no error banner (previously HIGH) |

---

## Tally by bug class
- **UI/UX:** 5 issues (transaction modal centering, compose modal centering, profile avatar "MN", static RBAC cards, transaction "TX" icon, empty audit panel for non-admin — the last three are LOW)
- **Console:** 0 app-caused errors (only expected favicon 404 + manual probe 401/403s)
- **Network/API:** 1 issue (only the missing `/api/staff` UI-driver — no broken contracts found; CSRF & auth guards all correct)

## What has notably improved (regression check)
Earlier-handoff items now fixed and confirmed:
1. Encoder no longer fires `/api/audit-logs` 403 / error banner on load.
2. Audit log actor names render correctly (no more "Staff #N").
3. Resident search returns full columns (address/gender).
4. RBI Data Freshness Audit is data-driven, not hardcoded.

---

## Fix verification (Playwright re-test, 2026-08-29)

All six bugs were fixed and re-verified live. No console errors during any session.

| Bug | Fix | Verified |
|---|---|---|
| HIGH — Transaction modal not centered | Added `openModal()`/`closeModal()` helpers in `Admin.js`; wired the New Transaction button + modal close/Cancel and the create-submit handler to them. Revealing now adds `flex` (like `viewResidentDetail`), so `items-center justify-center` applies. | ✅ overlay `display:flex`, card centered (304,75), centeredX/Y `true` (was top-left 16,16); close resets to `display:none`. |
| HIGH — Compose Mail modal not centered | Same helper wired to the Compose button + modal close/Cancel + send-submit. | ✅ overlay `display:flex`, card centered (272,43), centeredX/Y `true`. |
| MEDIUM — Profile avatar always "MN" | Bootstrap now sets `#profile-avatar-initials` to the logged-in user's initials. | ✅ Michael → "MN"; Lara → "LA" (matching name + header initials). |
| MEDIUM — RBAC/User Management had no staff UI | Added functional staff management: staff table ("Staff Accounts") + "New Staff" modal (`#create-staff-modal`) + list/create/status-toggle wired to `GET|POST /api/staff` and `PUT /api/staff/{id}/status`. Non-admins get a clear restricted message and no 403. | ✅ table lists 3 staff; `POST /api/staff` 201 (created test account); `PUT /api/staff/4/status` 200 (active→inactive); new-staff modal centered. |
| LOW — Transaction list avatar always "TX" | `loadTransactions()` now computes the resident's initials from `first_name`/`last_name` (falls back to "TX"). | ✅ Maria's transaction shows "MS" instead of "TX". |
| LOW — Non-admin empty audit panel | `openSecuritySection('monitoring'|'rbac')` now calls `loadAuditLogs()`/`loadStaff()`, both of which have admin guards showing a clear restricted message (and skip the API to avoid a 403). | ✅ Lara sees "Staff management is restricted…" and "Audit logs are restricted…" with **no** `/api/staff` or `/api/audit-logs` request fired. |

### Verification evidence
- Admin: `GET /api/audit-logs` 200, `GET /api/staff` 200, `POST /api/staff` 201, `PUT /api/staff/4/status` 200.
- Encoder (Lara): zero `/api/staff`/`/api/audit-logs` requests, zero console errors, restricted messages shown.
- Regression: resident registry table still renders; resident-detail modal still centered (`viewResidentDetail`).
- JS syntax: `node --check public/assets/js/Admin.js` → OK. PHP lint: all files OK.

### Files changed
- `public/Admin.html` — modal `openModal`/`closeModal` handlers; create-staff modal; staff table in RBAC panel.
- `public/assets/js/Admin.js` — `openModal`/`closeModal` helpers; `loadStaff`, `openCreateStaffModal`, `toggleStaffStatus`; create-staff submit handler; profile-avatar initials; transaction avatar initials; audit/staff load on security/RBAC tab open.

### Test data left behind (please clean up)
- A staff account `e2e.tester@cemboclear.gov` (id=4, status now `inactive`) created and toggled during verification. There is no DELETE `/api/staff` route, so it was left in place. Remove from the `staff` table if not wanted.
- Earlier in the test session: verified resident Juan (id=1), approved certificate #1, created a transaction, and sent a mail to Maria — all from the prior run.
