// The owners of the admin panel (gobaris.com/admin). They can always sign in,
// and can't be removed from inside the panel, so nobody can lock everyone out.
// Other people can be given access from the panel's "Admins" page; those are
// kept in the database.
//
// Access is checked here, on the server, every time an admin makes a change,
// so editing the admin page in a browser can never let anyone else in.
const db = require('./db');

const OWNERS = [
  { name: 'Harsh Chittoudiya', email: 'chittoudiyaharsh.2602@gmail.com' },
  { name: 'Dr. Aditi Gupta', email: 'aditi08041998@gmail.com' },
  { name: 'Ayush Upadhyay', email: 'ayushupadhyay161@gmail.com' },
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function findOwner(email) {
  const wanted = normalizeEmail(email);
  return OWNERS.find(a => a.email.toLowerCase() === wanted) || null;
}

// Returns { name, email, owner } for anyone allowed in, or null.
async function findAdmin(email) {
  const owner = findOwner(email);
  if (owner) return { name: owner.name, email: owner.email, owner: true };
  const extra = await db.getExtraAdmin(normalizeEmail(email));
  return extra ? { name: extra.name, email: extra.email, owner: false } : null;
}

async function listAdmins() {
  const extra = await db.listExtraAdmins();
  return [
    ...OWNERS.map(a => ({ name: a.name, email: a.email, owner: true })),
    ...extra
      .filter(a => !findOwner(a.email))
      .map(a => ({ name: a.name, email: a.email, owner: false, addedBy: a.added_by, addedAt: a.created_at })),
  ];
}

module.exports = { OWNERS, normalizeEmail, findOwner, findAdmin, listAdmins };
