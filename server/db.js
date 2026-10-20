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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT '',
      excerpt TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      read_minutes INTEGER NOT NULL DEFAULT 1,
      cover BYTEA,
      cover_type TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      updated_by TEXT,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Delivery progress, set by admins once an order is paid.
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment TEXT NOT NULL DEFAULT 'new'`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT NOT NULL DEFAULT ''`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      kg INTEGER NOT NULL,
      price INTEGER NOT NULL,
      offer_price INTEGER,
      stock INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      visible BOOLEAN NOT NULL DEFAULT true,
      sort INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      pack TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      handled_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      added_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

// Marks an order paid and takes its packs out of stock. Safe to call twice:
// the stock only goes down the first time.
async function markOrderPaid({ razorpayOrderId, razorpayPaymentId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE orders SET status = 'paid', razorpay_payment_id = $2, updated_at = now()
       WHERE razorpay_order_id = $1 AND status <> 'paid'
       RETURNING *`,
      [razorpayOrderId, razorpayPaymentId]
    );
    let order = result.rows[0];
    if (order) {
      for (const item of order.items) {
        await client.query(
          `UPDATE products SET stock = GREATEST(stock - $2, 0), updated_at = now() WHERE id = $1`,
          [item.id, item.qty]
        );
      }
    } else {
      order = (await client.query(`SELECT * FROM orders WHERE razorpay_order_id = $1`, [razorpayOrderId])).rows[0];
    }
    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getOrderByRazorpayId(razorpayOrderId) {
  const result = await pool.query(`SELECT * FROM orders WHERE razorpay_order_id = $1`, [razorpayOrderId]);
  return result.rows[0];
}

// ---- Blog posts (written from the admin panel) ----

// Every column except the cover image bytes, which are served separately.
const POST_COLUMNS = `id, slug, title, tag, excerpt, body, read_minutes, status,
  author_name, author_email, updated_by, published_at, created_at, updated_at,
  (cover IS NOT NULL) AS has_cover`;

async function listPosts({ publishedOnly }) {
  const result = await pool.query(
    `SELECT ${POST_COLUMNS} FROM posts
     ${publishedOnly ? "WHERE status = 'published'" : ''}
     ORDER BY COALESCE(published_at, created_at) DESC`
  );
  return result.rows;
}

async function getPostById(id) {
  const result = await pool.query(`SELECT ${POST_COLUMNS} FROM posts WHERE id = $1`, [id]);
  return result.rows[0];
}

async function getPostCover(slug) {
  const result = await pool.query(
    `SELECT cover, cover_type FROM posts WHERE slug = $1 AND status = 'published' AND cover IS NOT NULL`,
    [slug]
  );
  return result.rows[0];
}

async function slugTaken(slug, exceptId) {
  const result = await pool.query(`SELECT 1 FROM posts WHERE slug = $1 AND id <> $2`, [slug, exceptId || 0]);
  return result.rowCount > 0;
}

async function createPost({ slug, title, tag, excerpt, body, readMinutes, cover, coverType, status, authorName, authorEmail }) {
  const result = await pool.query(
    `INSERT INTO posts (slug, title, tag, excerpt, body, read_minutes, cover, cover_type, status,
                        author_name, author_email, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $9 = 'published' THEN now() END)
     RETURNING id`,
    [slug, title, tag, excerpt, body, readMinutes, cover, coverType, status, authorName, authorEmail]
  );
  return getPostById(result.rows[0].id);
}

// cover: undefined keeps the current image, null removes it, a Buffer replaces it.
async function updatePost(id, { slug, title, tag, excerpt, body, readMinutes, cover, coverType, status, updatedBy }) {
  const keepCover = cover === undefined;
  const result = await pool.query(
    `UPDATE posts SET slug = $2, title = $3, tag = $4, excerpt = $5, body = $6, read_minutes = $7,
       cover = CASE WHEN $8 THEN cover ELSE $9 END,
       cover_type = CASE WHEN $8 THEN cover_type ELSE $10 END,
       status = $11,
       published_at = CASE WHEN $11 = 'published' THEN COALESCE(published_at, now()) ELSE NULL END,
       updated_by = $12, updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [id, slug, title, tag, excerpt, body, readMinutes, keepCover, keepCover ? null : cover,
     keepCover ? null : coverType, status, updatedBy]
  );
  if (result.rowCount === 0) return null;
  return getPostById(id);
}

async function deletePost(id) {
  const result = await pool.query(`DELETE FROM posts WHERE id = $1`, [id]);
  return result.rowCount > 0;
}

// Fills in the starting shop packs and blog posts the very first time the
// server runs against an empty database.
async function seed({ products, posts }) {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM products`);
  if (rows[0].n === 0) {
    let sort = 0;
    for (const [id, p] of Object.entries(products)) {
      await pool.query(
        `INSERT INTO products (id, kg, price, stock, description, sort) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [id, p.kg, p.price, p.stock, p.description || '', sort++]
      );
    }
  }
  if (!(await getSetting('seeded_posts'))) {
    // oldest first, a week apart, so they sit below anything written in the admin panel
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      await pool.query(
        `INSERT INTO posts (slug, title, tag, excerpt, body, read_minutes, status, author_name, author_email, published_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'published', 'Gobaris', '', now() - make_interval(days => $7), now() - make_interval(days => $7))
         ON CONFLICT (slug) DO NOTHING`,
        [p.slug, p.title, p.tag, p.excerpt, p.body, p.readMinutes, 30 + (posts.length - i) * 7]
      );
    }
    await setSetting('seeded_posts', true, 'server');
  }
}

// ---- Shop ----

const PRODUCT_COLUMNS = `id, kg, price, offer_price, stock, description, visible, sort, updated_by, updated_at`;

async function listProducts({ visibleOnly } = {}) {
  const result = await pool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products ${visibleOnly ? 'WHERE visible' : ''} ORDER BY sort, kg`
  );
  return result.rows;
}

async function updateProduct(id, { price, offerPrice, stock, description, visible, updatedBy }) {
  const result = await pool.query(
    `UPDATE products SET price = $2, offer_price = $3, stock = $4, description = $5, visible = $6,
       updated_by = $7, updated_at = now()
     WHERE id = $1
     RETURNING ${PRODUCT_COLUMNS}`,
    [id, price, offerPrice, stock, description, visible, updatedBy]
  );
  return result.rows[0];
}

// ---- Orders (admin) ----

async function listOrders({ paidOnly }) {
  const result = await pool.query(
    `SELECT * FROM orders ${paidOnly ? "WHERE status = 'paid'" : ''} ORDER BY created_at DESC LIMIT 1000`
  );
  return result.rows;
}

async function updateOrderFulfillment(id, { fulfillment, adminNote }) {
  const result = await pool.query(
    `UPDATE orders SET fulfillment = $2, admin_note = $3, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, fulfillment, adminNote]
  );
  return result.rows[0];
}

// ---- Website text and lists (key → JSON) ----

async function getSetting(key) {
  const result = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
  return result.rows[0] ? result.rows[0].value : null;
}

async function getSettings(keys) {
  const result = await pool.query(
    `SELECT key, value, updated_by, updated_at FROM settings WHERE key = ANY($1)`,
    [keys]
  );
  return result.rows;
}

async function setSetting(key, value, updatedBy) {
  await pool.query(
    `INSERT INTO settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), updatedBy]
  );
}

// ---- Enquiries from the contact form ----

async function createEnquiry({ name, phone, pack, note }) {
  const result = await pool.query(
    `INSERT INTO enquiries (name, phone, pack, note) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, phone, pack, note]
  );
  return result.rows[0];
}

async function listEnquiries() {
  const result = await pool.query(`SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 1000`);
  return result.rows;
}

async function updateEnquiry(id, { status, handledBy }) {
  const result = await pool.query(
    `UPDATE enquiries SET status = $2, handled_by = $3, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status, handledBy]
  );
  return result.rows[0];
}

async function deleteEnquiry(id) {
  const result = await pool.query(`DELETE FROM enquiries WHERE id = $1`, [id]);
  return result.rowCount > 0;
}

// ---- Admins added from the admin panel (on top of the owners in admins.js) ----

async function listExtraAdmins() {
  const result = await pool.query(`SELECT email, name, added_by, created_at FROM admins ORDER BY created_at`);
  return result.rows;
}

async function getExtraAdmin(email) {
  const result = await pool.query(`SELECT email, name FROM admins WHERE email = $1`, [email]);
  return result.rows[0];
}

async function addExtraAdmin({ email, name, addedBy }) {
  const result = await pool.query(
    `INSERT INTO admins (email, name, added_by) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING email, name, added_by, created_at`,
    [email, name, addedBy]
  );
  return result.rows[0];
}

async function removeExtraAdmin(email) {
  const result = await pool.query(`DELETE FROM admins WHERE email = $1`, [email]);
  return result.rowCount > 0;
}

module.exports = {
  pool, initSchema, seed, createOrder, markOrderPaid, getOrderByRazorpayId,
  listPosts, getPostById, getPostCover, slugTaken, createPost, updatePost, deletePost,
  listProducts, updateProduct, listOrders, updateOrderFulfillment,
  getSetting, getSettings, setSetting,
  createEnquiry, listEnquiries, updateEnquiry, deleteEnquiry,
  listExtraAdmins, getExtraAdmin, addExtraAdmin, removeExtraAdmin,
};
