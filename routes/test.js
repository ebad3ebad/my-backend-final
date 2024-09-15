const express = require('express');
const { connectToDatabase, sql } = require('../db');
const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

// Create Order API
router.post('/create', verifyToken, async (req, res) => {
    let { products, store_id } = req.body;
    if (products.length === 0) {
        return res.status(400).json({ message: 'No products provided' });
    }

    const pool = await connectToDatabase();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();  // Begin transaction
        const request = new sql.Request(transaction);

        // Extract user_id from decoded token (set in the verifyToken middleware)
        const user_id = req.userId;

        // Check if store_id exists in the medical_store table
        const storeResult = await request
            .input('store_id', sql.Int, store_id)
            .query('SELECT * FROM medical_store WHERE store_id = @store_id');

        if (storeResult.recordset.length === 0) {
            return res.status(400).json({ message: 'Store does not exist' });
        }

        // Handle the first product
        const firstProduct = products[0];
        let { product_id, qty, unit, sell_price, discount } = firstProduct;

        // Check if product_id exists in the inventory table
        let productResult = await request
            .input('product_id', sql.Int, product_id)
            .query('SELECT * FROM inventory WHERE product_id = @product_id');

        if (productResult.recordset.length === 0) {
            return res.status(400).json({ message: 'Product does not exist' });
        }

        let product = productResult.recordset[0];

        // Check if qty in order is less than or equal to qty in inventory
        if (product.qty < qty || product.unit !== unit) {
            return res.status(400).json({
                message: 'Insufficient quantity in inventory or unit mismatch'
            });
        }

        // Insert the first product into the order table
        await request
            .input('user_id', sql.Int, user_id) // Set the logged-in user's ID
            .input('qty', sql.Int, qty)
            .input('unit', sql.VarChar, unit)
            .input('sell_price', sql.Decimal(10, 2), sell_price)
            .input('discount', sql.Decimal(10, 2), discount)
            .query(`
                INSERT INTO [order] 
                (product_id, user_id, store_id, qty, unit, sell_price, discount, order_date) 
                VALUES (@product_id, @user_id, @store_id, @qty, @unit, @sell_price, @discount, getDate())
            `);

        // Get the generated order_id
        const orderId = (await request.query('SELECT IDENT_CURRENT(\'[order]\') AS order_id')).recordset[0].order_id;

        // Update the inventory by reducing the qty
        await request
            .input('new_qty', sql.Int, product.qty - qty)
            .query('UPDATE inventory SET qty = @new_qty WHERE product_id = @product_id');

        // Handle subsequent products
        for (let i = 1; i < products.length; i++) {
            const product = products[i];
            let { product_id, qty, unit, sell_price, discount } = product;

            const request = new sql.Request(transaction);
            // Check if product_id exists in the inventory table
            let productResult = await request
                .input('product_id', sql.Int, product_id)
                .query('SELECT * FROM inventory WHERE product_id = @product_id');

            if (productResult.recordset.length === 0) {
                continue; // Skip if product does not exist
            }

            const inventoryProduct = productResult.recordset[0];

            // Check if qty in order is less than or equal to qty in inventory
            if (inventoryProduct.qty < qty || inventoryProduct.unit !== unit) {
                continue; // Skip if insufficient quantity or unit mismatch
            }

            // Insert subsequent products into the order table with the same order_id
            await request
                .input('orderId', sql.Int, orderId)
                .input('user_id', sql.Int, user_id)
                .input('store_id', sql.Int, store_id)
                .input('qty', sql.Int, qty)
                .input('unit', sql.VarChar, unit)
                .input('sell_price', sql.Decimal(10, 2), sell_price)
                .input('discount', sql.Decimal(10, 2), discount)
                .query(`
                    SET IDENTITY_INSERT [dbo].[order] ON
                    INSERT INTO [order] 
                    (order_id, product_id, user_id, store_id, qty, unit, sell_price, discount, order_date) 
                    VALUES (@orderId, @product_id, @user_id, @store_id, @qty, @unit, @sell_price, @discount, getDate())
                    SET IDENTITY_INSERT [dbo].[order] OFF
                    `);

            // Update the inventory by reducing the qty
            await request
                .input('new_qty', sql.Int, inventoryProduct.qty - qty)
                .query('UPDATE inventory SET qty = @new_qty WHERE product_id = @product_id');
        }

        // Commit the transaction if everything is successful
        await transaction.commit();
        res.status(201).json({ message: 'Order created successfully', orderId });

    } catch (err) {
        // Rollback the transaction if any error occurs
        await transaction.rollback();
        console.error('Error creating order:', err);
        res.status(500).json({ message: 'Error creating order' });

    }
});

router.get('/order/:orderId', verifyToken, async (req, res) => {
    const { orderId } = req.params;
 
    // Validate orderId (you might want to add more validation here)
    if (!orderId || isNaN(parseInt(orderId))) {
        return res.status(400).json({ message: 'Invalid order ID' });
    }

    try {
        // Ensure a connection pool is available
        const pool = await connectToDatabase();
        const request = new sql.Request(pool);
        console.log(orderId)
        // Query to get the details of the given order ID
        const result = await request
        .input('orderId', sql.Int, orderId)
        .query(`
            SELECT order_id, product_id, user_id, store_id, qty, unit, sell_price, discount, order_date
            FROM [order]
            WHERE order_id = @orderId
        `, {
            orderId: parseInt(orderId) // Parameterize the query to prevent SQL injection
        });

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Send the results as a JSON response
        res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).json({ message: 'Error fetching order details' });
    }
});


module.exports = router;
