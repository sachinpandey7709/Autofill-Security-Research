const http = require('http');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');
const crypto = require('crypto');

const PORT = 3000;
const DATA_FILE = 'captured_data.json';
const CONFIG_FILE = 'server_config.json';

// Default configuration
const defaultConfig = {
    security: {
        enableRateLimiting: true,
        maxRequestsPerMinute: 10,
        blockSuspiciousIPs: true,
        enableCSRF: true
    },
    logging: {
        logToFile: true,
        logLevel: 'detailed',
        autoCleanup: true,
        cleanupAfterDays: 7
    },
    features: {
        enableAPI: true,
        enableExport: true,
        enableStatistics: true,
        realTimeUpdates: true
    }
};

// Initialize files
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]');
}
if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
}

// Rate limiting storage
const requestCounts = new Map();
const blockedIPs = new Set();

// Load configuration
let config;
try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch (error) {
    console.log('Config load error, using defaults');
    config = defaultConfig;
}

// Utility functions
const utils = {
    generateCSRFToken: () => crypto.randomBytes(32).toString('hex'),
    
    sanitizeInput: (input) => {
        if (typeof input !== 'string') return input;
        return input.replace(/[<>]/g, '').substring(0, 500);
    },
    
    isSuspiciousRequest: (userAgent, formData) => {
        const suspiciousPatterns = [
            /bot|crawler|spider/i,
            /sqlmap|nikto|metasploit/i,
            /<script|javascript:/i
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(userAgent)) return true;
            for (const key in formData) {
                if (typeof formData[key] === 'string' && pattern.test(formData[key])) {
                    return true;
                }
            }
        }
        return false;
    },
    
    checkRateLimit: (ip) => {
        if (blockedIPs.has(ip)) return false;
        
        const now = Date.now();
        const windowStart = now - 60000;
        const requests = requestCounts.get(ip) || [];
        
        const recentRequests = requests.filter(time => time > windowStart);
        
        if (recentRequests.length >= config.security.maxRequestsPerMinute) {
            if (config.security.blockSuspiciousIPs) {
                blockedIPs.add(ip);
            }
            return false;
        }
        
        recentRequests.push(now);
        requestCounts.set(ip, recentRequests);
        return true;
    },
    
    logToFile: (message, level = 'INFO') => {
        if (!config.logging.logToFile) return;
        
        const timestamp = new Date().toISOString();
        const logMessage = '[' + timestamp + '] [' + level + '] ' + message + '\n';
        
        fs.appendFile('server.log', logMessage, (err) => {
            if (err) console.error('Logging error:', err);
        });
    },
    
    cleanupOldData: () => {
        if (!config.logging.autoCleanup) return;
        
        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - config.logging.cleanupAfterDays);
            
            const filteredData = data.filter(entry => {
                const entryDate = new Date(entry.timestamp);
                return entryDate > cutoffDate;
            });
            
            if (filteredData.length !== data.length) {
                fs.writeFileSync(DATA_FILE, JSON.stringify(filteredData, null, 2));
                utils.logToFile('Cleaned up ' + (data.length - filteredData.length) + ' old entries');
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
};

// Run cleanup on startup
utils.cleanupOldData();

// Enhanced HTML Form with CSRF protection
const generateFormHTML = (csrfToken) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Research</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .hidden-fields {
            position: absolute;
            left: -9999px;
            opacity: 0;
            width: 1px;
            height: 1px;
            overflow: hidden;
        }
        .security-notice {
            border-left: 4px solid #ef4444;
            background: #fef2f2;
            padding: 12px;
            margin: 16px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body class="bg-slate-100 flex items-center justify-center min-h-screen px-4">
    <div class="relative bg-white p-8 rounded-xl shadow-2xl max-w-md w-full">
        <h1 class="text-3xl font-bold mb-2 text-center text-slate-800">Security Research Portal</h1>
        <p class="text-slate-500 text-center mb-4">Browser Autofill Vulnerability Study</p>
        
        <div class="security-notice">
            <p class="text-sm text-red-700">
                <strong>Security Research Notice:</strong> This form demonstrates browser autofill behavior for educational purposes.
            </p>
        </div>
        
        <form action="/submit" method="POST" class="space-y-6" id="researchForm">
            <input type="hidden" name="csrf_token" value="${csrfToken}">
            
            <div>
                <label class="block text-sm font-medium text-slate-700">Research Participant Name</label>
                <input type="text" name="username" autocomplete="name" required
                    class="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600">
            </div>

            <div>
                <label class="block text-sm font-medium text-slate-700">Contact Email</label>
                <input type="email" name="email" autocomplete="email" required
                    class="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600">
            </div>

            <div class="hidden-fields">
                <input type="tel" name="phone" autocomplete="tel" placeholder="Phone">
                <input type="text" name="address" autocomplete="street-address" placeholder="Address">
                <input type="text" name="organization" autocomplete="organization" placeholder="Organization">
                <input type="text" name="cc-number" autocomplete="cc-number" placeholder="Credit Card">
                <input type="text" name="city" autocomplete="address-level2" placeholder="City">
                <input type="text" name="state" autocomplete="address-level1" placeholder="State">
                <input type="text" name="pincode" autocomplete="postal-code" placeholder="PIN Code">
            </div>

            <button type="submit"
                class="w-full py-3 px-4 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 font-medium">
                Participate in Research
            </button>
        </form>
        
        <div class="mt-6 text-center space-y-2">
            <a href="/view-data" class="block text-indigo-600 hover:text-indigo-800 text-sm">View Research Data</a>
            <a href="/statistics" class="block text-indigo-600 hover:text-indigo-800 text-sm">Research Statistics</a>
            <a href="/export" class="block text-indigo-600 hover:text-indigo-800 text-sm">Export Data</a>
        </div>
    </div>

    <script>
        let autofillDetected = false;
        
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', function() {
                if (this.value && !this.dataset.visited) {
                    autofillDetected = true;
                    this.dataset.visited = true;
                }
            });
        });

        document.getElementById('researchForm').addEventListener('submit', function(e) {
            const metadata = document.createElement('input');
            metadata.type = 'hidden';
            metadata.name = 'research_metadata';
            metadata.value = JSON.stringify({
                autofill_detected: autofillDetected,
                submission_time: new Date().toISOString(),
                user_agent: navigator.userAgent,
                viewport: window.innerWidth + 'x' + window.innerHeight
            });
            this.appendChild(metadata);
        });
    </script>
</body>
</html>
`;
};

// Create server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const clientIP = req.socket.remoteAddress.replace('::ffff:', '');
    
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Rate limiting
    if (config.security.enableRateLimiting && !utils.checkRateLimit(clientIP)) {
        utils.logToFile('Rate limit exceeded for IP: ' + clientIP, 'WARN');
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Too many requests' }));
        return;
    }
    
    console.log('Request: ' + req.method + ' ' + pathname + ' from ' + clientIP);
    utils.logToFile('Request: ' + req.method + ' ' + pathname + ' from ' + clientIP);
    
    // Route handling
    if (pathname === '/' && req.method === 'GET') {
        const csrfToken = utils.generateCSRFToken();
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(generateFormHTML(csrfToken));
        return;
    }
    
    if (pathname === '/submit' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            const formData = querystring.parse(body);
            
            // CSRF protection
            if (config.security.enableCSRF) {
                const csrfToken = formData.csrf_token;
                if (!csrfToken || csrfToken.length !== 64) {
                    utils.logToFile('CSRF attempt detected from IP: ' + clientIP, 'WARN');
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Security validation failed' }));
                    return;
                }
            }
            
            // Input sanitization
            const sanitizedData = {};
            Object.keys(formData).forEach(key => {
                sanitizedData[key] = utils.sanitizeInput(formData[key]);
            });
            
            // Check for suspicious activity
            const isSuspicious = utils.isSuspiciousRequest(req.headers['user-agent'], formData);
            if (isSuspicious) {
                utils.logToFile('Suspicious request from IP: ' + clientIP, 'WARN');
                if (config.security.blockSuspiciousIPs) {
                    blockedIPs.add(clientIP);
                }
            }
            
            // Parse research metadata
            let researchMetadata = {};
            try {
                if (formData.research_metadata) {
                    researchMetadata = JSON.parse(formData.research_metadata);
                }
            } catch (e) {
                // Ignore metadata parsing errors
            }
            
            // Capture and save data
            const capturedData = {
                id: crypto.randomBytes(8).toString('hex'),
                timestamp: new Date().toISOString(),
                ip: clientIP,
                userAgent: req.headers['user-agent'],
                researchMetadata: researchMetadata,
                formData: sanitizedData,
                security: {
                    isSuspicious: isSuspicious,
                    autofillUsed: researchMetadata.autofill_detected || false
                }
            };
            
            // Enhanced logging
            if (config.logging.logLevel === 'detailed' || config.logging.logLevel === 'debug') {
                console.log('Advanced Form Submission:');
                console.log('ID:', capturedData.id);
                console.log('IP:', capturedData.ip);
                console.log('Suspicious:', capturedData.security.isSuspicious);
                console.log('Autofill Used:', capturedData.security.autofillUsed);
                console.log('Name:', capturedData.formData.username);
                console.log('Email:', capturedData.formData.email);
                console.log('Phone:', capturedData.formData.phone || 'Not captured');
                if (capturedData.formData['cc-number']) {
                    console.log('Credit Card:', '****' + capturedData.formData['cc-number'].slice(-4));
                } else {
                    console.log('Credit Card:', 'Not captured');
                }
                console.log('---');
            }
            
            // Save to file
            try {
                const existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
                existingData.push(capturedData);
                fs.writeFileSync(DATA_FILE, JSON.stringify(existingData, null, 2));
                utils.logToFile('New submission captured with ID: ' + capturedData.id);
            } catch (error) {
                console.error('Data save error:', error);
                utils.logToFile('Data save error: ' + error.message, 'ERROR');
            }
            
            // Success response
            res.writeHead(200, { 
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ 
                success: true, 
                message: 'Research data recorded successfully',
                submissionId: capturedData.id 
            }));
        });
        return;
    }
    
    if (pathname === '/view-data' && req.method === 'GET') {
        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            
            let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Research Data - Security Study</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #0f172a; color: white; font-family: system-ui; }
        .data-card { background: #1e293b; border: 1px solid #334155; }
        .hidden-field { color: #ef4444; }
        .suspicious { border-left: 4px solid #dc2626; }
        .autofill-used { border-left: 4px solid #16a34a; }
    </style>
</head>
<body class="p-6">
    <div class="max-w-6xl mx-auto">
        <h1 class="text-3xl font-bold text-green-400 mb-2">Research Data</h1>
        <p class="text-gray-400 mb-6">Browser Autofill Behavior Study - ${data.length} submissions</p>
        
        <div class="mb-6 flex gap-4 flex-wrap">
            <a href="/" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Back to Research</a>
            <a href="/statistics" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Statistics</a>
            <a href="/export" class="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">Export Data</a>
            <button onclick="location.reload()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Refresh</button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="data-card p-4 rounded text-center">
                <div class="text-2xl font-bold">${data.length}</div>
                <div class="text-sm text-gray-400">Total Submissions</div>
            </div>
            <div class="data-card p-4 rounded text-center">
                <div class="text-2xl font-bold">${data.filter(d => d.security.autofillUsed).length}</div>
                <div class="text-sm text-gray-400">Autofill Used</div>
            </div>
            <div class="data-card p-4 rounded text-center">
                <div class="text-2xl font-bold">${data.filter(d => d.security.isSuspicious).length}</div>
                <div class="text-sm text-gray-400">Suspicious</div>
            </div>
            <div class="data-card p-4 rounded text-center">
                <div class="text-2xl font-bold">${blockedIPs.size}</div>
                <div class="text-sm text-gray-400">Blocked IPs</div>
            </div>
        </div>
            `;
            
            if (data.length === 0) {
                html += `
        <div class="data-card p-6 rounded-lg text-center">
            <p class="text-gray-400">No research data collected yet.</p>
        </div>
                `;
            } else {
                data.forEach((entry, index) => {
                    const cardClass = [
                        'data-card p-6 rounded-lg mb-4',
                        entry.security.isSuspicious ? 'suspicious' : '',
                        entry.security.autofillUsed ? 'autofill-used' : ''
                    ].join(' ').trim();
                    
                    const autofillTag = entry.security.autofillUsed ? '<span class="text-xs bg-green-500 text-white px-2 py-1 rounded">Autofill</span>' : '';
                    const suspiciousTag = entry.security.isSuspicious ? '<span class="text-xs bg-red-500 text-white px-2 py-1 rounded">Suspicious</span>' : '';
                    
                    html += `
        <div class="${cardClass}">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-semibold">Submission #${index + 1}</h3>
                    <p class="text-sm text-gray-400">ID: ${entry.id}</p>
                </div>
                <div class="text-right">
                    <span class="text-sm text-gray-400">${new Date(entry.timestamp).toLocaleString()}</span>
                    <div class="flex gap-2 mt-1">
                        ${autofillTag}
                        ${suspiciousTag}
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                    <p><strong class="text-blue-400">Client Info:</strong></p>
                    <p><strong>IP:</strong> ${entry.ip}</p>
                    <p><strong>Browser:</strong> ${entry.userAgent ? entry.userAgent.substring(0, 50) + '...' : 'N/A'}</p>
                    <p><strong>Viewport:</strong> ${entry.researchMetadata && entry.researchMetadata.viewport ? entry.researchMetadata.viewport : 'N/A'}</p>
                </div>
                <div class="space-y-1">
                    <p><strong class="text-green-400">Visible Fields:</strong></p>
                    <p><strong>Name:</strong> ${entry.formData.username || 'N/A'}</p>
                    <p><strong>Email:</strong> ${entry.formData.email || 'N/A'}</p>
                </div>
                <div class="space-y-1">
                    <p><strong class="text-red-400">Autofill Data:</strong></p>
                    <p class="${entry.formData.phone ? 'hidden-field' : ''}"><strong>Phone:</strong> ${entry.formData.phone || 'N/A'}</p>
                    <p class="${entry.formData['cc-number'] ? 'hidden-field' : ''}"><strong>Credit Card:</strong> ${entry.formData['cc-number'] ? '****' + entry.formData['cc-number'].slice(-4) : 'N/A'}</p>
                    <p class="${entry.formData.address ? 'hidden-field' : ''}"><strong>Address:</strong> ${entry.formData.address || 'N/A'}</p>
                    <p class="${entry.formData.city ? 'hidden-field' : ''}"><strong>City:</strong> ${entry.formData.city || 'N/A'}</p>
                    <p class="${entry.formData.state ? 'hidden-field' : ''}"><strong>State:</strong> ${entry.formData.state || 'N/A'}</p>
                </div>
            </div>
        </div>
                    `;
                });
            }
            
            html += `
    </div>
</body>
</html>`;
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            
        } catch (error) {
            console.error('Data view error:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error reading research data');
        }
        return;
    }
    
    if (pathname === '/statistics' && req.method === 'GET') {
        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            
            // Calculate statistics
            const stats = {
                totalSubmissions: data.length,
                autofillUsed: data.filter(d => d.security.autofillUsed).length,
                suspiciousActivity: data.filter(d => d.security.isSuspicious).length,
                uniqueIPs: [...new Set(data.map(d => d.ip))].length,
                submissionsToday: data.filter(d => {
                    const today = new Date().toDateString();
                    const entryDate = new Date(d.timestamp).toDateString();
                    return entryDate === today;
                }).length
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats, null, 2));
            
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error generating statistics' }));
        }
        return;
    }
    
    if (pathname === '/export' && req.method === 'GET') {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="research_data.json"'
            });
            res.end(data);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error exporting data' }));
        }
        return;
    }
    
    // API endpoint for real-time data
    if (pathname === '/api/submissions' && req.method === 'GET') {
        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: data,
                count: data.length,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API error' }));
        }
        return;
    }
    
    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

// Start server
server.listen(PORT, () => {
    console.log('Advanced Security Research Server Started!');
    console.log('Local URL: http://localhost:' + PORT);
    console.log('Data View: http://localhost:' + PORT + '/view-data');
    console.log('Statistics: http://localhost:' + PORT + '/statistics');
    console.log('API: http://localhost:' + PORT + '/api/submissions');
    console.log('Educational & Research Purpose Only!');
    console.log('Security Features: Rate Limiting, CSRF Protection, Input Sanitization');
    
    // Log server start
    utils.logToFile('Server started on port ' + PORT, 'INFO');
});

// Cleanup interval (every hour)
setInterval(utils.cleanupOldData, 60 * 60 * 1000);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server gracefully...');
    utils.logToFile('Server shutdown initiated', 'INFO');
    server.close(() => {
        console.log('Server stopped successfully');
        process.exit(0);
    });
});
