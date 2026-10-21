const express = require('express');

const db = require('./db');
const { CORE_TEAM } = require('./admins');
const { googleClientId, verifyGoogleCredential, createSessionToken, requireAdmin } = require('./auth');

const router = express.Router();

const MAX_COVER_BYTES = 2 * 1024 * 1024;
const COVER_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post';
}

async function uniqueSlug(title, exceptId) {
  const base = slugify(title);
  let slug = base;
  for (let n = 2; await db.slugTaken(slug, exceptId); n++) {
    slug = `${base}-${n}`;
  }
  return slug;
}

// What the public site gets for each post: no drafts, no editor emails.
function publicPost(post) {
  return {
    slug: post.slug,
    title: post.title,
    tag: post.tag,
    excerpt: post.excerpt,
    body: post.body,
    readMinutes: post.read_minutes,
    author: post.author_name,
    publishedAt: post.published_at,
    coverUrl: post.has_cover
      ? `/api/posts/${encodeURIComponent(post.slug)}/cover?v=${new Date(post.updated_at).getTime()}`
      : null,
  };
}

function adminPost(post) {
  return {
    ...publicPost(post),
    id: post.id,
    status: post.status,
    hasCover: post.has_cover,
    authorEmail: post.author_email,
    updatedBy: post.updated_by,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  };
}

// Checks and cleans a post sent from the admin panel. Throws a message the
// admin can act on if something is missing or too big.
function readPostInput(input) {
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const post = {
    title: str(input.title, 200),
    tag: str(input.tag, 60),
    excerpt: str(input.excerpt, 400),
    body: str(input.body, 100000),
    status: input.status === 'published' ? 'published' : 'draft',
  };
  if (!post.title) throw new Error('Please give the post a title.');
  if (post.status === 'published' && !post.body) throw new Error('Please write the post before publishing it.');

  const words = post.body.split(/\s+/).filter(Boolean).length;
  const minutes = Number(input.readMinutes);
  post.readMinutes = Number.isInteger(minutes) && minutes > 0 && minutes < 600
    ? minutes
    : Math.max(1, Math.round(words / 200));

  // cover: leave it out to keep the current image, null to remove it,
  // or a data: URL (the admin page resizes images before sending them).
  if (input.cover === null) {
    post.cover = null;
    post.coverType = null;
  } else if (typeof input.cover === 'string') {
    const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(input.cover);
    if (!match || !COVER_TYPES.includes(match[1])) throw new Error('The cover image must be a JPG, PNG or WebP.');
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > MAX_COVER_BYTES) throw new Error('The cover image is too large (2 MB max).');
    post.cover = bytes;
    post.coverType = match[1];
  }
  return post;
}

function sendError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(fallback, err);
  res.status(500).json({ error: fallback });
}

// ---- Public: the blog on the website ----

router.get('/api/posts', async (req, res) => {
  try {
    const posts = await db.listPosts({ publishedOnly: true });
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ posts: posts.map(publicPost) });
  } catch (err) {
    sendError(res, err, 'Could not load posts.');
  }
});

router.get('/api/posts/:slug/cover', async (req, res) => {
  try {
    const row = await db.getPostCover(req.params.slug);
    if (!row) return res.status(404).end();
    res.set('Content-Type', row.cover_type);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(row.cover);
  } catch (err) {
    sendError(res, err, 'Could not load the image.');
  }
});

// ---- Admin panel ----

// The admin page asks for this so the Google Client ID lives in one place
// (the server's environment) instead of being copied into the page.
router.get('/api/admin/config', (req, res) => {
  res.json({ googleClientId: googleClientId(), admins: CORE_TEAM.map(a => a.name) });
});

// Body: { credential } — the ID token from "Sign in with Google".
router.post('/api/admin/login', async (req, res) => {
  try {
    const admin = await verifyGoogleCredential((req.body || {}).credential);
    res.json({ token: createSessionToken(admin), admin });
  } catch (err) {
    sendError(res, err, 'Could not sign in.');
  }
});

router.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

router.get('/api/admin/posts', requireAdmin, async (req, res) => {
  try {
    const posts = await db.listPosts({ publishedOnly: false });
    res.json({ posts: posts.map(adminPost) });
  } catch (err) {
    sendError(res, err, 'Could not load posts.');
  }
});

router.post('/api/admin/posts', requireAdmin, async (req, res) => {
  let input;
  try {
    input = readPostInput(req.body || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  try {
    const post = await db.createPost({
      ...input,
      slug: await uniqueSlug(input.title),
      cover: input.cover || null,
      coverType: input.coverType || null,
      authorName: req.admin.name,
      authorEmail: req.admin.email,
    });
    res.status(201).json({ post: adminPost(post) });
  } catch (err) {
    sendError(res, err, 'Could not save the post.');
  }
});

router.put('/api/admin/posts/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Post not found.' });
  let input;
  try {
    input = readPostInput(req.body || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  try {
    const existing = await db.getPostById(id);
    if (!existing) return res.status(404).json({ error: 'Post not found.' });
    // Keep the link stable once a post is out; drafts follow their title.
    const slug = existing.published_at ? existing.slug : await uniqueSlug(input.title, id);
    const post = await db.updatePost(id, { ...input, slug, updatedBy: req.admin.email });
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    res.json({ post: adminPost(post) });
  } catch (err) {
    sendError(res, err, 'Could not save the post.');
  }
});

router.delete('/api/admin/posts/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const deleted = Number.isInteger(id) && await db.deletePost(id);
    if (!deleted) return res.status(404).json({ error: 'Post not found.' });
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Could not delete the post.');
  }
});

module.exports = router;
