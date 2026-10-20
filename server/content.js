const express = require('express');

const db = require('./db');
const { DEFAULTS } = require('./defaults');
const { listAdmins, normalizeEmail, findOwner } = require('./admins');
const { requireAdmin } = require('./auth');
const { publicProduct } = require('./shop');

const router = express.Router();

const KEYS = Object.keys(DEFAULTS); // site, facts, founders
const MAX_TEXT = 2000;
const MAX_ITEMS = 100;

// Keeps only the fields the website knows about, shaped like the defaults,
// so a bad request can't store anything unexpected.
function clean(value, template, field) {
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, MAX_ITEMS)
      .map(v => clean(v, template[0], field))
      .filter(v => (typeof v === 'string' ? v : Object.values(v).some(Boolean)));
  }
  if (template && typeof template === 'object') {
    const out = {};
    for (const k of Object.keys(template)) out[k] = clean(value && value[k], template[k], k);
    return out;
  }
  if (typeof template === 'boolean') return value === true;
  let s = String(value == null ? '' : value).trim().slice(0, MAX_TEXT);
  if (field === 'link' || field === 'linkedin') {
    if (s && !/^(https:\/\/|#)/i.test(s)) throw new Error('Links must start with https:// (for example https://www.linkedin.com/in/…).');
  }
  if (field === 'whatsapp') s = s.replace(/\D/g, '');
  if (field === 'email' && s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error(`"${s}" doesn't look like an email address.`);
  return s;
}

// Saved text on top of the defaults, so fields added later still have a value.
function withDefaults(saved, template) {
  if (saved == null) return template;
  if (Array.isArray(template)) return Array.isArray(saved) ? saved : template;
  if (template && typeof template === 'object') {
    const out = {};
    for (const k of Object.keys(template)) out[k] = withDefaults(saved[k], template[k]);
    return out;
  }
  return saved;
}

// Fields left out of a save keep their current value (lists are replaced whole).
function merge(current, incoming) {
  if (incoming === undefined) return current;
  if (incoming && typeof incoming === 'object' && !Array.isArray(incoming) &&
      current && typeof current === 'object' && !Array.isArray(current)) {
    const out = { ...current };
    for (const k of Object.keys(incoming)) out[k] = merge(current[k], incoming[k]);
    return out;
  }
  return incoming;
}

async function loadContent() {
  const rows = await db.getSettings(KEYS);
  const content = {};
  const meta = {};
  for (const k of KEYS) {
    const row = rows.find(r => r.key === k);
    content[k] = withDefaults(row && row.value, DEFAULTS[k]);
    meta[k] = row ? { updatedBy: row.updated_by, updatedAt: row.updated_at } : null;
  }
  return { content, meta };
}

// ---- Public: everything the website needs in one request ----

router.get('/api/site', async (req, res) => {
  try {
    const [{ content }, products] = await Promise.all([loadContent(), db.listProducts({ visibleOnly: true })]);
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ ...content, products: products.map(publicProduct) });
  } catch (err) {
    console.error('site content failed:', err);
    res.status(500).json({ error: 'Could not load the website content.' });
  }
});

// ---- Admin: website text, contact details, cow facts, founders ----

router.get('/api/admin/content', requireAdmin, async (req, res) => {
  try {
    const { content, meta } = await loadContent();
    res.json({ content, meta, defaults: DEFAULTS });
  } catch (err) {
    console.error('load content failed:', err);
    res.status(500).json({ error: 'Could not load the website content.' });
  }
});

router.put('/api/admin/content/:key', requireAdmin, async (req, res) => {
  const key = req.params.key;
  if (!KEYS.includes(key)) return res.status(404).json({ error: 'Unknown section.' });
  let value;
  try {
    const { content } = await loadContent();
    value = clean(merge(content[key], (req.body || {}).value), DEFAULTS[key]);
  } catch (err) {
    if (err instanceof Error && !err.code) return res.status(400).json({ error: err.message });
    console.error('load content failed:', err);
    return res.status(500).json({ error: 'Could not save.' });
  }
  try {
    await db.setSetting(key, value, req.admin.email);
    res.json({ value });
  } catch (err) {
    console.error('save content failed:', err);
    res.status(500).json({ error: 'Could not save.' });
  }
});

// ---- Admin: who has access ----

router.get('/api/admin/admins', requireAdmin, async (req, res) => {
  try {
    res.json({ admins: await listAdmins() });
  } catch (err) {
    console.error('list admins failed:', err);
    res.status(500).json({ error: 'Could not load the admin list.' });
  }
});

// Body: { name, email } — must be the person's Google account email.
router.post('/api/admin/admins', requireAdmin, async (req, res) => {
  const name = String((req.body || {}).name || '').trim().slice(0, 100);
  const email = normalizeEmail((req.body || {}).email);
  if (!name) return res.status(400).json({ error: 'Please enter their name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter their Google account email.' });
  if (findOwner(email)) return res.status(400).json({ error: 'That person already has access.' });
  try {
    await db.addExtraAdmin({ email, name, addedBy: req.admin.email });
    res.status(201).json({ admins: await listAdmins() });
  } catch (err) {
    console.error('add admin failed:', err);
    res.status(500).json({ error: 'Could not add the admin.' });
  }
});

router.delete('/api/admin/admins/:email', requireAdmin, async (req, res) => {
  const email = normalizeEmail(req.params.email);
  if (findOwner(email)) return res.status(400).json({ error: 'The three owners can’t be removed here.' });
  try {
    const removed = await db.removeExtraAdmin(email);
    if (!removed) return res.status(404).json({ error: 'That admin was not found.' });
    res.json({ admins: await listAdmins() });
  } catch (err) {
    console.error('remove admin failed:', err);
    res.status(500).json({ error: 'Could not remove the admin.' });
  }
});

module.exports = router;
