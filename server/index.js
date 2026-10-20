require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const db = require('./db');
const { initSchema, createOrder, markOrderPaid, getOrderByRazorpayId } = db;
const { PRODUCTS } = require('./products');
const { SEED_POSTS } = require('./seed-posts');
const blogRoutes = require('./blog');
const shop = require('./shop');
const contentRoutes = require('./content');
const enquiryRoutes = require('./enquiries');

const app = express();
const PORT = process.env.PORT || 4000;
// Render sits in front of the server; this makes req.ip the visitor's address.
app.set('trust proxy', 1);

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
// Large enough for a blog post's cover image sent from the admin panel.
app.use(express.json({ limit: '4mb' }));

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

// Body: { items: [{ id, qty }], customerName, customerPhone, customerAddress, expectedAmount }
// expectedAmount (in paise) is what the shopper saw; if prices changed in the
// admin panel since they opened the page, they're asked to refresh first.
app.post('/api/create-order', async (req, res) => {
  try {
    const { items, customerName, customerPhone, customerAddress, expectedAmount } = req.body || {};

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

    // Prices and stock come from the database (set in the admin panel), never
    // from the browser, so a tampered request can't change what's charged.
    const products = Object.fromEntries((await db.listProducts({ visibleOnly: true })).map(p => [p.id, p]));
    let amountPaise = 0;
    const resolvedItems = [];
    for (const line of items) {
      const product = products[line.id];
      const qty = Number(line.qty);
      if (!product || !Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: `Invalid item: ${line.id}` });
      }
      if (qty > product.stock) {
        return res.status(400).json({ error: product.stock === 0
          ? `Sorry, the ${product.kg} kg pack just sold out.`
          : `Only ${product.stock} left of the ${product.kg} kg pack.` });
      }
      const price = shop.salePrice(product);
      amountPaise += price * 100 * qty;
      resolvedItems.push({ id: line.id, kg: product.kg, qty, price });
    }
    if (expectedAmount != null && Number(expectedAmount) !== amountPaise) {
      return res.status(409).json({ error: 'Our prices have just been updated. Please refresh the page and check your cart again.' });
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

app.use(blogRoutes);
app.use(shop.router);
app.use(contentRoutes);
app.use(enquiryRoutes);

app.get('/api/order/:razorpayOrderId', async (req, res) => {
  const order = await getOrderByRazorpayId(req.params.razorpayOrderId);
  if (!order) return res.status(404).json({ error: 'Not found.' });
  res.json(order);
});

initSchema()
  .then(() => db.seed({ products: PRODUCTS, posts: SEED_POSTS }))
  .then(() => {
    app.listen(PORT, () => console.log(`Gobaris server listening on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database schema:', err);
    process.exit(1);
  });
