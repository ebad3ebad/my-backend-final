const sql = require('mssql');
require('dotenv').config();

const config = {
    user: "ebad1",
    password: "ebad1",
    server: "DESKTOP-JA3PT7Q",
    database: process.env.DB_NAME,
    options: {
        encrypt: false, // Set to true if using Azure SQL
        trustServerCertificate: true // Change to false for production
    }
};

let poolPromise;

async function connectToDatabase() {
    try {
        if (!poolPromise) {
            poolPromise = new sql.ConnectionPool(config)
                .connect()
                .then(pool => {
                    console.log('Connected to SQL Server');
                    return pool;
                });
        }
        return poolPromise;
    } catch (err) {
        console.error('Database connection error:', err);
        process.exit(1);
    }
}

module.exports = {
    connectToDatabase,
    sql
};
