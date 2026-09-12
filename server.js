const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to parse form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup Session to remember logged-in users
app.use(session({
    secret: 'passport-system-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Serve frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQLite Database (creates database.db automatically)
const db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Initialize every table before handling requests. The compatibility checks keep
// existing databases usable when new appointment/message columns are introduced.
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT,
        email TEXT UNIQUE,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        application_id TEXT NOT NULL,
        application_type TEXT NOT NULL DEFAULT 'New First-Time Application',
        status TEXT NOT NULL DEFAULT 'Pending',
        appointment_date TEXT,
        appointment_location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS enquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        application_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending Review',
        reply TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.all(`PRAGMA table_info(applications)`, (err, columns) => {
        if (err) {
            console.error('Unable to inspect applications table:', err.message);
            return;
        }

        const existingColumns = columns.map(column => column.name);
        const addColumn = (column, definition) => {
            if (!existingColumns.includes(column)) {
                db.run(`ALTER TABLE applications ADD COLUMN ${column} ${definition}`, (alterError) => {
                    if (alterError) {
                        console.error(`Unable to add ${column} column:`, alterError.message);
                    }
                });
            }
        };

        addColumn('appointment_date', 'TEXT');
        addColumn('appointment_location', 'TEXT');
        addColumn('application_type', "TEXT NOT NULL DEFAULT 'New First-Time Application'");
    });

    db.all(`PRAGMA table_info(enquiries)`, (err, columns) => {
        if (err) {
            console.error('Unable to inspect enquiries table:', err.message);
            return;
        }

        if (!columns.some(column => column.name === 'message')) {
            db.run(`ALTER TABLE enquiries ADD COLUMN message TEXT NOT NULL DEFAULT ''`, (alterError) => {
                if (alterError) {
                    console.error('Unable to add enquiry message column:', alterError.message);
                }
            });
        }
    });
});

// --- SIGN UP API ---
app.post('/api/signup', async (req, res) => {
    const { fullname, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)`;
        
        db.run(query, [fullname, email, hashedPassword], function(err) {
            if (err) {
                return res.json({ success: false, message: 'Email or phone already registered!' });
            }
            res.json({ success: true, message: 'Registration successful!' });
        });
    } catch (error) {
        res.json({ success: false, message: 'Server error during signup.' });
    }
});

// --- LOG IN API ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const query = `SELECT * FROM users WHERE email = ?`;
    db.get(query, [email], async (err, user) => {
        if (err || !user) {
            return res.json({ success: false, message: 'Invalid credentials!' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: 'Invalid credentials!' });
        }

        // Replace the session user with the freshly authenticated database record.
        const authenticatedUser = { id: user.id, fullName: user.fullname, email: user.email };
        req.session.user = authenticatedUser;
        res.json({ success: true, message: 'Login successful!' });
    });
});

// --- GET USER DATA FOR DASHBOARD ---
app.get('/api/user-data', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, fullName: req.session.user.fullName });
    } else {
        res.json({ loggedIn: false });
    }
});

// --- APPLICATION API ---
app.post('/api/applications', (req, res) => {
    const { email, applicationId, appId, applicationType } = req.body;
    const savedApplicationId = applicationId || appId;
    const savedApplicationType = applicationType || 'New First-Time Application';

    if (!email || !savedApplicationId) {
        return res.status(400).json({ success: false, message: 'Email and application ID are required.' });
    }

    const updateQuery = `UPDATE applications
        SET application_id = ?, application_type = ?, status = 'Pending Payment', appointment_date = NULL,
            appointment_location = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE email = ?`;

    db.run(updateQuery, [savedApplicationId, savedApplicationType, email], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Unable to save application.' });
        }

        if (this.changes > 0) {
            return res.json({
                success: true,
                applicationId: savedApplicationId,
                applicationType: savedApplicationType,
                status: 'Pending Payment',
                appointmentDate: null,
                appointmentLocation: null
            });
        }

        db.run(
            `INSERT INTO applications (email, application_id, application_type, status, appointment_date, appointment_location)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [email, savedApplicationId, savedApplicationType, 'Pending Payment', null, null],
            function(insertError) {
                if (insertError) {
                    return res.status(500).json({ success: false, message: 'Unable to save application.' });
                }
                res.status(201).json({
                    success: true,
                    id: this.lastID,
                    applicationId: savedApplicationId,
                    applicationType: savedApplicationType,
                    status: 'Pending Payment',
                    appointmentDate: null,
                    appointmentLocation: null
                });
            }
        );
    });
});

app.get('/api/applications/:email', (req, res) => {
    db.get(
        `SELECT id, email, application_id AS applicationId,
            application_type AS applicationType, status,
            appointment_date AS appointmentDate,
            appointment_location AS appointmentLocation,
            created_at AS createdAt, updated_at AS updatedAt
         FROM applications WHERE email = ?`,
        [req.params.email],
        (err, application) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Unable to fetch application.' });
            }
            res.json({ success: true, application: application || null });
        }
    );
});

// --- PAYMENT API ---
app.post('/api/payments', (req, res) => {
    const { email, applicationId, processingType, amount, paymentMethod } = req.body;
    const validPlans = {
        regular: { label: 'Regular Processing', amount: 950 },
        expedited: { label: 'Expedited / Rush Processing', amount: 1200 }
    };
    const selectedPlan = validPlans[processingType];
    const validMethods = ['GCash', 'Maya', 'Credit Card'];

    if (!email || !applicationId || !selectedPlan || Number(amount) !== selectedPlan.amount || !validMethods.includes(paymentMethod)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid application, processing plan, amount, and payment method.' });
    }

    const appointmentDate = (() => {
        const date = new Date();
        date.setDate(date.getDate() + (processingType === 'expedited' ? 7 : 12));
        return date.toISOString().slice(0, 10);
    })();
    const appointmentLocation = 'DFA NCR (SM Megamall)';

    db.run(
        `UPDATE applications
         SET status = 'Paid', appointment_date = ?, appointment_location = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = ? AND application_id = ?`,
        [appointmentDate, appointmentLocation, email, applicationId],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Unable to process payment.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'Application not found.' });
            }
            res.json({
                success: true,
                message: 'Payment recorded successfully. Your appointment has been generated.',
                applicationId,
                status: 'Paid',
                appointmentDate,
                appointmentLocation,
                processingType: selectedPlan.label,
                amount: selectedPlan.amount,
                paymentMethod
            });
        }
    );
});

// --- ENQUIRY API ---
app.post('/api/enquiries', (req, res) => {
    const { email, applicationId, appId, subject, message } = req.body;
    const linkedApplicationId = applicationId || appId;

    if (!linkedApplicationId || !subject || !message) {
        return res.status(400).json({ success: false, message: 'Application ID, subject, and message are required.' });
    }

    db.run(
        `INSERT INTO enquiries (email, application_id, subject, message) VALUES (?, ?, ?, ?)`,
        [email || null, linkedApplicationId, subject, message],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Unable to submit enquiry.' });
            }
            res.status(201).json({
                success: true,
                enquiry: {
                    id: this.lastID,
                    email: email || null,
                    appId: linkedApplicationId,
                    subject,
                    message,
                    status: 'Pending Review',
                    reply: 'Awaiting administrator response...'
                }
            });
        }
    );
});

app.get('/api/enquiries', (req, res) => {
    db.all(
        `SELECT id, email, application_id AS appId, subject, message, status, reply,
                created_at AS date
         FROM enquiries ORDER BY id DESC`,
        (err, enquiries) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Unable to fetch enquiries.' });
            }
            res.json({ success: true, enquiries });
        }
    );
});

app.post('/api/enquiries/reply', (req, res) => {
    const { enquiryId, id, reply } = req.body;
    const savedEnquiryId = enquiryId || id;

    if (!savedEnquiryId || !reply || !reply.trim()) {
        return res.status(400).json({ success: false, message: 'Enquiry ID and reply are required.' });
    }

    db.run(
        `UPDATE enquiries SET reply = ?, status = 'Resolved' WHERE id = ?`,
        [reply.trim(), savedEnquiryId],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Unable to save enquiry reply.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'Enquiry not found.' });
            }
            res.json({ success: true, status: 'Resolved', reply: reply.trim() });
        }
    );
});

// --- LOGOUT API ---
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running live at http://localhost:${PORT}`);
});