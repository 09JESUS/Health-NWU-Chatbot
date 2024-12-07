const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path'); 
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');


const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port =process.env.PORT || 3000;


app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the 'public' directory


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'agent.html'));
});


// Set up MySQL connection pool
const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'baloyi',
    database: 'Chatbot_db',
    insecureAuth: true,
    connectionLimit: 10 // Optional: to limit the number of simultaneous connections
});

// First query to create the Sign_Up table
const createSignUpTableQuery = `
CREATE TABLE IF NOT EXISTS Sign_Up (
    firstName VARCHAR(255) NOT NULL,
    lastName VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY,
    phone VARCHAR(20),
    address VARCHAR(255),
    password VARCHAR(255) NOT NULL
)`;

const createAgentRequestTableQuery = `
CREATE TABLE IF NOT EXISTS AgentRequest (
    Request_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    lastname VARCHAR(255),
    firstname VARCHAR(255),
    status VARCHAR(255),
    FOREIGN KEY (email) REFERENCES Sign_Up(email)
)`;

const createMessagesRequestTableQuery = `
CREATE TABLE IF NOT EXISTS Messages (
    Message_id INT PRIMARY KEY AUTO_INCREMENT,
    message TEXT NOT NULL,
    Request_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    fullName VARCHAR(255),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fetched BOOLEAN DEFAULT FALSE,
    loggedOut BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (Request_id) REFERENCES AgentRequest(Request_id),
    FOREIGN KEY (email) REFERENCES Sign_Up(email)
)`;

const createReportIssueTableQuery = `
CREATE TABLE IF NOT EXISTS ReportIssue (
    Report_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    report_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email) REFERENCES Sign_Up(email)
)`;

// Execute the first query

pool.query(createAgentRequestTableQuery, (err) => {
    if (err) throw err;
    console.log('Agents table is ready.');
    });

    pool.query(createSignUpTableQuery, (err) => {
        if (err) throw err;
        console.log('Sign_Up table is ready.');
    
        
    pool.query(createMessagesRequestTableQuery, (err) => {
        if (err) throw err;
        console.log('Messages table is ready.');
    });

    pool.query(createReportIssueTableQuery, (err) => {
        if (err) throw err;
        console.log('Report table is ready.');
    });
    
});

    // Example: server code to handle the /get-pending-requests route
app.get('/get-pending-requests', (req, res) => {
    const query = 'SELECT Request_id, firstname, lastname, status FROM AgentRequest WHERE status = "pending"';
    
    pool.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching pending requests:', err);
            return res.json({ success: false, message: 'Error fetching pending requests.' });
        }
        res.json(results);
    });
});


    // Example: server code to handle the /request-agent route
    app.post('/accept-agent', (req, res) => {
        const { requestId } = req.body; // Only need requestId to accept a request
    
        if (!requestId) {
            return res.json({ success: false, message: 'Request ID is required.' });
        }
    
        // Query to update status of the request to 'accepted'
        const updateQuery = `
            UPDATE AgentRequest
            SET status = 'accepted'
            WHERE Request_id = ?
        `;
    
        pool.query(updateQuery, [requestId], (err, results) => {
            if (err) {
                console.error('Error updating request status:', err);
                return res.json({ success: false, message: 'Error processing request.' });
            }
    
            res.json({ success: true, message: 'Request accepted successfully.' });
        });
    });
    
    
   

    app.post('/send', (req, res) => {
        const { message, requestId, email } = req.body;
        console.log('Received message:', message);
    
        // Query to retrieve the firstName and lastName from the Sign_Up table
        const nameQuery = `
            SELECT firstName, lastName 
            FROM Sign_Up 
            WHERE email = ?
        `;
    
        pool.query(nameQuery, [email], (err, nameResults) => {
            if (err) {
                console.error('Error retrieving first name and last name:', err);
                return res.json({ success: false, message: 'Error retrieving name.' });
            }
    
            if (nameResults.length > 0) {
                const { firstName, lastName } = nameResults[0];
                const fullName = `${firstName} ${lastName}`;
    
                // Insert the message and fullName into the Messages table
                const insertQuery = `
                    INSERT INTO Messages (Request_id, email, fullName, message, createdAt)
                    VALUES (?, ?, ?, ?, NOW())
                `;
    
                pool.query(insertQuery, [requestId, email, fullName, message ], (err, results) => {
                    if (err) {
                        console.error('Error saving message to database:', err);
                        return res.json({ success: false, message: 'Error saving message.' });
                    }
    
                    console.log('Message and full name saved to database:', results);
                    res.json({ success: true, message: 'Message received', data: results, fullName });
                });
            } else {
                res.json({ 
                    success: false, 
                    message: 'Name not found for the given email', 
                });
            }
        });
    })
    
    app.get('/fetchMessages/:requestId', (req, res) => {
        const { requestId } = req.params;
    
        // Update the SQL query to include messages that have not been fetched yet
        const fetchQuery = `
            SELECT Message_id, message, Request_id, email, fullName, createdAt 
            FROM Messages
            WHERE Request_id = ? AND fetched = FALSE
        `;
    
        pool.query(fetchQuery, [requestId], (err, results) => {
            if (err) {
                console.error('Error fetching messages from database:', err);
                return res.json({ success: false, message: 'Error fetching messages.' });
            }
    
            if (results.length > 0) {
                const messageIds = results.map(msg => msg.Message_id);
    
                // Mark messages as fetched
                const updateQuery = `
                    UPDATE Messages
                    SET fetched = TRUE
                    WHERE Message_id IN (?)
                `;
    
                pool.query(updateQuery, [messageIds], (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating messages as fetched:', updateErr);
                        return res.json({ success: false, message: 'Error updating messages.' });
                    }
    
                    console.log('Fetched messages:', results);
                    res.json({ success: true, messages: results });
                });
            } else {
                res.json({ success: true, messages: [] });
            }
        });
    });
    

    app.post('/updateLogoutStatus/:requestId', (req, res) => {
        const { requestId } = req.params;
        const email = req.session.email; // Fetch email from session
    
        if (!email) {
            return res.json({ success: false, message: 'User not logged in.' });
        }
    
        const updateQuery = `
            UPDATE Messages
            SET loggedOut = TRUE
            WHERE Request_id = ? AND email = ?
        `;
    
        pool.query(updateQuery, [requestId, email], (err, results) => {
            if (err) {
                console.error('Error updating logout status:', err);
                return res.json({ success: false, message: 'Error updating logout status.' });
            }
    
            console.log('Logout status updated for requestId:', requestId, 'and email:', email);
            res.json({ success: true });
        });
    });
    

    
    app.post('/checkLogoutStatus/:requestId', (req, res) => {
        const { requestId } = req.params;
    
        const checkQuery = `
            SELECT email, loggedOut
            FROM Messages
            WHERE Request_id = ? AND loggedOut = TRUE
        `;
    
        pool.query(checkQuery, [requestId], (err, results) => {
            if (err) {
                console.error('Error checking logout status:', err);
                return res.json({ success: false, message: 'Error checking logout status.' });
            }
    
            const loggedOut = results.length > 0;
            const email = loggedOut ? results.email : null;
            if (loggedOut) {
                res.json({ success: true, loggedOut, email, message: 'User has left the chat.' });
            } else {
                res.json({ success: true, loggedOut });
            }
        });
    });
    
    app.post('/submit-report', (req, res) => {
        const { email, description } = req.body;
    
        const insertQuery = `
            INSERT INTO ReportIssue (email, description)
            VALUES (?, ?)
        `;
    
        pool.query(insertQuery, [email, description], (err, results) => {
            if (err) {
                console.error('Error submitting report:', err);
                return res.json({ success: false, message: 'Error submitting report.' });
            }
    
            res.json({ success: true, message: 'Report submitted successfully.' });
        });
    });
    

    app.get('/get-pending-requests-count', (req, res) => {
        const query = 'SELECT COUNT(*) AS pendingCount FROM AgentRequest WHERE status = "pending"';
        
        pool.query(query, (err, results) => {
            if (err) {
                console.error('Error fetching pending requests count:', err);
                return res.json({ success: false, message: 'Error fetching pending requests count.' });
            }
            const pendingCount = results[0].pendingCount;
            res.json({ success: true, pendingCount });
        });
    });
    
    
server.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
});