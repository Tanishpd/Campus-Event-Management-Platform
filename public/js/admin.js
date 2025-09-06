// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.token = localStorage.getItem('admin_token');
        this.currentAdmin = JSON.parse(localStorage.getItem('current_admin') || 'null');
        this.charts = {};
        this.events = [];
        
        // Clear any existing data for fresh start
        if (!this.token) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('current_admin');
        }
        
        this.init();
    }
    
    init() {
        // Hide the dashboard content initially
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) {
            dashboardContent.style.display = 'none';
        }
        
        this.setupEventListeners();
        
        if (this.token && this.currentAdmin) {
            console.log('Token found, loading dashboard...');
            this.loadDashboard();
        } else {
            console.log('No token found, showing login...');
            // Instead of modal, show a simple login form overlay
            this.showSimpleLogin();
        }
    }
    
    showSimpleLogin() {
        // Create a simple login overlay
        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;" id="loginOverlay">
                <div style="background: white; padding: 30px; border-radius: 10px; text-align: center; min-width: 300px;">
                    <h3 style="margin-bottom: 20px; color: #333;">Admin Login</h3>
                    <div style="margin-bottom: 15px;">
                        <input type="text" id="overlayUsername" placeholder="Username" value="admin_nit" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <input type="password" id="overlayPassword" placeholder="Password" value="admin123" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    </div>
                    <button onclick="window.dashboard.quickLogin()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; width: 100%;">
                        Login
                    </button>
                    <p style="margin-top: 15px; color: #666; font-size: 12px;">Demo: admin_nit/admin123 or admin_iit/admin123</p>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    
    async quickLogin() {
        const username = document.getElementById('overlayUsername').value;
        const password = document.getElementById('overlayPassword').value;
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.token) {
                this.token = data.token;
                this.currentAdmin = data.user;
                localStorage.setItem('admin_token', this.token);
                localStorage.setItem('current_admin', JSON.stringify(data.user));
                
                // Remove login overlay
                const overlay = document.getElementById('loginOverlay');
                if (overlay) overlay.remove();
                
                this.loadDashboard();
                this.showToast('Login successful!', 'success');
            } else {
                alert('Login failed: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            alert('Network error: ' + error.message);
        }
    }
    
    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });
        
        // Event management
        document.getElementById('addEventBtn').addEventListener('click', () => {
            this.showAddEventModal();
        });
        
        document.getElementById('saveEventBtn').addEventListener('click', () => {
            this.saveEvent();
        });
        
        // Search and filters
        document.getElementById('eventSearch').addEventListener('input', (e) => {
            this.filterEvents(e.target.value);
        });
        
        document.getElementById('eventFilter').addEventListener('change', (e) => {
            this.filterEventsByType(e.target.value);
        });
        
        document.getElementById('eventTypeFilter').addEventListener('change', (e) => {
            this.updatePopularityChart(e.target.value);
        });
        
        document.getElementById('refreshEvents').addEventListener('click', () => {
            this.loadEvents();
        });
        
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.getAttribute('data-section');
                this.showSection(section);
                // Hide sidebar on mobile after selection
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('show');
                }
            });
        });
        
        // Mobile toggle
        const mobileToggle = document.getElementById('mobileToggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                sidebar.classList.toggle('show');
            });
        }
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const mobileToggle = document.getElementById('mobileToggle');
                if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
                    sidebar.classList.remove('show');
                }
            }
        });
    }
    
    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.token) {
                this.token = data.token;
                this.currentAdmin = data.user;
                localStorage.setItem('admin_token', this.token);
                localStorage.setItem('current_admin', JSON.stringify(data.user));
                
                bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                this.loadDashboard();
                this.showToast('Login successful!', 'success');
            } else {
                this.showToast(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }
    
    logout() {
        localStorage.removeItem('admin_token');
        this.token = null;
        this.currentAdmin = null;
        document.getElementById('dashboardContent').style.display = 'none';
        this.showLoginModal();
        this.showToast('Logged out successfully', 'info');
    }
    
    showLoginModal() {
        console.log('Attempting to show login modal...');
        const modalElement = document.getElementById('loginModal');
        
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement, {
                backdrop: 'static',
                keyboard: false
            });
            modal.show();
            console.log('Login modal should be visible now');
        } else {
            console.error('Login modal element not found!');
        }
    }
    
    showSection(sectionName) {
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-section') === sectionName) {
                link.classList.add('active');
            }
        });
        
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
            section.classList.add('d-none');
        });
        
        // Show selected section
        const targetSection = document.getElementById(sectionName + 'Section');
        if (targetSection) {
            targetSection.style.display = 'block';
            targetSection.classList.remove('d-none');
        }
        
        // Update page title
        const pageTitle = document.querySelector('.topbar h1');
        if (pageTitle) {
            pageTitle.textContent = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
        }
        
        // Load data for the section
        switch (sectionName) {
            case 'dashboard':
                this.loadDashboardStats();
                break;
            case 'events':
                this.loadEvents();
                break;
            case 'students':
                this.loadStudents();
                break;
            case 'registrations':
                this.loadRegistrations();
                break;
            case 'reports':
                this.loadReports();
                break;
        }
    }
    
    async loadDashboard() {
        console.log('Loading dashboard with user:', this.currentAdmin);
        
        // Show dashboard content
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) {
            dashboardContent.style.display = 'block';
        }
        
        // Display user info first
        if (this.currentAdmin) {
            const collegeName = this.currentAdmin.college?.name || this.currentAdmin.fullName || 'Admin';
            const userAvatar = collegeName.charAt(0).toUpperCase();
            
            // Update all possible places where the name appears
            const collegeNameEl = document.getElementById('collegeName');
            const userAvatarEl = document.getElementById('userAvatar');
            const adminNameSpan = document.querySelector('.admin-name');
            
            if (collegeNameEl) {
                collegeNameEl.textContent = collegeName;
                console.log('Set college name to:', collegeName);
            }
            if (userAvatarEl) {
                userAvatarEl.textContent = userAvatar;
            }
            if (adminNameSpan) {
                adminNameSpan.textContent = collegeName;
            }
            
            // Also update any "Loading..." text
            const loadingElements = document.querySelectorAll('[id*="collegeName"], .admin-name, .college-name');
            loadingElements.forEach(el => {
                if (el.textContent === 'Loading...' || el.textContent.includes('Loading')) {
                    el.textContent = collegeName;
                }
            });
        }
        
        // Force show the dashboard section immediately
        this.showSection('dashboard');
        
        // Load stats immediately
        setTimeout(() => {
            this.loadDashboardStats();
        }, 100);
    }
    
    async loadDashboardStats() {
        console.log('Loading dashboard stats...');
        try {
            // Load data in parallel
            const [eventsRes, studentsRes, registrationsRes] = await Promise.all([
                fetch('/api/events', { headers: { 'Authorization': `Bearer ${this.token}` } }),
                fetch('/api/students', { headers: { 'Authorization': `Bearer ${this.token}` } }),
                fetch('/api/registrations', { headers: { 'Authorization': `Bearer ${this.token}` } })
            ]);
            
            console.log('API responses received');
            
            const events = await eventsRes.json();
            const students = await studentsRes.json();
            const registrations = await registrationsRes.json();
            
            console.log('Stats data:', { events: events.length, students: students.length, registrations: registrations.length });
            
            // Calculate stats
            const totalEvents = Array.isArray(events) ? events.length : 0;
            const totalStudents = Array.isArray(students) ? students.length : 0;
            const totalRegistrations = Array.isArray(registrations) ? registrations.length : 0;
            const attendanceRate = totalRegistrations > 0 ? 85 : 0; // Mock 85% rate
            
            // Update DOM elements - be more aggressive about finding them
            const statUpdates = [
                { ids: ['totalEvents', 'eventsCount'], value: totalEvents },
                { ids: ['totalStudents', 'studentsCount'], value: totalStudents }, 
                { ids: ['totalRegistrations', 'registrationsCount'], value: totalRegistrations },
                { ids: ['attendanceRate'], value: `${attendanceRate}%` }
            ];
            
            statUpdates.forEach(({ids, value}) => {
                ids.forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = value;
                        console.log(`Updated ${id} to ${value}`);
                    }
                });
            });
            
            // Also try to find any elements with these classes or data attributes
            document.querySelectorAll('[data-stat="events"], .events-count').forEach(el => el.textContent = totalEvents);
            document.querySelectorAll('[data-stat="students"], .students-count').forEach(el => el.textContent = totalStudents);
            document.querySelectorAll('[data-stat="registrations"], .registrations-count').forEach(el => el.textContent = totalRegistrations);
            
            // Load charts if available
            if (typeof this.loadCharts === 'function') {
                this.loadCharts();
            }
            
        } catch (error) {
            console.error('Error loading stats:', error);
            // Set fallback values
            ['totalEvents', 'totalStudents', 'totalRegistrations', 'eventsCount', 'studentsCount', 'registrationsCount'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '0';
            });
            const attendanceEl = document.getElementById('attendanceRate');
            if (attendanceEl) attendanceEl.textContent = '0%';
        }
    }
    
    async loadEvents() {
        try {
            const response = await fetch('/api/events', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.events = data.events;
                this.renderEventsTable(this.events);
            }
        } catch (error) {
            console.error('Error loading events:', error);
            this.showToast('Failed to load events', 'error');
        }
    }
    
    renderEventsTable(events) {
        const tbody = document.getElementById('eventsTableBody');
        tbody.innerHTML = '';
        
        events.forEach(event => {
            const row = document.createElement('tr');
            row.className = 'fade-in';
            
            const startDate = new Date(event.start_datetime);
            const attendanceRate = event.registered_count > 0 ? 
                ((event.attended_count / event.registered_count) * 100).toFixed(1) : 0;
            
            row.innerHTML = `
                <td>
                    <strong>${event.title}</strong><br>
                    <small class="text-muted">${event.description?.substring(0, 50) || ''}...</small>
                </td>
                <td><span class="badge bg-primary">${event.event_type}</span></td>
                <td>
                    ${startDate.toLocaleDateString()}<br>
                    <small class="text-muted">${startDate.toLocaleTimeString()}</small>
                </td>
                <td>${event.location || '-'}</td>
                <td>
                    <span class="badge bg-info">${event.registered_count}/${event.max_participants}</span>
                </td>
                <td>
                    <span class="badge bg-success">${event.attended_count} (${attendanceRate}%)</span>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <span class="me-2">4.2</span>
                        <div class="stars">
                            ${this.generateStars(4.2)}
                        </div>
                    </div>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="dashboard.viewEvent(${event.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="dashboard.editEvent(${event.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success" onclick="dashboard.markAttendance(${event.id})">
                        <i class="fas fa-check"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    generateStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;
        let stars = '';
        
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star text-warning"></i>';
        }
        
        if (hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt text-warning"></i>';
        }
        
        const emptyStars = 5 - Math.ceil(rating);
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star text-warning"></i>';
        }
        
        return stars;
    }
    
    async loadCharts() {
        await this.loadPopularityChart();
        await this.loadEventTypeChart();
    }
    
    async loadPopularityChart(eventType = '') {
        try {
            const url = eventType ? 
                `/api/reports/event_popularity?type=${eventType}&limit=10` : 
                '/api/reports/event_popularity?limit=10';
                
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.renderPopularityChart(data.data);
            }
        } catch (error) {
            console.error('Error loading popularity chart:', error);
        }
    }
    
    renderPopularityChart(data) {
        const ctx = document.getElementById('registrationsChart').getContext('2d');
        
        if (this.charts.popularity) {
            this.charts.popularity.destroy();
        }
        
        const labels = data.map(event => event.title.substring(0, 20) + '...');
        const registrations = data.map(event => event.registration_count);
        const attendance = data.map(event => event.attendance_count);
        
        this.charts.popularity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Registrations',
                    data: registrations,
                    backgroundColor: 'rgba(13, 110, 253, 0.8)',
                    borderColor: 'rgba(13, 110, 253, 1)',
                    borderWidth: 1
                }, {
                    label: 'Attendance',
                    data: attendance,
                    backgroundColor: 'rgba(25, 135, 84, 0.8)',
                    borderColor: 'rgba(25, 135, 84, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Event Registration vs Attendance'
                    }
                }
            }
        });
    }
    
    async loadEventTypeChart() {
        try {
            const response = await fetch('/api/events', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const eventTypes = {};
                data.events.forEach(event => {
                    eventTypes[event.event_type] = (eventTypes[event.event_type] || 0) + 1;
                });
                
                this.renderEventTypeChart(eventTypes);
            }
        } catch (error) {
            console.error('Error loading event type chart:', error);
        }
    }
    
    renderEventTypeChart(eventTypes) {
        const ctx = document.getElementById('eventTypesChart').getContext('2d');
        
        if (this.charts.eventType) {
            this.charts.eventType.destroy();
        }
        
        const labels = Object.keys(eventTypes);
        const data = Object.values(eventTypes);
        const colors = [
            'rgba(13, 110, 253, 0.8)',
            'rgba(25, 135, 84, 0.8)',
            'rgba(255, 193, 7, 0.8)',
            'rgba(220, 53, 69, 0.8)',
            'rgba(13, 202, 240, 0.8)'
        ];
        
        this.charts.eventType = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: colors.slice(0, labels.length).map(color => color.replace('0.8', '1')),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Event Types Distribution'
                    }
                }
            }
        });
    }
    
    filterEvents(searchTerm) {
        const filteredEvents = this.events.filter(event =>
            event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.event_type.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        this.renderEventsTable(filteredEvents);
    }
    
    filterEventsByType(eventType) {
        if (eventType === '') {
            this.renderEventsTable(this.events);
        } else {
            const filteredEvents = this.events.filter(event => event.event_type === eventType);
            this.renderEventsTable(filteredEvents);
        }
    }
    
    updatePopularityChart(eventType) {
        this.loadPopularityChart(eventType);
    }
    
    showAddEventModal() {
        const modal = new bootstrap.Modal(document.getElementById('addEventModal'));
        
        // Reset form
        document.getElementById('eventForm').reset();
        
        // Set default values
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const dayAfter = new Date(now.getTime() + 25 * 60 * 60 * 1000);
        
        document.getElementById('startDateTime').value = tomorrow.toISOString().slice(0, 16);
        document.getElementById('endDateTime').value = dayAfter.toISOString().slice(0, 16);
        document.getElementById('registrationDeadline').value = now.toISOString().slice(0, 16);
        
        modal.show();
    }
    
    async saveEvent() {
        const form = document.getElementById('eventForm');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const eventData = {
            title: document.getElementById('eventTitle').value,
            description: document.getElementById('eventDescription').value,
            event_type: document.getElementById('eventType').value,
            start_datetime: document.getElementById('startDateTime').value + ':00Z',
            end_datetime: document.getElementById('endDateTime').value + ':00Z',
            location: document.getElementById('eventLocation').value,
            max_participants: parseInt(document.getElementById('maxParticipants').value),
            registration_deadline: document.getElementById('registrationDeadline').value + ':00Z',
            college_id: this.currentAdmin.college_id
        };
        
        try {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(eventData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
                await this.loadEvents();
                await this.loadDashboardStats();
                await this.loadCharts();
                this.showToast('Event created successfully!', 'success');
            } else {
                this.showToast(data.message || 'Failed to create event', 'error');
            }
        } catch (error) {
            console.error('Error creating event:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }
    
    viewEvent(eventId) {
        // Implementation for viewing event details
        console.log('Viewing event:', eventId);
    }
    
    editEvent(eventId) {
        // Implementation for editing event
        console.log('Editing event:', eventId);
    }
    
    markAttendance(eventId) {
        // Implementation for marking attendance
        console.log('Mark attendance for event:', eventId);
    }

    async loadStudents() {
        const section = document.getElementById('studentsSection');
        section.innerHTML = '<div class="text-center mt-5"><div class="spinner-border" role="status"></div><p class="mt-2">Loading students...</p></div>';
        // TODO: Implement student loading functionality
    }
    
    async loadRegistrations() {
        const section = document.getElementById('registrationsSection');
        section.innerHTML = '<div class="text-center mt-5"><div class="spinner-border" role="status"></div><p class="mt-2">Loading registrations...</p></div>';
        // TODO: Implement registrations loading functionality
    }
    
    async loadReports() {
        const section = document.getElementById('reportsSection');
        section.innerHTML = '<div class="text-center mt-5"><div class="spinner-border" role="status"></div><p class="mt-2">Loading reports...</p></div>';
        // TODO: Implement reports loading functionality
    }
    
    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
        toast.setAttribute('role', 'alert');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        container.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remove toast element after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AdminDashboard();
});
