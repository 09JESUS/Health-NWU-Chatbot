const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs'); // Changed to6 bcryptjs
const path = require('path'); // Added for path handling
const session = require('express-session'); //import sessions to retrieve information
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const app = express();
const cors = require('cors');
const multer = require('multer');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the 'public' directory

const port = 3000;
// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Function to remove dates from text
function removeDates(text) {
    const datePattern = /\b(?:\d{1,2}\s\w+\s\d{4}|\d{1,2}\s\w+\s\d{2,4}|\d{1,2}\s\w+|\d{4})\b/g;
    return text.replace(datePattern, '').replace(/\s+/g, ' ').trim();
  }
  
  // Function to scrape the web and return results
  async function scrapeWeb(query) {
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const $ = cheerio.load(response.data);
      const results = [];
  
      // Scraping results from multiple sections
      $('.BNeawe').each((index, element) => {
        results.push($(element).text());
      });
  
      $('.kCrYT a').each((index, element) => {
        const link = $(element).attr('href');
        if (link) {
          results.push(`https://www.google.com${link}`);
        }
      });
  
      // Post-process to merge text fragments and remove dates
      const mergedResults = results.join(' ')
        .replace(/\.\.\./g, '.')
        .split('. ')
        .map(sentence => sentence.trim())
        .filter(Boolean)
        .join('. ');
  
      const cleanedResults = removeDates(mergedResults);
  
      // Use a Set to filter out duplicate sentences
      const uniqueSentences = new Set();
      const filteredResults = cleanedResults.split('. ').filter(sentence => {
        const lowerCaseSentence = sentence.toLowerCase().trim();
        if (!uniqueSentences.has(lowerCaseSentence)) {
          uniqueSentences.add(lowerCaseSentence);
          return true;
        }
        return false;
      }).join('. ');
  
      return [filteredResults]; // Return as an array to match expected format.
    } catch (error) {
      console.error('Error scraping the web:', error.message);
      return ['Error fetching content.'];
    }
  }

  // Route to handle user queries
app.post('/ask', async (req, res) => {
    const { queryType, message } = req.body;
    try {
      if (queryType === 'scrape') {
        const answers = await scrapeWeb(message);
        res.json({ answers });
      } else {
        res.json({ error: 'Invalid query type.' });
      }
    } catch (error) {
      console.error('Server error:', error.message);
      res.json({ error: 'Error processing request. Please try again later.' });
    }
  });
  
  
app.use(session({
    secret: '1233', // Replace with a secure secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Set up MySQL connection pool
// Set up MySQL connection pool
const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'baloyi',
    password: 'baloyi123',
    database: 'chatbot_db',
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
    password VARCHAR(255) NOT NULL,
    image LONGBLOB DEFAULT NULL,
    userType VARCHAR(50) NOT NULL
)`;

// Second query to create the Appointment table
const createAppointmentTableQuery = `
CREATE TABLE IF NOT EXISTS Appointment (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    Appointment_date TEXT,
    Appointment_time TIME,
    Appointment_Description TEXT,
    status VARCHAR(20) ,
    FOREIGN KEY (email) REFERENCES Sign_Up(email)
)`;

// Second query to create the Appointment table
const createEmergencyTableQuery = `
CREATE TABLE IF NOT EXISTS Emergency (
    Emergency_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    lastname VARCHAR(255),
    firstname VARCHAR(255),
    phone_number VARCHAR(20), 
    address VARCHAR(255),
    Live_location VARCHAR(255), 
    Emergency_Reason VARCHAR(255),
    Emergency_datetime DATETIME,
    Emergency_Residence VARCHAR(255),
    FOREIGN KEY (email) REFERENCES Sign_Up(email)
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
pool.query(createSignUpTableQuery, (err) => {
    if (err) throw err;
    console.log('Sign_Up table is ready.');

    // Execute the second query after the first one is successful
    pool.query(createAppointmentTableQuery, (err) => {
        if (err) throw err;
        console.log('Appointment table is ready.');
    });

    // Execute the third query after the first one is successful
    pool.query(createEmergencyTableQuery, (err) => {
        if (err) throw err;
        console.log('Emergency table is ready.');
    });

    pool.query(createMessagesRequestTableQuery, (err) => {
        if (err) throw err;
        console.log('Messages table is ready.');
    });

    pool.query(createReportIssueTableQuery, (err) => {
        if (err) throw err;
        console.log('Report table is ready.');
    });

    pool.query(createAgentRequestTableQuery, (err) => {
        if (err) throw err;
        console.log('Agents table is ready.');
        });

});

// Assuming you have already set up Express, Multer, and MySQL connection









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
        const { message, requestId } = req.body;
        const email = req.session.user.email; // Retrieve email from session
        console.log('Received message:', message);
    
        if (!email) {
            return res.json({ success: false, message: 'User not logged in.' });
        }
    
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
    
                pool.query(insertQuery, [requestId, email, fullName, message], (err, results) => {
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
    });
    
    
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
        const email = req.session.user.email; // Retrieve email from session
    
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
        const email = req.session.user.email; // Retrieve email from session
        const { description } = req.body; // Still accept description from request body
    
        if (!email) {
            return res.json({ success: false, message: 'User not logged in.' });
        }
    
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
    






















///user server part

    
    // Example: server code to handle the /request-agent route
    app.post('/request-agent', (req, res) => {
        const email = req.session.user.email;

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



app.post('/sendU', (req, res) => {
    const { message, requestId } = req.body; // Removed email from destructuring
    const email = req.session.user.email; // Retrieve email from session
    console.log('Received message:', message);

    if (!email) {
        return res.json({ success: false, message: 'Email not found in session.' });
    }

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

            pool.query(insertQuery, [requestId, email, fullName, message], (err, results) => {
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
});


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
        const email = req.session.user.email; // Retrieve email from the session
    
        if (!email) {
            return res.json({ success: false, message: 'Email not found in session.' });
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
        const email = req.session.user.email; // Retrieve email from session
        const { description } = req.body; // Get description from request body
    
        if (!email) {
            return res.json({ success: false, message: 'Email not found in session.' });
        }
    
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
    
    



///ends here







































// Handle image upload
app.post('/upload-image', upload.single('image'), (req, res) => {
    const email = req.session.user.email; // Retrieve email from session
    const image = req.file ? req.file.buffer : null; // Ensure image file exists

    if (!email || !image) {
        return res.json({ success: false, message: 'Email and image are required.' });
    }

    // Query to check if the user exists
    const checkUserQuery = 'SELECT * FROM Sign_Up WHERE email = ?';
    
    pool.query(checkUserQuery, [email], (err, results) => {
        if (err) {
            console.error('Error checking user existence:', err);
            return res.json({ success: false, message: 'Error checking user.' });
        }

        if (results.length > 0) {
            // User exists, update image
            const updateImageQuery = `
                UPDATE Sign_Up 
                SET image = ? 
                WHERE email = ?`;

            pool.query(updateImageQuery, [image, email], (err) => {
                if (err) {
                    console.error('Error updating database:', err);
                    return res.json({ success: false, message: 'Error uploading image.' });
                }

                res.json({ success: true, message: 'Image uploaded successfully!' });
            });
        } else {
            // User does not exist
            res.json({ success: false, message: 'User does not exist.' });
        }
    });
});


app.post('/book-appointment', (req, res) => {
    const { date, time, reason } = req.body;
    const email = req.session.user.email; // Retrieve email from session

    if (!email || !date || !time || !reason) {
        return res.json({ success: false, message: 'All fields are required.' });
    }

    // Extract only the date part
    const appointmentDate = new Date(date).toISOString().split('T')[0];

    const query = 'INSERT INTO Appointment (email, Appointment_date, Appointment_time, Appointment_Description, status) VALUES (?, ?, ?, ?, ?)';
    pool.query(query, [email, appointmentDate, time, reason, 'pending'], (err, results) => {
        if (err) {
            console.error('Error inserting into database:', err);
            return res.json({ success: false, message: 'Error booking appointment.' });
        }

        res.json({ success: true, message: 'Appointment booked successfully!' });
    });
});


app.get('/get-appointment', (req, res) => {
    const email = req.session.user.email; // Retrieve email from session

    if (!email) {
        return res.status(400).json({ success: false, message: 'User not logged in.' });
    }

    const query = `
        SELECT 
            DATE_FORMAT(Appointment_date, '%Y-%m-%dT%H:%i:%sZ') AS Appointment_date, 
            Appointment_time, 
            Appointment_Description,
            IFNULL(status, '...') AS status
        FROM Appointment 
        WHERE email = ?`;

    pool.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.status(500).json({ success: false, message: 'Error retrieving appointment.' });
        }

        if (results.length > 0) {
            res.json({ success: true, appointment: results[0] });
        } else {
            res.json({ success: false, message: 'No appointment found.', status: '...' });
        }
    });
});



app.post('/update-appointment', (req, res) => {
    const { date, time, reason } = req.body;
    const email = req.session.user.email; // Retrieve email from session

    if (!email || !date || !time || !reason) {
        return res.json({ success: false, message: 'All fields are required.' });
    }

    const query = 'UPDATE Appointment SET Appointment_date = ?, Appointment_time = ?, Appointment_Description = ? WHERE email = ?';
    pool.query(query, [date, time, reason, email], (err, results) => {
        if (err) {
            console.error('Error updating database:', err);
            return res.json({ success: false, message: 'Error updating appointment.' });
        }

        res.json({ success: true, message: 'Appointment updated successfully!' });
    });
});

//Delete post
app.post('/delete-appointment', (req, res) => {
    const email = req.session.user.email; // Retrieve email from session

    if (!email) {
        return res.status(400).json({ success: false, message: 'User not logged in.' });
    }

    const query = 'DELETE FROM Appointment WHERE email = ?';
    pool.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error deleting from database:', err);
            return res.status(500).json({ success: false, message: 'Error deleting appointment.' });
        }

        res.json({ success: true, message: 'Appointment deleted successfully!' });
    });
});


//Request emergency
app.post('/report-emergency', (req, res) => {
    const { reason, residence, location } = req.body; 
    const email = req.session.user.email; // Retrieve email from session

    if (!email || !reason || !residence || !location) {
        return res.json({ success: false, message: 'All fields are required.' });
    }

    // Query to retrieve first name, last name, address, and phone number
    const userQuery = 'SELECT firstname, lastname, address, phone FROM Sign_Up WHERE email = ?';
    pool.query(userQuery, [email], (err, userResults) => {
        if (err) {
            console.error('Error retrieving user details:', err);
            return res.json({ success: false, message: 'Error retrieving user details.' });
        }

        if (userResults.length === 0) {
            return res.json({ success: false, message: 'User not found.' });
        }

        const { firstname, lastname, address, phone } = userResults[0];
        console.log('Retrieved user details:', lastname, firstname, phone, address); // Debugging log

        // Insert emergency report with reordered fields
        const emergencyQuery = `
            INSERT INTO Emergency (email, lastname, firstname, phone_number, address, Live_location, Emergency_Reason, Emergency_datetime, Emergency_Residence)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`;
        pool.query(emergencyQuery, [email, lastname, firstname, phone, address, location, reason, residence], (err, results) => {
            if (err) {
                console.error('Error inserting into database:', err);
                return res.json({ success: false, message: 'Error reporting emergency.' });
            }

            res.json({ success: true, message: 'Emergency reported successfully!' });
        });
    });
});


app.post('/check-emergency', (req, res) => {
    const email = req.session.user.email; // Retrieve email from session

    if (!email) {
        return res.json({ success: false, message: 'User email is required.' });
    }

    const query = `
    SELECT * FROM Emergency
    WHERE email = ?
    `;

    pool.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error checking emergency status:', err);
            return res.json({ success: false, message: 'Error checking emergency status.' });
        }

        // Check if any results exist
        const isEmergencyOngoing = results.length > 0;
        res.json({ success: true, isEmergencyOngoing });
    });
});


// Serve the login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// Serve the appropriate page based on the selected table
app.get('/login', (req, res) => {
    // Example logic to determine which table is selected
    const selectedTable = req.query.table; // Assumes the table name is passed as a query parameter

    if (selectedTable === 'Sign_Up') {
        // Serve the Chatbot page if the 'signup' table is selected
        res.sendFile(path.join(__dirname, 'public', 'Chatbot.html'));
    } else if (selectedTable = "clinic staff") {
        // Serve another HTML file if a different table is selected
        res.sendFile(path.join(__dirname, 'public', 'AnotherPage.html'));
    }
});



// Serve the Agent page
app.get('/agent', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'agent.html'));
});




// Endpoint to handle user login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ success: false, message: 'Email and password are required.' });
    }

    const query = 'SELECT email, firstName, lastName, phone, address, password, image, userType FROM Sign_Up WHERE email = ?';

    pool.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.json({ success: false, message: 'Error logging in.' });
        }

        if (results.length > 0) {
            const user = results[0];

            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    console.error('Error checking password:', err);
                    return res.json({ success: false, message: 'Error logging in.' });
                }

                if (isMatch) {
                    // Store user information in session
                    req.session.user = {
                        name: user.firstName,
                        surname: user.lastName,
                        email: user.email,
                        phone: user.phone,
                        address: user.address,
                        profileImage: user.image,
                        userType: user.userType // Include userType here
                    };
                    // Respond with success and user info
                    res.json({ success: true, message: 'Login successful!', user: req.session.user });
                } else {
                    res.json({ success: false, message: 'Invalid email or password.' });
                }
            });
        } else {
            res.json({ success: false, message: 'Invalid email or password.' });
        }
    });
});




//create a method that verify an agent
// Verify agent's name from the database
app.post('/verify-agent', (req, res) => {
    const agentName = req.body.name;

    const query = 'SELECT * FROM agents WHERE name = ?';
    db.query(query, [agentName], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            // Agent name found in the database
            res.json({ success: true });
        } else {
            // Agent name not found in the database
            res.json({ success: false });
        }
    });
});


// Serve the screen page and display the name based on login credentials
app.post('/Chatbot', (req, res) => {
    const { email, password } = req.body;

    // Query to find the student by email
    const query = 'SELECT  firstName, lastName, email, phone, address, password FROM Sign_Up WHERE email = ?';

    pool.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.status(500).send('Server error');
        }

        if (results.length > 0) {
            const user = results[0];

            // Check password
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    console.error('Error checking password:', err);
                    return res.status(500).send('Server error');
                }

                if (isMatch) {
                    // Successfully authenticated
                    res.sendFile(`Chatbot.html
                        
                    `);
                } else {
                    res.status(401).send('Invalid email or password');
                }
            });
        } else {
            res.status(401).send('Invalid email or password');
        }
    });
});

app.get('/api/user', (req, res) => {
    if (req.session.user) {
        const { name, surname, email, phone, address, profileImage } = req.session.user;

        // Convert BLOB to Base64 if profileImage exists
        const base64Image = profileImage ? Buffer.from(profileImage).toString('base64') : null;

        res.json({ 
            success: true, 
            user: { 
                name, 
                surname, 
                email, 
                phone, 
                address, 
                profileImage: base64Image // Use the converted Base64 string
            } 
        });
    } else {
        res.status(401).json({ success: false, message: 'User not logged in.' });
    }
});



// Handle registration request
app.post('/register', (req, res) => {
    const { firstName, lastName, email, phone, address, password, userType } = req.body; // Include userType

    // Hash the password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.json({ success: false, message: 'Error registering user.' });
        }

        const query = 'INSERT INTO Sign_Up (firstName, lastName, email, phone, address, password, userType) VALUES (?, ?, ?, ?, ?, ?, ?)'; // Include userType
        pool.query(query, [firstName, lastName, email, phone, address, hashedPassword, userType], (err, results) => {
            if (err) {
                console.error('Error inserting into database:', err);
                return res.json({ success: false, message: 'Error registering user.' });
            }

            res.json({ success: true, message: 'Registration successful!' });
        });

    });
});


app.get('/get-password', (req, res) => {
    const email = req.session.user.email; // Use email from session

    // Check if email exists in the database
    const checkEmailQuery = 'SELECT email, password FROM Sign_Up WHERE email = ?';
    pool.query(checkEmailQuery, [email], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.json({ success: false, message: 'Error retrieving password.' });
        }

        if (results.length === 0) {
            return res.json({ success: false, message: 'Error: Email not recognized. Please contact support.' });
        }

        const existingPassword = results[0].password; // Access the password from the first result row
        res.json({ success: true, password: existingPassword });
    });
});

async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

app.post('/update-profile', async (req, res) => {
    const email = req.session.user.email; // Use email from session
    const { firstName, lastName, phone, address, newPassword } = req.body; // Include newPassword

    // Log received data
    console.log('Received data:', req.body);

    // Check if email exists in the database
    const checkEmailQuery = 'SELECT email FROM Sign_Up WHERE email = ?';
    pool.query(checkEmailQuery, [email], async (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.json({ success: false, message: 'Error checking email.' });
        }

        if (results.length === 0) {
            return res.json({ success: false, message: 'Error: Email not recognized. Please contact support.' });
        }

        // Prepare to update the profile
        const queryParts = [];
        const queryParams = [];
        if (firstName) {
            queryParts.push('firstName = ?');
            queryParams.push(firstName);
        }
        if (lastName) {
            queryParts.push('lastName = ?');
            queryParams.push(lastName);
        }
        if (phone) {
            queryParts.push('phone = ?');
            queryParams.push(phone);
        }
        if (address) {
            queryParts.push('address = ?');
            queryParams.push(address);
        }
        if (newPassword) {
            try {
                // Hash the new password before saving it to the database
                const hashedPassword = await hashPassword(newPassword);
                queryParts.push('password = ?');
                queryParams.push(hashedPassword);
            } catch (hashError) {
                console.error('Error hashing password:', hashError);
                return res.json({ success: false, message: 'Error hashing password.' });
            }
        }

        // Append the email to the parameters
        queryParams.push(email);

        if (queryParts.length === 0) {
            return res.json({ success: false, message: 'No fields to update.' });
        }

        const query = `UPDATE Sign_Up SET ${queryParts.join(', ')} WHERE email = ?`;
        
        // Debugging: Log the final query
        console.log('Executing query:', query);
        console.log('With parameters:', queryParams);

        pool.query(query, queryParams, (err, results) => {
            if (err) {
                console.error('Error updating database:', err);
                return res.json({ success: false, message: 'Error updating profile.' });
            }

            console.log('Update results:', results);
            res.json({ success: true, message: 'Profile updated successfully!' });
        });
    });
});


//message
app.post('/send-sms', (req, res) => {
    const username = 'muhle_surp';
    const password = 'cFP6LSTb7hv.4vj';
    const postData = JSON.stringify(req.body);

    const options = {
        hostname: 'api.bulksms.com',
        port: 443,    
        path: '/v1/messages',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64')  // Ensure proper Base64 encoding
        }
    };

    const reqApi = https.request(options, (resp) => {
        let data = '';
        
        // Log the status code for debugging
        console.log(`Status Code: ${resp.statusCode}`);
        console.log(`Headers: ${JSON.stringify(resp.headers)}`);

        // Handle different HTTP status codes
        if (resp.statusCode === 401) {
            console.error('Authorization failed. Check your username and password.');
            res.status(401).send('Authorization failed. Please check your credentials.');
            return;
        } else if (resp.statusCode >= 400) {
            console.error(`Failed with status code: ${resp.statusCode}`);
            res.status(resp.statusCode).send(`Failed with status code: ${resp.statusCode}`);
            return;
        }

        // Listen for data from the API response
        resp.on('data', (chunk) => {
            data += chunk;
        });

        resp.on('end', () => {
            console.log('Response from API:', data);  // Log the actual response for debugging
            res.send("Message sent successfully!");
        });
    });

    reqApi.on('error', (e) => {
        console.error('Error sending message:', e.message);  // Add detailed logging
        res.status(500).send("Error sending message: " + e.message);
    });

    reqApi.write(postData);
    reqApi.end();
});

//phone number of user
app.get('/get-user-phone', (req, res) => {
    const email = req.session.user.email; // Replace with logic to get the user's email from session or request

    if (!email) {
        return res.json({ success: false, message: 'User email is required.' });
    }

    const query = 'SELECT phone FROM Sign_Up WHERE email = ?';

    pool.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error fetching phone number:', err);
            return res.json({ success: false, message: 'Error fetching phone number.' });
        }

        if (results.length > 0) {
            res.json({ phone: results[0].phone });
        } else {
            res.json({ success: false, message: 'Phone number not found.' });
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});