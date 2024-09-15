const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { connectToDatabase } = require('./db');
const authRoutes = require('./routes/auth');
const medicalStoreRoutes = require('./routes/medical-store');
const inventoryRoutes = require('./routes/inventory');
const orderRoutes = require('./routes/order');
const test=require('./routes/test')


  
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000;



app.use(cors());
app.use(bodyParser.json());

app.use('/api/auth', authRoutes);
app.use('/api/medical-store', medicalStoreRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/order',orderRoutes);
app.use('/api/test',test);




const startServer = async () => {
    try {
        await connectToDatabase(); // Ensure database connection is established
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (err) {
        console.error('Error starting server:', err);
    }
};

startServer();
