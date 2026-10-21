// The core team of the admin panel (gobaris.com/admin). They can always sign
// in, and can't be removed from inside the panel, so nobody can lock everyone
// out. Everyone has the same permissions; the role (Analyst, Admin or
// Executive) is the label the panel's Admins page groups people by.
// Other people can be given access from the panel's "Admins" page, with one of
// those roles; they're kept in the database.
//
// Access is checked here, on the server, every time an admin makes a change,
// so editing the admin page in a browser can never let anyone else in.
const db = require('./db');

const ROLES = ['Analyst', 'Admin', 'Executive'];

const CORE_TEAM = [
  { name: 'Harsh Chittoudiya', email: 'chittoudiyaharsh.2602@gmail.com', role: 'Admin' },
  { name: 'Dr. Aditi Gupta', email: 'aditi08041998@gmail.com', role: 'Admin' },
  { name: 'Ayush Upadhyay', email: 'ayushupadhyay161@gmail.com', role: 'Analyst' },
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function findCoreMember(email) {
  const wanted = normalizeEmail(email);
  return CORE_TEAM.find(a => a.email.toLowerCase() === wanted) || null;
}

// Returns { name, email, role, permanent } for anyone allowed in, or null.
async function findAdmin(email) {
  const core = findCoreMember(email);
  if (core) return { name: core.name, email: core.email, role: core.role, permanent: true };
  const extra = await db.getExtraAdmin(normalizeEmail(email));
  return extra ? { name: extra.name, email: extra.email, role: extra.role, permanent: false } : null;
}

async function listAdmins() {
  const extra = await db.listExtraAdmins();
  return [
    ...CORE_TEAM.map(a => ({ name: a.name, email: a.email, role: a.role, permanent: true })),
    ...extra
      .filter(a => !findCoreMember(a.email))
      .map(a => ({ name: a.name, email: a.email, role: a.role, permanent: false, addedBy: a.added_by, addedAt: a.created_at })),
  ];
}

module.exports = { ROLES, CORE_TEAM, normalizeEmail, findCoreMember, findAdmin, listAdmins };
