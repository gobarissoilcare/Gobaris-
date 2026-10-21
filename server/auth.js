const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const { findAdmin } = require('./admins');

const SESSION_HOURS = 12;

const googleClient = new OAuth2Client();

// Signs admin session tokens. Set SESSION_SECRET on the server so sessions
// survive a restart; without it a random one is used and admins simply sign
// in again after each deploy.
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set: admin sessions will reset whenever the server restarts.');
}

function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || '';
}

// Checks the ID token Google's "Sign in with Google" button hands the admin
// page, and returns the admin it belongs to — or throws if it isn't one of
// the allowed accounts.
async function verifyGoogleCredential(credential) {
  if (!googleClientId()) {
    const err = new Error('Google sign-in is not configured on the server yet.');
    err.status = 503;
    throw err;
  }
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: googleClientId() });
    payload = ticket.getPayload();
  } catch (e) {
    const err = new Error('Google sign-in could not be verified. Please try again.');
    err.status = 401;
    throw err;
  }
  const admin = payload.email_verified ? await findAdmin(payload.email) : null;
  if (!admin) {
    const err = new Error(`${payload.email} does not have access to the Gobaris admin panel.`);
    err.status = 403;
    throw err;
  }
  return { name: admin.name, email: admin.email, role: admin.role, permanent: admin.permanent, picture: payload.picture || '' };
}

function sign(data) {
  return crypto.createHmac('sha256', sessionSecret).update(data).digest('base64url');
}

function createSessionToken(admin) {
  const body = Buffer.from(JSON.stringify({
    email: admin.email,
    picture: admin.picture,
    exp: Date.now() + SESSION_HOURS * 3600 * 1000,
  })).toString('base64url');
  return `${body}.${sign(body)}`;
}

async function readSessionToken(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!data || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
  // Re-check the list on every request, so someone removed from the Admins
  // page (or from admins.js) is locked out straight away.
  const admin = await findAdmin(data.email);
  if (!admin) return null;
  return { name: admin.name, email: admin.email, role: admin.role, permanent: admin.permanent, picture: data.picture || '' };
}

// Express middleware: only lets the request through for a signed-in admin.
async function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  let admin;
  try {
    admin = await readSessionToken(token);
  } catch (err) {
    console.error('admin check failed:', err);
    return res.status(500).json({ error: 'Could not check your access. Please try again.' });
  }
  if (!admin) {
    return res.status(401).json({ error: 'Please sign in again.' });
  }
  req.admin = admin;
  next();
}

module.exports = { googleClientId, verifyGoogleCredential, createSessionToken, requireAdmin };
