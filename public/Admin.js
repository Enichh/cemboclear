// Redirect helper for 401 unauthenticated requests
window.redirectToLogin = function () {
    window.location.href = 'CCLog-in.html';
};

// Global inline error region helper (no alert)
function showError(message) {
    const banner = document.getElementById('admin-error-banner');
    const textEl = document.getElementById('admin-error-text');
    if (banner && textEl) {
        textEl.textContent = message || 'An error occurred. Please try again.';
        banner.classList.remove('hidden');
    }
}

// Current authenticated user cache
let currentUser = null;
let genderPieChart = null;
let ageAreaChart = null;

// Tab switcher state
let activeMainTab = 'gender';
let activeRecordsSub = 'compile';
let activeSecuritySub = 'monitoring';

function toggleProfilePanel(forceOpen) {
    const overlay = document.getElementById('profile-overlay');
    if (!overlay) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : overlay.classList.contains('hidden');
    overlay.classList.toggle('hidden', !shouldOpen);
    overlay.classList.toggle('flex', shouldOpen);
}

function toggleNotificationsPanel(forceOpen) {
    const panel = document.getElementById('notification-panel');
    const trigger = document.getElementById('notification-trigger');
    if (!panel || !trigger) return;

    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldOpen);
    trigger.classList.toggle('bg-blue-50', shouldOpen);
    trigger.classList.toggle('text-blue-700', shouldOpen);
    trigger.classList.toggle('ring-2', shouldOpen);
    trigger.classList.toggle('ring-blue-400', shouldOpen);
}

function closeProfilePanel() {
    toggleProfilePanel(false);
    showProfileSection('contact');
}

function openAccountPanel() {
    const overlay = document.getElementById('account-panel-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
}

function closeAccountPanel() {
    const overlay = document.getElementById('account-panel-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
}

function closeNotificationsPanel() {
    toggleNotificationsPanel(false);
}

function showProfileSection(section) {
    const sections = ['contact', 'edit', 'activity'];
    sections.forEach(key => {
        const element = document.getElementById('profile-detail-' + key);
        if (element) {
            element.classList.toggle('hidden', key !== section);
        }
    });
}

function clearAllTabs() {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.records-tab-content').forEach(el => el.classList.add('hidden'));

    const tabs = ['gender', 'age', 'updates', 'records-data', 'transaction', 'print-receipt', 'settings', 'mail', 'security'];
    tabs.forEach(id => {
        const btn = document.getElementById('tab-btn-' + id);
        if (btn) {
            btn.classList.remove('active-menu', 'text-gray-900', 'font-semibold');
            btn.classList.add('text-gray-500');
        }
    });

    document.querySelectorAll('.records-subtab').forEach(btn => {
        btn.classList.remove('active-menu', 'text-gray-900', 'font-semibold');
        btn.classList.add('text-gray-500');
    });

    document.querySelectorAll('.security-subtab').forEach(btn => {
        btn.classList.remove('active-menu', 'text-gray-900', 'font-semibold');
        btn.classList.add('text-gray-500');
    });

    document.querySelectorAll('.mail-subtab').forEach(btn => {
        btn.classList.remove('active-menu', 'text-gray-900', 'font-semibold');
        btn.classList.add('text-gray-500');
    });
}

function activateMainButton(tabId) {
    const btn = document.getElementById('tab-btn-' + tabId);
    if (btn) {
        btn.classList.add('active-menu', 'text-gray-900', 'font-semibold');
        btn.classList.remove('text-gray-500');
    }
    activeMainTab = tabId;
}

function activateRecordsSub(subId) {
    const btn = document.getElementById('tab-btn-records-' + subId);
    if (btn) {
        btn.classList.add('active-menu', 'text-gray-900', 'font-semibold');
        btn.classList.remove('text-gray-500');
    }
    activeRecordsSub = subId;
}

function toggleSidebarGroup(groupId) {
    const groupItems = document.getElementById('sidebar-group-' + groupId + '-items');
    const toggleIcon = document.getElementById('sidebar-toggle-icon-' + groupId);
    if (!groupItems) return;

    const groups = ['dashboard', 'financial', 'records', 'security', 'mail', 'settings'];
    groups.forEach(g => {
        const items = document.getElementById('sidebar-group-' + g + '-items');
        const icon = document.getElementById('sidebar-toggle-icon-' + g);
        if (!items) return;
        if (g === groupId) return;
        if (!items.classList.contains('hidden')) {
            items.classList.add('hidden');
            if (icon) icon.textContent = '+';
        }
    });

    const isOpen = !groupItems.classList.contains('hidden');
    if (isOpen) {
        groupItems.classList.add('hidden');
        if (toggleIcon) toggleIcon.textContent = '+';
    } else {
        groupItems.classList.remove('hidden');
        if (toggleIcon) toggleIcon.textContent = '−';
    }
}

function switchTab(tabId) {
    const mainPanel = document.getElementById('view-' + tabId);
    const panelIsVisible = mainPanel && !mainPanel.classList.contains('hidden');

    if (panelIsVisible && activeMainTab === tabId) {
        clearAllTabs();
        activeMainTab = null;
        return;
    }

    clearAllTabs();
    if (mainPanel) {
        mainPanel.classList.remove('hidden');
    }
    activateMainButton(tabId);

    if (tabId === 'records-data') {
        const subId = activeRecordsSub || 'compile';
        activateRecordsSub(subId);
        const subPanel = document.getElementById('view-records-' + subId);
        if (subPanel) {
            subPanel.classList.remove('hidden');
        }
    }
}

function openSecuritySection(subId) {
    const secPanel = document.getElementById('view-security');
    const panelIsVisible = secPanel && !secPanel.classList.contains('hidden');

    if (panelIsVisible && activeMainTab === 'security' && activeSecuritySub === subId) {
        clearAllTabs();
        activeMainTab = null;
        return;
    }

    clearAllTabs();
    if (secPanel) secPanel.classList.remove('hidden');
    activateMainButton('security');
    activateSecuritySub(subId);

    document.querySelectorAll('.security-subview').forEach(el => el.classList.add('hidden'));
    const sub = document.getElementById('view-security-' + subId);
    if (sub) sub.classList.remove('hidden');
}

function activateSecuritySub(subId) {
    document.querySelectorAll('.security-subtab').forEach(btn => {
        btn.classList.remove('active-menu', 'text-gray-900', 'font-semibold');
        btn.classList.add('text-gray-500');
    });
    const btn = document.getElementById('tab-btn-security-' + subId);
    if (btn) {
        btn.classList.add('active-menu', 'text-gray-900', 'font-semibold');
        btn.classList.remove('text-gray-500');
    }
    activeSecuritySub = subId;
}

function openRecordsData(subId) {
    const recordsPanel = document.getElementById('view-records-data');
    const panelIsVisible = recordsPanel && !recordsPanel.classList.contains('hidden');

    if (panelIsVisible && activeMainTab === 'records-data' && activeRecordsSub === subId) {
        clearAllTabs();
        activeMainTab = null;
        return;
    }

    clearAllTabs();
    if (recordsPanel) {
        recordsPanel.classList.remove('hidden');
    }
    activateMainButton('records-data');
    activateRecordsSub(subId);

    const subPanel = document.getElementById('view-records-' + subId);
    if (subPanel) {
        subPanel.classList.remove('hidden');
    }
}

function openMailSection(subId) {
    const mailPanel = document.getElementById('view-mail');
    const panelIsVisible = mailPanel && !mailPanel.classList.contains('hidden');

    if (panelIsVisible && activeMainTab === 'mail') {
        clearAllTabs();
        activeMainTab = null;
        return;
    }

    clearAllTabs();
    if (mailPanel) mailPanel.classList.remove('hidden');
    activateMainButton('mail');

    document.querySelectorAll('.mail-subtab').forEach(btn => {
        btn.classList.remove('active-menu', 'text-gray-900', 'font-semibold');
        btn.classList.add('text-gray-500');
    });
    const btn = document.getElementById('tab-btn-mail-' + subId);
    if (btn) {
        btn.classList.add('active-menu', 'text-gray-900', 'font-semibold');
        btn.classList.remove('text-gray-500');
    }
}

// -------------------------------------------------------------------------
// API INTEGRATION & DATA BINDING (Features A through H)
// -------------------------------------------------------------------------

async function logoutStaff() {
    try {
        await CemboClear.client().logout();
    } catch (e) {
        // ignore logout network errors
    } finally {
        window.location.href = 'CCLog-in.html';
    }
}

// Feature A — Staff Dashboard Stats (GET /api/dashboard/stats)
async function loadDashboardStats() {
    try {
        const stats = await CemboClear.client().get('/dashboard/stats');
        if (!stats) return;

        // Gender chart update
        if (stats.gender_distribution && genderPieChart) {
            let maleCount = 0;
            let femaleCount = 0;
            stats.gender_distribution.forEach(g => {
                const name = String(g.gender || '').toLowerCase();
                if (name === 'male') maleCount = g.cnt;
                else if (name === 'female') femaleCount = g.cnt;
            });
            genderPieChart.data.labels = ['Male', 'Female'];
            genderPieChart.data.datasets[0].data = [maleCount, femaleCount];
            genderPieChart.update();

            const maleEl = document.getElementById('stat-gender-male-count');
            const femaleEl = document.getElementById('stat-gender-female-count');
            const totalEl = document.getElementById('stat-total-residents-gender');
            if (maleEl) maleEl.textContent = maleCount;
            if (femaleEl) femaleEl.textContent = femaleCount;
            if (totalEl) totalEl.textContent = stats.total_residents || (maleCount + femaleCount);
        }

        // Age chart update
        if (stats.age_distribution && ageAreaChart) {
            const labels = stats.age_distribution.map(a => a.age_group);
            const counts = stats.age_distribution.map(a => a.cnt);
            ageAreaChart.data.labels = labels.length ? labels : ageAreaChart.data.labels;
            if (counts.length) {
                ageAreaChart.data.datasets[0].data = counts;
            }
            ageAreaChart.update();
        }

        // Stat cards update
        const pendingReq = document.getElementById('stat-pending-requests');
        const verifiedResCard = document.getElementById('stat-verified-residents-card');
        const totalResCard = document.getElementById('stat-total-residents-card');
        const pendingRes = document.getElementById('stat-pending-residents');
        const verifiedRes = document.getElementById('stat-verified-residents');
        const upcomingAppt = document.getElementById('stat-upcoming-appointments');

        if (pendingReq) pendingReq.textContent = stats.pending_requests ?? 0;
        if (verifiedResCard) verifiedResCard.textContent = stats.verified_residents ?? 0;
        if (totalResCard) totalResCard.textContent = stats.total_residents ?? 0;
        if (pendingRes) pendingRes.textContent = stats.pending_residents ?? 0;
        if (verifiedRes) verifiedRes.textContent = stats.verified_residents ?? 0;
        if (upcomingAppt) upcomingAppt.textContent = stats.upcoming_appointments ?? 0;

    } catch (err) {
        showError(err.message || 'Failed to load dashboard stats');
    }
}

// Feature B — Resident Registry (GET /api/residents, GET /api/residents/search)
let searchDebounceTimer = null;
async function loadResidents(page = 1, query = '') {
    const tableBody = document.getElementById('rbi-table-body');
    if (!tableBody) return;

    try {
        let res;
        if (query.trim()) {
            res = await CemboClear.client().get('/residents/search?q=' + encodeURIComponent(query.trim()));
        } else {
            res = await CemboClear.client().get('/residents?page=' + page + '&limit=25');
        }

        const residents = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
        if (residents.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No resident records found.</td></tr>';
            return;
        }

        tableBody.innerHTML = residents.map(r => {
            const fullName = `${r.last_name || ''}, ${r.first_name || ''} ${r.middle_name || ''}`.trim();
            const initials = `${(r.first_name || 'R')[0]}${(r.last_name || 'U')[0]}`.toUpperCase();
            const statusClass = r.registry_status === 'verified'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-yellow-100 text-yellow-700';

            return `
                <tr class="bg-white hover:bg-gray-50">
                    <td class="p-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-blue-800 text-white rounded-full flex items-center justify-center font-bold">${initials}</div>
                            <div>
                                <div class="font-semibold text-gray-800">${fullName}</div>
                                <div class="text-xs text-gray-400">Control No: ${r.control_no || 'N/A'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-4 text-gray-600">${r.address || 'N/A'}</td>
                    <td class="p-4 text-gray-600 capitalize">${r.gender || 'N/A'}</td>
                    <td class="p-4">
                        <span class="inline-flex px-3 py-1 rounded-full ${statusClass} text-xs font-bold capitalize">${r.registry_status || 'pending'}</span>
                    </td>
                    <td class="p-4 flex items-center gap-2">
                        <button onclick="viewResidentDetail(${r.id})" class="text-gray-500 hover:text-blue-700" title="View Details"><i class="fas fa-eye"></i></button>
                        ${r.registry_status !== 'verified' ? `<button onclick="verifyResident(${r.id})" class="text-emerald-600 hover:text-emerald-800 font-semibold text-xs border border-emerald-300 rounded px-2 py-1">Verify</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        // Pagination buttons
        const pagEl = document.getElementById('rbi-pagination');
        if (pagEl && res.total) {
            const totalPages = Math.ceil(res.total / 25);
            let btns = '';
            for (let i = 1; i <= Math.min(totalPages, 5); i++) {
                const active = i === page ? 'bg-blue-800 text-white font-bold' : 'bg-gray-200 text-gray-600';
                btns += `<button onclick="loadResidents(${i}, '${query}')" class="w-9 h-9 rounded-full ${active}">${i}</button>`;
            }
            pagEl.innerHTML = btns;
        }

    } catch (err) {
        showError(err.message || 'Failed to load residents');
    }
}

async function viewResidentDetail(id) {
    try {
        const res = await CemboClear.client().get('/residents/' + id);
        if (!res) return;
        const modal = document.getElementById('resident-detail-modal');
        const container = document.getElementById('resident-detail-content');
        if (modal && container) {
            container.innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    <div><strong>Full Name:</strong> ${res.first_name || ''} ${res.middle_name || ''} ${res.last_name || ''} ${res.suffix || ''}</div>
                    <div><strong>Control No:</strong> ${res.control_no || 'N/A'}</div>
                    <div><strong>Email:</strong> ${res.email || 'N/A'}</div>
                    <div><strong>Phone:</strong> ${res.phone || 'N/A'}</div>
                    <div><strong>Birthdate:</strong> ${res.birthdate || 'N/A'}</div>
                    <div><strong>Birth Place:</strong> ${res.birth_place || 'N/A'}</div>
                    <div><strong>Gender:</strong> ${res.gender || 'N/A'}</div>
                    <div><strong>Civil Status:</strong> ${res.civil_status || 'N/A'}</div>
                    <div class="col-span-2"><strong>Address:</strong> ${res.address || 'N/A'}</div>
                    <div><strong>Citizenship:</strong> ${res.citizenship || 'N/A'}</div>
                    <div><strong>Registry Status:</strong> ${res.registry_status || 'pending'}</div>
                </div>
            `;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    } catch (err) {
        showError(err.message || 'Failed to fetch resident details');
    }
}

async function verifyResident(id) {
    try {
        await CemboClear.client().put('/residents/' + id + '/verify');
        await loadResidents();
        await loadDashboardStats();
    } catch (err) {
        showError(err.message || 'Failed to verify resident');
    }
}

// Feature C — Certificates (GET /api/certificates, PUT approve/reject)
async function loadCertificates() {
    const body = document.getElementById('certificates-table-body');
    if (!body) return;

    try {
        const res = await CemboClear.client().get('/certificates');
        const certs = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
        if (certs.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">No certificate applications found.</td></tr>';
            return;
        }

        body.innerHTML = certs.map(c => {
            const statusBg = c.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                             c.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                             'bg-yellow-100 text-yellow-700';

            const residentName = c.first_name ? `${c.first_name} ${c.last_name}` : (c.resident_name || 'Resident #' + c.resident_id);
            const purposeName = c.purpose || c.purpose_name || 'N/A';

            return `
                <tr class="bg-white">
                    <td class="p-4 font-bold">#CERT-${c.id}</td>
                    <td class="p-4 font-semibold text-gray-800">${residentName}</td>
                    <td class="p-4 text-gray-600">${purposeName}</td>
                    <td class="p-4 text-gray-500 text-xs">${c.applied_at || 'N/A'}</td>
                    <td class="p-4"><span class="inline-flex px-3 py-1 rounded-full ${statusBg} text-xs font-bold uppercase">${c.status}</span></td>
                    <td class="p-4 text-right space-x-2">
                        ${c.status === 'pending' ? `
                            <button onclick="approveCertificate(${c.id})" class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700">Approve</button>
                            <button onclick="rejectCertificate(${c.id})" class="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-700">Reject</button>
                        ` : '<span class="text-xs text-gray-400 font-semibold">Processed</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        showError(err.message || 'Failed to load certificates');
    }
}

async function approveCertificate(id) {
    try {
        await CemboClear.client().put('/certificates/' + id + '/approve');
        await loadCertificates();
    } catch (err) {
        showError(err.message || 'Failed to approve certificate');
    }
}

async function rejectCertificate(id) {
    try {
        await CemboClear.client().put('/certificates/' + id + '/reject');
        await loadCertificates();
    } catch (err) {
        showError(err.message || 'Failed to reject certificate');
    }
}

// Feature D — Requests / Concerns (GET /api/requests)
let cachedRequests = [];
async function loadRequests() {
    const body = document.getElementById('requests-table-body');
    if (!body) return;

    try {
        const res = await CemboClear.client().get('/requests');
        cachedRequests = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        if (cachedRequests.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No requests submitted.</td></tr>';
            return;
        }

        body.innerHTML = cachedRequests.map(r => `
            <tr class="bg-white hover:bg-gray-50">
                <td class="p-4 font-bold text-gray-900">${r.ticket_id || '#REQ-' + r.id}</td>
                <td class="p-4">
                    <div class="font-semibold text-gray-800">${r.resident_name || (r.first_name ? r.first_name + ' ' + r.last_name : 'Resident')}</div>
                    <div class="text-xs text-gray-400">Control No: ${r.control_no || 'N/A'}</div>
                </td>
                <td class="p-4">
                    <div class="inline-flex px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold">${r.agency_name || 'Department'}</div>
                    <div class="text-xs text-gray-500 mt-1">${r.subject || 'No Subject'}</div>
                </td>
                <td class="p-4">
                    <span class="inline-flex px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold uppercase">${r.status || 'PENDING'}</span>
                </td>
                <td class="p-4 text-right">
                    <button onclick="viewRequestDetail(${r.id})" class="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-200">View Details</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showError(err.message || 'Failed to load requests');
    }
}

function viewRequestDetail(reqId) {
    const req = cachedRequests.find(r => r.id === reqId);
    const detailContainer = document.getElementById('request-detail-body');
    if (!req || !detailContainer) return;

    detailContainer.innerHTML = `
        <div class="space-y-3 text-sm text-gray-700">
            <div class="flex justify-between border-b border-gray-100 pb-2">
                <span class="font-bold text-gray-900">Ticket ID:</span>
                <span>${req.ticket_id || '#REQ-' + req.id}</span>
            </div>
            <div class="flex justify-between border-b border-gray-100 pb-2">
                <span class="font-bold text-gray-900">Submitter:</span>
                <span>${req.resident_name || (req.first_name ? req.first_name + ' ' + req.last_name : 'Resident')} (${req.control_no || 'N/A'})</span>
            </div>
            <div class="flex justify-between border-b border-gray-100 pb-2">
                <span class="font-bold text-gray-900">Department / Agency:</span>
                <span>${req.agency_name || 'N/A'}</span>
            </div>
            <div class="flex justify-between border-b border-gray-100 pb-2">
                <span class="font-bold text-gray-900">Subject:</span>
                <span>${req.subject || 'N/A'}</span>
            </div>
            <div class="flex justify-between border-b border-gray-100 pb-2">
                <span class="font-bold text-gray-900">Status:</span>
                <span class="capitalize font-semibold text-amber-600">${req.status}</span>
            </div>
            <div class="flex justify-between">
                <span class="font-bold text-gray-900">Submitted At:</span>
                <span>${req.created_at || 'N/A'}</span>
            </div>
        </div>
    `;
}

// Feature F — Staff Transactions (GET /api/transactions, POST /api/transactions)
async function loadTransactions(filterQuery = '') {
    const container = document.getElementById('transaction-results-list');
    if (!container) return;

    try {
        const res = await CemboClear.client().get('/transactions');
        let txs = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        if (filterQuery.trim()) {
            const q = filterQuery.trim().toLowerCase();
            txs = txs.filter(t => 
                String(t.resident_id) === q ||
                String(t.control_no || '').toLowerCase().includes(q) ||
                String(t.first_name || '').toLowerCase().includes(q) ||
                String(t.last_name || '').toLowerCase().includes(q)
            );
        }

        if (txs.length === 0) {
            container.innerHTML = '<div class="p-8 text-center text-gray-500 bg-white rounded-3xl border border-gray-200">No transactions recorded.</div>';
            return;
        }

        container.innerHTML = txs.map(t => {
            const residentLabel = t.first_name ? `${t.first_name} ${t.last_name}` : ('Resident #' + t.resident_id);
            return `
                <div class="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center font-bold text-emerald-800 text-2xl">TX</div>
                        <div>
                            <div class="text-xl font-bold text-gray-800">${t.description || 'Transaction #' + t.id}</div>
                            <div class="text-sm text-gray-500">Resident: <span class="font-semibold text-gray-900">${residentLabel}</span> (ID: #${t.resident_id})</div>
                            <div class="text-xs text-gray-400 mt-1">${t.transacted_at || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold text-emerald-600">₱${parseFloat(t.amount || 0).toFixed(2)}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        showError(err.message || 'Failed to load transactions');
    }
}

// Feature G — Staff Mail & Notifications (GET /api/mail, GET /api/notifications, GET /api/audit-logs)
let cachedMail = [];
async function loadMail() {
    const container = document.getElementById('mail-list-container');
    const countHeader = document.getElementById('mail-inbox-header');
    if (!container) return;

    try {
        const res = await CemboClear.client().get('/mail');
        cachedMail = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        if (countHeader) countHeader.textContent = `Inbox (${cachedMail.length})`;

        if (cachedMail.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">No messages in inbox.</div>';
            return;
        }

        container.innerHTML = cachedMail.map(m => `
            <button type="button" onclick="selectMailItem(${m.id})" class="mail-list-item w-full text-left px-4 py-4 hover:bg-gray-100 transition ${m.is_read ? 'opacity-70' : 'bg-blue-50/50'}">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="text-sm font-semibold text-gray-900">${m.sender_name || 'Sender'}</div>
                        <div class="text-sm text-gray-600 mt-1">${m.subject || 'No Subject'}</div>
                    </div>
                    <div class="text-xs text-gray-500">${m.created_at ? m.created_at.substring(0, 10) : ''}</div>
                </div>
                <div class="text-sm text-gray-500 mt-2 truncate">${m.body || ''}</div>
            </button>
        `).join('');

        if (cachedMail.length > 0) {
            selectMailItem(cachedMail[0].id);
        }
    } catch (err) {
        showError(err.message || 'Failed to load mail');
    }
}

function selectMailItem(id) {
    const mail = cachedMail.find(m => m.id === id);
    if (!mail) return;

    const subjEl = document.getElementById('mail-subject');
    const senderEl = document.getElementById('mail-sender');
    const metaEl = document.getElementById('mail-meta');
    const bodyEl = document.getElementById('mail-body');
    const readBtn = document.getElementById('mail-mark-read-btn');

    if (subjEl) subjEl.textContent = mail.subject || 'No Subject';
    if (senderEl) senderEl.textContent = 'From ' + (mail.sender_name || 'Sender');
    if (metaEl) metaEl.textContent = mail.created_at || '';
    if (bodyEl) bodyEl.textContent = mail.body || '';
    if (readBtn) {
        readBtn.onclick = async () => {
            try {
                await CemboClear.client().put('/mail/' + id + '/read');
                loadMail();
            } catch (err) {
                showError(err.message || 'Failed to mark mail read');
            }
        };
    }
}

async function loadNotifications() {
    const container = document.getElementById('notification-list-container');
    const badge = document.getElementById('notification-count-badge');
    if (!container) return;

    try {
        const res = await CemboClear.client().get('/notifications');
        const notifs = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        const unreadCount = notifs.filter(n => !n.is_read).length;
        if (badge) badge.textContent = unreadCount;

        if (notifs.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500 text-xs">No notifications.</div>';
            return;
        }

        container.innerHTML = notifs.map(n => `
            <div onclick="markNotificationRead(${n.id})" class="flex items-start gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${n.is_read ? 'opacity-60' : ''}">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mt-0.5"><i class="fas fa-bell"></i></div>
                <div>
                    <div class="text-sm font-semibold text-gray-800">${n.message}</div>
                    <div class="text-xs text-gray-400">${n.created_at || ''}</div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showError(err.message || 'Failed to load notifications');
    }
}

async function markNotificationRead(id) {
    try {
        await CemboClear.client().put('/notifications/' + id + '/read');
        await loadNotifications();
    } catch (e) {}
}

async function loadAuditLogs() {
    const body = document.getElementById('audit-logs-table-body');
    if (!body) return;

    try {
        const res = await CemboClear.client().get('/audit-logs');
        const logs = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);

        if (logs.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">No audit logs recorded.</td></tr>';
            return;
        }

        body.innerHTML = logs.map(l => `
            <tr>
                <td class="py-4 px-4">${l.created_at || 'N/A'}</td>
                <td class="py-4 px-4 font-semibold">${l.actor_name || 'Staff #' + (l.staff_id || 'Unknown')}</td>
                <td class="py-4 px-4">${l.action || 'N/A'}</td>
                <td class="py-4 px-4">${l.ip_address || '127.0.0.1'}</td>
                <td class="py-4 px-4 text-emerald-600 font-semibold capitalize">${l.security_status || 'Authorized'}</td>
            </tr>
        `).join('');
    } catch (err) {
        showError(err.message || 'Failed to load audit logs');
    }
}

// -------------------------------------------------------------------------
// DOM INITIALIZATION & EVENT LISTENERS
// -------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async function () {
    // 1. Post-login bootstrap check via me()
    try {
        const meRes = await CemboClear.client().me();
        if (meRes && meRes.id) {
            currentUser = meRes; // meRes IS the user object directly!
            if (currentUser.type !== 'staff') {
                window.location.href = 'CCLog-in.html';
                return;
            }

            const fullName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Admin User';
            const initials = `${(currentUser.first_name || 'A')[0]}${(currentUser.last_name || 'D')[0]}`.toUpperCase();
            const pos = currentUser.position || 'System Administrator';

            const headerName = document.getElementById('header-user-name');
            const headerInitials = document.getElementById('header-user-initials');
            const sidebarInitials = document.getElementById('sidebar-user-initials');
            const sidebarRole = document.getElementById('sidebar-user-role');
            const profileNameH = document.getElementById('profile-name-header');
            const profileNameC = document.getElementById('profile-name-card');
            const profileRoleC = document.getElementById('profile-role-card');
            const profileEmailC = document.getElementById('profile-email-card');
            const profilePhoneC = document.getElementById('profile-phone-card');
            const profileBranchC = document.getElementById('profile-branch-card');
            const editName = document.getElementById('edit-profile-name');
            const editPos = document.getElementById('edit-profile-pos');
            const accountName = document.getElementById('account-panel-name');
            const accountPos = document.getElementById('account-panel-pos');
            const accountInitials = document.getElementById('account-panel-initials');
            const accountEmailInput = document.getElementById('account-input-email');
            const accountPhoneInput = document.getElementById('account-input-phone');

            if (headerName) headerName.textContent = fullName;
            if (headerInitials) headerInitials.textContent = initials;
            if (sidebarInitials) sidebarInitials.textContent = initials;
            if (sidebarRole) sidebarRole.textContent = pos;
            if (profileNameH) profileNameH.textContent = fullName;
            if (profileNameC) profileNameC.textContent = fullName;
            if (profileRoleC) profileRoleC.textContent = pos;
            if (profileEmailC) profileEmailC.textContent = currentUser.email || '';
            if (profilePhoneC) profilePhoneC.textContent = currentUser.phone || 'N/A';
            if (profileBranchC) profileBranchC.textContent = currentUser.branch || 'Barangay Office';
            if (editName) editName.textContent = fullName;
            if (editPos) editPos.textContent = pos;
            if (accountName) accountName.textContent = fullName;
            if (accountPos) accountPos.textContent = pos;
            if (accountInitials) accountInitials.textContent = initials;
            if (accountEmailInput) accountEmailInput.value = currentUser.email || '';
            if (accountPhoneInput) accountPhoneInput.value = currentUser.phone || '';
        }
    } catch (err) {
        if (err && err.status === 401) {
            window.redirectToLogin();
            return;
        }
    }

    // 2. Initialize Chart.js instances
    const ctxPie = document.getElementById('genderPieChart')?.getContext('2d');
    if (ctxPie) {
        genderPieChart = new Chart(ctxPie, {
            type: 'pie',
            data: {
                labels: ['Male', 'Female'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#1200b3', '#ff94da'],
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    const ctxArea = document.getElementById('ageAreaChart')?.getContext('2d');
    if (ctxArea) {
        const ageLabels = ['Under 18', '18-30', '31-50', '51+'];
        ageAreaChart = new Chart(ctxArea, {
            type: 'bar',
            data: {
                labels: ageLabels,
                datasets: [{
                    label: 'Resident Count by Age Group',
                    data: [0, 0, 0, 0],
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // 3. Attach search and form listeners
    const rbiSearch = document.getElementById('rbi-search-input');
    if (rbiSearch) {
        rbiSearch.addEventListener('input', function () {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                loadResidents(1, this.value);
            }, 300);
        });
    }

    const txSearchBtn = document.getElementById('transaction-search-btn');
    const txSearchInput = document.getElementById('transaction-search-input');
    if (txSearchBtn && txSearchInput) {
        txSearchBtn.addEventListener('click', function () {
            loadTransactions(txSearchInput.value.trim());
        });
    }

    const addTxForm = document.getElementById('add-transaction-form');
    if (addTxForm) {
        addTxForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const resId = document.getElementById('tx-resident-id')?.value;
            const desc = document.getElementById('tx-description')?.value;
            const amt = document.getElementById('tx-amount')?.value;
            try {
                await CemboClear.client().post('/transactions', {
                    resident_id: parseInt(resId, 10),
                    description: desc,
                    amount: parseFloat(amt)
                });
                document.getElementById('add-transaction-modal')?.classList.add('hidden');
                addTxForm.reset();
                await loadTransactions();
            } catch (err) {
                showError(err.message || 'Failed to create transaction');
            }
        });
    }

    const composeForm = document.getElementById('compose-mail-form');
    if (composeForm) {
        composeForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const recId = document.getElementById('mail-recipient-id')?.value;
            const recType = document.getElementById('mail-recipient-type')?.value;
            const subj = document.getElementById('mail-input-subject')?.value;
            const body = document.getElementById('mail-input-body')?.value;

            try {
                await CemboClear.client().post('/mail', {
                    recipient_id: parseInt(recId, 10),
                    recipient_type: recType,
                    subject: subj,
                    body: body
                });
                document.getElementById('compose-mail-modal')?.classList.add('hidden');
                composeForm.reset();
                await loadMail();
            } catch (err) {
                showError(err.message || 'Failed to send mail');
            }
        });
    }

    // 4. Initial API Data Load
    await loadDashboardStats();
    await loadResidents();
    await loadCertificates();
    await loadRequests();
    await loadTransactions();
    await loadMail();
    await loadNotifications();
    await loadAuditLogs();
});
