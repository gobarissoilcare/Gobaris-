const express = require('express');

const db = require('./db');
const { requireAdmin } = require('./auth');

const router = express.Router();

const FULFILLMENT = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];

// The price a customer actually pays: the offer price while one is set.
function salePrice(p) {
  return p.offer_price != null ? p.offer_price : p.price;
}

function publicProduct(p) {
  return {
    id: p.id,
    kg: p.kg,
    price: salePrice(p),
    regularPrice: p.price,
    onOffer: p.offer_price != null,
    stock: p.stock,
    description: p.description,
  };
}

function adminProduct(p) {
  return {
    id: p.id,
    kg: p.kg,
    price: p.price,
    offerPrice: p.offer_price,
    stock: p.stock,
    description: p.description,
    visible: p.visible,
    updatedBy: p.updated_by,
    updatedAt: p.updated_at,
  };
}

function adminOrder(o) {
  return {
    id: o.id,
    razorpayOrderId: o.razorpay_order_id,
    razorpayPaymentId: o.razorpay_payment_id,
    paid: o.status === 'paid',
    fulfillment: o.fulfillment,
    adminNote: o.admin_note,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    customerAddress: o.customer_address,
    items: o.items,
    amount: o.amount_paise / 100,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  // a leading = + - @ would make Excel treat the cell as a formula
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return '"' + safe.replace(/"/g, '""') + '"';
}

// ---- Admin: packs, prices and stock ----

router.get('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const products = await db.listProducts();
    res.json({ products: products.map(adminProduct) });
  } catch (err) {
    console.error('list products failed:', err);
    res.status(500).json({ error: 'Could not load the shop.' });
  }
});

// Body: { price, offerPrice (or null), stock, description, visible }
router.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const whole = v => Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : NaN;
  const price = whole(b.price);
  const stock = whole(b.stock);
  const offerPrice = b.offerPrice === null || b.offerPrice === '' || b.offerPrice === undefined ? null : whole(b.offerPrice);
  if (!(price > 0) || price > 1000000) return res.status(400).json({ error: 'Please enter a price in whole rupees.' });
  if (Number.isNaN(stock) || stock > 100000) return res.status(400).json({ error: 'Please enter the stock as a whole number.' });
  if (offerPrice !== null && (!(offerPrice > 0) || offerPrice >= price)) {
    return res.status(400).json({ error: 'The offer price must be lower than the regular price.' });
  }
  try {
    const product = await db.updateProduct(req.params.id, {
      price,
      offerPrice,
      stock,
      description: String(b.description || '').trim().slice(0, 600),
      visible: b.visible !== false,
      updatedBy: req.admin.email,
    });
    if (!product) return res.status(404).json({ error: 'Pack not found.' });
    res.json({ product: adminProduct(product) });
  } catch (err) {
    console.error('update product failed:', err);
    res.status(500).json({ error: 'Could not save the pack.' });
  }
});

// ---- Admin: orders ----

router.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await db.listOrders({ paidOnly: req.query.all !== '1' });
    res.json({ orders: orders.map(adminOrder) });
  } catch (err) {
    console.error('list orders failed:', err);
    res.status(500).json({ error: 'Could not load orders.' });
  }
});

// Body: { fulfillment, adminNote }
router.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  if (!FULFILLMENT.includes(b.fulfillment)) return res.status(400).json({ error: 'Unknown order status.' });
  try {
    const order = Number.isInteger(id) && await db.updateOrderFulfillment(id, {
      fulfillment: b.fulfillment,
      adminNote: String(b.adminNote || '').trim().slice(0, 1000),
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ order: adminOrder(order) });
  } catch (err) {
    console.error('update order failed:', err);
    res.status(500).json({ error: 'Could not save the order.' });
  }
});

// A spreadsheet of orders that opens in Excel or Google Sheets.
router.get('/api/admin/orders.csv', requireAdmin, async (req, res) => {
  try {
    const orders = (await db.listOrders({ paidOnly: req.query.all !== '1' })).map(adminOrder);
    const head = ['Order', 'Date', 'Paid', 'Status', 'Customer', 'Phone', 'Address', 'Packs', 'Amount (Rs)', 'Payment ID', 'Note'];
    const rows = orders.map(o => [
      o.id,
      new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      o.paid ? 'Yes' : 'No',
      o.fulfillment,
      o.customerName,
      o.customerPhone,
      o.customerAddress,
      o.items.map(i => `${i.qty} x ${i.kg}kg`).join(', '),
      o.amount,
      o.razorpayPaymentId || '',
      o.adminNote,
    ]);
    const csv = '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="gobaris-orders.csv"');
    res.send(csv);
  } catch (err) {
    console.error('export orders failed:', err);
    res.status(500).json({ error: 'Could not export orders.' });
  }
});

module.exports = { router, salePrice, publicProduct };
