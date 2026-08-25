/* ---------------------------------------------------------------------------
   Tessera · util — small helpers used everywhere
--------------------------------------------------------------------------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s = '') {
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

let _uid = 0;
export const uid = (p = 'x') =>
  `${p}_${Date.now().toString(36)}${(_uid++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function debounce(fn, ms) {
  let t;
  const wrapped = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  wrapped.cancel = () => clearTimeout(t);
  wrapped.flush = (...a) => { clearTimeout(t); fn(...a); };
  return wrapped;
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** animate a number into an element (skipped under reduced motion) */
export function countUp(el, target, ms = 550) {
  if (!el) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || target <= 0) { el.textContent = String(target); return; }
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- dates ---------- */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const asDate = (iso) => {
  if (!iso) return null;
  /* tolerate epoch numbers / Date objects from imports or older schemas —
     a malformed date must never take down a whole view */
  if (iso instanceof Date) return isNaN(iso) ? null : iso;
  if (typeof iso === 'number') return new Date(iso);
  if (typeof iso !== 'string') return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayISO = () => toISO(new Date());

export function dayDiff(iso, fromISO = todayISO()) {
  const a = asDate(iso), b = asDate(fromISO);
  if (!a || !b) return 0;
  return Math.round((a - b) / 86400000);
}

/** "Today", "Tomorrow", "Sat", or "Aug 21" */
export function relDay(iso) {
  if (!iso) return '';
  const d = dayDiff(iso);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  const dt = asDate(iso);
  return d < -1 ? `${MONTHS[dt.getMonth()]} ${dt.getDate()}` : dt.toLocaleDateString(undefined, { weekday: 'short' });
}

/** short due badge: overdue/today get colored classes upstream */
export function dueBadgeInfo(iso) {
  if (!iso) return null;
  const d = dayDiff(iso);
  return {
    cls: d < 0 ? 'over' : d <= 1 ? 'soon' : '',
    label: d === 0 ? 'Today' : relDay(iso),
  };
}

export function fmtFull(iso) {
  const dt = asDate(iso);
  return dt ? `${DAYS[dt.getDay()]}, ${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}` : '';
}

/** relative timestamp for activity: "just now", "2h", "Aug 21" */
export function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  const d = Math.floor(s / 86400);
  if (d < 7) return `${d}d`;
  const dt = new Date(ts);
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}
export const dayName = (now = new Date()) => DAYS[now.getDay()];
export const dateLine = (now = new Date()) =>
  `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

/* ---------- fuzzy match ----------
   Subsequence scoring: consecutive chars and word starts win. Returns
   { score, marks } where marks is a boolean array over the haystack. */
export function fuzzy(q, text) {
  if (!q) return { score: 0, marks: [] };
  const t = text.toLowerCase();
  const needle = q.toLowerCase().replace(/\s+/g, '');
  let ti = 0, score = 0, prevHit = -2;
  const marks = new Array(t.length).fill(false);
  for (const ch of needle) {
    const idx = t.indexOf(ch, ti);
    if (idx === -1) return null;
    marks[idx] = true;
    score += idx === prevHit + 1 ? 14 : 5;
    if (idx === 0 || /\s|[-_/.\[]/.test(t[idx - 1])) score += 9;
    prevHit = idx;
    ti = idx + 1;
  }
  score -= ti * 0.05;
  return { score, marks };
}

/** wrap matched chars of `text` in <b> using marks from fuzzy() */
export function markHtml(text, marks) {
  if (!marks || !marks.length) return esc(text);
  let out = '', open = false;
  for (let i = 0; i < text.length; i++) {
    const want = marks[i];
    if (want && !open) { out += '<b>'; open = true; }
    if (!want && open) { out += '</b>'; open = false; }
    out += esc(text[i]);
  }
  if (open) out += '</b>';
  return out;
}

/* ---------- misc ---------- */
export const initials = (name = '?') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function htmlToText(html = '') {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}

export function plainToBlocks(text) {
  return text.split('\n')
    .map(l => l.trim()).filter(Boolean)
    .map(l => ({
      id: uid('b'),
      type: /^[-*]\s+/.test(l) ? 'ul' : l.replace(/^[-*]\s+/, '') ? (/^\d+[.)]\s+/.test(l) ? 'ol' : 'p') : 'p',
      html: esc(l.replace(/^([-*]|\d+[.)])\s+/, '')),
      indent: 0,
    }));
}

export const blocksText = (blocks = []) => blocks.map(b => htmlToText(b.html)).join('\n');

/* ---------- caret helpers for contenteditable ---------- */

export function getCaretOffset(el) {
  const sel = getSelection();
  if (!sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer)) return null;
  const pre = r.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}

export function setCaretOffset(el, offset) {
  const sel = getSelection();
  const r = document.createRange();
  let placed = false;
  const walk = (node) => {
    for (const child of node.childNodes) {
      const len = child.textContent.length;
      if (child.nodeType === 3) {
        if (offset <= len) { r.setStart(child, clamp(offset, 0, len)); placed = true; return true; }
        offset -= len;
      } else if (walk(child)) return true;
    }
    return false;
  };
  walk(el);
  if (!placed) { r.selectNodeContents(el); r.collapse(!offset); }
  else r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

export function caretRect(el) {
  try {
    const sel = getSelection();
    if (sel.rangeCount) {
      const r = sel.getRangeAt(0).cloneRange();
      let rect = typeof r.getBoundingClientRect === 'function'
        ? r.getBoundingClientRect()
        : null;
      if (!rect || (!rect.top && !rect.left)) rect = null;
      if (rect) return rect;
    }
  } catch { /* fall through */ }
  try {
    return el ? el.getBoundingClientRect() : { top: 0, left: 0, bottom: 0, height: 20 };
  } catch {
    return { top: 0, left: 0, bottom: 0, height: 20 };
  }
}

export function placeCaretEnd(el) {
  const sel = getSelection();
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

/* ---------- sanitize inline html (allowlist) ---------- */
const ALLOWED_INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'CODE', 'BR', 'SPAN']);

export function cleanInline(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const scrub = (node) => {
    [...node.children].forEach((c) => {
      scrub(c);
      if (!ALLOWED_INLINE.has(c.tagName)) {
        c.replaceWith(...c.childNodes);
      } else {
        [...c.attributes].forEach(a => c.removeAttribute(a.name));
        if (c.tagName === 'SPAN') c.replaceWith(...c.childNodes);
      }
    });
  };
  scrub(tpl.content);
  return tpl.innerHTML;
}

/* ---------- export / import ---------- */
export function downloadFile(name, text, mime = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
