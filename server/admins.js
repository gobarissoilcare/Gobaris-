// The only people who can sign in to the admin panel (gobaris.com/admin).
// Access is checked here, on the server, every time an admin makes a change,
// so editing the admin page in a browser can never let anyone else in.
//
// To give someone access, add their Google account's email below, then
// commit and redeploy the server. To remove someone, delete their line.
const ADMINS = [
  { name: 'Harsh Chittoudiya', email: 'chittoudiyaharsh.2602@gmail.com' },
  { name: 'Dr. Aditi Gupta', email: 'aditi08041998@gmail.com' },
  { name: 'Ayush Upadhyay', email: 'ayushupadhyay161@gmail.com' },
];

function findAdmin(email) {
  const wanted = String(email || '').trim().toLowerCase();
  return ADMINS.find(a => a.email.toLowerCase() === wanted) || null;
}

module.exports = { ADMINS, findAdmin };
