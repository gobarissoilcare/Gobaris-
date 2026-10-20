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

module.exports = {
  pool, initSchema, createOrder, markOrderPaid, getOrderByRazorpayId,
  listPosts, getPostById, getPostCover, slugTaken, createPost, updatePost, deletePost,
};
