const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authModule = require('./auth');
const { authenticateToken } = authModule;

// Get all registrations with filters
router.get('/', authenticateToken, (req, res) => {
    const { event_id, student_id, status, limit = 50, offset = 0 } = req.query;
    
    let query = `
        SELECT er.*, e.title as event_title, e.start_datetime, e.event_type,
               s.full_name as student_name, s.email as student_email, s.student_id as student_id_number
        FROM event_registrations er
        JOIN events e ON er.event_id = e.id
        JOIN students s ON er.student_id = s.id
        WHERE e.college_id = ?
    `;
    const params = [req.user.collegeId];
    
    if (event_id) {
        query += ' AND er.event_id = ?';
        params.push(event_id);
    }
    
    if (student_id) {
        query += ' AND er.student_id = ?';
        params.push(student_id);
    }
    
    if (status) {
        query += ' AND er.status = ?';
        params.push(status);
    }
    
    query += ' ORDER BY er.registration_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.getDb().all(query, params, (err, registrations) => {
        if (err) {
            console.error('Get registrations error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(registrations);
    });
});

// Register student for event
router.post('/', authenticateToken, (req, res) => {
    const { eventId, studentId, notes } = req.body;
    
    if (!eventId || !studentId) {
        return res.status(400).json({ message: 'Event ID and Student ID are required' });
    }
    
    // First check if event exists and belongs to the same college
    const eventQuery = 'SELECT * FROM events WHERE id = ? AND college_id = ? AND is_active = 1';
    
    db.getDb().get(eventQuery, [eventId, req.user.collegeId], (err, event) => {
        if (err) {
            console.error('Event check error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        // Check if registration deadline has passed
        if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
            return res.status(400).json({ message: 'Registration deadline has passed' });
        }
        
        // Check if event is full
        const countQuery = 'SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ? AND status = "registered"';
        
        db.getDb().get(countQuery, [eventId], (err, result) => {
            if (err) {
                console.error('Count registrations error:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            
            if (result.count >= event.max_participants) {
                return res.status(400).json({ message: 'Event is full' });
            }
            
            // Check if student exists and belongs to the same college
            const studentQuery = 'SELECT * FROM students WHERE id = ? AND college_id = ?';
            
            db.getDb().get(studentQuery, [studentId, req.user.collegeId], (err, student) => {
                if (err) {
                    console.error('Student check error:', err);
                    return res.status(500).json({ message: 'Internal server error' });
                }
                
                if (!student) {
                    return res.status(404).json({ message: 'Student not found' });
                }
                
                // Register the student
                const insertQuery = `
                    INSERT INTO event_registrations (event_id, student_id, notes)
                    VALUES (?, ?, ?)
                `;
                
                db.getDb().run(insertQuery, [eventId, studentId, notes], function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return res.status(409).json({ message: 'Student already registered for this event' });
                        }
                        console.error('Registration error:', err);
                        return res.status(500).json({ message: 'Internal server error' });
                    }
                    
                    res.status(201).json({
                        message: 'Student registered successfully',
                        registrationId: this.lastID
                    });
                });
            });
        });
    });
});

// Update registration status
router.put('/:id', authenticateToken, (req, res) => {
    const { status, notes } = req.body;
    
    if (!status || !['registered', 'cancelled', 'attended'].includes(status)) {
        return res.status(400).json({ message: 'Valid status is required (registered, cancelled, attended)' });
    }
    
    const query = `
        UPDATE event_registrations 
        SET status = ?, notes = ?
        WHERE id = ? AND event_id IN (
            SELECT id FROM events WHERE college_id = ?
        )
    `;
    
    db.getDb().run(query, [status, notes, req.params.id, req.user.collegeId], function(err) {
        if (err) {
            console.error('Update registration error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Registration not found or unauthorized' });
        }
        
        res.json({ message: 'Registration updated successfully' });
    });
});

// Cancel registration
router.delete('/:id', authenticateToken, (req, res) => {
    const query = `
        UPDATE event_registrations 
        SET status = 'cancelled'
        WHERE id = ? AND event_id IN (
            SELECT id FROM events WHERE college_id = ?
        )
    `;
    
    db.getDb().run(query, [req.params.id, req.user.collegeId], function(err) {
        if (err) {
            console.error('Cancel registration error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Registration not found or unauthorized' });
        }
        
        res.json({ message: 'Registration cancelled successfully' });
    });
});

// Get registrations for specific event
router.get('/event/:eventId', authenticateToken, (req, res) => {
    const query = `
        SELECT er.*, s.full_name as student_name, s.email as student_email, 
               s.student_id as student_id_number, s.department, s.year
        FROM event_registrations er
        JOIN students s ON er.student_id = s.id
        JOIN events e ON er.event_id = e.id
        WHERE er.event_id = ? AND e.college_id = ?
        ORDER BY er.registration_date DESC
    `;
    
    db.getDb().all(query, [req.params.eventId, req.user.collegeId], (err, registrations) => {
        if (err) {
            console.error('Get event registrations error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(registrations);
    });
});

// Bulk registration for multiple students
router.post('/bulk', authenticateToken, (req, res) => {
    const { eventId, studentIds, notes } = req.body;
    
    if (!eventId || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ message: 'Event ID and student IDs array are required' });
    }
    
    // Check if event exists and belongs to the same college
    const eventQuery = 'SELECT * FROM events WHERE id = ? AND college_id = ? AND is_active = 1';
    
    db.getDb().get(eventQuery, [eventId, req.user.collegeId], (err, event) => {
        if (err) {
            console.error('Event check error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        // Check current registrations
        const countQuery = 'SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ? AND status = "registered"';
        
        db.getDb().get(countQuery, [eventId], (err, result) => {
            if (err) {
                console.error('Count registrations error:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            
            if (result.count + studentIds.length > event.max_participants) {
                return res.status(400).json({ 
                    message: `Cannot register ${studentIds.length} students. Only ${event.max_participants - result.count} spots available.` 
                });
            }
            
            // Bulk insert registrations
            const insertQuery = 'INSERT OR IGNORE INTO event_registrations (event_id, student_id, notes) VALUES (?, ?, ?)';
            let completed = 0;
            let successful = 0;
            
            studentIds.forEach(studentId => {
                db.getDb().run(insertQuery, [eventId, studentId, notes], function(err) {
                    completed++;
                    if (!err && this.changes > 0) {
                        successful++;
                    }
                    
                    if (completed === studentIds.length) {
                        res.json({
                            message: `Bulk registration completed. ${successful} students registered successfully.`,
                            successful,
                            total: studentIds.length
                        });
                    }
                });
            });
        });
    });
});

// Get registrations for a specific student
router.get('/student/:student_id', authenticateToken, (req, res) => {
    const student_id = req.params.student_id;
    
    // Security check: students can only access their own registrations
    if (req.user.role === 'student' && req.user.userId != student_id) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    const query = `
        SELECT er.*, e.title as event_title, e.description as event_description, 
               e.start_datetime as event_start, e.end_datetime as event_end, 
               e.location as event_location, e.event_type,
               f.rating as feedback_rating, f.comments as feedback_comments,
               CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as has_feedback
        FROM event_registrations er
        JOIN events e ON er.event_id = e.id
        LEFT JOIN feedback f ON er.event_id = f.event_id AND er.student_id = f.student_id
        WHERE er.student_id = ? AND e.college_id = ?
        ORDER BY er.registration_date DESC
    `;
    
    const college_id = req.user.role === 'student' ? req.user.collegeId : req.user.collegeId;
    
    db.getDb().all(query, [student_id, college_id], (err, registrations) => {
        if (err) {
            console.error('Get student registrations error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(registrations);
    });
});

// Update registration attendance status
router.put('/:id/attendance', authenticateToken, (req, res) => {
    const { attendance_status, check_in_time } = req.body;
    
    if (!attendance_status || !['attended', 'absent'].includes(attendance_status)) {
        return res.status(400).json({ message: 'Valid attendance_status is required (attended, absent)' });
    }
    
    // Get registration details first
    const getRegistrationQuery = `
        SELECT er.*, e.title as event_title 
        FROM event_registrations er 
        JOIN events e ON er.event_id = e.id
        WHERE er.id = ? AND e.college_id = ?
    `;
    
    db.getDb().get(getRegistrationQuery, [req.params.id, req.user.collegeId], (err, registration) => {
        if (err) {
            console.error('Get registration error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!registration) {
            return res.status(404).json({ message: 'Registration not found or unauthorized' });
        }
        
        // Update registration status
        const updateQuery = `
            UPDATE event_registrations 
            SET status = ?
            WHERE id = ?
        `;
        
        db.getDb().run(updateQuery, [attendance_status, req.params.id], function(updateErr) {
            if (updateErr) {
                console.error('Update registration status error:', updateErr);
                return res.status(500).json({ message: 'Internal server error' });
            }
            
            // If marking as attended, also create attendance record
            if (attendance_status === 'attended') {
                const attendanceQuery = `
                    INSERT OR IGNORE INTO attendance (event_id, student_id, marked_by, notes)
                    VALUES (?, ?, ?, 'Marked by admin')
                `;
                
                db.getDb().run(attendanceQuery, [
                    registration.event_id, 
                    registration.student_id, 
                    req.user.userId || req.user.id
                ], (attendanceErr) => {
                    if (attendanceErr && !attendanceErr.message.includes('UNIQUE constraint failed')) {
                        console.error('Create attendance record error:', attendanceErr);
                    }
                    // Don't fail the whole operation if attendance record creation fails
                });
            }
            
            res.json({ 
                message: `Attendance marked as ${attendance_status} successfully`,
                registration_id: req.params.id,
                status: attendance_status
            });
        });
    });
});

module.exports = router;
