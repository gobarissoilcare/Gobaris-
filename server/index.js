require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const { initSchema, createOrder, markOrderPaid, getOrderByRazorpayId } = require('./db');
const { PRODUCTS } = require('./products');

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, paymentsConfigured: Boolean(getRazorpay()) });
});

// Body: { items: [{ id, qty }], customerName, customerPhone, customerAddress }
app.post('/api/create-order', async (req, res) => {
  try {
    const { items, customerName, customerPhone, customerAddress } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }
    if (!customerName || !customerPhone || !customerAddress) {
      return res.status(400).json({ error: 'Name, phone, and address are required.' });
    }

    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({ error: 'Payments are not configured yet.' });
    }

    let amountPaise = 0;
    const resolvedItems = [];
    for (const line of items) {
      const product = PRODUCTS[line.id];
      const qty = Number(line.qty);
      if (!product || !Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: `Invalid item: ${line.id}` });
      }
      if (qty > product.stock) {
        return res.status(400).json({ error: `Only ${product.stock} left of ${line.id}.` });
      }
      amountPaise += product.price * 100 * qty;
      resolvedItems.push({ id: line.id, kg: product.kg, qty, price: product.price });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `gobaris_${Date.now()}`,
    });

    await createOrder({
      razorpayOrderId: razorpayOrder.id,
      customerName,
      customerPhone,
      customerAddress,
      items: resolvedItems,
      amountPaise,
    });

    res.json({
      orderId: razorpayOrder.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('create-order failed:', err);
    res.status(500).json({ error: 'Could not create order.' });
  }
});

// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment fields.' });
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: 'Payments are not configured yet.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature verification failed.' });
    }

    const order = await markOrderPaid({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    res.json({ ok: true, order });
  } catch (err) {
    console.error('verify-payment failed:', err);
    res.status(500).json({ error: 'Could not verify payment.' });
  }
});

app.get('/api/order/:razorpayOrderId', async (req, res) => {
  const order = await getOrderByRazorpayId(req.params.razorpayOrderId);
  if (!order) return res.status(404).json({ error: 'Not found.' });
  res.json(order);
});

initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Gobaris server listening on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database schema:', err);
    process.exit(1);
  });
