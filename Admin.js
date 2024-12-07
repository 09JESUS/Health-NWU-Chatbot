const express = require('express');
const mysql = require('mysql2'); // For MySQL database connection
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs'); // For password hashing
const path = require('path'); // For serving static files
const session = require('express-session'); // For session handling
const cors = require('cors'); // For enabling Cross-Origin Resource Sharing
const multer = require('multer'); // For file uploads
const app = express(); // Initialize the app

// Enable CORS
app.use(cors());

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (e.g., HTML, CSS, JS) from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware for handling user sessions
app.use(session({
    secret: 'your_secret_key', // Replace with a secure secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'shakira',
    password: 'shakira123',
    database: 'chatbot_db',
    insecureAuth: true,
    connectionLimit: 10 // Optional: to limit the number of simultaneous connections
});
// Set the port the server will listen to
const port = 3001;


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
    


});
// Configure multer for file uploads (optional, based on your needs)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve the  page (Admin.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admin.html'));
});

// Handle registration request (insert user into MySQL database)

// Register or update patient
app.post('/register', (req, res) => {
    const { firstName, lastName, email, phone, address, password, userType } = req.body;

    // Hash the password before storing or updating the record
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.json({ success: false, message: 'Error processing registration.' });
        }

        // Query to check if the email already exists
        const checkEmailQuery = 'SELECT * FROM Sign_Up WHERE email = ?';
        pool.query(checkEmailQuery, [email], (err, results) => {
            if (err) {
                console.error('Error querying database:', err);
                return res.json({ success: false, message: 'Error processing request.' });
            }

            if (results.length > 0) {
                // If email exists, update the existing record
                const updateQuery = 'UPDATE Sign_Up SET firstName = ?, lastName = ?, phone = ?, address = ?, password = ?, userType = ? WHERE email = ?';
                pool.query(updateQuery, [firstName, lastName, phone, address, hashedPassword, userType, email], (err, updateResults) => {
                    if (err) {
                        console.error('Error updating database:', err);
                        return res.json({ success: false, message: 'Error updating patient record.' });
                    }

                    res.json({ success: true, message: 'Patient record updated successfully!' });
                });
            } else {
                // If email does not exist, insert a new record
                const insertQuery = 'INSERT INTO Sign_Up (firstName, lastName, email, phone, address, password, userType) VALUES (?, ?, ?, ?, ?, ?, ?)';
                pool.query(insertQuery, [firstName, lastName, email, phone, address, hashedPassword, userType], (err, insertResults) => {
                    if (err) {
                        console.error('Error inserting into database:', err);
                        return res.json({ success: false, message: 'Error registering patient.' });
                    }

                    res.json({ success: true, message: 'Patient registration successful!' });
                });
            }
        });
    });
});


app.post('/delete', (req, res) => {
    const { email } = req.body; // Extracting the patient's email from the request body

    if (!email) {
        return res.json({ success: false, message: 'Email is required to delete the patient.' });
    }

    // Query to delete the patient from the database
    const deleteQuery = 'DELETE FROM Sign_Up WHERE email = ?';
    pool.query(deleteQuery, [email], (err, results) => {
        if (err) {
            console.error('Error deleting patient from the database:', err);
            return res.json({ success: false, message: 'Error deleting patient from the database.' });
        }

        if (results.affectedRows === 0) {
            // No rows were deleted, meaning the email was not found
            return res.json({ success: false, message: 'Patient not found.' });
        }

        res.json({ success: true, message: 'Patient deleted successfully!' });
    });
});


app.post('/updateStatus', (req, res) => {
    const { email, status } = req.body; // Extract email and status from request body

    if (!email || !status) {
        return res.json({ success: false, message: 'Email and status are required.' });
    }

    // Query to update the appointment status in the database
    const updateStatusQuery = 'UPDATE Appointment SET status = ? WHERE email = ?';
    
    pool.query(updateStatusQuery, [status, email], (err, results) => {
        if (err) {
            console.error('Error updating appointment status in the database:', err);
            return res.json({ success: false, message: 'Error updating appointment status.' });
        }

        res.json({ success: true, message: 'Appointment status updated successfully!' });
    });
});



app.get('/users', (req, res) => {
    const query = 'SELECT firstName, lastName, email, phone, address FROM Sign_Up WHERE userType = ?';
    pool.query(query, ['User'], (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.json({ success: false, message: 'Error fetching users.', error: err.message });
        }

        res.json({ success: true, users: results });
    });
});


app.get('/agents', (req, res) => {
    const query = 'SELECT firstName, lastName, email, phone , address FROM Sign_Up WHERE userType = ?';
    pool.query(query, ['Agent'], (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.json({ success: false, message: 'Error fetching users.', error: err.message });
        }

        res.json({ success: true, agents: results });
    });
});


// Route to Fetch All Appointments
// Route to Add a New Appointmentapp.post('/appointments', (req, res) => {
    app.post('/appointments', (req, res) => {
    const { email, date, time, description, status } = req.body; // Extract appointment data from the request body

    if (!email || !date || !time || !description) {
        return res.json({ success: false, message: 'All fields are required.' });
    }

    // Query to check if the email already exists in the appointments table
    const checkEmailQuery = 'SELECT * FROM Appointment WHERE email = ?';
    
    pool.query(checkEmailQuery, [email], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            return res.json({ success: false, message: 'Error processing request.' });
        }

        if (results.length > 0) {
            // If email exists, update the existing appointment record
            const updateQuery = 'UPDATE Appointment SET Appointment_date = ?, Appointment_time = ?, Appointment_Description = ?, status = ? WHERE email = ?';
            pool.query(updateQuery, [date, time, description, status, email], (err, updateResults) => {
                if (err) {
                    console.error('Error updating appointment in the database:', err);
                    return res.json({ success: false, message: 'Error updating appointment.' });
                }

                res.json({ success: true, message: 'Appointment updated successfully!' });
            });
        } else {
            // If email does not exist, insert a new appointment
            const insertQuery = 'INSERT INTO Appointment (email, Appointment_date, Appointment_time, Appointment_Description, status) VALUES (?, ?, ?, ?, ?)';
            pool.query(insertQuery, [email, date, time, description, status], (err, insertResults) => {
                if (err) {
                    console.error('Error inserting appointment into database:', err);
                    return res.json({ success: false, message: 'Email doesn\'t exist.' });
                }

                res.json({ success: true, message: 'Appointment added successfully!' });
            });
        }
    });
});


// Route to delete an appointment by email
app.post('/deleteAppointment', (req, res) => {
    const { email } = req.body; // Extract email from the request body

    // SQL query to delete the appointment from the database
    const deleteQuery = 'DELETE FROM Appointment WHERE email = ?';

    pool.query(deleteQuery, [email], (err, results) => {
        if (err) {
            console.error('Error deleting appointment from the database:', err);
            return res.json({ success: false, message: 'Error deleting appointment from the database.' });
        }

        if (results.affectedRows === 0) {
            return res.json({ success: false, message: 'Appointment not found.' });
        }

        res.json({ success: true, message: 'Appointment deleted successfully!' });
    });
});


// Assuming you have Express and MySQL set up
// Assuming you have Express and MySQL set up
app.post('/emergencies', (req, res) => {
    const { email, Live_location, firstname, lastname, phone_number, Emergency_Reason, Emergency_Residence, Emergency_datetime } = req.body;

    // SQL query to insert a new emergency record
    const query = `
        INSERT INTO Emergency (email, Live_location, firstname, lastname, phone_number, Emergency_Reason, Emergency_Residence, Emergency_datetime)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [email, Live_location, firstname, lastname, phone_number, Emergency_Reason, Emergency_Residence, Emergency_datetime];

    pool.query(query, values, (err, results) => {
        if (err) {
            console.error('Error posting emergency:', err);
            return res.json({ success: false, message: 'Error posting emergency.', error: err.message });
        }

        // If successful, send back the results (or any relevant info)
        res.json({ success: true, message: 'Emergency reported successfully', emergencyId: results.insertId });
    });
});

// POST route to update appointment status
app.post('/update-appointment-by-email/:email', (req, res) => {
    const email = req.params.email;
    const newStatus = req.body.status;

    // Check if the new status is provided
    if (!newStatus) {
        return res.status(400).json({ success: false, message: 'Status is required' });
    }

    // MySQL query to update the appointment status using the email
    const query = `
        UPDATE Appointment
        SET status = ?
        WHERE email = ?
    `;

    // Execute the update query
    pool.query(query, [newStatus, email], (err, result) => {
        if (err) {
            console.error('Error updating appointment status:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        // Check if any rows were affected (i.e., if the appointment was found)
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Appointment not found for the provided email' });
        }

        // Return success response
        res.json({ success: true, message: 'Appointment status updated successfully' });
    });
});

app.get('/get-users', async (req, res) => {
    try {
        await sql.connect(dbConfig);
        // Select users where userType is "User"
        const result = await sql.query`SELECT firstName, lastName, email, phone, address FROM Sign_Up WHERE userType = 'User'`;
        res.json(result.recordset); // Send the user data back to the client
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Error fetching data');
    }
});

// Route to Fetch All Appointments
app.get('/get-appointments', (req, res) => {
    const selectQuery = `
        SELECT email, Appointment_date, Appointment_time, Appointment_Description, status 
        FROM Appointment
    `;

    pool.query(selectQuery, (err, results) => {
        if (err) {
            console.error('Error retrieving appointments from the database:', err);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving appointments from the database.'
            });
        }

        // Return the results as JSON
        res.json({
            success: true,
            appointments: results
        });
    });
});


// Route to Fetch All Emergencies
app.get('/get-emergencies', (req, res) => {
    const selectQuery = `
        SELECT firstname, lastname, phone_number, address, Live_location, Emergency_Reason, Emergency_datetime, Emergency_Residence
        FROM Emergency
    `;

    pool.query(selectQuery, (err, results) => {
        if (err) {
            console.error('Error retrieving emergencies from the database:', err);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving emergencies from the database.'
            });
        }

        // Return the results as JSON
        res.json({
            success: true,
            emergencies: results
        });
    });
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
