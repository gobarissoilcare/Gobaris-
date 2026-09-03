const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      razorpay_order_id TEXT UNIQUE NOT NULL,
      razorpay_payment_id TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      items JSONB NOT NULL,
      amount_paise INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function createOrder({ razorpayOrderId, customerName, customerPhone, customerAddress, items, amountPaise }) {
  const result = await pool.query(
    `INSERT INTO orders (razorpay_order_id, customer_name, customer_phone, customer_address, items, amount_paise)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [razorpayOrderId, customerName, customerPhone, customerAddress, JSON.stringify(items), amountPaise]
  );
  return result.rows[0];
}

async function markOrderPaid({ razorpayOrderId, razorpayPaymentId }) {
  const result = await pool.query(
    `UPDATE orders SET status = 'paid', razorpay_payment_id = $2, updated_at = now()
     WHERE razorpay_order_id = $1
     RETURNING *`,
    [razorpayOrderId, razorpayPaymentId]
  );
  return result.rows[0];
}

async function getOrderByRazorpayId(razorpayOrderId) {
  const result = await pool.query(`SELECT * FROM orders WHERE razorpay_order_id = $1`, [razorpayOrderId]);
  return result.rows[0];
}

module.exports = { pool, initSchema, createOrder, markOrderPaid, getOrderByRazorpayId };
