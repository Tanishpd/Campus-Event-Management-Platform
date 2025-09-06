const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authModule = require('./auth');
const { authenticateToken } = authModule;

// Get all attendance records with filters
router.get('/', authenticateToken, (req, res) => {
    const { event_id, student_id, limit = 50, offset = 0 } = req.query;
    
    let query = `
        SELECT a.*, e.title as event_title, e.start_datetime, e.event_type,
               s.full_name as student_name, s.email as student_email, s.student_id as student_id_number,
               au.full_name as marked_by_name
        FROM attendance a
        JOIN events e ON a.event_id = e.id
        JOIN students s ON a.student_id = s.id
        LEFT JOIN admin_users au ON a.marked_by = au.id
        WHERE e.college_id = ?
    `;
    const params = [req.user.collegeId];
    
    if (event_id) {
        query += ' AND a.event_id = ?';
        params.push(event_id);
    }
    
    if (student_id) {
        query += ' AND a.student_id = ?';
        params.push(student_id);
    }
    
    query += ' ORDER BY a.check_in_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.getDb().all(query, params, (err, attendance) => {
        if (err) {
            console.error('Get attendance error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(attendance);
    });
});

// Mark attendance (check-in)
router.post('/checkin', authenticateToken, (req, res) => {
    const { eventId, studentId, notes } = req.body;
    
    if (!eventId || !studentId) {
        return res.status(400).json({ message: 'Event ID and Student ID are required' });
    }
    
    // Check if student is registered for the event
    const registrationQuery = `
        SELECT er.* FROM event_registrations er
        JOIN events e ON er.event_id = e.id
        WHERE er.event_id = ? AND er.student_id = ? AND e.college_id = ? AND er.status = 'registered'
    `;
    
    db.getDb().get(registrationQuery, [eventId, studentId, req.user.collegeId], (err, registration) => {
        if (err) {
            console.error('Check registration error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!registration) {
            return res.status(404).json({ message: 'Student not registered for this event' });
        }
        
        // Mark attendance
        const insertQuery = `
            INSERT INTO attendance (event_id, student_id, marked_by, notes)
            VALUES (?, ?, ?, ?)
        `;
        
        db.getDb().run(insertQuery, [eventId, studentId, req.user.userId, notes], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Attendance already marked for this student' });
                }
                console.error('Mark attendance error:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            
            // Update registration status to 'attended'
            const updateQuery = 'UPDATE event_registrations SET status = "attended" WHERE event_id = ? AND student_id = ?';
            db.getDb().run(updateQuery, [eventId, studentId], (updateErr) => {
                if (updateErr) {
                    console.error('Update registration status error:', updateErr);
                }
            });
            
            res.status(201).json({
                message: 'Attendance marked successfully',
                attendanceId: this.lastID
            });
        });
    });
});

// Mark check-out time
router.put('/:id/checkout', authenticateToken, (req, res) => {
    const { notes } = req.body;
    
    const query = `
        UPDATE attendance 
        SET check_out_time = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
        WHERE id = ? AND event_id IN (
            SELECT id FROM events WHERE college_id = ?
        )
    `;
    
    db.getDb().run(query, [notes, req.params.id, req.user.collegeId], function(err) {
        if (err) {
            console.error('Mark checkout error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Attendance record not found or unauthorized' });
        }
        
        res.json({ message: 'Check-out time updated successfully' });
    });
});

// Get attendance for specific event
router.get('/event/:eventId', authenticateToken, (req, res) => {
    const query = `
        SELECT a.*, s.full_name as student_name, s.email as student_email, 
               s.student_id as student_id_number, s.department, s.year,
               au.full_name as marked_by_name
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        JOIN events e ON a.event_id = e.id
        LEFT JOIN admin_users au ON a.marked_by = au.id
        WHERE a.event_id = ? AND e.college_id = ?
        ORDER BY a.check_in_time DESC
    `;
    
    db.getDb().all(query, [req.params.eventId, req.user.collegeId], (err, attendance) => {
        if (err) {
            console.error('Get event attendance error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(attendance);
    });
});

// Get attendance summary for an event
router.get('/event/:eventId/summary', authenticateToken, (req, res) => {
    const queries = {
        total_registered: `
            SELECT COUNT(*) as count FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            WHERE er.event_id = ? AND e.college_id = ? AND er.status IN ('registered', 'attended')
        `,
        total_attended: `
            SELECT COUNT(*) as count FROM attendance a
            JOIN events e ON a.event_id = e.id
            WHERE a.event_id = ? AND e.college_id = ?
        `,
        attendance_by_department: `
            SELECT s.department, COUNT(*) as count FROM attendance a
            JOIN students s ON a.student_id = s.id
            JOIN events e ON a.event_id = e.id
            WHERE a.event_id = ? AND e.college_id = ?
            GROUP BY s.department
            ORDER BY count DESC
        `,
        attendance_by_year: `
            SELECT s.year, COUNT(*) as count FROM attendance a
            JOIN students s ON a.student_id = s.id
            JOIN events e ON a.event_id = e.id
            WHERE a.event_id = ? AND e.college_id = ?
            GROUP BY s.year
            ORDER BY s.year
        `
    };
    
    const summary = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;
    
    Object.entries(queries).forEach(([key, query]) => {
        db.getDb()[key.includes('by_') ? 'all' : 'get'](query, [req.params.eventId, req.user.collegeId], (err, result) => {
            if (err) {
                console.error(`Summary query error (${key}):`, err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            
            if (key.includes('by_')) {
                summary[key] = result;
            } else {
                summary[key] = result.count;
            }
            
            completed++;
            
            if (completed === totalQueries) {
                // Calculate attendance percentage
                summary.attendance_percentage = summary.total_registered > 0 
                    ? Math.round((summary.total_attended / summary.total_registered) * 100)
                    : 0;
                
                res.json(summary);
            }
        });
    });
});

// Bulk check-in for multiple students
router.post('/bulk-checkin', authenticateToken, (req, res) => {
    const { eventId, studentIds, notes } = req.body;
    
    if (!eventId || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ message: 'Event ID and student IDs array are required' });
    }
    
    // Check if event exists and belongs to the same college
    const eventQuery = 'SELECT * FROM events WHERE id = ? AND college_id = ?';
    
    db.getDb().get(eventQuery, [eventId, req.user.collegeId], (err, event) => {
        if (err) {
            console.error('Event check error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        // Bulk mark attendance
        const insertQuery = 'INSERT OR IGNORE INTO attendance (event_id, student_id, marked_by, notes) VALUES (?, ?, ?, ?)';
        const updateQuery = 'UPDATE event_registrations SET status = "attended" WHERE event_id = ? AND student_id = ? AND status = "registered"';
        
        let completed = 0;
        let successful = 0;
        
        studentIds.forEach(studentId => {
            db.getDb().run(insertQuery, [eventId, studentId, req.user.userId, notes], function(err) {
                if (!err && this.changes > 0) {
                    successful++;
                    // Update registration status
                    db.getDb().run(updateQuery, [eventId, studentId]);
                }
                
                completed++;
                
                if (completed === studentIds.length) {
                    res.json({
                        message: `Bulk check-in completed. ${successful} students marked present.`,
                        successful,
                        total: studentIds.length
                    });
                }
            });
        });
    });
});

// Update attendance notes
router.put('/:id', authenticateToken, (req, res) => {
    const { notes } = req.body;
    
    const query = `
        UPDATE attendance 
        SET notes = ?
        WHERE id = ? AND event_id IN (
            SELECT id FROM events WHERE college_id = ?
        )
    `;
    
    db.getDb().run(query, [notes, req.params.id, req.user.collegeId], function(err) {
        if (err) {
            console.error('Update attendance error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Attendance record not found or unauthorized' });
        }
        
        res.json({ message: 'Attendance updated successfully' });
    });
});

module.exports = router;
