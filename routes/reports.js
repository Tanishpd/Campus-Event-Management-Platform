const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authModule = require('./auth');
const { authenticateToken } = authModule;

// Event Popularity Report - Sorted by number of registrations
router.get('/event-popularity', authenticateToken, (req, res) => {
    const { limit = 10, event_type, start_date, end_date } = req.query;
    
    let query = `
        SELECT e.id, e.title, e.event_type, e.start_datetime, e.location,
               COUNT(er.id) as total_registrations,
               COUNT(a.id) as total_attendance,
               AVG(f.rating) as average_rating,
               ROUND((COUNT(a.id) * 100.0 / COUNT(er.id)), 2) as attendance_percentage
        FROM events e
        LEFT JOIN event_registrations er ON e.id = er.event_id AND er.status IN ('registered', 'attended')
        LEFT JOIN attendance a ON e.id = a.event_id
        LEFT JOIN feedback f ON e.id = f.event_id
        WHERE e.college_id = ? AND e.is_active = 1
    `;
    const params = [req.user.collegeId];
    
    if (event_type) {
        query += ' AND e.event_type = ?';
        params.push(event_type);
    }
    
    if (start_date) {
        query += ' AND DATE(e.start_datetime) >= DATE(?)';
        params.push(start_date);
    }
    
    if (end_date) {
        query += ' AND DATE(e.start_datetime) <= DATE(?)';
        params.push(end_date);
    }
    
    query += `
        GROUP BY e.id, e.title, e.event_type, e.start_datetime, e.location
        ORDER BY total_registrations DESC, average_rating DESC
        LIMIT ?
    `;
    params.push(parseInt(limit));
    
    db.getDb().all(query, params, (err, events) => {
        if (err) {
            console.error('Event popularity report error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json({
            title: 'Event Popularity Report',
            description: 'Events sorted by total registrations and average rating',
            generated_at: new Date().toISOString(),
            data: events
        });
    });
});

// Student Participation Report - How many events a student attended
router.get('/student-participation', authenticateToken, (req, res) => {
    const { limit = 20, department, year, min_events = 0 } = req.query;
    
    let query = `
        SELECT s.id, s.student_id, s.full_name, s.email, s.department, s.year,
               COUNT(DISTINCT er.event_id) as total_registrations,
               COUNT(DISTINCT a.event_id) as total_attendance,
               AVG(f.rating) as average_feedback_rating,
               ROUND((COUNT(DISTINCT a.event_id) * 100.0 / COUNT(DISTINCT er.event_id)), 2) as attendance_rate
        FROM students s
        LEFT JOIN event_registrations er ON s.id = er.student_id
        LEFT JOIN attendance a ON s.id = a.student_id
        LEFT JOIN feedback f ON s.id = f.student_id
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
    
    query += `
        GROUP BY s.id, s.student_id, s.full_name, s.email, s.department, s.year
        HAVING total_registrations >= ?
        ORDER BY total_attendance DESC, total_registrations DESC
        LIMIT ?
    `;
    params.push(parseInt(min_events), parseInt(limit));
    
    db.getDb().all(query, params, (err, students) => {
        if (err) {
            console.error('Student participation report error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json({
            title: 'Student Participation Report',
            description: 'Students sorted by event attendance and participation',
            generated_at: new Date().toISOString(),
            filters: { department, year, min_events },
            data: students
        });
    });
});

// Top 3 Most Active Students
router.get('/top-active-students', authenticateToken, (req, res) => {
    const { period = 'all' } = req.query;
    
    let dateFilter = '';
    const params = [req.user.collegeId];
    
    if (period === 'month') {
        dateFilter = "AND er.registration_date >= datetime('now', '-1 month')";
    } else if (period === 'semester') {
        dateFilter = "AND er.registration_date >= datetime('now', '-6 months')";
    } else if (period === 'year') {
        dateFilter = "AND er.registration_date >= datetime('now', '-1 year')";
    }
    
    const query = `
        SELECT s.id, s.student_id, s.full_name, s.email, s.department, s.year,
               COUNT(DISTINCT er.event_id) as total_registrations,
               COUNT(DISTINCT a.event_id) as total_attendance,
               COUNT(DISTINCT f.event_id) as feedback_given,
               AVG(f.rating) as average_feedback_rating,
               -- Activity score calculation
               (COUNT(DISTINCT er.event_id) * 1.0 + 
                COUNT(DISTINCT a.event_id) * 2.0 + 
                COUNT(DISTINCT f.event_id) * 1.5) as activity_score
        FROM students s
        JOIN event_registrations er ON s.id = er.student_id
        LEFT JOIN attendance a ON s.id = a.student_id AND a.event_id = er.event_id
        LEFT JOIN feedback f ON s.id = f.student_id AND f.event_id = er.event_id
        WHERE s.college_id = ? ${dateFilter}
        GROUP BY s.id, s.student_id, s.full_name, s.email, s.department, s.year
        HAVING total_registrations > 0
        ORDER BY activity_score DESC, total_attendance DESC
        LIMIT 3
    `;
    
    db.getDb().all(query, params, (err, students) => {
        if (err) {
            console.error('Top active students report error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json({
            title: 'Top 3 Most Active Students',
            description: 'Students with highest activity scores based on registrations, attendance, and feedback',
            period: period,
            generated_at: new Date().toISOString(),
            data: students
        });
    });
});

// Flexible Reports with Custom Filters
router.get('/custom', authenticateToken, (req, res) => {
    const { 
        report_type, event_type, department, year, 
        start_date, end_date, group_by, limit = 50 
    } = req.query;
    
    let query, params = [req.user.collegeId];
    let title, description;
    
    switch (report_type) {
        case 'events_by_type':
            title = 'Events by Type Report';
            description = 'Summary of events grouped by event type';
            query = `
                SELECT e.event_type,
                       COUNT(*) as total_events,
                       COUNT(DISTINCT er.student_id) as unique_participants,
                       AVG(
                           (SELECT COUNT(*) FROM event_registrations 
                            WHERE event_id = e.id AND status IN ('registered', 'attended'))
                       ) as avg_registrations,
                       AVG(
                           (SELECT AVG(rating) FROM feedback WHERE event_id = e.id)
                       ) as avg_rating
                FROM events e
                LEFT JOIN event_registrations er ON e.id = er.event_id
                WHERE e.college_id = ? AND e.is_active = 1
            `;
            if (start_date) {
                query += ' AND DATE(e.start_datetime) >= DATE(?)';
                params.push(start_date);
            }
            if (end_date) {
                query += ' AND DATE(e.start_datetime) <= DATE(?)';
                params.push(end_date);
            }
            query += ' GROUP BY e.event_type ORDER BY total_events DESC';
            break;
            
        case 'attendance_by_department':
            title = 'Attendance by Department Report';
            description = 'Student attendance statistics grouped by department';
            query = `
                SELECT s.department,
                       COUNT(DISTINCT s.id) as total_students,
                       COUNT(DISTINCT a.student_id) as students_attended,
                       COUNT(DISTINCT a.event_id) as events_attended,
                       ROUND(AVG(f.rating), 2) as avg_feedback_rating
                FROM students s
                LEFT JOIN attendance a ON s.id = a.student_id
                LEFT JOIN feedback f ON s.id = f.student_id
                WHERE s.college_id = ?
            `;
            if (department) {
                query += ' AND s.department = ?';
                params.push(department);
            }
            if (year) {
                query += ' AND s.year = ?';
                params.push(year);
            }
            query += ' GROUP BY s.department ORDER BY students_attended DESC';
            break;
            
        case 'monthly_trends':
            title = 'Monthly Event Trends Report';
            description = 'Event activity trends by month';
            query = `
                SELECT strftime('%Y-%m', e.start_datetime) as month,
                       COUNT(*) as events_held,
                       COUNT(DISTINCT er.student_id) as unique_participants,
                       SUM(CASE WHEN er.status = 'attended' THEN 1 ELSE 0 END) as total_attendance,
                       AVG(f.rating) as avg_rating
                FROM events e
                LEFT JOIN event_registrations er ON e.id = er.event_id
                LEFT JOIN feedback f ON e.id = f.event_id
                WHERE e.college_id = ? AND e.is_active = 1
            `;
            if (event_type) {
                query += ' AND e.event_type = ?';
                params.push(event_type);
            }
            if (start_date) {
                query += ' AND DATE(e.start_datetime) >= DATE(?)';
                params.push(start_date);
            }
            if (end_date) {
                query += ' AND DATE(e.start_datetime) <= DATE(?)';
                params.push(end_date);
            }
            query += ' GROUP BY strftime("%Y-%m", e.start_datetime) ORDER BY month DESC LIMIT ?';
            params.push(parseInt(limit));
            break;
            
        default:
            return res.status(400).json({ 
                message: 'Invalid report_type. Available types: events_by_type, attendance_by_department, monthly_trends' 
            });
    }
    
    db.getDb().all(query, params, (err, data) => {
        if (err) {
            console.error('Custom report error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json({
            title,
            description,
            report_type,
            filters: { event_type, department, year, start_date, end_date },
            generated_at: new Date().toISOString(),
            data
        });
    });
});

// College Dashboard Summary
router.get('/dashboard-summary', authenticateToken, (req, res) => {
    const queries = {
        total_events: `SELECT COUNT(*) as count FROM events WHERE college_id = ? AND is_active = 1`,
        upcoming_events: `SELECT COUNT(*) as count FROM events WHERE college_id = ? AND is_active = 1 AND start_datetime > datetime('now')`,
        total_students: `SELECT COUNT(*) as count FROM students WHERE college_id = ?`,
        total_registrations: `
            SELECT COUNT(*) as count FROM event_registrations er
            JOIN events e ON er.event_id = e.id
            WHERE e.college_id = ?
        `,
        total_attendance: `
            SELECT COUNT(*) as count FROM attendance a
            JOIN events e ON a.event_id = e.id
            WHERE e.college_id = ?
        `,
        average_rating: `
            SELECT AVG(f.rating) as average FROM feedback f
            JOIN events e ON f.event_id = e.id
            WHERE e.college_id = ?
        `,
        recent_events: `
            SELECT e.*, COUNT(er.id) as registrations FROM events e
            LEFT JOIN event_registrations er ON e.id = er.event_id
            WHERE e.college_id = ? AND e.is_active = 1
            GROUP BY e.id
            ORDER BY e.start_datetime DESC
            LIMIT 5
        `,
        popular_event_types: `
            SELECT e.event_type, COUNT(*) as count FROM events e
            WHERE e.college_id = ? AND e.is_active = 1
            GROUP BY e.event_type
            ORDER BY count DESC
            LIMIT 5
        `
    };
    
    const summary = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;
    
    Object.entries(queries).forEach(([key, query]) => {
        const isArrayResult = ['recent_events', 'popular_event_types'].includes(key);
        
        db.getDb()[isArrayResult ? 'all' : 'get'](query, [req.user.collegeId], (err, result) => {
            if (err) {
                console.error(`Dashboard summary query error (${key}):`, err);
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
                // Calculate derived metrics
                summary.attendance_rate = summary.total_registrations > 0 
                    ? Math.round((summary.total_attendance / summary.total_registrations) * 100)
                    : 0;
                
                summary.avg_registrations_per_event = summary.total_events > 0
                    ? Math.round(summary.total_registrations / summary.total_events)
                    : 0;
                
                res.json({
                    title: 'College Dashboard Summary',
                    description: 'Overview of college event management statistics',
                    generated_at: new Date().toISOString(),
                    summary
                });
            }
        });
    });
});

// Export data for external analysis
router.get('/export/:type', authenticateToken, (req, res) => {
    const { type } = req.params;
    const { format = 'json', start_date, end_date } = req.query;
    
    let query, filename;
    const params = [req.user.collegeId];
    
    switch (type) {
        case 'events':
            query = `
                SELECT e.*, c.name as college_name,
                       COUNT(er.id) as total_registrations,
                       COUNT(a.id) as total_attendance,
                       AVG(f.rating) as average_rating
                FROM events e
                JOIN colleges c ON e.college_id = c.id
                LEFT JOIN event_registrations er ON e.id = er.event_id
                LEFT JOIN attendance a ON e.id = a.event_id
                LEFT JOIN feedback f ON e.id = f.event_id
                WHERE e.college_id = ? AND e.is_active = 1
            `;
            filename = 'events_export';
            break;
            
        case 'students':
            query = `
                SELECT s.*, c.name as college_name,
                       COUNT(er.id) as total_registrations,
                       COUNT(a.id) as total_attendance,
                       AVG(f.rating) as average_feedback_rating
                FROM students s
                JOIN colleges c ON s.college_id = c.id
                LEFT JOIN event_registrations er ON s.id = er.student_id
                LEFT JOIN attendance a ON s.id = a.student_id
                LEFT JOIN feedback f ON s.id = f.student_id
                WHERE s.college_id = ?
            `;
            filename = 'students_export';
            break;
            
        case 'registrations':
            query = `
                SELECT er.*, e.title as event_title, e.event_type, e.start_datetime,
                       s.full_name as student_name, s.email, s.department, s.year
                FROM event_registrations er
                JOIN events e ON er.event_id = e.id
                JOIN students s ON er.student_id = s.id
                WHERE e.college_id = ?
            `;
            filename = 'registrations_export';
            break;
            
        default:
            return res.status(400).json({ message: 'Invalid export type. Available types: events, students, registrations' });
    }
    
    if (start_date) {
        query += type === 'registrations' ? ' AND DATE(er.registration_date) >= DATE(?)' : ' AND DATE(e.start_datetime) >= DATE(?)';
        params.push(start_date);
    }
    
    if (end_date) {
        query += type === 'registrations' ? ' AND DATE(er.registration_date) <= DATE(?)' : ' AND DATE(e.start_datetime) <= DATE(?)';
        params.push(end_date);
    }
    
    if (type !== 'registrations') {
        query += ` GROUP BY ${type === 'events' ? 'e' : 's'}.id`;
    }
    
    query += ` ORDER BY ${type === 'events' ? 'e.start_datetime' : type === 'students' ? 's.full_name' : 'er.registration_date'} DESC`;
    
    db.getDb().all(query, params, (err, data) => {
        if (err) {
            console.error('Export data error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (format === 'csv') {
            // Convert to CSV format
            if (data.length === 0) {
                return res.status(404).json({ message: 'No data to export' });
            }
            
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map(row => 
                Object.values(row).map(value => 
                    typeof value === 'string' && value.includes(',') ? `"${value}"` : value
                ).join(',')
            );
            
            const csv = [headers, ...rows].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csv);
        } else {
            res.json({
                title: `${type.charAt(0).toUpperCase() + type.slice(1)} Export`,
                export_type: type,
                format,
                generated_at: new Date().toISOString(),
                total_records: data.length,
                data
            });
        }
    });
});

module.exports = router;
