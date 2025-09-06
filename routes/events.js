const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authModule = require('./auth');
const { authenticateToken } = authModule;

// Public events endpoint (no authentication required)
router.get('/public', (req, res) => {
    const query = `
        SELECT COUNT(*) as count
        FROM events e
        WHERE e.is_active = 1 AND e.start_datetime > datetime('now')
    `;

    db.getDb().get(query, [], (err, result) => {
        if (err) {
            console.error('Get public events count error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json([{ count: result.count }]);
    });
});

// Get events for a specific college (for students)
router.get('/student/:college_id', authenticateToken, (req, res) => {
    const college_id = req.params.college_id;
    const { event_type, upcoming, limit = 50, offset = 0 } = req.query;
    
    // Security check: ensure student can only access their college's events
    if (req.user.role === 'student' && req.user.collegeId != college_id) {
        return res.status(403).json({ message: 'Access denied' });
    }
    
    let query = `
        SELECT e.*, c.name as college_name, c.code as college_code,
               au.full_name as created_by_name,
               (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as registration_count
        FROM events e
        JOIN colleges c ON e.college_id = c.id
        LEFT JOIN admin_users au ON e.created_by = au.id
        WHERE e.is_active = 1 AND e.college_id = ? AND e.start_datetime > datetime('now')
    `;
    const params = [college_id];
    
    if (event_type) {
        query += ' AND e.event_type = ?';
        params.push(event_type);
    }
    
    query += ' ORDER BY e.start_datetime ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.getDb().all(query, params, (err, events) => {
        if (err) {
            console.error('Get student events error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(events);
    });
});

// Get all events (with college-based filtering for scale)
router.get('/', authenticateToken, (req, res) => {
    const { event_type, upcoming, limit = 50, offset = 0 } = req.query;
    
    // SECURITY: Always filter by the authenticated admin's college
    const college_id = req.user.collegeId;
    
    // Performance optimization: Use indexed columns in WHERE clause
    let query = `
        SELECT e.*, c.name as college_name, c.code as college_code,
               au.full_name as created_by_name,
               (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as registration_count
        FROM events e
        JOIN colleges c ON e.college_id = c.id
        LEFT JOIN admin_users au ON e.created_by = au.id
        WHERE e.is_active = 1 AND e.college_id = ?
    `;
    const params = [college_id];
    
    if (event_type) {
        query += ' AND e.event_type = ?';
        params.push(event_type);
    }
    
    if (upcoming === 'true') {
        query += ' AND e.start_datetime > datetime("now")';
    }
    
    query += ' ORDER BY e.start_datetime DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.getDb().all(query, params, (err, events) => {
        if (err) {
            console.error('Get events error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(events);
    });
});

// Get single event by ID
router.get('/:id', (req, res) => {
    const query = `
        SELECT e.*, c.name as college_name, c.code as college_code,
               au.full_name as created_by_name,
               (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as registration_count,
               (SELECT COUNT(*) FROM attendance WHERE event_id = e.id) as attendance_count,
               (SELECT AVG(rating) FROM feedback WHERE event_id = e.id) as average_rating
        FROM events e
        JOIN colleges c ON e.college_id = c.id
        LEFT JOIN admin_users au ON e.created_by = au.id
        WHERE e.id = ?
    `;
    
    db.getDb().get(query, [req.params.id], (err, event) => {
        if (err) {
            console.error('Get event error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        res.json(event);
    });
});

// Create new event
router.post('/', authenticateToken, (req, res) => {
    const {
        title, description, eventType, startDatetime, endDatetime,
        location, maxParticipants, registrationDeadline
    } = req.body;
    
    if (!title || !eventType || !startDatetime || !endDatetime) {
        return res.status(400).json({ message: 'Title, event type, and date/time are required' });
    }
    
    const query = `
        INSERT INTO events (
            college_id, title, description, event_type, start_datetime, 
            end_datetime, location, max_participants, registration_deadline, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.getDb().run(query, [
        req.user.collegeId, title, description, eventType, startDatetime,
        endDatetime, location, maxParticipants || 100, registrationDeadline, req.user.userId
    ], function(err) {
        if (err) {
            console.error('Create event error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.status(201).json({
            message: 'Event created successfully',
            eventId: this.lastID
        });
    });
});

// Update event
router.put('/:id', authenticateToken, (req, res) => {
    const {
        title, description, eventType, startDatetime, endDatetime,
        location, maxParticipants, registrationDeadline, isActive
    } = req.body;
    
    const query = `
        UPDATE events SET
            title = ?, description = ?, event_type = ?, start_datetime = ?,
            end_datetime = ?, location = ?, max_participants = ?, 
            registration_deadline = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND college_id = ?
    `;
    
    db.getDb().run(query, [
        title, description, eventType, startDatetime, endDatetime,
        location, maxParticipants, registrationDeadline, isActive,
        req.params.id, req.user.collegeId
    ], function(err) {
        if (err) {
            console.error('Update event error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }
        
        res.json({ message: 'Event updated successfully' });
    });
});

// Delete event (soft delete)
router.delete('/:id', authenticateToken, (req, res) => {
    const query = 'UPDATE events SET is_active = 0 WHERE id = ? AND college_id = ?';
    
    db.getDb().run(query, [req.params.id, req.user.collegeId], function(err) {
        if (err) {
            console.error('Delete event error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }
        
        res.json({ message: 'Event deleted successfully' });
    });
});

// Get event types
router.get('/meta/types', (req, res) => {
    const eventTypes = [
        'Workshop', 'Hackathon', 'Tech Talk', 'Fest', 'Seminar', 'Competition', 'Other'
    ];
    res.json(eventTypes);
});

module.exports = router;
