// Interactive Dynamic Tab Switcher Engine
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

const profileOverlay = document.getElementById('profile-overlay');
if (profileOverlay) {
    profileOverlay.addEventListener('click', function (event) {
        if (event.target === this) {
            closeProfilePanel();
        }
    });
}

const accountPanelOverlay = document.getElementById('account-panel-overlay');
if (accountPanelOverlay) {
    accountPanelOverlay.addEventListener('click', function (event) {
        if (event.target === this) {
            closeAccountPanel();
        }
    });
}

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeProfilePanel();
        closeNotificationsPanel();
        closeAccountPanel();
    }
});

document.addEventListener('click', function (event) {
    const panel = document.getElementById('notification-panel');
    const trigger = document.getElementById('notification-trigger');
    if (panel && trigger && !panel.contains(event.target) && !trigger.contains(event.target)) {
        closeNotificationsPanel();
    }
});

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

const ctxPie = document.getElementById('genderPieChart').getContext('2d');
new Chart(ctxPie, {
    type: 'pie',
    data: {
        labels: ['Male', 'Female'],
        datasets: [{
            data: [49, 51],
            backgroundColor: ['#1200b3', '#ff94da'],
            borderWidth: 1,
            borderColor: '#ffffff'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        }
    }
});

const ctxArea = document.getElementById('ageAreaChart').getContext('2d');
const ageLabels = [
    '0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', 
    '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80 years & over'
];

new Chart(ctxArea, {
    type: 'line',
    data: {
        labels: ageLabels,
        datasets: [
            {
                label: 'Total',
                data: [2200, 2100, 2150, 2350, 2800, 2900, 2400, 1850, 1600, 1500, 1300, 1000, 700, 350, 150, 150, 200],
                backgroundColor: 'rgba(74, 74, 74, 0.9)', 
                fill: true,
                tension: 0.3,
                pointRadius: 0
            },
            {
                label: 'Male',
                data: [1200, 1200, 1150, 1150, 1400, 1500, 1300, 900, 800, 750, 700, 500, 400, 250, 100, 80, 100],
                backgroundColor: 'rgba(143, 130, 125, 0.8)',
                fill: true,
                tension: 0.3,
                pointRadius: 0
            },
            {
                label: 'Female',
                data: [1100, 1000, 1050, 1300, 1500, 1450, 1200, 900, 750, 700, 650, 600, 450, 200, 100, 100, 150],
                backgroundColor: 'rgba(219, 164, 145, 0.7)',
                fill: true,
                tension: 0.3,
                pointRadius: 0
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: { usePointStyle: true, boxWidth: 8, font: { weight: 'bold' } }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { maxRotation: 45, minRotation: 45, font: { weight: 'bold', size: 11 } }
            },
            y: {
                stacked: false,
                min: 0,
                max: 6000,
                ticks: { stepSize: 1000, font: { weight: 'bold' } }
            }
        }
    }
});
