// Minimal server.js for testing deployment issues
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

console.log("Starting minimal server...");

// --- Basic HTTP Server ---
const server = http.createServer((req, res) => {
    console.log(`HTTP request received: ${req.url}`);
    if (req.url === '/' || req.url === '/index.html') {
        // Try to serve index.html, but don't crash if it fails
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                console.error("Minimal server: Error loading index.html (continuing anyway):", err.code);
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/favicon.ico') {
         res.writeHead(204);
         res.end();
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// --- Basic WebSocket Server ---
const wss = new WebSocket.Server({ server });
console.log("Minimal WebSocket server attached.");

wss.on('connection', (ws, req) => {
    const clientId = `minimal-user-${Date.now()}`;
    console.log(`Minimal server: Client connected: ${clientId}`);

    // Send a simple welcome message
    try {
        ws.send(JSON.stringify({ type: 'systemMessage', payload: { message: 'Connected to minimal server!', isError: false } }));
    } catch (err) {
        console.error(`Minimal server: Error sending welcome to ${clientId}:`, err);
    }

    ws.on('message', (message) => {
        console.log(`Minimal server: Received message from ${clientId}: ${message}`);
        // Echo back
        try {
             ws.send(JSON.stringify({ type: 'echo', payload: message.toString() }));
        } catch (err) {
             console.error(`Minimal server: Error echoing to ${clientId}:`, err);
        }
    });

    ws.on('close', (code, reason) => {
        const reasonString = reason ? reason.toString() : 'N/A';
        console.log(`Minimal server: Client disconnected: ${clientId}. Code: ${code}, Reason: ${reasonString}`);
    });

    ws.on('error', (error) => {
        console.error(`Minimal server: WebSocket error for client ${clientId}:`, error);
        try { ws.terminate(); } catch(e) {}
    });

}); // End of wss.on('connection')

// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Minimal HTTP and WebSocket server listening on port ${PORT}`);
}); // End server.listen

console.log("Minimal server script finished initial execution.");

// Make sure there's a newline character at the very end of the file