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
const port =process.env.PORT || 3001;


app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the 'public' directory



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'client.html'));
});


// Set up MySQL connection pool
const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'baloyi',
    database: 'ChatBot_DB',
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


    // Example: server code to handle the /request-agent route
    app.post('/request-agent', (req, res) => {
        const { email } = req.body;
    
        if (!email) {
            return res.json({ success: false, message: 'Email is required.' });
        }
    
        const selectQuery = `
            SELECT firstName, lastName, email
            FROM Sign_Up
            WHERE email = ?
        `;
    
        pool.query(selectQuery, [email], (err, results) => {
            if (err) {
                console.error('Error selecting from database:', err);
                return res.json({ success: false, message: 'Error retrieving user information.' });
            }
    
            if (results.length > 0) {
                const { firstName, lastName } = results[0];
    
                const insertQuery = `
                    INSERT INTO AgentRequest (firstName, lastName, email, status)
                    VALUES (?, ?, ?, 'pending')
                `;
    
                pool.query(insertQuery, [firstName, lastName, email], (err, insertResults) => {
                    if (err) {
                        console.error('Error inserting into database:', err);
                        return res.json({ success: false, message: 'Error processing request.' });
                    }
    
                    // Fetch the Request_id of the newly inserted request
                    const requestIdQuery = `
                        SELECT Request_id
                        FROM AgentRequest
                        WHERE email = ?
                        ORDER BY Request_id DESC
                        LIMIT 1
                    `;
    
                    pool.query(requestIdQuery, [email], (err, requestIdResults) => {
                        if (err) {
                            console.error('Error retrieving request ID:', err);
                            return res.json({ success: false, message: 'Error retrieving request ID.' });
                        }
    
                        if (requestIdResults.length > 0) {
                            const { Request_id } = requestIdResults[0];
                            res.json({ success: true, message: 'Request submitted. Please wait...', requestId: Request_id });
                        } else {
                            res.json({ success: false, message: 'Request ID not found.' });
                        }
                    });
                });
            } else {
                res.json({ success: false, message: 'User not found.' });
            }
        });
    });
    
    
    // Example: server code to handle checking agent request status
// Example: server code to handle checking agent request status
app.get('/check-request-status/:email', (req, res) => {
    const { email } = req.params;

    // Query to check the status of the agent request
    const statusQuery = `
        SELECT status
        FROM AgentRequest
        WHERE email = ?
        ORDER BY Request_id DESC
        LIMIT 1
    `;

    pool.query(statusQuery, [email], (err, results) => {
        if (err) {
            console.error('Error selecting from database:', err);
            return res.json({ success: false, message: 'Error retrieving request status.' });
        }

        if (results.length > 0) {
            const status = results[0].status;
            res.json({ success: true, status });
        } else {
            res.json({ success: false, message: 'No request found.' });
        }
    });
});

app.delete('/delete-request/:requestId', (req, res) => {
    const { requestId } = req.params;

    const deleteQuery = `
        DELETE FROM AgentRequest
        WHERE Request_id = ?
    `;

    pool.query(deleteQuery, [requestId], (err, results) => {
        if (err) {
            console.error('Error deleting from database:', err);
            return res.json({ success: false, message: 'Error deleting request.' });
        }

        res.json({ success: true, message: 'Request deleted successfully.' });
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
    
        // Update the SQL query to include all messages regardless of fetched status
        const fetchQuery = `
            SELECT Message_id, message, Request_id, email, fullName, createdAt 
            FROM Messages
            WHERE Request_id = ?
        `;
    
        pool.query(fetchQuery, [requestId], (err, results) => {
            if (err) {
                console.error('Error fetching messages from database:', err);
                return res.json({ success: false, message: 'Error fetching messages.' });
            }
    
            // Log the fetched messages
            console.log('Fetched messages:', results);
            res.json({ success: true, messages: results });
        });
    });
    
    app.post('/updateLogoutStatus/:requestId', (req, res) => {
        const { requestId } = req.params;
        const { email } = req.body;
    
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
    

server.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
});