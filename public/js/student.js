// Student Portal JavaScript
class StudentPortal {
    constructor() {
        this.currentStudent = null;
        this.events = [];
        this.filteredEvents = [];
        this.colleges = [];
        this.students = [];
        this.registrations = new Set();
        this.feedbackEvents = new Set();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadColleges();
        this.loadEvents();
        this.updateHeroStats();
        
        // Show student selection modal on first visit
        if (!sessionStorage.getItem('selectedStudent')) {
            setTimeout(() => {
                new bootstrap.Modal(document.getElementById('studentSelectionModal')).show();
            }, 1000);
        } else {
            this.currentStudent = JSON.parse(sessionStorage.getItem('selectedStudent'));
            this.loadRegistrations();
        }
    }

    setupEventListeners() {
        // Search functionality
        document.getElementById('eventSearch').addEventListener('input', (e) => {
            this.filterEvents();
        });

        // Type filter
        document.getElementById('typeFilter').addEventListener('change', (e) => {
            this.filterEvents();
        });

        // Sort functionality
        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.sortEvents();
        });

        // Filter pills
        document.querySelectorAll('#filterPills .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('#filterPills .btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Set filter value
                const filter = e.target.dataset.filter;
                document.getElementById('typeFilter').value = filter;
                this.filterEvents();
            });
        });

        // College selection
        document.getElementById('collegeSelect').addEventListener('change', (e) => {
            this.loadStudentsForCollege(e.target.value);
        });

        // Student selection
        document.getElementById('studentSelect').addEventListener('change', (e) => {
            const selectBtn = document.getElementById('selectStudentBtn');
            selectBtn.disabled = !e.target.value;
        });

        // Select student button
        document.getElementById('selectStudentBtn').addEventListener('click', () => {
            this.selectStudent();
        });

        // Registration confirmation
        document.getElementById('confirmRegistrationBtn').addEventListener('click', () => {
            this.registerForEvent();
        });

        // Feedback submission
        document.getElementById('submitFeedbackBtn').addEventListener('click', () => {
            this.submitFeedback();
        });

        // Check-in confirmation
        document.getElementById('confirmCheckinBtn').addEventListener('click', () => {
            this.checkinToEvent();
        });

        // Star rating
        document.querySelectorAll('#starRating i').forEach(star => {
            star.addEventListener('click', (e) => {
                this.setRating(parseInt(e.target.dataset.rating));
            });
            
            star.addEventListener('mouseenter', (e) => {
                this.highlightStars(parseInt(e.target.dataset.rating));
            });
        });

        document.getElementById('starRating').addEventListener('mouseleave', () => {
            this.highlightStars(this.selectedRating || 0);
        });

        // Hero buttons
        document.getElementById('exploreBtn').addEventListener('click', () => {
            document.getElementById('eventsGrid').scrollIntoView({ behavior: 'smooth' });
        });
    }

    async loadColleges() {
        try {
            const response = await fetch('/api/colleges');
            this.colleges = await response.json();
            
            const collegeSelect = document.getElementById('collegeSelect');
            collegeSelect.innerHTML = '<option value="">Choose your college...</option>';
            
            this.colleges.forEach(college => {
                const option = document.createElement('option');
                option.value = college.id;
                option.textContent = college.name;
                collegeSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading colleges:', error);
            this.showAlert('Error loading colleges. Please try again.', 'danger');
        }
    }

    async loadStudentsForCollege(collegeId) {
        const studentSelect = document.getElementById('studentSelect');
        
        if (!collegeId) {
            studentSelect.innerHTML = '<option value="">First select a college...</option>';
            studentSelect.disabled = true;
            return;
        }

        try {
            const response = await fetch(`/api/students?college_id=${collegeId}`);
            this.students = await response.json();
            
            studentSelect.innerHTML = '<option value="">Choose your profile...</option>';
            
            this.students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${student.name} (${student.student_id})`;
                studentSelect.appendChild(option);
            });
            
            studentSelect.disabled = false;
        } catch (error) {
            console.error('Error loading students:', error);
            this.showAlert('Error loading students. Please try again.', 'danger');
        }
    }

    selectStudent() {
        const collegeId = document.getElementById('collegeSelect').value;
        const studentId = document.getElementById('studentSelect').value;
        
        const college = this.colleges.find(c => c.id == collegeId);
        const student = this.students.find(s => s.id == studentId);
        
        this.currentStudent = {
            ...student,
            college: college
        };
        
        sessionStorage.setItem('selectedStudent', JSON.stringify(this.currentStudent));
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('studentSelectionModal')).hide();
        
        // Load registrations
        this.loadRegistrations();
        
        this.showAlert(`Welcome, ${student.name}! You can now register for events.`, 'success');
    }

    async loadEvents() {
        try {
            this.showLoadingState(true);
            const response = await fetch('/api/events');
            this.events = await response.json();
            this.filteredEvents = [...this.events];
            
            this.renderEvents();
            this.showLoadingState(false);
        } catch (error) {
            console.error('Error loading events:', error);
            this.showAlert('Error loading events. Please try again.', 'danger');
            this.showLoadingState(false);
        }
    }

    async loadRegistrations() {
        if (!this.currentStudent) return;

        try {
            const response = await fetch(`/api/registrations?student_id=${this.currentStudent.id}`);
            const registrations = await response.json();
            
            this.registrations = new Set(registrations.map(r => r.event_id));
            this.renderEvents(); // Re-render to show registration status
        } catch (error) {
            console.error('Error loading registrations:', error);
        }
    }

    filterEvents() {
        const searchTerm = document.getElementById('eventSearch').value.toLowerCase();
        const typeFilter = document.getElementById('typeFilter').value;
        
        this.filteredEvents = this.events.filter(event => {
            const matchesSearch = !searchTerm || 
                event.title.toLowerCase().includes(searchTerm) ||
                event.description.toLowerCase().includes(searchTerm) ||
                event.location.toLowerCase().includes(searchTerm);
                
            const matchesType = !typeFilter || event.type === typeFilter;
            
            return matchesSearch && matchesType;
        });
        
        this.sortEvents();
        this.renderEvents();
    }

    sortEvents() {
        const sortBy = document.getElementById('sortBy').value;
        
        this.filteredEvents.sort((a, b) => {
            switch (sortBy) {
                case 'date':
                    return new Date(a.date) - new Date(b.date);
                case 'popularity':
                    return (b.registered_count || 0) - (a.registered_count || 0);
                case 'rating':
                    return (b.avg_rating || 0) - (a.avg_rating || 0);
                default:
                    return 0;
            }
        });
    }

    renderEvents() {
        const eventsGrid = document.getElementById('eventsGrid');
        const noEventsMessage = document.getElementById('noEventsMessage');
        const resultsCount = document.getElementById('resultsCount');
        
        resultsCount.textContent = `${this.filteredEvents.length} events found`;
        
        if (this.filteredEvents.length === 0) {
            eventsGrid.style.display = 'none';
            noEventsMessage.style.display = 'block';
            return;
        }
        
        eventsGrid.style.display = 'flex';
        noEventsMessage.style.display = 'none';
        
        eventsGrid.innerHTML = this.filteredEvents.map(event => this.createEventCard(event)).join('');
        
        // Add event listeners to new cards
        this.attachEventCardListeners();
    }

    createEventCard(event) {
        const eventDate = new Date(event.date);
        const isRegistered = this.registrations.has(event.id);
        const isFull = (event.registered_count || 0) >= event.capacity;
        const capacityPercentage = ((event.registered_count || 0) / event.capacity) * 100;
        
        const getCapacityClass = (percentage) => {
            if (percentage >= 100) return 'full';
            if (percentage >= 80) return 'high';
            if (percentage >= 50) return 'medium';
            return 'low';
        };
        
        const getEventIcon = (type) => {
            const icons = {
                'Workshop': 'fas fa-tools',
                'Seminar': 'fas fa-chalkboard-teacher',
                'Competition': 'fas fa-trophy',
                'Fest': 'fas fa-music'
            };
            return icons[type] || 'fas fa-calendar-alt';
        };
        
        const getTypeColor = (type) => {
            const colors = {
                'Workshop': 'bg-primary',
                'Seminar': 'bg-info',
                'Competition': 'bg-warning text-dark',
                'Fest': 'bg-success'
            };
            return colors[type] || 'bg-secondary';
        };

        return `
            <div class="col-lg-4 col-md-6">
                <div class="event-card fade-in" data-event-id="${event.id}">
                    <div class="event-card-header">
                        <i class="event-icon ${getEventIcon(event.type)}"></i>
                        <span class="badge event-type-badge ${getTypeColor(event.type)}">${event.type}</span>
                    </div>
                    
                    <div class="event-card-body">
                        <h5 class="event-title">${event.title}</h5>
                        
                        <div class="event-meta">
                            <div class="event-meta-item">
                                <i class="fas fa-calendar-alt"></i>
                                <span>${eventDate.toLocaleDateString()}</span>
                            </div>
                            <div class="event-meta-item">
                                <i class="fas fa-clock"></i>
                                <span>${eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div class="event-meta-item">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${event.location}</span>
                            </div>
                        </div>
                        
                        <p class="event-description">${event.description}</p>
                        
                        <div class="event-stats">
                            <div class="event-stat">
                                <div class="event-stat-number">${event.registered_count || 0}</div>
                                <div class="event-stat-label">Registered</div>
                            </div>
                            <div class="event-stat">
                                <div class="event-stat-number">${event.capacity}</div>
                                <div class="event-stat-label">Capacity</div>
                            </div>
                            <div class="event-stat">
                                <div class="event-stat-number">${event.avg_rating ? event.avg_rating.toFixed(1) : 'N/A'}</div>
                                <div class="event-stat-label">Rating</div>
                            </div>
                        </div>
                        
                        <div class="capacity-bar">
                            <div class="capacity-fill ${getCapacityClass(capacityPercentage)}" 
                                 style="width: ${Math.min(capacityPercentage, 100)}%"></div>
                        </div>
                        <small class="text-muted">${event.capacity - (event.registered_count || 0)} spots remaining</small>
                        
                        ${isRegistered ? 
                            '<div class="registration-status registered"><i class="fas fa-check-circle me-2"></i>Registered</div>' :
                            isFull ? 
                                '<div class="registration-status full"><i class="fas fa-exclamation-triangle me-2"></i>Event Full</div>' : 
                                ''
                        }
                        
                        <div class="event-actions">
                            ${!isRegistered && !isFull ? 
                                '<button class="btn btn-primary btn-register register-btn" data-event-id="' + event.id + '"><i class="fas fa-user-plus me-2"></i>Register</button>' :
                                isRegistered ? 
                                    '<button class="btn btn-success btn-register checkin-btn" data-event-id="' + event.id + '"><i class="fas fa-qr-code me-2"></i>Check-in</button>' :
                                    '<button class="btn btn-secondary btn-register" disabled><i class="fas fa-ban me-2"></i>Full</button>'
                            }
                            
                            <button class="btn btn-outline-secondary btn-action feedback-btn" 
                                    data-event-id="${event.id}" 
                                    title="Give Feedback"
                                    ${!isRegistered ? 'disabled' : ''}>
                                <i class="fas fa-star"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventCardListeners() {
        // Register buttons
        document.querySelectorAll('.register-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!this.currentStudent) {
                    new bootstrap.Modal(document.getElementById('studentSelectionModal')).show();
                    return;
                }
                
                const eventId = e.target.dataset.eventId;
                this.showRegistrationModal(eventId);
            });
        });

        // Check-in buttons
        document.querySelectorAll('.checkin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = e.target.dataset.eventId;
                this.showCheckinModal(eventId);
            });
        });

        // Feedback buttons
        document.querySelectorAll('.feedback-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.disabled) return;
                
                const eventId = e.target.dataset.eventId;
                this.showFeedbackModal(eventId);
            });
        });
    }

    showRegistrationModal(eventId) {
        const event = this.events.find(e => e.id == eventId);
        const modal = new bootstrap.Modal(document.getElementById('registrationModal'));
        
        const eventDetails = document.getElementById('eventDetails');
        const eventDate = new Date(event.date);
        
        eventDetails.innerHTML = `
            <div class="row">
                <div class="col-md-8">
                    <h4>${event.title}</h4>
                    <p class="text-muted">${event.description}</p>
                    
                    <div class="row mt-3">
                        <div class="col-sm-6">
                            <strong><i class="fas fa-calendar-alt me-2"></i>Date:</strong><br>
                            ${eventDate.toLocaleDateString()}
                        </div>
                        <div class="col-sm-6">
                            <strong><i class="fas fa-clock me-2"></i>Time:</strong><br>
                            ${eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <div class="col-sm-6 mt-2">
                            <strong><i class="fas fa-map-marker-alt me-2"></i>Location:</strong><br>
                            ${event.location}
                        </div>
                        <div class="col-sm-6 mt-2">
                            <strong><i class="fas fa-tag me-2"></i>Type:</strong><br>
                            ${event.type}
                        </div>
                    </div>
                </div>
                <div class="col-md-4 text-center">
                    <div class="border rounded p-3">
                        <h5>Availability</h5>
                        <div class="mb-2">
                            <span class="badge bg-success fs-6">${event.capacity - (event.registered_count || 0)} spots left</span>
                        </div>
                        <div class="progress">
                            <div class="progress-bar" style="width: ${((event.registered_count || 0) / event.capacity) * 100}%"></div>
                        </div>
                        <small class="text-muted">${event.registered_count || 0} / ${event.capacity} registered</small>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('confirmRegistrationBtn').dataset.eventId = eventId;
        modal.show();
    }

    showFeedbackModal(eventId) {
        const event = this.events.find(e => e.id == eventId);
        const modal = new bootstrap.Modal(document.getElementById('feedbackModal'));
        
        document.querySelector('#feedbackModal .modal-title').textContent = `Feedback for ${event.title}`;
        document.getElementById('submitFeedbackBtn').dataset.eventId = eventId;
        
        // Reset form
        this.selectedRating = 0;
        this.highlightStars(0);
        document.getElementById('feedbackComments').value = '';
        
        modal.show();
    }

    showCheckinModal(eventId) {
        const event = this.events.find(e => e.id == eventId);
        const modal = new bootstrap.Modal(document.getElementById('checkinModal'));
        
        document.getElementById('checkinEventTitle').textContent = event.title;
        document.getElementById('confirmCheckinBtn').dataset.eventId = eventId;
        
        modal.show();
    }

    async registerForEvent() {
        const eventId = document.getElementById('confirmRegistrationBtn').dataset.eventId;
        
        try {
            const response = await fetch('/api/registrations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event_id: parseInt(eventId),
                    student_id: this.currentStudent.id
                })
            });

            if (response.ok) {
                this.registrations.add(parseInt(eventId));
                this.showAlert('Successfully registered for the event!', 'success');
                
                // Update event data
                const event = this.events.find(e => e.id == eventId);
                if (event) {
                    event.registered_count = (event.registered_count || 0) + 1;
                }
                
                this.renderEvents();
                bootstrap.Modal.getInstance(document.getElementById('registrationModal')).hide();
            } else {
                const error = await response.json();
                this.showAlert(error.message || 'Registration failed', 'danger');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showAlert('Network error. Please try again.', 'danger');
        }
    }

    async submitFeedback() {
        const eventId = document.getElementById('submitFeedbackBtn').dataset.eventId;
        const comments = document.getElementById('feedbackComments').value.trim();
        
        if (!this.selectedRating) {
            this.showAlert('Please select a rating', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event_id: parseInt(eventId),
                    student_id: this.currentStudent.id,
                    rating: this.selectedRating,
                    comments: comments
                })
            });

            if (response.ok) {
                this.feedbackEvents.add(parseInt(eventId));
                this.showAlert('Thank you for your feedback!', 'success');
                bootstrap.Modal.getInstance(document.getElementById('feedbackModal')).hide();
                
                // Update local event data
                this.loadEvents(); // Reload to get updated ratings
            } else {
                const error = await response.json();
                this.showAlert(error.message || 'Feedback submission failed', 'danger');
            }
        } catch (error) {
            console.error('Feedback error:', error);
            this.showAlert('Network error. Please try again.', 'danger');
        }
    }

    async checkinToEvent() {
        const eventId = document.getElementById('confirmCheckinBtn').dataset.eventId;
        
        try {
            const response = await fetch('/api/attendance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event_id: parseInt(eventId),
                    student_id: this.currentStudent.id,
                    status: 'present'
                })
            });

            if (response.ok) {
                this.showAlert('Successfully checked in to the event!', 'success');
                bootstrap.Modal.getInstance(document.getElementById('checkinModal')).hide();
            } else {
                const error = await response.json();
                this.showAlert(error.message || 'Check-in failed', 'danger');
            }
        } catch (error) {
            console.error('Check-in error:', error);
            this.showAlert('Network error. Please try again.', 'danger');
        }
    }

    setRating(rating) {
        this.selectedRating = rating;
        this.highlightStars(rating);
    }

    highlightStars(rating) {
        document.querySelectorAll('#starRating i').forEach((star, index) => {
            star.classList.toggle('active', index < rating);
        });
    }

    async updateHeroStats() {
        try {
            const [eventsResponse, studentsResponse] = await Promise.all([
                fetch('/api/events'),
                fetch('/api/students')
            ]);
            
            const events = await eventsResponse.json();
            const students = await studentsResponse.json();
            
            document.getElementById('heroTotalEvents').textContent = events.length;
            document.getElementById('heroActiveStudents').textContent = students.length;
        } catch (error) {
            console.error('Error updating hero stats:', error);
        }
    }

    showLoadingState(show) {
        const loadingSpinner = document.getElementById('loadingSpinner');
        const eventsGrid = document.getElementById('eventsGrid');
        
        if (show) {
            loadingSpinner.style.display = 'block';
            eventsGrid.style.display = 'none';
        } else {
            loadingSpinner.style.display = 'none';
            eventsGrid.style.display = 'flex';
        }
    }

    showAlert(message, type = 'info') {
        // Create alert element
        const alertId = 'alert-' + Date.now();
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show position-fixed" 
                 id="${alertId}" 
                 style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', alertHtml);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }
}

// Initialize the student portal when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StudentPortal();
});
