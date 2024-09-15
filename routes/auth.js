const express = require('express');
const jwt = require('jsonwebtoken');
const { connectToDatabase, sql } = require('../db');
const router = express.Router();
require('dotenv').config();

// Login API
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const pool = await connectToDatabase();
        const result = await pool
            .request()
            .input('username', sql.VarChar, username)
            .input('password', sql.VarChar, password)
            .query('SELECT * FROM [user] WHERE username = @username AND password = @password');

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const user = result.recordset[0];

        // Create a JWT token
        const token = jwt.sign(
            { id: user.user_id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token valid for 1 hour
        );

        res.status(200).json({
            message: 'Login successful',
            token: token
        });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ message: 'Error logging in' });
    }
});

module.exports = router;
