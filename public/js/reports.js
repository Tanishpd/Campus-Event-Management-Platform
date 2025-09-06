// Reports Dashboard JavaScript
class ReportsDashboard {
    constructor() {
        this.charts = {};
        this.currentFilters = {
            college: '',
            eventType: '',
            dateFrom: '',
            dateTo: '',
            reportType: 'overview'
        };
        this.data = {
            events: [],
            registrations: [],
            attendance: [],
            feedback: [],
            colleges: [],
            students: []
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeDateFilters();
        this.loadData();
        this.updateReportGeneratedTime();
    }

    setupEventListeners() {
        // Filter controls
        document.getElementById('applyFiltersBtn').addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('reportType').addEventListener('change', (e) => {
            this.currentFilters.reportType = e.target.value;
            this.renderReportType();
        });

        // Chart controls
        document.getElementById('popularityViewRegistrations').addEventListener('click', (e) => {
            this.setChartView('popularity', 'registrations', e.target);
        });

        document.getElementById('popularityViewAttendance').addEventListener('click', (e) => {
            this.setChartView('popularity', 'attendance', e.target);
        });

        document.getElementById('trendsTimeframe').addEventListener('change', () => {
            this.updateParticipationTrends();
        });

        document.getElementById('feedbackMetric').addEventListener('change', () => {
            this.updateFeedbackAnalysis();
        });

        // Table refresh buttons
        document.getElementById('refreshPopularityTable').addEventListener('click', () => {
            this.updatePopularityTable();
        });

        document.getElementById('refreshStudentsTable').addEventListener('click', () => {
            this.updateActiveStudentsTable();
        });

        // Export functionality
        document.getElementById('exportPdfBtn').addEventListener('click', () => {
            this.showExportModal('pdf');
        });

        document.getElementById('exportExcelBtn').addEventListener('click', () => {
            this.showExportModal('excel');
        });

        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            this.showExportModal('csv');
        });

        document.getElementById('confirmExportBtn').addEventListener('click', () => {
            this.exportReport();
        });
    }

    initializeDateFilters() {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        
        document.getElementById('dateFromFilter').value = thirtyDaysAgo.toISOString().split('T')[0];
        document.getElementById('dateToFilter').value = today.toISOString().split('T')[0];
    }

    async loadData() {
        try {
            this.showLoadingState(true);
            
            const [eventsRes, registrationsRes, attendanceRes, feedbackRes, collegesRes, studentsRes] = await Promise.all([
                fetch('/api/events'),
                fetch('/api/reports/registrations'),
                fetch('/api/reports/attendance'),
                fetch('/api/reports/feedback'),
                fetch('/api/colleges'),
                fetch('/api/students')
            ]);

            this.data.events = await eventsRes.json();
            this.data.registrations = await registrationsRes.json();
            this.data.attendance = await attendanceRes.json();
            this.data.feedback = await feedbackRes.json();
            this.data.colleges = await collegesRes.json();
            this.data.students = await studentsRes.json();

            this.populateFilterOptions();
            this.renderDashboard();
            this.showLoadingState(false);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showAlert('Error loading dashboard data. Please try again.', 'danger');
            this.showLoadingState(false);
        }
    }

    populateFilterOptions() {
        const collegeSelect = document.getElementById('collegeFilter');
        collegeSelect.innerHTML = '<option value="">All Colleges</option>';
        
        this.data.colleges.forEach(college => {
            const option = document.createElement('option');
            option.value = college.id;
            option.textContent = college.name;
            collegeSelect.appendChild(option);
        });
    }

    applyFilters() {
        this.currentFilters = {
            college: document.getElementById('collegeFilter').value,
            eventType: document.getElementById('eventTypeFilter').value,
            dateFrom: document.getElementById('dateFromFilter').value,
            dateTo: document.getElementById('dateToFilter').value,
            reportType: document.getElementById('reportType').value
        };
        
        this.renderDashboard();
    }

    renderDashboard() {
        this.updateStats();
        this.renderCharts();
        this.updateTables();
        this.renderReportType();
    }

    renderReportType() {
        // Show/hide sections based on report type
        const reportType = this.currentFilters.reportType;
        
        // All sections are always visible, but we can emphasize specific ones
        document.querySelectorAll('.chart-card, .table-card').forEach(card => {
            card.style.display = 'block';
        });
        
        // Update charts based on report type focus
        switch (reportType) {
            case 'popularity':
                this.emphasizeSection('eventPopularityChart');
                break;
            case 'participation':
                this.emphasizeSection('participationTrendsChart');
                break;
            case 'feedback':
                this.emphasizeSection('feedbackAnalysisChart');
                break;
            case 'active-students':
                this.emphasizeSection('studentsTableBody');
                break;
        }
    }

    emphasizeSection(sectionId) {
        // Add visual emphasis to the selected section
        document.querySelectorAll('.chart-card, .table-card').forEach(card => {
            card.classList.remove('emphasized');
        });
        
        const section = document.getElementById(sectionId)?.closest('.chart-card, .table-card');
        if (section) {
            section.classList.add('emphasized');
        }
    }

    updateStats() {
        const filteredData = this.getFilteredData();
        
        // Calculate stats
        const totalEvents = filteredData.events.length;
        const totalRegistrations = filteredData.registrations.length;
        const totalAttendance = filteredData.attendance.filter(a => a.status === 'present').length;
        const avgRating = this.calculateAverageRating(filteredData.feedback);
        
        // Update DOM
        document.getElementById('totalEvents').textContent = totalEvents;
        document.getElementById('totalRegistrations').textContent = totalRegistrations;
        document.getElementById('totalAttendance').textContent = totalAttendance;
        document.getElementById('avgRating').textContent = avgRating.toFixed(1);
        
        // Calculate trends (simplified - would need historical data for real trends)
        document.getElementById('eventsTrend').textContent = '+12%';
        document.getElementById('registrationsTrend').textContent = '+8%';
        document.getElementById('attendanceTrend').textContent = '+15%';
        document.getElementById('ratingTrend').textContent = '+5%';
    }

    renderCharts() {
        this.renderEventPopularityChart();
        this.renderEventTypeChart();
        this.renderParticipationTrendsChart();
        this.renderCollegePerformanceChart();
        this.renderFeedbackAnalysisChart();
    }

    renderEventPopularityChart() {
        const ctx = document.getElementById('eventPopularityChart').getContext('2d');
        const filteredData = this.getFilteredData();
        
        // Get top 10 events by registration count
        const eventStats = filteredData.events.map(event => ({
            title: event.title,
            registrations: filteredData.registrations.filter(r => r.event_id === event.id).length,
            attendance: filteredData.attendance.filter(a => a.event_id === event.id && a.status === 'present').length
        })).sort((a, b) => b.registrations - a.registrations).slice(0, 10);

        if (this.charts.eventPopularity) {
            this.charts.eventPopularity.destroy();
        }

        this.charts.eventPopularity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: eventStats.map(e => this.truncateText(e.title, 20)),
                datasets: [{
                    label: 'Registrations',
                    data: eventStats.map(e => e.registrations),
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }, {
                    label: 'Attendance',
                    data: eventStats.map(e => e.attendance),
                    backgroundColor: 'rgba(75, 192, 192, 0.8)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    renderEventTypeChart() {
        const ctx = document.getElementById('eventTypeChart').getContext('2d');
        const filteredData = this.getFilteredData();
        
        const typeStats = {};
        filteredData.events.forEach(event => {
            typeStats[event.type] = (typeStats[event.type] || 0) + 1;
        });

        if (this.charts.eventType) {
            this.charts.eventType.destroy();
        }

        this.charts.eventType = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(typeStats),
                datasets: [{
                    data: Object.values(typeStats),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 205, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderParticipationTrendsChart() {
        const ctx = document.getElementById('participationTrendsChart').getContext('2d');
        const timeframe = parseInt(document.getElementById('trendsTimeframe').value);
        
        // Generate trend data for the last N days
        const labels = [];
        const registrationData = [];
        const attendanceData = [];
        
        for (let i = timeframe - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            // Simulate data (in real app, would filter by actual dates)
            registrationData.push(Math.floor(Math.random() * 20) + 5);
            attendanceData.push(Math.floor(Math.random() * 15) + 3);
        }

        if (this.charts.participationTrends) {
            this.charts.participationTrends.destroy();
        }

        this.charts.participationTrends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'New Registrations',
                    data: registrationData,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Attendance',
                    data: attendanceData,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    renderCollegePerformanceChart() {
        const ctx = document.getElementById('collegePerformanceChart').getContext('2d');
        const filteredData = this.getFilteredData();
        
        const collegeStats = this.data.colleges.map(college => {
            const collegeRegistrations = filteredData.registrations.filter(r => {
                const student = this.data.students.find(s => s.id === r.student_id);
                return student && student.college_id === college.id;
            });
            
            return {
                name: college.name,
                count: collegeRegistrations.length
            };
        }).sort((a, b) => b.count - a.count);

        if (this.charts.collegePerformance) {
            this.charts.collegePerformance.destroy();
        }

        this.charts.collegePerformance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: collegeStats.map(c => this.truncateText(c.name, 15)),
                datasets: [{
                    label: 'Registrations',
                    data: collegeStats.map(c => c.count),
                    backgroundColor: 'rgba(255, 159, 64, 0.8)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    renderFeedbackAnalysisChart() {
        const ctx = document.getElementById('feedbackAnalysisChart').getContext('2d');
        const filteredData = this.getFilteredData();
        const metric = document.getElementById('feedbackMetric').value;
        
        const eventFeedback = filteredData.events.map(event => {
            const eventFeedbackList = filteredData.feedback.filter(f => f.event_id === event.id);
            const avgRating = eventFeedbackList.length > 0 
                ? eventFeedbackList.reduce((sum, f) => sum + f.rating, 0) / eventFeedbackList.length 
                : 0;
            
            return {
                title: event.title,
                avgRating: avgRating,
                count: eventFeedbackList.length
            };
        }).filter(e => e.count > 0).sort((a, b) => b.avgRating - a.avgRating).slice(0, 10);

        if (this.charts.feedbackAnalysis) {
            this.charts.feedbackAnalysis.destroy();
        }

        this.charts.feedbackAnalysis = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: eventFeedback.map(e => this.truncateText(e.title, 20)),
                datasets: [{
                    label: metric === 'rating' ? 'Average Rating' : 'Feedback Count',
                    data: eventFeedback.map(e => metric === 'rating' ? e.avgRating : e.count),
                    backgroundColor: 'rgba(153, 102, 255, 0.8)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: metric === 'rating' ? 5 : undefined,
                        ticks: {
                            precision: metric === 'rating' ? 1 : 0
                        }
                    }
                }
            }
        });
        
        // Update rating distribution
        this.updateRatingDistribution();
    }

    updateTables() {
        this.updatePopularityTable();
        this.updateActiveStudentsTable();
    }

    updatePopularityTable() {
        const tbody = document.getElementById('popularityTableBody');
        const filteredData = this.getFilteredData();
        
        const eventStats = filteredData.events.map(event => {
            const registrations = filteredData.registrations.filter(r => r.event_id === event.id);
            const attendance = filteredData.attendance.filter(a => a.event_id === event.id && a.status === 'present');
            const feedback = filteredData.feedback.filter(f => f.event_id === event.id);
            const avgRating = feedback.length > 0 ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length : 0;
            const attendanceRate = registrations.length > 0 ? (attendance.length / registrations.length) * 100 : 0;
            
            return {
                ...event,
                registrationCount: registrations.length,
                attendanceRate: attendanceRate,
                avgRating: avgRating
            };
        }).sort((a, b) => b.registrationCount - a.registrationCount).slice(0, 10);
        
        tbody.innerHTML = eventStats.map((event, index) => `
            <tr>
                <td>
                    <span class="rank-badge rank-${index < 3 ? index + 1 : 'other'}">
                        ${index + 1}
                    </span>
                </td>
                <td>
                    <div>
                        <strong>${this.truncateText(event.title, 30)}</strong>
                        <br>
                        <small class="text-muted">${new Date(event.date).toLocaleDateString()}</small>
                    </div>
                </td>
                <td>
                    <span class="badge bg-secondary">${event.type}</span>
                </td>
                <td>
                    <strong>${event.registrationCount}</strong>
                    <div class="progress progress-sm mt-1">
                        <div class="progress-bar" style="width: ${(event.registrationCount / event.capacity) * 100}%"></div>
                    </div>
                </td>
                <td>
                    <span class="${event.attendanceRate >= 80 ? 'text-success' : event.attendanceRate >= 60 ? 'text-warning' : 'text-danger'} fw-bold">
                        ${event.attendanceRate.toFixed(0)}%
                    </span>
                </td>
                <td>
                    <div class="rating-stars">
                        ${this.renderStars(event.avgRating)}
                        <small class="text-muted">(${event.avgRating.toFixed(1)})</small>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updateActiveStudentsTable() {
        const tbody = document.getElementById('studentsTableBody');
        const filteredData = this.getFilteredData();
        
        const studentStats = this.data.students.map(student => {
            const studentRegistrations = filteredData.registrations.filter(r => r.student_id === student.id);
            const studentAttendance = filteredData.attendance.filter(a => a.student_id === student.id && a.status === 'present');
            const attendanceRate = studentRegistrations.length > 0 ? (studentAttendance.length / studentRegistrations.length) * 100 : 0;
            
            // Calculate engagement score
            const score = (studentRegistrations.length * 10) + (studentAttendance.length * 15) + (attendanceRate * 0.5);
            
            const college = this.data.colleges.find(c => c.id === student.college_id);
            
            return {
                ...student,
                eventCount: studentRegistrations.length,
                attendanceCount: studentAttendance.length,
                attendanceRate: attendanceRate,
                score: score,
                collegeName: college ? college.name : 'Unknown'
            };
        }).sort((a, b) => b.score - a.score).slice(0, 10);
        
        tbody.innerHTML = studentStats.map((student, index) => `
            <tr>
                <td>
                    <span class="rank-badge rank-${index < 3 ? index + 1 : 'other'}">
                        ${index + 1}
                    </span>
                </td>
                <td>
                    <div>
                        <strong>${student.name}</strong>
                        <br>
                        <small class="text-muted">${student.student_id}</small>
                    </div>
                </td>
                <td>
                    <small>${this.truncateText(student.collegeName, 20)}</small>
                </td>
                <td>
                    <span class="badge bg-primary">${student.eventCount}</span>
                </td>
                <td>
                    <span class="badge bg-success">${student.attendanceCount}</span>
                    <small class="text-muted d-block">${student.attendanceRate.toFixed(0)}%</small>
                </td>
                <td>
                    <strong class="text-primary">${Math.round(student.score)}</strong>
                </td>
            </tr>
        `).join('');
    }

    updateParticipationTrends() {
        this.renderParticipationTrendsChart();
    }

    updateFeedbackAnalysis() {
        this.renderFeedbackAnalysisChart();
    }

    updateRatingDistribution() {
        const container = document.getElementById('ratingDistribution');
        const filteredData = this.getFilteredData();
        
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        filteredData.feedback.forEach(f => {
            ratingCounts[f.rating] = (ratingCounts[f.rating] || 0) + 1;
        });
        
        const total = Object.values(ratingCounts).reduce((sum, count) => sum + count, 0);
        
        const ratingHtml = [5, 4, 3, 2, 1].map(rating => {
            const count = ratingCounts[rating] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            
            return `
                <div class="rating-item">
                    <div class="rating-label">
                        <div class="rating-stars">
                            ${this.renderStars(rating)}
                        </div>
                        <span>${rating}</span>
                    </div>
                    <div class="rating-bar">
                        <div class="rating-fill rating-${rating}" style="width: ${percentage}%">
                            ${percentage > 15 ? `${count}` : ''}
                        </div>
                    </div>
                    <div class="rating-count">${count}</div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = ratingHtml;
    }

    getFilteredData() {
        const filters = this.currentFilters;
        
        let filteredEvents = this.data.events;
        let filteredRegistrations = this.data.registrations;
        let filteredAttendance = this.data.attendance;
        let filteredFeedback = this.data.feedback;
        
        // Filter by date
        if (filters.dateFrom || filters.dateTo) {
            const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : new Date('1900-01-01');
            const toDate = filters.dateTo ? new Date(filters.dateTo) : new Date('2100-12-31');
            
            filteredEvents = filteredEvents.filter(event => {
                const eventDate = new Date(event.date);
                return eventDate >= fromDate && eventDate <= toDate;
            });
            
            const eventIds = new Set(filteredEvents.map(e => e.id));
            filteredRegistrations = filteredRegistrations.filter(r => eventIds.has(r.event_id));
            filteredAttendance = filteredAttendance.filter(a => eventIds.has(a.event_id));
            filteredFeedback = filteredFeedback.filter(f => eventIds.has(f.event_id));
        }
        
        // Filter by event type
        if (filters.eventType) {
            filteredEvents = filteredEvents.filter(event => event.type === filters.eventType);
            
            const eventIds = new Set(filteredEvents.map(e => e.id));
            filteredRegistrations = filteredRegistrations.filter(r => eventIds.has(r.event_id));
            filteredAttendance = filteredAttendance.filter(a => eventIds.has(a.event_id));
            filteredFeedback = filteredFeedback.filter(f => eventIds.has(f.event_id));
        }
        
        // Filter by college
        if (filters.college) {
            const collegeStudents = this.data.students.filter(s => s.college_id == filters.college);
            const studentIds = new Set(collegeStudents.map(s => s.id));
            
            filteredRegistrations = filteredRegistrations.filter(r => studentIds.has(r.student_id));
            filteredAttendance = filteredAttendance.filter(a => studentIds.has(a.student_id));
            filteredFeedback = filteredFeedback.filter(f => studentIds.has(f.student_id));
        }
        
        return {
            events: filteredEvents,
            registrations: filteredRegistrations,
            attendance: filteredAttendance,
            feedback: filteredFeedback
        };
    }

    calculateAverageRating(feedbackList) {
        if (feedbackList.length === 0) return 0;
        const sum = feedbackList.reduce((total, feedback) => total + feedback.rating, 0);
        return sum / feedbackList.length;
    }

    setChartView(chartType, view, button) {
        // Update button states
        const parentControls = button.parentElement;
        parentControls.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Re-render the specific chart
        if (chartType === 'popularity') {
            this.renderEventPopularityChart();
        }
    }

    showExportModal(format) {
        document.getElementById('exportFormat').value = format;
        new bootstrap.Modal(document.getElementById('exportModal')).show();
    }

    exportReport() {
        const format = document.getElementById('exportFormat').value;
        const includeCharts = document.getElementById('includeCharts').checked;
        const includeTables = document.getElementById('includeTables').checked;
        const includeStats = document.getElementById('includeStats').checked;
        
        // In a real application, this would generate and download the actual file
        this.showAlert(`Export functionality would generate a ${format.toUpperCase()} report with selected sections.`, 'info');
        
        bootstrap.Modal.getInstance(document.getElementById('exportModal')).hide();
    }

    renderStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
        
        let starsHtml = '';
        
        for (let i = 0; i < fullStars; i++) {
            starsHtml += '<i class="fas fa-star"></i>';
        }
        
        if (halfStar) {
            starsHtml += '<i class="fas fa-star-half-alt"></i>';
        }
        
        for (let i = 0; i < emptyStars; i++) {
            starsHtml += '<i class="far fa-star"></i>';
        }
        
        return starsHtml;
    }

    truncateText(text, length) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    updateReportGeneratedTime() {
        document.getElementById('reportGeneratedTime').textContent = new Date().toLocaleString();
    }

    showLoadingState(show) {
        const elements = document.querySelectorAll('.chart-card, .table-card');
        
        elements.forEach(element => {
            let overlay = element.querySelector('.loading-overlay');
            
            if (show && !overlay) {
                overlay = document.createElement('div');
                overlay.className = 'loading-overlay';
                overlay.innerHTML = `
                    <div class="loading-spinner">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <div class="text-muted">Loading data...</div>
                    </div>
                `;
                element.appendChild(overlay);
            } else if (!show && overlay) {
                overlay.remove();
            }
        });
    }

    showAlert(message, type = 'info') {
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
        
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }
}

// Initialize the reports dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ReportsDashboard();
});
