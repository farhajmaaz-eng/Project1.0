/* ---------------------------------------------------------------------------
   Tessera · auth — local-only accounts. No server: credentials never leave
   this browser. Passwords are stretched with PBKDF2 (150k iterations) before
   storage, so plaintext doesn't sit in localStorage and a stolen file isn't
   instantly crackable. Legacy SHA-256 accounts migrate transparently on the
   next successful sign-in. Sign-in attempts are throttled locally.
--------------------------------------------------------------------------- */

const AKEY = 'tessera.auth';     // { name, email, hash, salt, iterations?, v? }
const SKEY = 'tessera.session';  // '1' when signed in
const TKEY = 'tessera.authlock'; // { fails, until } — throttle state

const ITERATIONS = 150_000;
const MAX_FAILS = 5;
const LOCKOUT_MS = 30_000;

export function getAccount() {
  try { return JSON.parse(localStorage.getItem(AKEY)); } catch { return null; }
}
export const hasSession = () => localStorage.getItem(SKEY) === '1';

const toHex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function pbkdf2(password, saltHex, iterations = ITERATIONS) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  ).then(toHex);
}

/** pre-migration hashing scheme */
async function legacySha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(buf);
}

/* ---------- throttling ---------- */

function throttleState() {
  try { return JSON.parse(localStorage.getItem(TKEY)) || { fails: 0, until: 0 }; }
  catch { return { fails: 0, until: 0 }; }
}
function saveThrottle(t) { localStorage.setItem(TKEY, JSON.stringify(t)); }

function lockedFor() {
  const t = throttleState();
  return t.until > Date.now() ? Math.ceil((t.until - Date.now()) / 1000) : 0;
}
function noteFail() {
  const t = throttleState();
  t.fails += 1;
  if (t.fails >= MAX_FAILS) {
    t.until = Date.now() + LOCKOUT_MS * Math.min(4, 2 ** (t.fails - MAX_FAILS));
    t.fails = 0;
  }
  saveThrottle(t);
}
function noteSuccess() { localStorage.removeItem(TKEY); }

export function throttleHint() {
  const s = lockedFor();
  if (!s) return '';
  return `Too many attempts — wait ${s}s and try again.`;
}

/* ---------- account lifecycle ---------- */

export async function signUp({ name, email, password }) {
  if (!name.trim()) throw new Error('Tell me your name.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('That email does not look right.');
  if (password.length < 8) throw new Error('Password needs at least 8 characters.');
  if (getAccount()) throw new Error('An account already exists on this device.');

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await pbkdf2(password, salt);

  localStorage.setItem(AKEY, JSON.stringify({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    salt, hash, iterations: ITERATIONS,
  }));
  noteSuccess();
  return true;
}

export async function signIn(email, password) {
  const wait = lockedFor();
  if (wait) throw new Error(`Too many attempts — wait ${wait}s and try again.`);
  const acct = getAccount();
  if (!acct) throw new Error('No account on this device yet — create one first.');
  if (email.trim().toLowerCase() !== acct.email) { noteFail(); throw new Error('Wrong email for this device.'); }

  let ok;
  let upgraded = null;
  if (acct.iterations) {
    ok = (await pbkdf2(password, acct.salt, acct.iterations)) === acct.hash;
  } else {
    // legacy account: verify against old scheme, then upgrade in place
    ok = (await legacySha256(`${acct.salt}:${password}`)) === acct.hash;
    if (ok) upgraded = { salt: toHex(crypto.getRandomValues(new Uint8Array(16))) };
    if (upgraded) upgraded.hash = await pbkdf2(password, upgraded.salt);
  }

  if (!ok) { noteFail(); throw new Error('Wrong password.'); }
  if (upgraded) {
    localStorage.setItem(AKEY, JSON.stringify({
      ...acct, salt: upgraded.salt, hash: upgraded.hash, iterations: ITERATIONS,
    }));
  }
  noteSuccess();
  return true;
}

export function startSession() { localStorage.setItem(SKEY, '1'); }
export function signOut() { localStorage.removeItem(SKEY); }
