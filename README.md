Campus Event Management Platform

A full-stack system designed to streamline event management in multiple colleges. The platform solves the typical problems of planning, monitoring, and assessing campus events with the goal of providing seamless experiences for both administrators and students.

Understanding of the Project

In my opinion, this platform is an essential bridge between organizers and student participants in higher education. It addresses a number of real-world issues:

Scattered Event Details → Consolidates announcements, registrations, and updates into a single accessible location.

Burdensome Attendance Management → Overcomes paper-based methods with electronic check-ins, providing real-time accuracy.

Inability to Analyze Participation → Transforms participation data into actionable analytics for optimizing subsequent events.

Cross-College Scalability → Built to operate across multiple colleges while maintaining data safely isolated.

The overall architecture demonstrates an awareness of academic workflow — balancing administrators' desire for solid reporting against students' affinity for easy, intuitive interactions.

Core Architecture & Design Principles
Backend-First Development

The platform is built around a RESTful API, enabling integration with web applications, mobile clients, and third-party systems. With Express.js, the backend provides a clean, reusable interface.

Database Strategy

The schema is designed for clarity and dependability:

Hierarchical Relations: Colleges → Students → Events retain ownership limits.

Event Flexibility: Employs diverse event types (workshops, hackathons, seminars, etc.).

Total Tracking: Registrations, attendance, and responses are all tracked for analysis.

Data Reliability: Foreign key constraints ensure reliable relationships.

Security & Privacy

Authentication is managed by JWT, which guarantees administrators can only see their college's data while ensuring privacy and compliance.

Key Features
Event Management

Detailed event information (title, description, type, venue, capacity, deadlines).

Automated registration limits with waitlist management.

Several event types to accommodate academic and cultural events.

Student Registration & Engagement

Quick, API-driven registration with student systems.

Electronic attendance check-in/out to ensure accuracy.

Rating + comment feedback forms to gauge event quality.

Reporting & Analytics

Popularity statistics to measure events.

Student engagement reports to track participation.

Departmental breakouts of attendance.

Historically driven predictive insights.

Technical Details

Tech Stack

Backend: Node.js with Express.js

Database: SQLite (development), horizontally scalable to PostgreSQL/MySQL (production)

Authentication: JWT (secure and stateless)

API Design: RESTful endpoints

Testing: Jest + Supertest

Database Schema

Colleges → Admin Users (auth management)
Colleges → Students (student records)
Colleges → Events (event details)
Students + Events → Registrations (participation)
Students + Events → Attendance (presence logs)
Students + Events → Feedback (ratings & comments)

API Endpoints

POST /api/auth/login – Admin authentication

GET/POST /api/events – Manage events

GET/POST /api/students – Manage student data

POST /api/registrations – Register students for events

POST /api/attendance/checkin – Record attendance

POST /api/feedback – Collect feedback

GET /api/reports/* – Generate analytics reports

Installation & Setup

Requirements: Node.js v16+, npm, Git

Steps:
git clone https://github.com/Tanishpd/Campus-Event-Management-Platform
cd Campus-Event-Management-Platform
npm install
npm run dev

Environment Setup:

NODE_ENV=development
PORT=3000
DB_PATH=./database/campus_events.db
CORS_ORIGIN=http://localhost:3001

On first run, the system automatically generates the database with dummy colleges, admins, students, and events.

Testing:

npm test
npm start
curl http://localhost:3000/api/health

Demo Credentials

IIT Delhi → Username: admin_iit | Password: admin123

> **Demo credentials — change before deploying.** These accounts are seeded by
> `config/database.js` for local evaluation only. `JWT_SECRET` must be set in the
> environment; the server refuses to start without it, so it can never boot with a
> signing key published in this repository.


NIT Karnataka → Username: admin_nit | Password: admin123

Example usage:

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_iit","password":"admin123"}'


Development Workflow

npm start → Launch production server

npm run dev → Launch development server

npm test → Run test

npm run build → Build client app

VS Code tasks provide auto-reload, test running, and debugging.

Scaling Considerations

Built for ~50 colleges, ~25k students, ~1k active events at max.

College-based data isolation.

Indexed queries for performance.

Stateless JWT authentication for horizontal scaling.

Modular APIs for optimization in the future.

Production Enhancements:

PostgreSQL/MySQL migration.

Redis for caching.

Load balancers (nginx) for traffic handling.

Monitoring/logging tools for reliability.

Roadmap for Enhancements

Mobile app (React Native).

Reminders through push notifications.

LMS system integrations.

Event recommendation through machine learning.

Social aspects for student networking.

Security & Privacy

Encryption both in transit and at rest.

Role-based access control.

Audit logs for transparency.

Adherence to FERPA/GDPR principles.

Contribution & Support

The platform offers a robust base that can be adapted for various institutions. Its API-based modularity and support for testing facilitate enhancements and maintenance easily.

Author: Tanish PD
Assignment: Webknot Technologies – Campus Drive
Completion Date: September 6, 2025