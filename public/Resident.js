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

function saveResidentProfile() {
    const fullName = document.getElementById('resident-full-name')?.value.trim() || 'Juan M. Dela Cruz';
    const role = document.getElementById('resident-role')?.value.trim() || 'Resident User';
    const nameDisplay = document.getElementById('resident-profile-name-display');
    const navName = document.querySelector('.navbar-user-area .user-pill span');
    const pillInitials = document.querySelector('.user-pill-initials');
    const avatarFallback = document.getElementById('resident-profile-avatar-fallback');

    if (nameDisplay) nameDisplay.textContent = fullName;
    if (navName) navName.textContent = fullName;
    if (pillInitials) {
        const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'JD';
        pillInitials.textContent = initials;
    }
    if (avatarFallback) {
        const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'JD';
        avatarFallback.textContent = initials;
    }
    const roleText = document.querySelector('.resident-profile-header p');
    if (roleText) roleText.textContent = role;
    closeResidentProfile();
}

function openComplaintModal(departmentName) {
    const modal = document.getElementById('complaint-modal');
    const deptDisplay = document.getElementById('modal-dept-name');
    const form = document.querySelector('#complaint-modal form');
    const fileNameDisplay = document.getElementById('complaint-file-name');
    const select = document.getElementById('complaint-type');

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

function submitComplaint(event) {
    event.preventDefault();
    closeComplaintModal();
}

document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('complaint-file');
    const fileNameDisplay = document.getElementById('complaint-file-name');
    const profileCard = document.getElementById('resident-profile-card');
    const profileBackdrop = document.getElementById('resident-profile-backdrop');
    const profilePill = document.querySelector('.navbar-user-area .user-pill');
    const notificationsPanel = document.getElementById('notifications-panel');
    const bellButton = document.querySelector('.bell-notification');
    const profilePhotoInput = document.getElementById('profile-photo-input');
    const profilePreview = document.getElementById('resident-profile-preview');
    const profileFallback = document.getElementById('resident-profile-avatar-fallback');

    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', function () {
            fileNameDisplay.textContent = this.files && this.files[0] ? this.files[0].name : 'No file chosen';
        });
    }

    if (profilePhotoInput && profilePreview && profileFallback) {
        profilePhotoInput.addEventListener('change', function () {
            const file = this.files && this.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                profilePreview.src = e.target.result;
                profilePreview.style.display = 'block';
                profileFallback.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }

    if (profileCard && profilePill) {
        document.addEventListener('click', function (event) {
            const clickedInsideProfile = profileCard.contains(event.target);
            const clickedProfilePill = profilePill.contains(event.target);
            const clickedInsideNotifications = notificationsPanel && notificationsPanel.contains(event.target);
            const clickedBellButton = bellButton && bellButton.contains(event.target);
            const clickedBackdrop = profileBackdrop && profileBackdrop.contains(event.target);

            if (!clickedInsideProfile && !clickedProfilePill && !clickedInsideNotifications && !clickedBellButton && !clickedBackdrop) {
                profileCard.classList.remove('open');
                if (profileBackdrop) profileBackdrop.classList.remove('open');
                if (notificationsPanel) notificationsPanel.classList.remove('open');
            }
        });
    }
});
