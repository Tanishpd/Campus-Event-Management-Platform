const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dbDir, 'campus_events.db');

class Database {
    constructor() {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('📁 Connected to SQLite database at:', dbPath);
                this.initializeTables();
            }
        });
    }

    initializeTables() {
        const queries = [
            // Colleges table
            `CREATE TABLE IF NOT EXISTS colleges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) UNIQUE NOT NULL,
                address TEXT,
                contact_email VARCHAR(255),
                phone VARCHAR(20),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Admin users table
            `CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                college_id INTEGER NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'admin',
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (college_id) REFERENCES colleges (id)
            )`,

            // Students table
            `CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                college_id INTEGER NOT NULL,
                student_id VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                department VARCHAR(100),
                year INTEGER,
                password_hash VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(college_id, student_id),
                UNIQUE(college_id, email),
                FOREIGN KEY (college_id) REFERENCES colleges (id)
            )`,

            // Events table
            `CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                college_id INTEGER NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('Workshop', 'Hackathon', 'Tech Talk', 'Fest', 'Seminar', 'Competition', 'Other')),
                start_datetime DATETIME NOT NULL,
                end_datetime DATETIME NOT NULL,
                location VARCHAR(255),
                max_participants INTEGER DEFAULT 100,
                registration_deadline DATETIME,
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (college_id) REFERENCES colleges (id),
                FOREIGN KEY (created_by) REFERENCES admin_users (id)
            )`,

            // Event registrations table
            `CREATE TABLE IF NOT EXISTS event_registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled', 'attended')),
                notes TEXT,
                UNIQUE(event_id, student_id),
                FOREIGN KEY (event_id) REFERENCES events (id),
                FOREIGN KEY (student_id) REFERENCES students (id)
            )`,

            // Attendance table
            `CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                check_out_time DATETIME,
                marked_by INTEGER,
                notes TEXT,
                UNIQUE(event_id, student_id),
                FOREIGN KEY (event_id) REFERENCES events (id),
                FOREIGN KEY (student_id) REFERENCES students (id),
                FOREIGN KEY (marked_by) REFERENCES admin_users (id)
            )`,

            // Feedback table
            `CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comments TEXT,
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(event_id, student_id),
                FOREIGN KEY (event_id) REFERENCES events (id),
                FOREIGN KEY (student_id) REFERENCES students (id)
            )`
        ];

        queries.forEach(query => {
            this.db.run(query, (err) => {
                if (err) {
                    console.error('Error creating table:', err.message);
                } else {
                    // Extract table name from query for logging
                    const match = query.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
                    if (match) {
                        console.log(`✅ Table '${match[1]}' initialized`);
                    }
                }
            });
        });

        // Create performance indexes for scale (50 colleges × 500 students × 20 events)
        this.createPerformanceIndexes();

        // Insert sample data after table creation
        setTimeout(() => this.insertSampleData(), 1000);
    }

    createPerformanceIndexes() {
        const indexQueries = [
            // College-based data isolation indexes (most critical for performance)
            "CREATE INDEX IF NOT EXISTS idx_events_college_date ON events(college_id, start_datetime)",
            "CREATE INDEX IF NOT EXISTS idx_students_college ON students(college_id)",
            "CREATE INDEX IF NOT EXISTS idx_registrations_college ON event_registrations(event_id, student_id)",
            
            // Event-specific performance indexes
            "CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type, start_datetime)",
            "CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active, college_id)",
            "CREATE INDEX IF NOT EXISTS idx_events_registration_deadline ON events(registration_deadline)",
            
            // Registration performance indexes
            "CREATE INDEX IF NOT EXISTS idx_registrations_student ON event_registrations(student_id)",
            "CREATE INDEX IF NOT EXISTS idx_registrations_status ON event_registrations(status, registration_date)",
            
            // Attendance tracking indexes
            "CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance(event_id, check_in_time)",
            "CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id, check_in_time)",
            
            // Feedback analysis indexes
            "CREATE INDEX IF NOT EXISTS idx_feedback_event_rating ON feedback(event_id, rating)",
            "CREATE INDEX IF NOT EXISTS idx_feedback_student ON feedback(student_id, submitted_at)",
            
            // Admin user access indexes
            "CREATE INDEX IF NOT EXISTS idx_admin_college ON admin_users(college_id, is_active)",
            "CREATE INDEX IF NOT EXISTS idx_admin_username ON admin_users(username)",
            
            // Cross-college analytics indexes (for platform-wide reports)
            "CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at)",
            
            // Composite indexes for common query patterns
            "CREATE INDEX IF NOT EXISTS idx_events_college_type_date ON events(college_id, event_type, start_datetime)",
            "CREATE INDEX IF NOT EXISTS idx_registrations_event_status ON event_registrations(event_id, status, registration_date)"
        ];

        indexQueries.forEach(query => {
            this.db.run(query, (err) => {
                if (err) {
                    console.error('Error creating index:', err.message);
                }
            });
        });

        console.log('🚀 Performance indexes created for scale (50 colleges × 500 students × 20 events)');
    }

    insertSampleData() {
        // Check if sample data already exists
        this.db.get("SELECT COUNT(*) as count FROM colleges", (err, row) => {
            if (err) {
                console.error('Error checking sample data:', err.message);
                return;
            }
            
            if (row.count === 0) {
                console.log('🌱 Inserting sample data...');
                this.insertInitialData();
            } else {
                console.log('📊 Sample data already exists, skipping insertion');
            }
        });
    }

    insertInitialData() {
        const sampleQueries = [
            // Sample colleges
            "INSERT INTO colleges (name, code, address, contact_email, phone) VALUES ('Indian Institute of Technology', 'IIT-DEL', 'New Delhi, India', 'admin@iitd.ac.in', '+91-11-2659-1234')",
            "INSERT INTO colleges (name, code, address, contact_email, phone) VALUES ('National Institute of Technology', 'NIT-KAR', 'Karnataka, India', 'admin@nitk.ac.in', '+91-824-247-3456')",
            "INSERT INTO colleges (name, code, address, contact_email, phone) VALUES ('Indian Institute of Science', 'IISC-BLR', 'Bangalore, India', 'admin@iisc.ac.in', '+91-80-2293-2001')",

            // Sample admin users (password: 'admin123' - hashed)
            "INSERT INTO admin_users (college_id, username, email, password_hash, full_name, role) VALUES (1, 'admin_iit', 'admin@iitd.ac.in', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'IIT Admin', 'admin')",
            "INSERT INTO admin_users (college_id, username, email, password_hash, full_name, role) VALUES (2, 'admin_nit', 'admin@nitk.ac.in', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'NIT Admin', 'admin')",

            // Sample students
            "INSERT INTO students (college_id, student_id, email, full_name, phone, department, year) VALUES (1, 'CS2021001', 'student1@iitd.ac.in', 'Rahul Kumar', '+91-9876543210', 'Computer Science', 3)",
            "INSERT INTO students (college_id, student_id, email, full_name, phone, department, year) VALUES (1, 'CS2021002', 'student2@iitd.ac.in', 'Priya Singh', '+91-9876543211', 'Computer Science', 2)",
            "INSERT INTO students (college_id, student_id, email, full_name, phone, department, year) VALUES (2, 'EC2020001', 'student3@nitk.ac.in', 'Arjun Patel', '+91-9876543212', 'Electronics', 4)",
            "INSERT INTO students (college_id, student_id, email, full_name, phone, department, year) VALUES (2, 'ME2021001', 'student4@nitk.ac.in', 'Sneha Sharma', '+91-9876543213', 'Mechanical', 2)",

            // Sample events
            `INSERT INTO events (college_id, title, description, event_type, start_datetime, end_datetime, location, max_participants, registration_deadline, created_by) VALUES 
            (1, 'Web Development Workshop', 'Learn modern web development with React and Node.js', 'Workshop', '2025-09-15 09:00:00', '2025-09-15 17:00:00', 'Lab 101', 50, '2025-09-13 23:59:59', 1)`,

            `INSERT INTO events (college_id, title, description, event_type, start_datetime, end_datetime, location, max_participants, registration_deadline, created_by) VALUES 
            (1, 'AI/ML Tech Talk', 'Industry experts discuss latest trends in AI and Machine Learning', 'Tech Talk', '2025-09-20 14:00:00', '2025-09-20 16:00:00', 'Auditorium', 200, '2025-09-18 23:59:59', 1)`,

            `INSERT INTO events (college_id, title, description, event_type, start_datetime, end_datetime, location, max_participants, registration_deadline, created_by) VALUES 
            (2, 'Hackathon 2025', '48-hour coding competition with exciting prizes', 'Hackathon', '2025-09-25 18:00:00', '2025-09-27 18:00:00', 'Innovation Center', 100, '2025-09-20 23:59:59', 2)`,

            // Sample registrations
            "INSERT INTO event_registrations (event_id, student_id, status) VALUES (1, 1, 'registered')",
            "INSERT INTO event_registrations (event_id, student_id, status) VALUES (1, 2, 'registered')",
            "INSERT INTO event_registrations (event_id, student_id, status) VALUES (2, 1, 'registered')",
            "INSERT INTO event_registrations (event_id, student_id, status) VALUES (3, 3, 'registered')",
            "INSERT INTO event_registrations (event_id, student_id, status) VALUES (3, 4, 'registered')",

            // Sample attendance
            "INSERT INTO attendance (event_id, student_id, marked_by) VALUES (1, 1, 1)",
            "INSERT INTO attendance (event_id, student_id, marked_by) VALUES (1, 2, 1)",

            // Sample feedback
            "INSERT INTO feedback (event_id, student_id, rating, comments) VALUES (1, 1, 5, 'Excellent workshop! Learned a lot about React.')",
            "INSERT INTO feedback (event_id, student_id, rating, comments) VALUES (1, 2, 4, 'Good content but could use more hands-on examples.')"
        ];

        sampleQueries.forEach(query => {
            this.db.run(query, (err) => {
                if (err && !err.message.includes('UNIQUE constraint failed')) {
                    console.error('Error inserting sample data:', err.message);
                }
            });
        });

        console.log('✅ Sample data insertion completed');
    }

    getDb() {
        return this.db;
    }

    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
}

module.exports = new Database();
