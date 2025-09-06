const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authModule = require('./auth');
const { authenticateToken } = authModule;

// Get student count (public endpoint)
router.get('/count', (req, res) => {
    const query = 'SELECT COUNT(*) as count FROM students';
    
    db.getDb().get(query, [], (err, result) => {
        if (err) {
            console.error('Get students count error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json({ count: result.count });
    });
});

// Get all students (admin only, filtered by college)
router.get('/', authenticateToken, (req, res) => {
    const { limit = 50, offset = 0, department, year, search } = req.query;
    
    let query = `
        SELECT s.*, 
               (SELECT COUNT(*) FROM event_registrations er 
                JOIN events e ON er.event_id = e.id 
                WHERE er.student_id = s.id) as total_registrations,
               (SELECT COUNT(*) FROM attendance a 
                JOIN events e ON a.event_id = e.id 
                WHERE a.student_id = s.id) as total_attendance
        FROM students s
        WHERE s.college_id = ?
    `;
    const params = [req.user.collegeId];
    
    if (department) {
        query += ' AND s.department = ?';
        params.push(department);
    }
    
    if (year) {
        query += ' AND s.year = ?';
        params.push(year);
    }
    
    if (search) {
        query += ' AND (s.full_name LIKE ? OR s.email LIKE ? OR s.student_id LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }
    
    query += ' ORDER BY s.full_name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.getDb().all(query, params, (err, students) => {
        if (err) {
            console.error('Get students error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(students);
    });
});

// Get single student by ID
router.get('/:id', authenticateToken, (req, res) => {
    const query = `
        SELECT s.*,
               (SELECT COUNT(*) FROM event_registrations er 
                JOIN events e ON er.event_id = e.id 
                WHERE er.student_id = s.id) as total_registrations,
               (SELECT COUNT(*) FROM attendance a 
                JOIN events e ON a.event_id = e.id 
                WHERE a.student_id = s.id) as total_attendance,
               (SELECT AVG(f.rating) FROM feedback f 
                JOIN events e ON f.event_id = e.id 
                WHERE f.student_id = s.id) as average_feedback_given
        FROM students s
        WHERE s.id = ? AND s.college_id = ?
    `;
    
    db.getDb().get(query, [req.params.id, req.user.collegeId], (err, student) => {
        if (err) {
            console.error('Get student error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        
        res.json(student);
    });
});

// Create new student
router.post('/', authenticateToken, (req, res) => {
    const { studentId, email, fullName, phone, department, year } = req.body;
    
    if (!studentId || !email || !fullName) {
        return res.status(400).json({ message: 'Student ID, email, and full name are required' });
    }
    
    const query = `
        INSERT INTO students (college_id, student_id, email, full_name, phone, department, year)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.getDb().run(query, [
        req.user.collegeId, studentId, email, fullName, phone, department, year
    ], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ message: 'Student ID or email already exists' });
            }
            console.error('Create student error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.status(201).json({
            message: 'Student created successfully',
            studentId: this.lastID
        });
    });
});

// Update student
router.put('/:id', authenticateToken, (req, res) => {
    const { email, fullName, phone, department, year } = req.body;
    
    const query = `
        UPDATE students SET
            email = ?, full_name = ?, phone = ?, department = ?, year = ?
        WHERE id = ? AND college_id = ?
    `;
    
    db.getDb().run(query, [
        email, fullName, phone, department, year, req.params.id, req.user.collegeId
    ], function(err) {
        if (err) {
            console.error('Update student error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Student not found or unauthorized' });
        }
        
        res.json({ message: 'Student updated successfully' });
    });
});

// Delete student
router.delete('/:id', authenticateToken, (req, res) => {
    const query = 'DELETE FROM students WHERE id = ? AND college_id = ?';
    
    db.getDb().run(query, [req.params.id, req.user.collegeId], function(err) {
        if (err) {
            console.error('Delete student error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Student not found or unauthorized' });
        }
        
        res.json({ message: 'Student deleted successfully' });
    });
});

// Get student's event history
router.get('/:id/events', authenticateToken, (req, res) => {
    const query = `
        SELECT e.*, er.registration_date, er.status as registration_status,
               a.check_in_time, a.check_out_time,
               f.rating, f.comments as feedback_comments
        FROM events e
        JOIN event_registrations er ON e.id = er.event_id
        LEFT JOIN attendance a ON e.id = a.event_id AND a.student_id = er.student_id
        LEFT JOIN feedback f ON e.id = f.event_id AND f.student_id = er.student_id
        WHERE er.student_id = ? AND e.college_id = ?
        ORDER BY e.start_datetime DESC
    `;
    
    db.getDb().all(query, [req.params.id, req.user.collegeId], (err, events) => {
        if (err) {
            console.error('Get student events error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(events);
    });
});

// Get departments (for filtering)
router.get('/meta/departments', authenticateToken, (req, res) => {
    const query = 'SELECT DISTINCT department FROM students WHERE college_id = ? ORDER BY department';
    
    db.getDb().all(query, [req.user.collegeId], (err, departments) => {
        if (err) {
            console.error('Get departments error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        const departmentList = departments.map(d => d.department).filter(d => d);
        res.json(departmentList);
    });
});

module.exports = router;
