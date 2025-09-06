const db = require('../config/database');

class ReportService {
    // Generate comprehensive event analytics
    static async generateEventAnalytics(collegeId, eventId = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    e.id, e.title, e.event_type, e.start_datetime, e.end_datetime,
                    e.max_participants, e.location,
                    COUNT(DISTINCT er.id) as total_registrations,
                    COUNT(DISTINCT CASE WHEN er.status = 'attended' THEN er.id END) as attended_count,
                    COUNT(DISTINCT a.id) as actual_attendance,
                    AVG(f.rating) as average_rating,
                    COUNT(DISTINCT f.id) as feedback_count,
                    -- Registration by department
                    GROUP_CONCAT(DISTINCT s.department) as departments_involved,
                    -- Time-based analytics
                    julianday(e.start_datetime) - julianday(datetime('now')) as days_until_event
                FROM events e
                LEFT JOIN event_registrations er ON e.id = er.event_id
                LEFT JOIN attendance a ON e.id = a.event_id
                LEFT JOIN feedback f ON e.id = f.event_id
                LEFT JOIN students s ON er.student_id = s.id
                WHERE e.college_id = ? AND e.is_active = 1
            `;
            
            const params = [collegeId];
            
            if (eventId) {
                query += ' AND e.id = ?';
                params.push(eventId);
            }
            
            query += ' GROUP BY e.id ORDER BY e.start_datetime DESC';
            
            db.getDb().all(query, params, (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    // Process results to add calculated metrics
                    const processedResults = results.map(event => ({
                        ...event,
                        attendance_rate: event.total_registrations > 0 
                            ? Math.round((event.actual_attendance / event.total_registrations) * 100) 
                            : 0,
                        capacity_utilization: event.max_participants > 0 
                            ? Math.round((event.total_registrations / event.max_participants) * 100) 
                            : 0,
                        feedback_rate: event.actual_attendance > 0 
                            ? Math.round((event.feedback_count / event.actual_attendance) * 100) 
                            : 0,
                        status: event.days_until_event > 0 ? 'upcoming' : event.days_until_event > -1 ? 'ongoing' : 'completed',
                        departments_involved: event.departments_involved ? event.departments_involved.split(',') : []
                    }));
                    
                    resolve(processedResults);
                }
            });
        });
    }
    
    // Generate student engagement scores
    static async generateStudentEngagementScores(collegeId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    s.id, s.student_id, s.full_name, s.department, s.year,
                    COUNT(DISTINCT er.event_id) as events_registered,
                    COUNT(DISTINCT a.event_id) as events_attended,
                    COUNT(DISTINCT f.event_id) as feedback_submitted,
                    AVG(f.rating) as average_feedback_rating,
                    -- Engagement score calculation
                    (COUNT(DISTINCT er.event_id) * 1.0 + 
                     COUNT(DISTINCT a.event_id) * 2.0 + 
                     COUNT(DISTINCT f.event_id) * 1.5 +
                     COALESCE(AVG(f.rating), 0) * 0.5) as engagement_score,
                    -- Consistency metrics
                    CASE 
                        WHEN COUNT(DISTINCT er.event_id) > 0 
                        THEN ROUND((COUNT(DISTINCT a.event_id) * 100.0 / COUNT(DISTINCT er.event_id)), 2)
                        ELSE 0 
                    END as attendance_consistency,
                    -- Recent activity (last 30 days)
                    COUNT(DISTINCT CASE 
                        WHEN er.registration_date > datetime('now', '-30 days') 
                        THEN er.event_id 
                    END) as recent_registrations
                FROM students s
                LEFT JOIN event_registrations er ON s.id = er.student_id
                LEFT JOIN attendance a ON s.id = a.student_id
                LEFT JOIN feedback f ON s.id = f.student_id
                WHERE s.college_id = ?
                GROUP BY s.id, s.student_id, s.full_name, s.department, s.year
                HAVING events_registered > 0
                ORDER BY engagement_score DESC
            `;
            
            db.getDb().all(query, [collegeId], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    // Add engagement level classification
                    const processedResults = results.map((student, index) => ({
                        ...student,
                        rank: index + 1,
                        engagement_level: student.engagement_score >= 10 ? 'High' :
                                        student.engagement_score >= 5 ? 'Medium' : 'Low',
                        feedback_quality: student.average_feedback_rating >= 4 ? 'Positive' :
                                        student.average_feedback_rating >= 3 ? 'Neutral' : 'Critical'
                    }));
                    
                    resolve(processedResults);
                }
            });
        });
    }
    
    // Generate predictive analytics for event success
    static async predictEventSuccess(collegeId, eventData) {
        return new Promise((resolve, reject) => {
            // Analyze historical data for similar events
            const query = `
                SELECT 
                    AVG(
                        CASE WHEN total_reg > 0 
                        THEN (total_att * 100.0 / total_reg) 
                        ELSE 0 END
                    ) as avg_attendance_rate,
                    AVG(avg_rating) as avg_rating,
                    COUNT(*) as similar_events_count
                FROM (
                    SELECT 
                        e.id,
                        COUNT(DISTINCT er.id) as total_reg,
                        COUNT(DISTINCT a.id) as total_att,
                        AVG(f.rating) as avg_rating
                    FROM events e
                    LEFT JOIN event_registrations er ON e.id = er.event_id
                    LEFT JOIN attendance a ON e.id = a.event_id
                    LEFT JOIN feedback f ON e.id = f.event_id
                    WHERE e.college_id = ? 
                    AND e.event_type = ?
                    AND e.is_active = 1
                    AND e.start_datetime < datetime('now')
                    GROUP BY e.id
                ) historical_data
            `;
            
            db.getDb().get(query, [collegeId, eventData.event_type], (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    const prediction = {
                        predicted_attendance_rate: result.avg_attendance_rate || 75,
                        predicted_rating: result.avg_rating || 3.5,
                        confidence_level: result.similar_events_count >= 5 ? 'High' : 
                                       result.similar_events_count >= 2 ? 'Medium' : 'Low',
                        similar_events_analyzed: result.similar_events_count,
                        recommendations: []
                    };
                    
                    // Generate recommendations based on predictions
                    if (prediction.predicted_attendance_rate < 60) {
                        prediction.recommendations.push("Consider improving marketing strategy");
                        prediction.recommendations.push("Check event timing conflicts");
                    }
                    
                    if (prediction.predicted_rating < 3.5) {
                        prediction.recommendations.push("Review event content and format");
                        prediction.recommendations.push("Ensure adequate resources and preparation");
                    }
                    
                    if (prediction.confidence_level === 'Low') {
                        prediction.recommendations.push("Limited historical data - monitor closely");
                    }
                    
                    resolve(prediction);
                }
            });
        });
    }
    
    // Generate department-wise analytics
    static async generateDepartmentAnalytics(collegeId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    s.department,
                    COUNT(DISTINCT s.id) as total_students,
                    COUNT(DISTINCT er.student_id) as active_students,
                    COUNT(DISTINCT er.event_id) as events_participated,
                    COUNT(DISTINCT a.student_id) as students_with_attendance,
                    AVG(f.rating) as average_feedback,
                    -- Event type preferences
                    GROUP_CONCAT(DISTINCT e.event_type) as event_types_attended,
                    -- Engagement metrics
                    ROUND(
                        (COUNT(DISTINCT er.student_id) * 100.0 / COUNT(DISTINCT s.id)), 2
                    ) as engagement_percentage
                FROM students s
                LEFT JOIN event_registrations er ON s.id = er.student_id
                LEFT JOIN events e ON er.event_id = e.id
                LEFT JOIN attendance a ON s.id = a.student_id
                LEFT JOIN feedback f ON s.id = f.student_id
                WHERE s.college_id = ?
                GROUP BY s.department
                ORDER BY engagement_percentage DESC
            `;
            
            db.getDb().all(query, [collegeId], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    const processedResults = results.map(dept => ({
                        ...dept,
                        event_types_attended: dept.event_types_attended ? 
                            dept.event_types_attended.split(',').filter((v, i, arr) => arr.indexOf(v) === i) : [],
                        participation_rate: dept.total_students > 0 ? 
                            Math.round((dept.students_with_attendance / dept.total_students) * 100) : 0,
                        feedback_participation: dept.students_with_attendance > 0 ?
                            Math.round((dept.average_feedback || 0) * 20) : 0 // Convert to percentage
                    }));
                    
                    resolve(processedResults);
                }
            });
        });
    }
}

module.exports = ReportService;
