const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authModule = require('./auth');
const { authenticateToken } = authModule;

// Get all colleges
router.get('/', (req, res) => {
    const query = 'SELECT * FROM colleges ORDER BY name';
    
    db.getDb().all(query, [], (err, colleges) => {
        if (err) {
            console.error('Get colleges error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json(colleges);
    });
});

// Get college by ID
router.get('/:id', (req, res) => {
    const query = 'SELECT * FROM colleges WHERE id = ?';
    
    db.getDb().get(query, [req.params.id], (err, college) => {
        if (err) {
            console.error('Get college error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!college) {
            return res.status(404).json({ message: 'College not found' });
        }
        
        res.json(college);
    });
});

// Create new college (admin only)
router.post('/', authenticateToken, (req, res) => {
    const { name, code, address, contactEmail, phone } = req.body;
    
    if (!name || !code) {
        return res.status(400).json({ message: 'Name and code are required' });
    }
    
    const query = `
        INSERT INTO colleges (name, code, address, contact_email, phone)
        VALUES (?, ?, ?, ?, ?)
    `;
    
    db.getDb().run(query, [name, code, address, contactEmail, phone], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ message: 'College code already exists' });
            }
            console.error('Create college error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.status(201).json({
            message: 'College created successfully',
            collegeId: this.lastID
        });
    });
});

// Get college statistics
router.get('/:id/stats', authenticateToken, (req, res) => {
    const collegeId = req.params.id;
    
    const queries = [
        'SELECT COUNT(*) as total_students FROM students WHERE college_id = ?',
        'SELECT COUNT(*) as total_events FROM events WHERE college_id = ?',
        'SELECT COUNT(*) as total_registrations FROM event_registrations er JOIN events e ON er.event_id = e.id WHERE e.college_id = ?',
        'SELECT COUNT(*) as total_attendance FROM attendance a JOIN events e ON a.event_id = e.id WHERE e.college_id = ?'
    ];
    
    const stats = {};
    let completed = 0;
    
    queries.forEach((query, index) => {
        db.getDb().get(query, [collegeId], (err, result) => {
            if (err) {
                console.error('Stats query error:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            
            const keys = ['total_students', 'total_events', 'total_registrations', 'total_attendance'];
            stats[keys[index]] = Object.values(result)[0];
            completed++;
            
            if (completed === queries.length) {
                res.json(stats);
            }
        });
    });
});

module.exports = router;
