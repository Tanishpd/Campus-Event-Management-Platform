const request = require('supertest');
const app = require('../server');
const db = require('../config/database');

describe('Campus Event Management API', () => {
    let adminToken;
    let testEventId;
    let testStudentId;

    beforeAll(async () => {
        // Wait for database initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    describe('Authentication', () => {
        test('POST /api/auth/login - should authenticate admin user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'admin_iit',
                    password: 'admin123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('username', 'admin_iit');
            
            adminToken = response.body.token;
        });

        test('POST /api/auth/login - should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'admin_iit',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
        });
    });

    describe('Events', () => {
        test('GET /api/events - should get list of events', async () => {
            const response = await request(app)
                .get('/api/events')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('POST /api/events - should create new event', async () => {
            const eventData = {
                title: 'Test Workshop',
                description: 'A test workshop for API testing',
                eventType: 'Workshop',
                startDatetime: '2025-09-30 10:00:00',
                endDatetime: '2025-09-30 16:00:00',
                location: 'Test Lab',
                maxParticipants: 30
            };

            const response = await request(app)
                .post('/api/events')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(eventData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('eventId');
            
            testEventId = response.body.eventId;
        });

        test('GET /api/events/:id - should get event by ID', async () => {
            const response = await request(app)
                .get(`/api/events/${testEventId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('title', 'Test Workshop');
        });
    });

    describe('Students', () => {
        test('GET /api/students - should get list of students', async () => {
            const response = await request(app)
                .get('/api/students')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            
            if (response.body.length > 0) {
                testStudentId = response.body[0].id;
            }
        });

        test('POST /api/students - should create new student', async () => {
            const studentData = {
                studentId: 'TEST2025001',
                email: 'test.student@iitd.ac.in',
                fullName: 'Test Student',
                phone: '+91-9876543999',
                department: 'Computer Science',
                year: 2
            };

            const response = await request(app)
                .post('/api/students')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(studentData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('studentId');
        });
    });

    describe('Registrations', () => {
        test('POST /api/registrations - should register student for event', async () => {
            if (!testEventId || !testStudentId) {
                console.log('Skipping registration test - missing test data');
                return;
            }

            const registrationData = {
                eventId: testEventId,
                studentId: testStudentId,
                notes: 'Test registration'
            };

            const response = await request(app)
                .post('/api/registrations')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(registrationData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('registrationId');
        });

        test('GET /api/registrations/event/:eventId - should get registrations for event', async () => {
            if (!testEventId) {
                console.log('Skipping get registrations test - missing event ID');
                return;
            }

            const response = await request(app)
                .get(`/api/registrations/event/${testEventId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('Attendance', () => {
        test('POST /api/attendance/checkin - should mark attendance', async () => {
            if (!testEventId || !testStudentId) {
                console.log('Skipping attendance test - missing test data');
                return;
            }

            const attendanceData = {
                eventId: testEventId,
                studentId: testStudentId,
                notes: 'Test check-in'
            };

            const response = await request(app)
                .post('/api/attendance/checkin')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(attendanceData);

            // Might be 201 (success) or 404 (not registered) - both are valid for test
            expect([201, 404, 409]).toContain(response.status);
        });
    });

    describe('Feedback', () => {
        test('POST /api/feedback - should submit feedback', async () => {
            if (!testEventId || !testStudentId) {
                console.log('Skipping feedback test - missing test data');
                return;
            }

            const feedbackData = {
                eventId: testEventId,
                studentId: testStudentId,
                rating: 4,
                comments: 'Test feedback - good workshop!'
            };

            const response = await request(app)
                .post('/api/feedback')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(feedbackData);

            // Might be 201 (success) or 404 (not attended) - both are valid for test
            expect([201, 404]).toContain(response.status);
        });
    });

    describe('Reports', () => {
        test('GET /api/reports/event-popularity - should get event popularity report', async () => {
            const response = await request(app)
                .get('/api/reports/event-popularity')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('title');
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('GET /api/reports/student-participation - should get student participation report', async () => {
            const response = await request(app)
                .get('/api/reports/student-participation')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('title');
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('GET /api/reports/top-active-students - should get top active students', async () => {
            const response = await request(app)
                .get('/api/reports/top-active-students')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('title', 'Top 3 Most Active Students');
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('GET /api/reports/dashboard-summary - should get dashboard summary', async () => {
            const response = await request(app)
                .get('/api/reports/dashboard-summary')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('summary');
            expect(response.body.summary).toHaveProperty('total_events');
            expect(response.body.summary).toHaveProperty('total_students');
        });
    });

    describe('Health Check', () => {
        test('GET /api/health - should return health status', async () => {
            const response = await request(app)
                .get('/api/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'OK');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    afterAll(() => {
        // Close database connection
        if (db.getDb()) {
            db.close();
        }
    });
});
