const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
function verifyToken(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) {
        console.log('No token provided');
        return res.status(403).json({ message: 'No token provided' });
    }

    const tokenParts = token.split(' ');
    
    // Ensure token follows the "Bearer <token>" format
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
        console.log('Invalid token format:', token);
        return res.status(403).json({ message: 'Invalid token format' });
    }

    // Print the token sent in the request
    console.log('Token received from request:', tokenParts[1]);

    jwt.verify(tokenParts[1], process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log('Error verifying token:', err.message);
            return res.status(500).json({ message: 'Failed to authenticate token' });
        }

        // Print the decoded token (JWT payload)
        console.log('Decoded token:', decoded);

        req.userId = decoded.id;
        next();
    });
}

module.exports = verifyToken;
