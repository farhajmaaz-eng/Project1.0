/* ---------------------------------------------------------------------------
   Tessera · auth — local-only accounts. No server: credentials never leave
   this browser. Passwords are stored as salted SHA-256 hashes so plaintext
   doesn't sit in localStorage.
--------------------------------------------------------------------------- */

const AKEY = 'tessera.auth';     // { name, email, hash, salt }
const SKEY = 'tessera.session';  // '1' when signed in

export function getAccount() {
  try { return JSON.parse(localStorage.getItem(AKEY)); } catch { return null; }
}
export const hasSession = () => localStorage.getItem(SKEY) === '1';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function signUp({ name, email, password, workspace }) {
  if (!name.trim()) throw new Error('Tell me your name.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('That email does not look right.');
  if (password.length < 4) throw new Error('Password needs at least 4 characters.');
  if (getAccount()) throw new Error('An account already exists on this device.');

  const salt = crypto.getRandomValues(new Uint8Array(12))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await sha256(`${salt}:${password}`);

  localStorage.setItem(AKEY, JSON.stringify({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    salt, hash,
  }));
  return true;
}

export async function signIn(email, password) {
  const acct = getAccount();
  if (!acct) throw new Error('No account on this device yet — create one first.');
  if (email.trim().toLowerCase() !== acct.email) throw new Error('Wrong email for this device.');
  const attempt = await sha256(`${acct.salt}:${password}`);
  if (attempt !== acct.hash) throw new Error('Wrong password.');
  return true;
}

export function startSession() { localStorage.setItem(SKEY, '1'); }
export function signOut() { localStorage.removeItem(SKEY); }
