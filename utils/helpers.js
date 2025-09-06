const db = require('../config/database');

// Database query helper with error handling
const dbQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.getDb().all(query, params, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

// Get single row from database
const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.getDb().get(query, params, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

// Run database insert/update/delete
const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.getDb().run(query, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ 
                    lastID: this.lastID, 
                    changes: this.changes 
                });
            }
        });
    });
};

// Format date for display
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Calculate age from date
const calculateAge = (startDate, endDate = new Date()) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// Validate email format
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Validate phone format
const isValidPhone = (phone) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

// Generate random string
const generateRandomString = (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Pagination helper
const paginate = (totalCount, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(totalCount / limit);
    
    return {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        offset,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
    };
};

// Error response helper
const errorResponse = (res, statusCode, message, error = null) => {
    const response = {
        success: false,
        message,
        timestamp: new Date().toISOString()
    };
    
    if (process.env.NODE_ENV === 'development' && error) {
        response.error = error.message;
        response.stack = error.stack;
    }
    
    return res.status(statusCode).json(response);
};

// Success response helper
const successResponse = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

// Check if event registration is open
const isRegistrationOpen = (event) => {
    if (!event.is_active) return false;
    
    const now = new Date();
    const deadline = event.registration_deadline ? new Date(event.registration_deadline) : null;
    const eventStart = new Date(event.start_datetime);
    
    // Registration closes at deadline or event start time, whichever is earlier
    const registrationCloses = deadline && deadline < eventStart ? deadline : eventStart;
    
    return now < registrationCloses;
};

// Check if event is currently happening
const isEventActive = (event) => {
    const now = new Date();
    const start = new Date(event.start_datetime);
    const end = new Date(event.end_datetime);
    
    return now >= start && now <= end;
};

// Get event status
const getEventStatus = (event) => {
    const now = new Date();
    const start = new Date(event.start_datetime);
    const end = new Date(event.end_datetime);
    
    if (now < start) {
        return 'upcoming';
    } else if (now >= start && now <= end) {
        return 'ongoing';
    } else {
        return 'completed';
    }
};

// Calculate event duration in hours
const getEventDuration = (event) => {
    const start = new Date(event.start_datetime);
    const end = new Date(event.end_datetime);
    const diffTime = end - start;
    const diffHours = diffTime / (1000 * 60 * 60);
    return Math.round(diffHours * 10) / 10; // Round to 1 decimal place
};

// Sanitize input for SQL queries
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/['"\\]/g, '');
};

// Generate event QR code data
const generateEventQRData = (eventId, studentId) => {
    return JSON.stringify({
        eventId,
        studentId,
        timestamp: Date.now(),
        type: 'attendance'
    });
};

// Parse QR code data
const parseQRData = (qrData) => {
    try {
        return JSON.parse(qrData);
    } catch (error) {
        return null;
    }
};

// Calculate statistics
const calculateStats = (data, field) => {
    if (!Array.isArray(data) || data.length === 0) {
        return {
            count: 0,
            sum: 0,
            average: 0,
            min: 0,
            max: 0
        };
    }
    
    const values = data.map(item => Number(item[field]) || 0);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return {
        count: values.length,
        sum,
        average: Math.round(average * 100) / 100,
        min,
        max
    };
};

// Group data by field
const groupBy = (data, field) => {
    return data.reduce((groups, item) => {
        const key = item[field] || 'unknown';
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});
};

// Sort data by multiple fields
const multiSort = (data, sortFields) => {
    return data.sort((a, b) => {
        for (const { field, direction = 'asc' } of sortFields) {
            const aVal = a[field];
            const bVal = b[field];
            
            if (aVal < bVal) {
                return direction === 'asc' ? -1 : 1;
            }
            if (aVal > bVal) {
                return direction === 'asc' ? 1 : -1;
            }
        }
        return 0;
    });
};

// Rate limiter helper (simple implementation)
const rateLimiters = new Map();

const rateLimit = (identifier, maxRequests = 100, windowMs = 60000) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimiters.has(identifier)) {
        rateLimiters.set(identifier, []);
    }
    
    const requests = rateLimiters.get(identifier);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= maxRequests) {
        return false; // Rate limit exceeded
    }
    
    // Add current request
    validRequests.push(now);
    rateLimiters.set(identifier, validRequests);
    
    return true; // Request allowed
};

module.exports = {
    // Database helpers
    dbQuery,
    dbGet,
    dbRun,
    
    // Date and time helpers
    formatDate,
    calculateAge,
    
    // Validation helpers
    isValidEmail,
    isValidPhone,
    
    // Utility helpers
    generateRandomString,
    paginate,
    sanitizeInput,
    
    // Response helpers
    errorResponse,
    successResponse,
    
    // Event helpers
    isRegistrationOpen,
    isEventActive,
    getEventStatus,
    getEventDuration,
    
    // QR code helpers
    generateEventQRData,
    parseQRData,
    
    // Data processing helpers
    calculateStats,
    groupBy,
    multiSort,
    
    // Rate limiting
    rateLimit
};
