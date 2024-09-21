const express = require('express');
const { connectToDatabase, sql } = require('../db');
const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

// Create  API
router.post('/create', verifyToken, async (req, res) => {
    const { store_name, store_address, store_person, store_person_contact } = req.body;

    try {
        const pool = await connectToDatabase() // Ensure a connection pool is available

        const request = new sql.Request(pool); // Use the pool for the request

        request.input('store_name', sql.VarChar,store_name);
        request.input('store_address', sql.VarChar, store_address);
        request.input('store_person', sql.VarChar, store_person);
        request.input('store_person_contact', sql.VarChar, store_person_contact);

        await request.query(`
            INSERT INTO [medical_store] (store_name, store_address,store_person,store_person_contact)
            VALUES (@store_name, @store_address, @store_person, @store_person_contact)
        `);

        res.status(201).json({ message: 'Medical store created successfully' });
    } catch (err) {
        console.error('Error creating store:', err);
        res.status(500).json({ message: 'Server error' });
    }
});
////get all 
router.get('/all', verifyToken, async (req, res) => {
    try {
        const pool = await connectToDatabase() // Ensure a connection pool is available

        const request = new sql.Request(pool); // Use the pool for the request

        const result = await request.query(`SELECT * FROM [medical_store] where active=1`);

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error('Error fetching medical store :', err);
        res.status(500).json({ message: 'Server error' });
    }
});
///update
router.put('/update/:store_id', verifyToken, async (req, res) => {
    const {store_id} = req.params;
    const { store_name, store_address, store_person, store_person_contact } = req.body;

    try {
        const pool = await connectToDatabase() // Ensure a connection pool is available

        const request = new sql.Request(pool); // Use the pool for the request

        request.input('store_id', sql.Int,store_id);
        request.input('store_name', sql.VarChar,store_name);
        request.input('store_address', sql.VarChar, store_address);
        request.input('store_person', sql.VarChar, store_person);
        request.input('store_person_contact', sql.VarChar, store_person_contact);
        await request.query(`
            UPDATE [medical_store]
            SET store_name = @store_name, store_address = @store_address, store_person = @store_person, store_person_contact = @store_person_contact
            WHERE store_id = @store_id
        `);

        res.status(200).json({ message: 'streupdated successfully' });
    } catch (err) {
        console.error('Error updating store item:', err);
        res.status(500).json({ message: 'Server error' });
    }
});
/// deelete 
/*
router.delete('/delete/:store_id', verifyToken, async (req, res) => {
    const { store_id} = req.params;

    try {
        const pool = await connectToDatabase() // Ensure a connection pool is available

        const request = new sql.Request(pool); // Use the pool for the request

        request.input('store_id', sql.Int, store_id);

        await request.query(`
            DELETE FROM [medical_store] WHERE store_id = @store_id
        `);

        res.status(200).json({ message: 'Medical deleted successfully' });
    } catch (err) {
        console.error('Error deleting :', err);
        res.status(500).json({ message: 'Server error' });
    }
});
*/
router.put('/delete/:store_id', verifyToken, async (req, res) => {
    const { store_id } = req.params;

    try {
        const pool = await connectToDatabase() // Ensure a connection pool is available

        const request = new sql.Request(pool); // Use the pool for the request

        request.input('store_id', sql.Int, store_id);

        await request.query(`
            update medical_store set active=0 where store_id=@store_id
        `);

        res.status(200).json({ message: 'Medical store deleted successfully' });
    } catch (err) {
        console.error('Error deleting store:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;
