// Student Portal JavaScript
class StudentPortal {
    constructor() {
        this.token = localStorage.getItem('student_token');
        this.currentStudent = JSON.parse(localStorage.getItem('current_student') || 'null');
        this.events = [];
        this.colleges = [];
        this.selectedEventId = null;
        
        // Debug logging
        console.log('StudentPortal initialized');
        console.log('Token:', this.token ? 'Present' : 'None');
        console.log('Current Student:', this.currentStudent);
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadInitialData();
        
        if (this.token && this.currentStudent) {
            console.log('User appears to be logged in, validating...');
            this.validateToken().then(isValid => {
                if (isValid) {
                    this.showLoggedInState();
                    this.loadStudentData();
                } else {
                    console.log('Token validation failed, logging out');
                    this.logout();
                }
            });
        } else {
            console.log('No token or student data, showing logged out state');
            this.showLoggedOutState();
        }
    }
    
    async validateToken() {
        if (!this.token || !this.currentStudent) return false;
        
        try {
            // Try to fetch student data to validate token
            const response = await fetch(`/api/registrations/student/${this.currentStudent.id}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            return response.ok;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }
    
    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
        
        // Register form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });
        
        // Load colleges when register modal opens
        const registerModal = document.getElementById('registerModal');
        registerModal.addEventListener('show.bs.modal', () => {
            this.loadColleges();
        });
    }
    
    async loadInitialData() {
        try {
            // Load basic stats for welcome section
            const [eventsRes, studentsRes, collegesRes] = await Promise.all([
                fetch('/api/events/public'),
                fetch('/api/students/count'),
                fetch('/api/colleges')
            ]);
            
            if (eventsRes.ok) {
                const events = await eventsRes.json();
                document.getElementById('totalEvents').textContent = events.length || 0;
            }
            
            if (studentsRes.ok) {
                const data = await studentsRes.json();
                document.getElementById('totalStudents').textContent = data.count || 0;
            }
            
            if (collegesRes.ok) {
                const colleges = await collegesRes.json();
                document.getElementById('totalColleges').textContent = colleges.length || 0;
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }
    
    async loadColleges() {
        try {
            const response = await fetch('/api/colleges');
            if (response.ok) {
                this.colleges = await response.json();
                const select = document.getElementById('regCollege');
                select.innerHTML = '<option value="">Select College</option>';
                
                this.colleges.forEach(college => {
                    const option = document.createElement('option');
                    option.value = college.id;
                    option.textContent = `${college.name} (${college.code})`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading colleges:', error);
        }
    }
    
    async login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await fetch('/api/auth/student-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.token) {
                this.token = data.token;
                this.currentStudent = data.user;
                localStorage.setItem('student_token', this.token);
                localStorage.setItem('current_student', JSON.stringify(data.user));
                
                bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                this.showLoggedInState();
                this.loadStudentData();
                this.showToast('Welcome back! Login successful', 'success');
            } else {
                this.showToast(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }
    
    async register() {
        const formData = {
            full_name: document.getElementById('regFullName').value,
            email: document.getElementById('regEmail').value,
            student_id: document.getElementById('regStudentId').value,
            phone: document.getElementById('regPhone').value,
            college_id: document.getElementById('regCollege').value,
            department: document.getElementById('regDepartment').value,
            year: document.getElementById('regYear').value,
            password: document.getElementById('regPassword').value
        };
        
        try {
            const response = await fetch('/api/auth/student-register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok && data.token) {
                this.token = data.token;
                this.currentStudent = data.user;
                localStorage.setItem('student_token', this.token);
                localStorage.setItem('current_student', JSON.stringify(data.user));
                
                bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
                this.showLoggedInState();
                this.loadStudentData();
                this.showToast('Profile created successfully! Welcome!', 'success');
            } else {
                this.showToast(data.message || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }
    
    showLoggedInState() {
        document.getElementById('loginNav').classList.add('d-none');
        document.getElementById('registerNav').classList.add('d-none');
        document.getElementById('logoutNav').classList.remove('d-none');
        document.getElementById('welcomeSection').style.display = 'none';
        this.showSection('events');
    }
    
    showLoggedOutState() {
        console.log('Showing logged out state');
        document.getElementById('loginNav').classList.remove('d-none');
        document.getElementById('registerNav').classList.remove('d-none');
        document.getElementById('logoutNav').classList.add('d-none');
        document.getElementById('welcomeSection').style.display = 'block';
        this.hideAllSections();
        
        // Clear any loading content
        document.getElementById('eventsContent').innerHTML = '<div class="text-center text-muted">Please login to view events</div>';
        document.getElementById('registrationsContent').innerHTML = '<div class="text-center text-muted">Please login to view registrations</div>';
    }
    
    logout() {
        console.log('Logging out user');
        this.token = null;
        this.currentStudent = null;
        localStorage.removeItem('student_token');
        localStorage.removeItem('current_student');
        localStorage.clear(); // Clear all localStorage to be safe
        this.showLoggedOutState();
        this.showToast('Logged out successfully', 'info');
    }
    
    hideAllSections() {
        document.getElementById('profileSection').classList.remove('active');
        document.getElementById('eventsSection').classList.remove('active');
        document.getElementById('registrationsSection').classList.remove('active');
    }
    
    showSection(section) {
        if (!this.token || !this.currentStudent) {
            console.log('User not logged in, cannot show section:', section);
            this.showToast('Please login to access this section', 'warning');
            return;
        }
        
        this.hideAllSections();
        document.getElementById(`${section}Section`).classList.add('active');
        
        // Load section data
        if (section === 'events') {
            this.loadEvents();
        } else if (section === 'profile') {
            this.loadProfile();
        } else if (section === 'registrations') {
            this.loadRegistrations();
        }
    }
    
    async loadStudentData() {
        await Promise.all([
            this.loadEvents(),
            this.loadProfile()
        ]);
    }
    
    async loadEvents() {
        if (!this.token || !this.currentStudent) {
            console.log('No token or student data, skipping events load');
            return;
        }
        
        try {
            const response = await fetch(`/api/events/student/${this.currentStudent.college_id}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.events = await response.json();
                this.renderEvents(this.events);
            } else {
                console.error('Failed to load events:', response.status, response.statusText);
                this.showToast('Failed to load events', 'error');
                // If unauthorized, logout the user
                if (response.status === 401) {
                    this.logout();
                }
            }
        } catch (error) {
            console.error('Error loading events:', error);
            this.showToast('Error loading events', 'error');
        }
    }
    
    renderEvents(events) {
        const container = document.getElementById('eventsContent');
        
        if (events.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-calendar-times fa-3x mb-3" style="opacity: 0.5;"></i>
                    <h5>No events available</h5>
                    <p>Check back soon for exciting events!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = events.map(event => `
            <div class="event-card">
                <div class="row">
                    <div class="col-md-8">
                        <h5>${event.title}</h5>
                        <p class="text-muted">${event.description || 'No description available'}</p>
                        <div class="d-flex flex-wrap gap-2 mb-2">
                            <span class="badge bg-primary">${event.event_type}</span>
                            <span class="badge bg-info">
                                <i class="fas fa-calendar"></i> ${new Date(event.start_datetime).toLocaleDateString()}
                            </span>
                            <span class="badge bg-warning">
                                <i class="fas fa-clock"></i> ${new Date(event.start_datetime).toLocaleTimeString()}
                            </span>
                            <span class="badge bg-secondary">
                                <i class="fas fa-location-pin"></i> ${event.location || 'Location TBD'}
                            </span>
                        </div>
                        <div class="text-muted">
                            <small>
                                <i class="fas fa-users"></i> ${event.registration_count || 0}/${event.max_participants} registered
                                ${event.registration_deadline ? 
                                    `• <i class="fas fa-deadline"></i> Register by ${new Date(event.registration_deadline).toLocaleDateString()}` 
                                    : ''
                                }
                            </small>
                        </div>
                    </div>
                    <div class="col-md-4 text-end d-flex flex-column justify-content-center">
                        <button class="btn btn-success mb-2" onclick="portal.showEventDetails(${event.id})">
                            <i class="fas fa-info-circle"></i> View Details
                        </button>
                        <button class="btn btn-primary" onclick="portal.showEventRegistration(${event.id})" 
                                ${event.registration_count >= event.max_participants ? 'disabled' : ''}>
                            <i class="fas fa-user-plus"></i> 
                            ${event.registration_count >= event.max_participants ? 'Full' : 'Register'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    filterEvents() {
        const eventType = document.getElementById('eventTypeFilter').value;
        const filteredEvents = eventType ? 
            this.events.filter(event => event.event_type === eventType) : 
            this.events;
        this.renderEvents(filteredEvents);
    }
    
    showEventDetails(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;
        
        document.getElementById('eventModalTitle').innerHTML = `
            <i class="fas fa-calendar-alt"></i> ${event.title}
        `;
        
        document.getElementById('eventModalBody').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6><i class="fas fa-info-circle"></i> Event Details</h6>
                    <p><strong>Type:</strong> ${event.event_type}</p>
                    <p><strong>Date:</strong> ${new Date(event.start_datetime).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> ${new Date(event.start_datetime).toLocaleTimeString()} - ${new Date(event.end_datetime).toLocaleTimeString()}</p>
                    <p><strong>Location:</strong> ${event.location || 'Location TBD'}</p>
                    <p><strong>Max Participants:</strong> ${event.max_participants}</p>
                </div>
                <div class="col-md-6">
                    <h6><i class="fas fa-users"></i> Registration Info</h6>
                    <p><strong>Registered:</strong> ${event.registration_count || 0}/${event.max_participants}</p>
                    <p><strong>Spaces Left:</strong> ${event.max_participants - (event.registration_count || 0)}</p>
                    ${event.registration_deadline ? 
                        `<p><strong>Registration Deadline:</strong> ${new Date(event.registration_deadline).toLocaleDateString()}</p>` 
                        : ''
                    }
                    <p><strong>College:</strong> ${event.college_name}</p>
                </div>
            </div>
            <div class="mt-3">
                <h6><i class="fas fa-file-text"></i> Description</h6>
                <p>${event.description || 'No detailed description available.'}</p>
            </div>
        `;
        
        this.selectedEventId = eventId;
        const modal = new bootstrap.Modal(document.getElementById('eventModal'));
        modal.show();
    }
    
    showEventRegistration(eventId) {
        this.selectedEventId = eventId;
        this.showEventDetails(eventId);
    }
    
    async registerForEvent() {
        if (!this.selectedEventId) return;
        
        try {
            const response = await fetch('/api/registrations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    eventId: this.selectedEventId,
                    studentId: this.currentStudent.id
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
                this.showToast('Successfully registered for the event!', 'success');
                this.loadEvents(); // Refresh events to update counts
            } else {
                this.showToast(data.message || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }
    
    async loadProfile() {
        if (!this.currentStudent) return;
        
        const profileContent = document.getElementById('profileContent');
        profileContent.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6><i class="fas fa-user"></i> Personal Information</h6>
                    <p><strong>Name:</strong> ${this.currentStudent.full_name}</p>
                    <p><strong>Email:</strong> ${this.currentStudent.email}</p>
                    <p><strong>Student ID:</strong> ${this.currentStudent.student_id}</p>
                    <p><strong>Phone:</strong> ${this.currentStudent.phone}</p>
                </div>
                <div class="col-md-6">
                    <h6><i class="fas fa-graduation-cap"></i> Academic Information</h6>
                    <p><strong>College:</strong> ${this.currentStudent.college_name}</p>
                    <p><strong>Department:</strong> ${this.currentStudent.department}</p>
                    <p><strong>Year:</strong> ${this.currentStudent.year}</p>
                    <p><strong>Joined:</strong> ${new Date(this.currentStudent.created_at).toLocaleDateString()}</p>
                </div>
            </div>
            <div class="mt-4">
                <button class="btn btn-primary" onclick="portal.editProfile()">
                    <i class="fas fa-edit"></i> Edit Profile
                </button>
            </div>
        `;
    }
    
    async loadRegistrations() {
        if (!this.token || !this.currentStudent) {
            console.log('No token or student data, skipping registrations load');
            return;
        }
        
        try {
            const response = await fetch(`/api/registrations/student/${this.currentStudent.id}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const registrations = await response.json();
                this.renderRegistrations(registrations);
            } else {
                console.error('Failed to load registrations:', response.status, response.statusText);
                this.showToast('Failed to load registrations', 'error');
                // If unauthorized, logout the user
                if (response.status === 401) {
                    this.logout();
                }
            }
        } catch (error) {
            console.error('Error loading registrations:', error);
            this.showToast('Error loading registrations', 'error');
        }
    }
    
    renderRegistrations(registrations) {
        const container = document.getElementById('registrationsContent');
        
        if (registrations.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-clipboard-list fa-3x mb-3" style="opacity: 0.5;"></i>
                    <h5>No registrations yet</h5>
                    <p>Start by registering for some events!</p>
                    <button class="btn btn-primary" onclick="portal.showSection('events')">
                        <i class="fas fa-calendar"></i> Browse Events
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = registrations.map(reg => `
            <div class="event-card">
                <div class="row">
                    <div class="col-md-8">
                        <h5>${reg.event_title}</h5>
                        <p class="text-muted">${reg.event_description || 'No description'}</p>
                        <div class="d-flex flex-wrap gap-2">
                            <span class="badge bg-primary">${reg.event_type}</span>
                            <span class="badge ${reg.status === 'registered' ? 'bg-success' : reg.status === 'attended' ? 'bg-info' : 'bg-warning'}">
                                ${reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                            </span>
                            <span class="badge bg-secondary">
                                <i class="fas fa-calendar"></i> ${new Date(reg.event_start).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <div class="col-md-4 text-end d-flex flex-column justify-content-center">
                        <small class="text-muted">
                            Registered: ${new Date(reg.registration_date).toLocaleDateString()}
                        </small>
                        ${reg.status === 'registered' ? 
                            `<button class="btn btn-warning btn-sm mt-2" onclick="portal.cancelRegistration(${reg.id})">
                                <i class="fas fa-times"></i> Cancel
                            </button>` : 
                            reg.status === 'attended' ?
                            `<div class="mt-2">
                                <button class="btn btn-info btn-sm" onclick="portal.showFeedbackModal(${reg.event_id}, '${reg.event_title}')" ${reg.has_feedback ? 'disabled' : ''}>
                                    <i class="fas fa-star"></i> ${reg.has_feedback ? 'Feedback Submitted' : 'Give Feedback'}
                                </button>
                                ${reg.has_feedback ? `<div class="text-warning small mt-1"><i class="fas fa-star"></i> Rating: ${reg.feedback_rating}/5</div>` : ''}
                            </div>` : ''
                        }
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    async cancelRegistration(registrationId) {
        if (!confirm('Are you sure you want to cancel this registration?')) return;
        
        try {
            const response = await fetch(`/api/registrations/${registrationId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.showToast('Registration cancelled successfully', 'info');
                this.loadRegistrations();
                this.loadEvents(); // Refresh events to update counts
            } else {
                const data = await response.json();
                this.showToast(data.message || 'Failed to cancel registration', 'error');
            }
        } catch (error) {
            console.error('Error cancelling registration:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }
    
    showFeedbackModal(eventId, eventTitle) {
        this.selectedEventId = eventId;
        document.getElementById('feedbackEventTitle').textContent = eventTitle;
        
        // Reset form
        const stars = document.querySelectorAll('#ratingStars i');
        stars.forEach(star => star.classList.remove('active'));
        document.getElementById('feedbackComments').value = '';
        document.getElementById('submitFeedbackBtn').disabled = true;
        document.getElementById('ratingText').textContent = 'Click stars to rate';
        
        // Setup star rating interaction
        this.setupStarRating();
        
        const modal = new bootstrap.Modal(document.getElementById('feedbackModal'));
        modal.show();
    }
    
    setupStarRating() {
        const stars = document.querySelectorAll('#ratingStars i');
        const ratingText = document.getElementById('ratingText');
        const submitBtn = document.getElementById('submitFeedbackBtn');
        let selectedRating = 0;
        
        // Setup feedback form submission
        document.getElementById('feedbackForm').onsubmit = (e) => {
            e.preventDefault();
            this.submitFeedback();
        };
        
        const ratingLabels = {
            1: 'Poor - Not satisfied',
            2: 'Fair - Below expectations',
            3: 'Good - Met expectations',
            4: 'Very Good - Above expectations',
            5: 'Excellent - Outstanding!'
        };
        
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                selectedRating = index + 1;
                this.selectedRating = selectedRating;
                
                // Update visual state
                stars.forEach((s, i) => {
                    if (i < selectedRating) {
                        s.classList.add('active');
                    } else {
                        s.classList.remove('active');
                    }
                });
                
                ratingText.textContent = ratingLabels[selectedRating];
                submitBtn.disabled = false;
            });
            
            star.addEventListener('mouseenter', () => {
                const hoverRating = index + 1;
                stars.forEach((s, i) => {
                    if (i < hoverRating) {
                        s.style.color = '#ffc107';
                    } else {
                        s.style.color = '#ddd';
                    }
                });
                ratingText.textContent = ratingLabels[hoverRating];
            });
            
            star.addEventListener('mouseleave', () => {
                stars.forEach((s, i) => {
                    if (i < selectedRating) {
                        s.style.color = '#ffc107';
                        s.classList.add('active');
                    } else {
                        s.style.color = '#ddd';
                        s.classList.remove('active');
                    }
                });
                if (selectedRating > 0) {
                    ratingText.textContent = ratingLabels[selectedRating];
                } else {
                    ratingText.textContent = 'Click stars to rate';
                }
            });
        });
    }
    
    async submitFeedback() {
        if (!this.selectedRating || this.selectedRating < 1) {
            this.showToast('Please select a rating', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    event_id: this.selectedEventId,
                    rating: this.selectedRating,
                    comments: document.getElementById('feedbackComments').value || null
                })
            });
            
            if (response.ok) {
                this.showToast('Thank you for your feedback!', 'success');
                bootstrap.Modal.getInstance(document.getElementById('feedbackModal')).hide();
                this.loadRegistrations(); // Refresh to show feedback submitted
            } else {
                try {
                    const data = await response.json();
                    this.showToast(data.message || 'Failed to submit feedback', 'error');
                } catch (jsonError) {
                    this.showToast(`Server error: ${response.status} ${response.statusText}`, 'error');
                }
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }
    
    editProfile() {
        this.showToast('Profile editing feature coming soon!', 'info');
    }
    
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toastId = 'toast_' + Date.now();
        
        const bgClass = {
            'success': 'bg-success',
            'error': 'bg-danger',
            'warning': 'bg-warning',
            'info': 'bg-info'
        }[type] || 'bg-info';
        
        const toastHtml = `
            <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
                <div class="toast-header ${bgClass} text-white">
                    <strong class="me-auto">
                        <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                                        type === 'error' ? 'fa-exclamation-circle' :
                                        type === 'warning' ? 'fa-exclamation-triangle' : 
                                        'fa-info-circle'}"></i> 
                        ${type.charAt(0).toUpperCase() + type.slice(1)}
                    </strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = new bootstrap.Toast(document.getElementById(toastId));
        toastElement.show();
        
        // Remove toast element after it's hidden
        document.getElementById(toastId).addEventListener('hidden.bs.toast', () => {
            document.getElementById(toastId).remove();
        });
    }
}

// Global functions for onclick handlers
function showSection(section) {
    portal.showSection(section);
}

function showLoginModal() {
    const modal = new bootstrap.Modal(document.getElementById('loginModal'));
    modal.show();
}

function showRegisterModal() {
    bootstrap.Modal.getInstance(document.getElementById('loginModal'))?.hide();
    const modal = new bootstrap.Modal(document.getElementById('registerModal'));
    modal.show();
}

function logout() {
    portal.logout();
}

function filterEvents() {
    portal.filterEvents();
}

function loadEvents() {
    portal.loadEvents();
}

function registerForEvent() {
    portal.registerForEvent();
}

// Initialize the portal when page loads
let portal;
document.addEventListener('DOMContentLoaded', function() {
    portal = new StudentPortal();
});
