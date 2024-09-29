const express = require('express');
const { connectToDatabase,sql } = require('../db');
const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

// Create a new inventory item - Protected Route
router.post('/create', verifyToken, async (req, res) => {
    const { product_name, qty, unit, purchase_price,default_price } = req.body;

    try {
        const pool = await connectToDatabase() // Ensure a connection pool is available

        const request = new sql.Request(pool); // Use the pool for the request

        request.input('product_name', sql.VarChar, product_name);
        request.input('qty', sql.Int, qty);
        request.input('unit', sql.VarChar, unit);
        request.input('purchase_price', sql.Decimal(18, 2), purchase_price);
        request.input('default_price', sql.Decimal(18, 2), default_price);

        await request.query(`
            INSERT INTO [Inventory] (product_name, qty, unit, purchase_price,default_price,purchase_date)
            VALUES (@product_name, @qty, @unit, @purchase_price,@default_price,GETDATE())
        `);

        res.status(201).json({ message: 'Inventory item created successfully' });
    } catch (err) {
        console.error('Error creating inventory item:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Fetch all inventory items - Protected Route
router.get('/all', verifyToken, async (req, res) => {
    try {
        const pool = await connectToDatabase() // Ensure a connection pool is available

        const request = new sql.Request(pool); // Use the pool for the request

        const result = await request.query(`SELECT * FROM [Inventory] where active=1`);

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching inventory items:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update an inventory item - Protected Route
router.put('/update/:product_id', verifyToken, async (req, res) => {
    const { product_id } = req.params;
    const { product_name, qty, unit, purchase_price,default_price } = req.body;

    try {
        const pool = await connectToDatabase() // Ensure a connection pool is available

        const request = new sql.Request(pool); // Use the pool for the request

        request.input('product_id', sql.Int, product_id);
        request.input('product_name', sql.VarChar, product_name);
        request.input('qty', sql.Int, qty);
        request.input('unit', sql.VarChar, unit);
        request.input('purchase_price', sql.Decimal(18, 2), purchase_price);
        request.input('default_price', sql.Decimal(18, 2), default_price);

        await request.query(`
            UPDATE [Inventory]
            SET product_name = @product_name, qty = @qty, unit = @unit, purchase_price = @purchase_price,default_price = @default_price,purchase_date=getDate()
            WHERE product_id = @product_id
        `);

        res.status(200).json({ message: 'Inventory item updated successfully' });
    } catch (err) {
        console.error('Error updating inventory item:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete an inventory item - Protected Route
router.put('/delete/:product_id', verifyToken, async (req, res) => {
    const { product_id } = req.params;

    try {
        const pool = await connectToDatabase() // Ensure a connection pool is available

        const request = new sql.Request(pool); // Use the pool for the request

        request.input('product_id', sql.Int, product_id);

        await request.query(`
            update Inventory set active=0 where product_id=@product_id
        `);

        res.status(200).json({ message: 'Inventory item deleted successfully' });
    } catch (err) {
        console.error('Error deleting inventory item:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
