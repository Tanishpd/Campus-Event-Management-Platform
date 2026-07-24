const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Fail fast rather than booting with a signing key that is published in this
// repository. A server that starts with a known secret issues forgeable tokens.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set it.');
}
const db = require('../config/database');

// Login endpoint
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const query = `
        SELECT au.*, c.name as college_name, c.code as college_code 
        FROM admin_users au
        JOIN colleges c ON au.college_id = c.id
        WHERE au.username = ? AND au.is_active = 1
    `;

    db.getDb().get(query, [username], (err, user) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign(
            { 
                userId: user.id,
                collegeId: user.college_id,
                username: user.username,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                college: {
                    id: user.college_id,
                    name: user.college_name,
                    code: user.college_code
                }
            }
        });
    });
});

// Register endpoint (for demo purposes)
router.post('/register', (req, res) => {
    const { username, email, password, fullName, collegeId } = req.body;

    if (!username || !email || !password || !fullName || !collegeId) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);

    const query = `
        INSERT INTO admin_users (college_id, username, email, password_hash, full_name)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.getDb().run(query, [collegeId, username, email, passwordHash, fullName], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ message: 'Username or email already exists' });
            }
            console.error('Registration error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        res.status(201).json({
            message: 'Registration successful',
            userId: this.lastID
        });
    });
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Get current user info
router.get('/me', authenticateToken, (req, res) => {
    const query = `
        SELECT au.*, c.name as college_name, c.code as college_code 
        FROM admin_users au
        JOIN colleges c ON au.college_id = c.id
        WHERE au.id = ?
    `;

    db.getDb().get(query, [req.user.userId], (err, user) => {
        if (err) {
            console.error('Get user error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            college: {
                id: user.college_id,
                name: user.college_name,
                code: user.college_code
            }
        });
    });
});

// Student Registration endpoint
router.post('/student-register', (req, res) => {
    const { full_name, email, student_id, phone, college_id, department, year, password } = req.body;

    if (!full_name || !email || !student_id || !college_id || !password) {
        return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Check if student already exists
    const checkQuery = 'SELECT * FROM students WHERE email = ? OR student_id = ?';
    db.getDb().get(checkQuery, [email, student_id], (err, existingStudent) => {
        if (err) {
            console.error('Check student error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (existingStudent) {
            return res.status(400).json({ message: 'Student with this email or ID already exists' });
        }

        // Hash password
        const password_hash = bcrypt.hashSync(password, 10);

        // Insert new student
        const insertQuery = `
            INSERT INTO students (college_id, student_id, email, full_name, phone, department, year, password_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.getDb().run(insertQuery, [college_id, student_id, email, full_name, phone, department, year, password_hash], function(err) {
            if (err) {
                console.error('Student registration error:', err);
                return res.status(500).json({ message: 'Registration failed' });
            }

            // Get the created student with college info
            const studentQuery = `
                SELECT s.*, c.name as college_name, c.code as college_code
                FROM students s
                JOIN colleges c ON s.college_id = c.id
                WHERE s.id = ?
            `;

            db.getDb().get(studentQuery, [this.lastID], (err, student) => {
                if (err) {
                    console.error('Get student error:', err);
                    return res.status(500).json({ message: 'Registration completed but login failed' });
                }

                // Create JWT token
                const token = jwt.sign(
                    { 
                        userId: student.id,
                        collegeId: student.college_id,
                        email: student.email,
                        role: 'student'
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                res.status(201).json({
                    message: 'Student registered successfully',
                    token: token,
                    user: {
                        id: student.id,
                        student_id: student.student_id,
                        email: student.email,
                        full_name: student.full_name,
                        phone: student.phone,
                        department: student.department,
                        year: student.year,
                        college_id: student.college_id,
                        college_name: student.college_name,
                        college_code: student.college_code,
                        created_at: student.created_at
                    }
                });
            });
        });
    });
});

// Student Login endpoint
router.post('/student-login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const query = `
        SELECT s.*, c.name as college_name, c.code as college_code 
        FROM students s
        JOIN colleges c ON s.college_id = c.id
        WHERE s.email = ?
    `;

    db.getDb().get(query, [email], (err, student) => {
        if (err) {
            console.error('Student login error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (!student) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const validPassword = bcrypt.compareSync(password, student.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign(
            { 
                userId: student.id,
                collegeId: student.college_id,
                email: student.email,
                role: 'student'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token: token,
            user: {
                id: student.id,
                student_id: student.student_id,
                email: student.email,
                full_name: student.full_name,
                phone: student.phone,
                department: student.department,
                year: student.year,
                college_id: student.college_id,
                college_name: student.college_name,
                college_code: student.college_code,
                created_at: student.created_at
            }
        });
    });
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
