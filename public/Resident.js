// Redirect helper for 401 unauthenticated requests
window.redirectToLogin = function () {
    window.location.href = 'CCLog-in.html';
};

// Global inline message region helper (no alert)
function showError(message) {
    const banner = document.getElementById('resident-error-banner');
    const textEl = document.getElementById('resident-error-text');
    if (banner && textEl) {
        textEl.textContent = message || 'An error occurred. Please try again.';
        banner.style.background = '#ffebe9';
        banner.style.borderColor = '#ff8182';
        banner.style.color = '#b20000';
        banner.style.display = 'flex';
    }
}

function showSuccess(message) {
    const banner = document.getElementById('resident-error-banner');
    const textEl = document.getElementById('resident-error-text');
    if (banner && textEl) {
        textEl.textContent = message;
        banner.style.background = '#e6f4ea';
        banner.style.borderColor = '#34a853';
        banner.style.color = '#137333';
        banner.style.display = 'flex';
        setTimeout(() => {
            banner.style.display = 'none';
        }, 5000);
    }
}

// Current authenticated resident user cache
let currentUser = null;
let currentAgencyId = 1;
let selectedAppointmentSlot = null;
let cachedResidentMail = [];

// Panel & View helpers
function openUserAccountPanel() {
    const panel = document.getElementById('user-account-panel');
    const backdrop = document.getElementById('user-account-backdrop');
    if (panel) panel.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
}

function closeUserAccountPanel() {
    const panel = document.getElementById('user-account-panel');
    const backdrop = document.getElementById('user-account-backdrop');
    if (panel) panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
}

function switchView(viewId, element) {
    const views = document.querySelectorAll('.dashboard-view');
    views.forEach(view => view.classList.remove('active-view'));

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active-view');
    if (element) element.classList.add('active');
}

function toggleSettingsMenu(element) {
    const submenu = element.nextElementSibling;
    if (submenu) submenu.classList.toggle('open');
}

function toggleNotifications() {
    const panel = document.getElementById('notifications-panel');
    if (panel) panel.classList.toggle('open');
}

function closeNotifications() {
    const panel = document.getElementById('notifications-panel');
    if (panel) panel.classList.remove('open');
}

function toggleResidentProfile() {
    const card = document.getElementById('resident-profile-card');
    const backdrop = document.getElementById('resident-profile-backdrop');
    if (card) card.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('open');
}

function closeResidentProfile() {
    const card = document.getElementById('resident-profile-card');
    const backdrop = document.getElementById('resident-profile-backdrop');
    if (card) card.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
}

async function logoutResident() {
    try {
        await CemboClear.client().logout();
    } catch (e) {
    } finally {
        window.location.href = 'CCLog-in.html';
    }
}

// -------------------------------------------------------------------------
// FEATURE C: Certificate Purposes & Application
// -------------------------------------------------------------------------

async function loadCertificatePurposes() {
    const select = document.getElementById('certificate-purpose-select');
    if (!select) return;

    try {
        const res = await CemboClear.client().get('/certificate-purposes');
        const purposes = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        if (purposes.length === 0) {
            select.innerHTML = '<option value="">No certificate purposes available</option>';
            return;
        }

        select.innerHTML = '<option value="">-- Select Purpose of Certificate --</option>' +
            purposes.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch (err) {
        showError(err.message || 'Failed to load certificate purposes');
    }
}

async function handleApplyCertificate(event) {
    event.preventDefault();
    const select = document.getElementById('certificate-purpose-select');
    const purposeId = select ? select.value : null;

    if (!purposeId) {
        showError('Please select a purpose for the certificate.');
        return;
    }

    const btn = document.getElementById('btn-apply-certificate');
    if (btn) btn.disabled = true;

    try {
        // 1. Submit certificate application
        const certRes = await CemboClear.client().post('/certificates', {
            purpose_id: parseInt(purposeId, 10)
        });

        // 2. Process signature file upload if selected
        const sigFile = document.getElementById('info-signature')?.files[0];
        if (sigFile) {
            const formDataSig = new FormData();
            formDataSig.append('file', sigFile);
            formDataSig.append('kind', 'signature');
            if (currentUser && currentUser.id) {
                formDataSig.append('resident_id', currentUser.id);
            }
            await CemboClear.client().post('/upload', formDataSig);
        }

        // 3. Process valid ID file upload if selected
        const idFile = document.getElementById('info-valid-id')?.files[0];
        if (idFile) {
            const formDataId = new FormData();
            formDataId.append('file', idFile);
            formDataId.append('kind', 'valid_id');
            if (currentUser && currentUser.id) {
                formDataId.append('resident_id', currentUser.id);
            }
            await CemboClear.client().post('/upload', formDataId);
        }

        showSuccess('Certificate application submitted successfully!');
        select.value = '';
        await loadMyCertificates();

    } catch (err) {
        showError(err.message || 'Failed to submit certificate application');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function loadMyCertificates() {
    const container = document.getElementById('my-certificates-list');
    if (!container) return;

    try {
        const res = await CemboClear.client().get('/certificates');
        const certs = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        if (certs.length === 0) {
            container.innerHTML = '<p style="color:#777; font-style:italic;">No certificate applications found.</p>';
            return;
        }

        container.innerHTML = certs.map(c => `
            <div style="background:#fff; border:1px solid #e0e0e0; border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:#0056b3;">#CERT-${c.id}</strong> — <span>${c.purpose || c.purpose_name || 'Certificate Application'}</span>
                    <div style="font-size:12px; color:#888; margin-top:4px;">Applied: ${c.applied_at || 'N/A'}</div>
                </div>
                <div>
                    <span style="padding:4px 12px; border-radius:20px; font-weight:bold; font-size:12px; text-transform:uppercase; ${c.status === 'approved' ? 'background:#e6f4ea; color:#137333;' : c.status === 'rejected' ? 'background:#fce8e6; color:#c5221f;' : 'background:#fef7e0; color:#b06000;'}">${c.status}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showError(err.message || 'Failed to load certificates list');
    }
}

// -------------------------------------------------------------------------
// FEATURE D: Requests & Concerns (Ticketing)
// -------------------------------------------------------------------------

const AGENCY_NAME_MAP = {
    'Administrative': 1,
    'Health': 2,
    'Applying and Requirement': 3,
    'Peace & Order': 4,
    'Disaster Response': 5,
    'Environment & Sanitation': 6
};

function openComplaintModal(departmentName) {
    const modal = document.getElementById('complaint-modal');
    const deptDisplay = document.getElementById('modal-dept-name');
    const form = document.getElementById('complaint-form');
    const fileNameDisplay = document.getElementById('complaint-file-name');
    const select = document.getElementById('complaint-type');

    currentAgencyId = AGENCY_NAME_MAP[departmentName] || 1;

    const optionsByDepartment = {
        Administrative: [
            'Resident Record Correction',
            'System Feedback Report',
            'Community Improvement Suggestion',
            'Official Information Request',
            'Request Barangay Profile',
            'General Inquiry / Concern'
        ],
        Health: [
            'Medical Assistance Request',
            'Health Certificate Inquiry',
            'Vaccination Slot Request',
            'Senior Citizen Health Program',
            'Community Health Concern Report'
        ],
        'Applying and Requirement': [
            'Financial Assistance Request',
            'Senior Citizen Program',
            'PWD Assistance Application',
            'Family Welfare Concern',
            'Livelihood Training Program'
        ],
        'Peace & Order': [
            'Noise Complaint',
            'Neighborhood Dispute Report',
            'Public Disturbance Report',
            'CCTV Footage Request',
            'Security Assistance Request'
        ],
        'Disaster Response': [
            'Hazard / Danger Report',
            'Flood Management Query',
            'Evacuation Center Inquiry',
            'Rescue Relief Request',
            'Emergency Preparedness Inquiry'
        ],
        'Environment & Sanitation': [
            'Garbage Collection Complaint',
            'Illegal Dumping Report',
            'Drainage Clogging Issue',
            'Street Cleaning Request',
            'Environmental Hazard Report'
        ]
    };

    if (modal && deptDisplay) {
        deptDisplay.textContent = departmentName;
        modal.classList.add('open');

        if (form) form.reset();
        if (fileNameDisplay) fileNameDisplay.textContent = 'No file chosen';
        if (select) {
            const options = optionsByDepartment[departmentName] || [
                'General Inquiry / Concern',
                'Service Request',
                'Documentation Assistance',
                'Follow-up Request'
            ];

            select.innerHTML = '<option value="">-- Select request type --</option>' +
                options.map(option => `<option value="${option}">${option}</option>`).join('');
        }
    }
}

function closeComplaintModal() {
    const modal = document.getElementById('complaint-modal');
    if (modal) modal.classList.remove('open');
}

async function submitComplaint(event) {
    event.preventDefault();
    const typeSelect = document.getElementById('complaint-type');
    const detailsInput = document.getElementById('complaint-message');
    const fileInput = document.getElementById('complaint-file');

    const subjectVal = typeSelect ? typeSelect.value : 'General Request';
    const detailsVal = detailsInput ? detailsInput.value : '';

    try {
        // 1. Submit Request
        const res = await CemboClear.client().post('/requests', {
            agency_id: currentAgencyId,
            request_type_id: null,
            subject: subjectVal,
            details: detailsVal
        });

        // 2. Upload supporting file if attached
        if (fileInput && fileInput.files && fileInput.files[0] && res && res.id) {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('kind', 'supporting_document');
            formData.append('request_id', res.id);
            await CemboClear.client().post('/upload', formData);
        }

        showSuccess('Request submitted successfully! Ticket ID: ' + (res.ticket_id || '#REQ-' + res.id));
        closeComplaintModal();
        await loadMyRequests();

    } catch (err) {
        showError(err.message || 'Failed to submit request');
    }
}

async function loadMyRequests() {
    const container = document.getElementById('my-requests-list');
    if (!container) return;

    try {
        const res = await CemboClear.client().get('/requests');
        const reqs = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        if (reqs.length === 0) {
            container.innerHTML = '<p style="color:#777; font-style:italic;">No submitted requests found.</p>';
            return;
        }

        container.innerHTML = reqs.map(r => `
            <div style="background:#fff; border:1px solid #e0e0e0; border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:#0056b3;">${r.ticket_id || '#REQ-' + r.id}</strong> — <span>${r.subject || 'Request'}</span>
                    <div style="font-size:12px; color:#666; margin-top:4px;">Agency: ${r.agency_name || 'Office'} | Details: ${r.details || 'N/A'}</div>
                </div>
                <div>
                    <span style="padding:4px 12px; border-radius:20px; font-weight:bold; font-size:12px; text-transform:uppercase; background:#fef7e0; color:#b06000;">${r.status || 'PENDING'}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showError(err.message || 'Failed to load submitted requests');
    }
}

// -------------------------------------------------------------------------
// FEATURE E: Appointments & Slot Picker (GET slots, POST appt, PUT cancel)
// -------------------------------------------------------------------------

async function loadAvailableSlots() {
    const datePicker = document.getElementById('appointment-date-picker');
    const slotsContainer = document.getElementById('time-slot-list');
    const dateDisplay = document.getElementById('selected-date-display');
    const bookBtn = document.getElementById('btn-book-appointment');

    const selectedDate = datePicker ? datePicker.value : '';
    if (!selectedDate) {
        showError('Please select an appointment date first.');
        return;
    }

    if (dateDisplay) dateDisplay.textContent = selectedDate;
    selectedAppointmentSlot = null;
    if (bookBtn) bookBtn.disabled = true;

    try {
        const res = await CemboClear.client().get('/appointments/slots?date=' + selectedDate);
        const slots = (res && res.slots) ? res.slots : (Array.isArray(res) ? res : []);

        if (!slots || slots.length === 0) {
            slotsContainer.innerHTML = '<p style="color:#777;">No slots available for this date.</p>';
            return;
        }

        slotsContainer.innerHTML = slots.map(s => {
            const isAvail = s.available === true;
            const statusLabel = isAvail ? 'Available' : 'Fully Booked';
            const statusClass = isAvail ? 'color:#137333; font-weight:bold;' : 'color:#c5221f; font-weight:bold;';

            return `
                <div class="time-slot" style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; border:1px solid #ddd; border-radius:10px; margin-bottom:8px; background:${isAvail ? '#fff' : '#f9f9f9'};">
                    <div class="time-left" style="display:flex; align-items:center; gap:10px;">
                        <input type="radio" name="time_slot_radio" value="${s.time_slot}" ${isAvail ? '' : 'disabled'} onchange="selectAppointmentSlot('${s.time_slot}')" />
                        <span style="font-weight:600;">${s.time_slot}</span>
                    </div>
                    <span style="${statusClass}">${statusLabel}</span>
                </div>
            `;
        }).join('');

    } catch (err) {
        showError(err.message || 'Failed to fetch appointment slots');
    }
}

function selectAppointmentSlot(slot) {
    selectedAppointmentSlot = slot;
    const bookBtn = document.getElementById('btn-book-appointment');
    if (bookBtn) bookBtn.disabled = false;
}

async function bookAppointment() {
    const datePicker = document.getElementById('appointment-date-picker');
    const selectedDate = datePicker ? datePicker.value : '';

    if (!selectedDate || !selectedAppointmentSlot) {
        showError('Please select both a date and an available time slot.');
        return;
    }

    try {
        await CemboClear.client().post('/appointments', {
            date: selectedDate,
            time_slot: selectedAppointmentSlot
        });

        showSuccess(`Appointment booked successfully for ${selectedDate} at ${selectedAppointmentSlot}!`);
        await loadAvailableSlots();
        await loadMyAppointments();

    } catch (err) {
        showError(err.message || 'Failed to book appointment');
    }
}

async function loadMyAppointments() {
    const container = document.getElementById('my-appointments-list');
    if (!container) return;

    try {
        const res = await CemboClear.client().get('/appointments');
        const list = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        if (list.length === 0) {
            container.innerHTML = '<p style="color:#777; font-style:italic;">No upcoming appointments.</p>';
            return;
        }

        container.innerHTML = list.map(a => `
            <div style="background:#fff; border:1px solid #e0e0e0; border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:#0056b3;">${a.appt_date || a.date}</strong> — <span>Time Slot: ${a.time_slot}</span>
                    <div style="font-size:12px; color:#777; margin-top:4px;">Status: <span style="font-weight:bold; text-transform:uppercase;">${a.status}</span></div>
                </div>
                <div>
                    ${a.status !== 'cancelled' ? `<button onclick="cancelAppointment(${a.id})" style="background:#dc3545; color:#fff; border:none; padding:6px 15px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer;">Cancel</button>` : '<span style="color:#888; font-size:12px;">Cancelled</span>'}
                </div>
            </div>
        `).join('');

    } catch (err) {
        showError(err.message || 'Failed to load appointments');
    }
}

async function cancelAppointment(id) {
    try {
        await CemboClear.client().put('/appointments/' + id + '/cancel');
        showSuccess('Appointment cancelled successfully.');
        await loadMyAppointments();
        await loadAvailableSlots();
    } catch (err) {
        showError(err.message || 'Failed to cancel appointment');
    }
}

// -------------------------------------------------------------------------
// FEATURE F: Resident Transactions (GET /api/transactions)
// -------------------------------------------------------------------------

async function loadMyTransactions() {
    const container = document.getElementById('resident-transactions-list');
    if (!container) return;

    try {
        const res = await CemboClear.client().get('/transactions');
        const txs = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        if (txs.length === 0) {
            container.innerHTML = '<p style="color:#777; font-style:italic;">No transactions recorded.</p>';
            return;
        }

        container.innerHTML = txs.map(t => `
            <div style="background:#fff; border:1px solid #e0e0e0; border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${t.description || 'Transaction #' + t.id}</strong>
                    <div style="font-size:12px; color:#888; margin-top:4px;">${t.transacted_at || ''}</div>
                </div>
                <div style="font-weight:bold; font-size:16px; color:#28a745;">
                    ₱${parseFloat(t.amount || 0).toFixed(2)}
                </div>
            </div>
        `).join('');
    } catch (err) {
        showError(err.message || 'Failed to load transactions');
    }
}

// -------------------------------------------------------------------------
// FEATURE G: Resident Mail & Notifications (GET mail, GET notifs)
// -------------------------------------------------------------------------

async function loadResidentMail() {
    const container = document.getElementById('resident-mail-list');
    const header = document.getElementById('resident-mail-header');
    if (!container) return;

    try {
        const res = await CemboClear.client().get('/mail');
        cachedResidentMail = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        if (header) header.textContent = `Inbox (${cachedResidentMail.length})`;

        if (cachedResidentMail.length === 0) {
            container.innerHTML = '<div style="padding:15px; color:#777; font-size:13px; text-align:center;">No mail messages in inbox.</div>';
            return;
        }

        container.innerHTML = cachedResidentMail.map(m => `
            <div class="mail-item ${m.is_read ? '' : 'active'}" onclick="selectResidentMail(${m.id})" style="cursor:pointer; padding:12px; border-bottom:1px solid #eee;">
                <div class="mail-item-top" style="display:flex; justify-content:space-between;">
                    <span class="mail-item-title" style="font-weight:bold;">${m.sender_name || 'Admin'}</span>
                    <span class="mail-item-time" style="font-size:12px; color:#888;">${m.created_at ? m.created_at.substring(0, 10) : ''}</span>
                </div>
                <div class="mail-item-preview" style="font-size:13px; color:#555; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.subject || 'No Subject'}</div>
            </div>
        `).join('');

        if (cachedResidentMail.length > 0) {
            selectResidentMail(cachedResidentMail[0].id);
        }
    } catch (err) {
        showError(err.message || 'Failed to load resident mail');
    }
}

function selectResidentMail(id) {
    const mail = cachedResidentMail.find(m => m.id === id);
    if (!mail) return;

    const subjEl = document.getElementById('resident-mail-subject');
    const senderEl = document.getElementById('resident-mail-sender');
    const dateEl = document.getElementById('resident-mail-date');
    const bodyEl = document.getElementById('resident-mail-body');
    const readBtn = document.getElementById('resident-mail-read-btn');

    if (subjEl) subjEl.textContent = mail.subject || 'No Subject';
    if (senderEl) senderEl.textContent = 'From: ' + (mail.sender_name || 'Barangay Staff');
    if (dateEl) dateEl.textContent = 'Date: ' + (mail.created_at || '');
    if (bodyEl) bodyEl.textContent = mail.body || '';
    if (readBtn) {
        readBtn.onclick = async () => {
            try {
                await CemboClear.client().put('/mail/' + id + '/read');
                await loadResidentMail();
            } catch (err) {
                showError(err.message || 'Failed to mark mail read');
            }
        };
    }
}

async function loadResidentNotifications() {
    const container = document.getElementById('resident-notification-list');
    const badge = document.getElementById('resident-notification-badge');
    if (!container) return;

    try {
        const res = await CemboClear.client().get('/notifications');
        const notifs = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
        const unreadCount = notifs.filter(n => !n.is_read).length;

        if (badge) {
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        if (notifs.length === 0) {
            container.innerHTML = '<div style="padding:15px; color:#777; font-size:13px; text-align:center;">No notifications.</div>';
            return;
        }

        container.innerHTML = notifs.map(n => `
            <div class="notification-item" onclick="markResidentNotificationRead(${n.id})" style="cursor:pointer; ${n.is_read ? 'opacity:0.6;' : ''}">
                <strong>Update:</strong> ${n.message}
                <div style="font-size:11px; color:#888; margin-top:2px;">${n.created_at || ''}</div>
            </div>
        `).join('');
    } catch (err) {
        showError(err.message || 'Failed to load notifications');
    }
}

async function markResidentNotificationRead(id) {
    try {
        await CemboClear.client().put('/notifications/' + id + '/read');
        await loadResidentNotifications();
    } catch (e) {}
}

// -------------------------------------------------------------------------
// DOM INITIALIZATION & EVENT LISTENERS
// -------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async function () {
    // Set default date for appointment picker to today YYYY-MM-DD
    const datePicker = document.getElementById('appointment-date-picker');
    if (datePicker) {
        const today = new Date().toISOString().split('T')[0];
        datePicker.value = today;
    }

    // Set static date/time for certificate form
    const dateTimeEl = document.getElementById('info-datetime');
    if (dateTimeEl) {
        dateTimeEl.value = new Date().toLocaleString();
    }

    // 1. Post-login bootstrap check via me()
    try {
        const meRes = await CemboClear.client().me();
        if (meRes && meRes.id) {
            currentUser = meRes; // meRes IS the user object directly!
            if (currentUser.type !== 'resident') {
                window.location.href = 'CCLog-in.html';
                return;
            }

            const fullName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Resident User';
            const initials = `${(currentUser.first_name || 'J')[0]}${(currentUser.last_name || 'D')[0]}`.toUpperCase();

            // Bind values across user elements
            const navName = document.getElementById('nav-user-name');
            const initialsPill = document.querySelector('.user-pill-initials');
            const sidebarInitials = document.getElementById('sidebar-user-initials');
            const profileName = document.getElementById('resident-profile-name-display');
            const avatarFallback = document.getElementById('resident-profile-avatar-fallback');
            const accountControl = document.getElementById('account-control-no');

            if (navName) navName.textContent = fullName;
            if (initialsPill) initialsPill.textContent = initials;
            if (sidebarInitials) sidebarInitials.textContent = initials;
            if (profileName) profileName.textContent = fullName;
            if (avatarFallback) avatarFallback.textContent = initials;
            if (accountControl) accountControl.value = currentUser.control_no || 'N/A';

            // Populate Account Panel inputs
            const accEmail = document.getElementById('account-email');
            const accPhone = document.getElementById('account-phone');
            const accBirth = document.getElementById('account-birthdate');
            if (accEmail) accEmail.value = currentUser.email || '';
            if (accPhone) accPhone.value = currentUser.phone || '';
            if (accBirth) accBirth.value = currentUser.birthdate || '';

            // Populate Profile Card inputs
            const profName = document.getElementById('resident-full-name');
            const profEmail = document.getElementById('resident-email');
            const profContact = document.getElementById('resident-contact');
            const profAddress = document.getElementById('resident-address');
            const profRole = document.getElementById('resident-role');
            if (profName) profName.value = fullName;
            if (profEmail) profEmail.value = currentUser.email || '';
            if (profContact) profContact.value = currentUser.phone || '';
            if (profAddress) profAddress.value = currentUser.address || '';
            if (profRole) profRole.value = currentUser.control_no || 'N/A';

            // Pre-fill Personal Information Form
            const infoLast = document.getElementById('info-last-name');
            const infoFirst = document.getElementById('info-first-name');
            const infoMiddle = document.getElementById('info-middle-name');
            const infoSuffix = document.getElementById('info-suffix');
            const infoBirth = document.getElementById('info-birthdate');
            const infoPlace = document.getElementById('info-birth-place');
            const infoGender = document.getElementById('info-gender');
            const infoCivil = document.getElementById('info-civil-status');
            const infoAddress = document.getElementById('info-address');
            const infoCitizen = document.getElementById('info-citizenship');
            const infoPhone = document.getElementById('info-phone');
            const infoEmail = document.getElementById('info-email');

            if (infoLast) infoLast.value = currentUser.last_name || '';
            if (infoFirst) infoFirst.value = currentUser.first_name || '';
            if (infoMiddle) infoMiddle.value = currentUser.middle_name || '';
            if (infoSuffix) infoSuffix.value = currentUser.suffix || '';
            if (infoBirth) infoBirth.value = currentUser.birthdate || '';
            if (infoPlace) infoPlace.value = currentUser.birth_place || '';
            if (infoGender) infoGender.value = (currentUser.gender || '').toLowerCase();
            if (infoCivil) infoCivil.value = currentUser.civil_status || '';
            if (infoAddress) infoAddress.value = currentUser.address || '';
            if (infoCitizen) infoCitizen.value = currentUser.citizenship || '';
            if (infoPhone) infoPhone.value = currentUser.phone || '';
            if (infoEmail) infoEmail.value = currentUser.email || '';
        }
    } catch (err) {
        if (err && err.status === 401) {
            window.redirectToLogin();
            return;
        }
    }

    // File input label handler for complaint modal
    const fileInput = document.getElementById('complaint-file');
    const fileNameDisplay = document.getElementById('complaint-file-name');
    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', function () {
            fileNameDisplay.textContent = this.files && this.files[0] ? this.files[0].name : 'No file chosen';
        });
    }

    // Load initial data
    await loadCertificatePurposes();
    await loadMyCertificates();
    await loadMyRequests();
    await loadAvailableSlots();
    await loadMyAppointments();
    await loadMyTransactions();
    await loadResidentMail();
    await loadResidentNotifications();
});
