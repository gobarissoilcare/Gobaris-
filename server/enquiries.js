const express = require('express');

const db = require('./db');
const { requireAdmin } = require('./auth');

const router = express.Router();

const STATUSES = ['new', 'replied', 'closed'];

// A few enquiries per visitor every 10 minutes is plenty; this stops a script
// from flooding the list.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map();
function tooMany(ip) {
  const now = Date.now();
  const times = (recent.get(ip) || []).filter(t => now - t < WINDOW_MS);
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) recent.clear();
  return times.length > MAX_PER_WINDOW;
}

function adminEnquiry(e) {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone,
    pack: e.pack,
    note: e.note,
    status: e.status,
    handledBy: e.handled_by,
    createdAt: e.created_at,
  };
}

// Body: { name, phone, pack, note, website } — "website" is a hidden field
// only bots fill in.
router.post('/api/enquiries', async (req, res) => {
  const b = req.body || {};
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const enquiry = { name: str(b.name, 120), phone: str(b.phone, 40), pack: str(b.pack, 200), note: str(b.note, 2000) };
  if (b.website) return res.status(201).json({ ok: true });
  if (!enquiry.name || !enquiry.phone) return res.status(400).json({ error: 'Please enter your name and phone number.' });
  if (tooMany(req.ip)) return res.status(429).json({ error: 'Too many enquiries. Please try again in a few minutes.' });
  try {
    await db.createEnquiry(enquiry);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('save enquiry failed:', err);
    res.status(500).json({ error: 'Could not save the enquiry.' });
  }
});

router.get('/api/admin/enquiries', requireAdmin, async (req, res) => {
  try {
    res.json({ enquiries: (await db.listEnquiries()).map(adminEnquiry) });
  } catch (err) {
    console.error('list enquiries failed:', err);
    res.status(500).json({ error: 'Could not load enquiries.' });
  }
});

// Body: { status }
router.put('/api/admin/enquiries/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = (req.body || {}).status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status.' });
  try {
    const e = Number.isInteger(id) && await db.updateEnquiry(id, { status, handledBy: req.admin.email });
    if (!e) return res.status(404).json({ error: 'Enquiry not found.' });
    res.json({ enquiry: adminEnquiry(e) });
  } catch (err) {
    console.error('update enquiry failed:', err);
    res.status(500).json({ error: 'Could not save.' });
  }
});

router.delete('/api/admin/enquiries/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const deleted = Number.isInteger(id) && await db.deleteEnquiry(id);
    if (!deleted) return res.status(404).json({ error: 'Enquiry not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('delete enquiry failed:', err);
    res.status(500).json({ error: 'Could not delete.' });
  }
});

module.exports = router;
