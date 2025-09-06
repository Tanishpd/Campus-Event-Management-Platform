const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authModule = require('./auth');
const { authenticateToken } = authModule;

// Submit feedback for an event
router.post('/', authenticateToken, (req, res) => {
    const { event_id, rating, comments } = req.body;
    const studentId = req.user.userId; // Student ID from JWT token
    
    if (!event_id || !rating) {
        return res.status(400).json({ message: 'Event ID and rating are required' });
    }
    
    if (!studentId) {
        return res.status(400).json({ message: 'Student authentication required' });
    }
    
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    
    // Check if student attended the event (status = 'attended' in event_registrations)
    const registrationQuery = `
        SELECT er.*, e.title as event_title FROM event_registrations er
        JOIN events e ON er.event_id = e.id
        WHERE er.event_id = ? AND er.student_id = ? AND e.college_id = ?
    `;
    
    db.getDb().get(registrationQuery, [event_id, studentId, req.user.collegeId], (err, registration) => {
        if (err) {
            console.error('Check registration error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!registration) {
            console.log('No registration found for Event ID:', event_id, 'Student ID:', studentId, 'College ID:', req.user.collegeId);
            return res.status(404).json({ message: 'Student is not registered for this event' });
        }
        
        // Check if student attended the event
        if (registration.status !== 'attended') {
            console.log('Student has not attended this event. Current status:', registration.status);
            return res.status(404).json({ 
                message: `Please attend the event first. Current status: ${registration.status}` 
            });
        }
        
        // Submit feedback
        const insertQuery = `
            INSERT INTO feedback (event_id, student_id, rating, comments)
            VALUES (?, ?, ?, ?)
        `;
        
        db.getDb().run(insertQuery, [event_id, studentId, rating, comments], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Feedback already submitted for this event' });
                }
                console.error('Submit feedback error:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            
            res.status(201).json({
                message: 'Feedback submitted successfully',
                feedbackId: this.lastID
            });
        });
    });
});

// Get feedback for a specific event
router.get('/event/:eventId', authenticateToken, (req, res) => {
    const query = `
        SELECT f.*, s.full_name as student_name, s.email as student_email, 
               s.student_id as student_id_number, s.department, s.year
        FROM feedback f
        JOIN students s ON f.student_id = s.id
        JOIN events e ON f.event_id = e.id
        WHERE f.event_id = ? AND e.college_id = ?
        ORDER BY f.submitted_at DESC
    `;
    
    db.getDb().all(query, [req.params.eventId, req.user.collegeId], (err, feedback) => {
        if (err) {
            console.error('Get event feedback error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(feedback);
    });
});

// Get feedback summary for an event
router.get('/event/:eventId/summary', authenticateToken, (req, res) => {
    const queries = {
        total_feedback: `
            SELECT COUNT(*) as count FROM feedback f
            JOIN events e ON f.event_id = e.id
            WHERE f.event_id = ? AND e.college_id = ?
        `,
        average_rating: `
            SELECT AVG(f.rating) as average FROM feedback f
            JOIN events e ON f.event_id = e.id
            WHERE f.event_id = ? AND e.college_id = ?
        `,
        rating_distribution: `
            SELECT f.rating, COUNT(*) as count FROM feedback f
            JOIN events e ON f.event_id = e.id
            WHERE f.event_id = ? AND e.college_id = ?
            GROUP BY f.rating
            ORDER BY f.rating
        `,
        feedback_by_department: `
            SELECT s.department, AVG(f.rating) as average_rating, COUNT(*) as count 
            FROM feedback f
            JOIN students s ON f.student_id = s.id
            JOIN events e ON f.event_id = e.id
            WHERE f.event_id = ? AND e.college_id = ?
            GROUP BY s.department
            ORDER BY average_rating DESC
        `,
        recent_comments: `
            SELECT f.comments, f.rating, s.full_name as student_name, f.submitted_at
            FROM feedback f
            JOIN students s ON f.student_id = s.id
            JOIN events e ON f.event_id = e.id
            WHERE f.event_id = ? AND e.college_id = ? AND f.comments IS NOT NULL AND f.comments != ''
            ORDER BY f.submitted_at DESC
            LIMIT 10
        `
    };
    
    const summary = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;
    
    Object.entries(queries).forEach(([key, query]) => {
        const isArrayResult = ['rating_distribution', 'feedback_by_department', 'recent_comments'].includes(key);
        
        db.getDb()[isArrayResult ? 'all' : 'get'](query, [req.params.eventId, req.user.collegeId], (err, result) => {
            if (err) {
                console.error(`Feedback summary query error (${key}):`, err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            
            if (isArrayResult) {
                summary[key] = result;
            } else if (key === 'average_rating') {
                summary[key] = result.average ? Math.round(result.average * 10) / 10 : 0;
            } else {
                summary[key] = result.count || 0;
            }
            
            completed++;
            
            if (completed === totalQueries) {
                // Calculate feedback response rate
                const attendanceQuery = `
                    SELECT COUNT(*) as attended FROM attendance a
                    JOIN events e ON a.event_id = e.id
                    WHERE a.event_id = ? AND e.college_id = ?
                `;
                
                db.getDb().get(attendanceQuery, [req.params.eventId, req.user.collegeId], (err, attendanceResult) => {
                    if (!err && attendanceResult) {
                        summary.response_rate = attendanceResult.attended > 0 
                            ? Math.round((summary.total_feedback / attendanceResult.attended) * 100)
                            : 0;
                    } else {
                        summary.response_rate = 0;
                    }
                    
                    res.json(summary);
                });
            }
        });
    });
});

// Get all feedback for college with filters
router.get('/', authenticateToken, (req, res) => {
    const { event_type, rating, limit = 50, offset = 0, start_date, end_date } = req.query;
    
    let query = `
        SELECT f.*, e.title as event_title, e.event_type, e.start_datetime,
               s.full_name as student_name, s.student_id as student_id_number
        FROM feedback f
        JOIN events e ON f.event_id = e.id
        JOIN students s ON f.student_id = s.id
        WHERE e.college_id = ?
    `;
    const params = [req.user.collegeId];
    
    if (event_type) {
        query += ' AND e.event_type = ?';
        params.push(event_type);
    }
    
    if (rating) {
        query += ' AND f.rating = ?';
        params.push(rating);
    }
    
    if (start_date) {
        query += ' AND DATE(f.submitted_at) >= DATE(?)';
        params.push(start_date);
    }
    
    if (end_date) {
        query += ' AND DATE(f.submitted_at) <= DATE(?)';
        params.push(end_date);
    }
    
    query += ' ORDER BY f.submitted_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.getDb().all(query, params, (err, feedback) => {
        if (err) {
            console.error('Get feedback error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(feedback);
    });
});

// Update feedback (allow students to modify their feedback within 24 hours)
router.put('/:id', authenticateToken, (req, res) => {
    const { rating, comments } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Valid rating (1-5) is required' });
    }
    
    // Check if feedback exists and was submitted within 24 hours
    const checkQuery = `
        SELECT f.* FROM feedback f
        JOIN events e ON f.event_id = e.id
        WHERE f.id = ? AND e.college_id = ? 
        AND datetime(f.submitted_at, '+24 hours') > datetime('now')
    `;
    
    db.getDb().get(checkQuery, [req.params.id, req.user.collegeId], (err, feedback) => {
        if (err) {
            console.error('Check feedback error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!feedback) {
            return res.status(404).json({ 
                message: 'Feedback not found or modification period expired (24 hours)' 
            });
        }
        
        const updateQuery = `
            UPDATE feedback 
            SET rating = ?, comments = ?
            WHERE id = ?
        `;
        
        db.getDb().run(updateQuery, [rating, comments, req.params.id], function(err) {
            if (err) {
                console.error('Update feedback error:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            
            res.json({ message: 'Feedback updated successfully' });
        });
    });
});

// Delete feedback (admin only, within 24 hours of submission)
router.delete('/:id', authenticateToken, (req, res) => {
    const query = `
        DELETE FROM feedback 
        WHERE id = ? AND event_id IN (
            SELECT id FROM events WHERE college_id = ?
        ) AND datetime(submitted_at, '+24 hours') > datetime('now')
    `;
    
    db.getDb().run(query, [req.params.id, req.user.collegeId], function(err) {
        if (err) {
            console.error('Delete feedback error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ 
                message: 'Feedback not found or deletion period expired (24 hours)' 
            });
        }
        
        res.json({ message: 'Feedback deleted successfully' });
    });
});

// Bulk submit feedback (for testing/demo purposes)
router.post('/bulk', authenticateToken, (req, res) => {
    const { feedbackList } = req.body;
    
    if (!Array.isArray(feedbackList) || feedbackList.length === 0) {
        return res.status(400).json({ message: 'Feedback list array is required' });
    }
    
    const insertQuery = 'INSERT OR IGNORE INTO feedback (event_id, student_id, rating, comments) VALUES (?, ?, ?, ?)';
    let completed = 0;
    let successful = 0;
    
    feedbackList.forEach(({ eventId, studentId, rating, comments }) => {
        if (!eventId || !studentId || !rating || rating < 1 || rating > 5) {
            completed++;
            return;
        }
        
        db.getDb().run(insertQuery, [eventId, studentId, rating, comments], function(err) {
            if (!err && this.changes > 0) {
                successful++;
            }
            
            completed++;
            
            if (completed === feedbackList.length) {
                res.json({
                    message: `Bulk feedback submission completed. ${successful} feedback entries added.`,
                    successful,
                    total: feedbackList.length
                });
            }
        });
    });
});

module.exports = router;
