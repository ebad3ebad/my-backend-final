const express = require('express');
const { connectToDatabase, sql } = require('../db');
const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

// Get All Orders API
router.get('/all', verifyToken, async (req, res) => {
    try {
        // Ensure a connection pool is available
        const pool = await connectToDatabase();
        const request = new sql.Request(pool);

        // Query to get all orders
        const result = await request.query(`
            SELECT order_id, product_id, user_id, store_id, qty, unit, sell_price, order_date
            FROM [order]
        `);

        // Send the results as a JSON response
        res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ message: 'Error fetching orders' });
    }
});

/// suggestion
router.get('/suggestion', verifyToken, async (req, res) => {
    let query = req.query.query; // Extract query parameter from the URL
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }
    try {
        // Ensure a connection pool is available
        const pool = await connectToDatabase();
        const request = new sql.Request(pool);
         
        // Query to get all orders
        const result = await request
        .input('query', sql.VarChar, `%${query}%`) // Add wildcards directly here
        .query(
          'SELECT product_id, product_name, qty, unit,default_price FROM inventory WHERE product_name LIKE @query and active=1'
        );
      
      // Send the results as a JSON response
      res.status(200).json(result.recordset);
        console.log(query)
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ message: 'Error fetching orders' });
    }
});

// Create Order API
router.post('/create', verifyToken, async (req, res) => {
    let { products, store_id } = req.body;
    if (products.length === 0) {
        return res.status(401).json({ message: 'No products provided' });
    }

    try {
        const pool = await connectToDatabase();
        const request = new sql.Request(pool);

        // Extract user_id from decoded token (set in the verifyToken middleware)
        const user_id = req.userId;

        // Check if store_id exists in the medical_store table
        const storeResult = await request
            .input('store_id', sql.Int, store_id)
            .query('SELECT * FROM medical_store WHERE store_id = @store_id');

        if (storeResult.recordset.length === 0) {
            return res.status(402).json({ message: 'Store does not exist' });
        }

        // Handle the first product
        const firstProduct = products[0];
        let { product_id, qty, unit, sell_price } = firstProduct;
        
        // Check if product_id exists in the inventory table
        let productResult = await request
            .input('product_id', sql.Int, product_id)
            .query('SELECT * FROM inventory WHERE product_id = @product_id and active= 1');

        if (productResult.recordset.length === 0) {
            return res.status(405).json({ message: 'Product does not exist' });
        }

        let product = productResult.recordset[0];

        // Check if qty in order is less than or equal to qty in inventory
        if (product.qty < qty || product.unit !== unit) {
            return res.status(406).json({
                message: 'Insufficient quantity in inventory or unit mismatch'
            });
        }

        // Insert the first product into the order table
        await request
            .input('user_id', sql.Int, user_id) // Set the logged-in user's ID
            //.input('store_id', sql.Int, store_id)
            .input('qty', sql.Int, qty)
            .input('unit', sql.VarChar, unit)
            .input('sell_price', sql.Decimal(10, 2), sell_price)
            //.input('discount', sql.Decimal(10, 2), discount)
            .query(`
                INSERT INTO [order] 
                (product_id, user_id, store_id, qty, unit, sell_price, order_date) 
                VALUES (@product_id, @user_id, @store_id, @qty, @unit, @sell_price, getDate())
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
            let { product_id, qty, unit, sell_price } = product;
            console.log(product_id)
            const request = new sql.Request(pool);
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
                //.input('discount', sql.Decimal(10, 2), discount)
                .input('order_date', sql.DateTime, new Date())
                .query(`
                    SET IDENTITY_INSERT [dbo].[order] ON
                    INSERT INTO [order] 
                    (order_id,product_id, user_id, store_id, qty, unit, sell_price, order_date) 
                    VALUES (@orderId,@product_id, @user_id, @store_id, @qty, @unit, @sell_price, getDate())
                    SET IDENTITY_INSERT [dbo].[order] OFF
                    `);

            // Update the inventory by reducing the qty
            await request
                .input('new_qty', sql.Int, inventoryProduct.qty - qty)
                .query('UPDATE inventory SET qty = @new_qty WHERE product_id = @product_id');
        }

        res.status(201).json({ message: 'Order created successfully', orderId });
        await request.query('INSERT INTO payment SELECT order_id, order_date,store_id,SUM(qty * sell_price) AS bill,10 AS gst_rate,0 AS discount, 0 AS total_received FROM [dbo].[order] where order_id = (select max(order_id) from [dbo].[order]) GROUP BY order_id, order_date,store_id;')

    } 
    
    catch (err) {
        console.error('Error creating order:', err);
        res.status(500).json({ message: 'Error creating order' });
    }
});

//// get order of a store
router.get('/store/:store_id', verifyToken, async (req, res) => {

    const { store_id } = req.params;
    try {
        // Ensure a connection pool is available
        const pool = await connectToDatabase();
        const request = new sql.Request(pool);

        // Query to get all orders
        const result = await request
        .input('store_id', sql.Int,store_id)
        .query(`
            SELECT order_id, order_date,bill,gst_rate,balance,total_bill
            FROM [payment] where store_id=@store_id
        `);

        // Send the results as a JSON response
        res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ message: 'Error fetching orders' });
    }
});

//// post revenue
router.post('/revenue/:order_id',verifyToken,async(req,res)=>{
let { discount,total_received } = req.body;
let { order_id } = req.params;
try {
    const pool = await connectToDatabase();
    const request = new sql.Request(pool);

    // Extract user_id from decoded token (set in the verifyToken middleware)
    const user_id = req.userId;

    // Check if store_id exists in the medical_store table
   const result=await request
        .input('order_id', sql.Int, order_id)
        .input('discount',sql.Decimal,discount)
        .input('total_received',sql.Decimal,total_received)
        .query(`
            UPDATE payment SET total_received = total_received+@total_received WHERE order_id = @order_id;
            UPDATE payment SET discount=@discount WHERE order_id = @order_id;
            `);
        /*
        if (result.rowsAffected != 1) {
            return res.status(401).json({ message: 'Error posting -- order duplication' });
        }
            */
        res.status(200).json(result.rowsAffected);
    }
    catch (err) {
        console.error('Error posting revenue:', err);
        res.status(500).json({ message: 'Error posting revenue' });
    }
});

////data for receipt
router.get('/receipt/:order_id', verifyToken, async (req, res) => {

    const { order_id } = req.params;
    try {
        // Ensure a connection pool is available
        const pool = await connectToDatabase();
        const request = new sql.Request(pool);

        // Query to get all orders
        const result = await request
        .input('order_id', sql.Int,order_id)
        .query(`
            SELECT *
            FROM receipt_vu where order_id=@order_id
        `);

        // Send the results as a JSON response
        res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error fetching receipt detail:', err);
        res.status(500).json({ message: 'Error fetching receipt' });
    }
});

///// recipt test2 
router.get('/receipt_table/:order_id', verifyToken, async (req, res) => {

    const { order_id } = req.params;
    try {
        // Ensure a connection pool is available
        const pool = await connectToDatabase();
        const request = new sql.Request(pool);

        // Query to get all orders
        const result = await request
        .input('order_id', sql.Int,order_id)
        .query(`
            select i.product_name,o.qty,o.unit,o.sell_price,(o.qty*o.sell_price) Amount 
            from [dbo].[order] o left join inventory i on o.product_id=i.product_id where order_id=@order_id

        `);

        // Send the results as a JSON response
        res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error fetching receipt table :', err);
        res.status(500).json({ message: 'Error fetching receipt table' });
    }
});


////receipt_other
router.get('/receipt_other/:order_id', verifyToken, async (req, res) => {

    const { order_id } = req.params;
    try {
        // Ensure a connection pool is available
        const pool = await connectToDatabase();
        const request = new sql.Request(pool);

        // Query to get all orders
        const result = await request
        .input('order_id', sql.Int,order_id)
        .query(`
            select top 1 order_id,order_date,store_name,gst_rate,discount,total_bill,total_received,balance,bill,store_person
             from receipt_vu where order_id=@order_id
        `);

        // Send the results as a JSON response
        res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error fetching receipt table :', err);
        res.status(500).json({ message: 'Error fetching receipt table' });
    }
});


///dasboard
router.get('/dashboard', async (req, res) => {
    try {
        // Ensure a connection pool is available
        const pool = await connectToDatabase();
        const request = new sql.Request(pool);

        // Query to get all orders
        const result = await request
        .query(`
            SELECT
    (SELECT COUNT(DISTINCT order_id) FROM payment WHERE status <> 'completed') AS pending_orders,
    (SELECT COUNT(DISTINCT order_id) FROM payment WHERE status = 'completed') AS completed_orders,
    (SELECT COUNT(store_id) FROM medical_store WHERE active = 1) AS active_stores,
    (SELECT COUNT(product_id) FROM inventory WHERE active = 1) AS active_products,
	(select round((sum(o.sell_price)-sum(i.purchase_price)),0)profit from [dbo].[order] o left join inventory i on o.product_id=i.product_id) profit,
	(select sum(qty*purchase_price) from inventory where active=1) Total_Stock,
	(select convert(DECIMAL(18, 2),(round(sum(balance),2))) from payment where status='pending') Balance;
        `);

        // Send the results as a JSON response
        res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error completed order :', err);
        res.status(500).json({ message: 'Error completed order' });
    }
});


////particular order
router.get('/order_detail/:order_id', verifyToken, async (req, res) => {

    const { order_id } = req.params;
    try {
        // Ensure a connection pool is available
        const pool = await connectToDatabase();
        const request = new sql.Request(pool);

        // Query to get all orders
        const result = await request
        .input('order_id', sql.Int,order_id)
        .query(`
            	select product_name,qty,unit,sell_price,O_bill from receipt_vu where order_id=@order_id 
        `);

        // Send the results as a JSON response
        res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Error P_order detail:', err);
        res.status(500).json({ message: 'Error fetching P_order detail' });
    }
});


module.exports = router;
