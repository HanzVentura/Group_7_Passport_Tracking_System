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

// Create Users table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT,
    email TEXT UNIQUE,
    password TEXT
)`);

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

        // Save user details in session
        req.session.user = { id: user.id, fullname: user.fullname, email: user.email };
        res.json({ success: true, message: 'Login successful!' });
    });
});

// --- GET USER DATA FOR DASHBOARD ---
app.get('/api/user-data', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, fullname: req.session.user.fullname });
    } else {
        res.json({ loggedIn: false });
    }
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