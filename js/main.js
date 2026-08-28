/* ---------------------------------------------------------------------------
   Tessera · main v4 — boot, auth gating, router, theme, shortcuts, motion
--------------------------------------------------------------------------- */

import { S, onChange, takePersistError, setSetting } from './store.js';
import { renderSidebar, closeSidebar, wireSidebarScrim } from './sidebar.js';
import { renderTabbar } from './tabbar.js';
import { openPalette } from './palette.js';
import { openModal, closeTopMenu, anyMenuOpen, anyModalOpen, toast } from './ui.js';
import { isDrawerOpen } from './issue-drawer.js';
import { esc, sleep } from './util.js';
import { ico } from './icons.js';
import { nav } from './nav.js';
import { wireRipples, watchSurfaces, reduceMotion } from './motion.js';
import { initFx } from './fx.js';
import * as auth from './auth.js';

const viewEl = document.getElementById('view');
const reduce = reduceMotion();

/* ---------- theme ---------- */

const media = matchMedia('(prefers-color-scheme: light)');
media.addEventListener('change', () => {
  if (S()?.settings.theme === 'system') applyThemeFromSettings();
});

export function applyThemeFromSettings() {
  let pref = S()?.settings.theme || 'dark';
  if (pref === 'system') pref = media.matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = pref;
  const btn = document.querySelector('#sidebar .sb-foot [data-theme]');
  if (btn) btn.innerHTML = ico(pref === 'light' ? 'moon' : 'sun', 15);
}

/**
 * Theme switch with a cinematic circular wipe from the toggle button
 * (View Transitions API when available; instant crossfade otherwise).
 */
export function cycleTheme(originEl) {
  const cur = document.documentElement.dataset.theme;
  if (S()) setSetting('theme', cur === 'light' ? 'dark' : 'light');
  themeWipe(originEl, applyThemeFromSettings);
}

/** run `fn` inside a circular reveal expanding from originEl */
export function themeWipe(originEl, fn) {
  if (reduce || !document.startViewTransition || !originEl) { fn(); return; }

  const r = originEl.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(
    Math.max(x, innerWidth - x),
    Math.max(y, innerHeight - y),
  );

  const transition = document.startViewTransition(fn);
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      {
        duration: 480,
        easing: 'cubic-bezier(.3,.9,.3,1)',
        pseudoElement: '::view-transition-new(root)',
      },
    );
  }).catch(() => {});
}

/* ---------- routes ---------- */

const ROUTE_TITLES = {
  '#/home': 'Home', '#/my': 'My issues', '#/all': 'All issues', '#/board': 'Board',
  '#/cycles': 'Cycles', '#/projects': 'Projects', '#/docs': 'Docs', '#/settings': 'Settings',
};

const routes = {
  '#/home':     () => import('./views/home.js').then(m => m.renderHome(viewEl)),
  '#/my':       () => import('./views/issues.js').then(m => m.renderIssues(viewEl, '#/my')),
  '#/all':      () => import('./views/issues.js').then(m => m.renderIssues(viewEl, '#/all')),
  '#/board':    () => import('./views/board.js').then(m => m.renderBoard(viewEl)),
  '#/cycles':   () => import('./views/cycles.js').then(m => m.renderCycles(viewEl)),
  '#/projects': () => import('./views/projects.js').then(m => m.renderProjects(viewEl)),
  '#/docs':     () => import('./views/docs.js').then(m => m.renderDocs(viewEl, null)),
  '#/settings': () => import('./views/settings.js').then(m => m.renderSettings(viewEl)),
  '#/ai':       () => import('./views/ai.js').then(m => m.renderAI(viewEl)),
};

function ensureMobileChrome() {
  let top = document.getElementById('mob-top');
  if (!top) {
    top = document.createElement('header');
    top.id = 'mob-top';
    top.className = 'mob-top';
    top.innerHTML = `
      <button class="icon-btn" data-menu aria-label="Menu">${ico('board', 18)}</button>
      <span class="mob-title"></span>
      <button class="icon-btn" data-search aria-label="Search">${ico('search', 17)}</button>`;
    document.body.appendChild(top);
    top.querySelector('[data-menu]').onclick = () => {
      const sb = document.getElementById('sidebar');
      sb.classList.add('open');
      if (!document.querySelector('.sb-scrim')) {
        const scrim = document.createElement('div');
        scrim.className = 'sb-scrim';
        scrim.onclick = () => closeSidebar();
        document.body.appendChild(scrim);
      }
    };
    top.querySelector('[data-search]').onclick = () => openPalette();
  }
}

async function route() {
  closeTopMenu();

  /* ---- auth gate ---- */
  const acct = auth.getAccount();
  const hash0 = location.hash || '#/home';
  if (!acct) {
    enterAuthMode();
    if (hash0 !== '#/welcome') { location.hash = '#/welcome'; return; }
    await import('./views/welcome.js').then(m => m.renderWelcome(viewEl, 'signup'));
    dismissBoot();
    playReveal();
    return;
  }
  if (!auth.hasSession()) {
    enterAuthMode();
    if (hash0 !== '#/login') { location.hash = '#/login'; return; }
    await import('./views/welcome.js').then(m => m.renderWelcome(viewEl, 'login'));
    dismissBoot();
    playReveal();
    return;
  }
  exitAuthMode();

  if (!S()) { // account exists but workspace missing (shouldn't happen) — recover
    await import('./store.js').then(m => m.initStateFor({ name: acct.name }));
  }

  const hash = hash0;
  if (hash === '#/welcome' || hash === '#/login') { location.hash = '#/home'; return; }

  const entity =
    hash.startsWith('#/cycle/')   ? () => import('./views/cycles.js').then(m => m.renderCycle(viewEl, hash.split('/')[2]))
  : hash.startsWith('#/project/') ? () => import('./views/projects.js').then(m => m.renderProject(viewEl, hash.split('/')[2]))
  : hash.startsWith('#/doc/')     ? () => import('./views/docs.js').then(m => m.renderDocs(viewEl, hash.split('/')[2]))
  : hash.startsWith('#/issue/')   ? () => Promise.all([
      import('./views/issues.js').then(m => m.renderIssues(viewEl, '#/all')),
      import('./issue-drawer.js'),
    ]).then(([, d]) => d.openIssue(hash.split('/')[2]))
  : null;

  /* the old view drifts up + blurs out while the next one loads */
  const inner = viewEl.querySelector('.view-inner');
  if (inner && !reduce && !skipExitOnce) {
    inner.classList.add('leaving');
    await sleep(110);
  }
  skipExitOnce = false;
  viewEl.scrollTop = 0;

  renderSidebar();
  renderTabbar();
  applyThemeFromSettings();
  ensureMobileChrome();
  setMobileTitle(hash);

  try {
    if (entity) await entity();
    else if (routes[hash]) await routes[hash]();
    else { location.hash = '#/home'; return; }
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = `<div class="view-inner"><div class="empty">
      ${ico('alert', 26)}<h3>Something broke here</h3>
      <p>${esc(String(err?.message || err))} — check the console for details.</p></div></div>`;
  }

  playReveal();
  viewEl.scrollTop = 0;
  dismissBoot();
}

/* first navigation skips the exit flourish — there's nothing to leave yet */
let skipExitOnce = true;

function enterAuthMode() {
  document.body.classList.add('auth-mode');
  closeSidebar();
  document.querySelector('.sb-scrim')?.remove();
}
function exitAuthMode() {
  document.body.classList.remove('auth-mode');
}

function setMobileTitle(hash) {
  if (hash.startsWith('#/issue/')) { const el = document.querySelector('.mob-title'); if (el) el.textContent = 'Issue'; return; }
  const base = hash.split('/').slice(0, 2).join('/');
  const el = document.querySelector('.mob-title');
  if (el) el.textContent = ROUTE_TITLES[base] || (hash.startsWith('#/doc/') ? 'Page' : base.replace('#/', '') || 'Tessera');
}

/* offline support */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

/** staggered entrance for the freshly rendered view */
function playReveal() {
  const inner = viewEl.querySelector('.view-inner');
  if (!inner) return;
  inner.classList.remove('reveal', 'leaving');
  [...inner.children].forEach((el, i) => el.style.setProperty('--i', Math.min(i, 6)));
  void inner.offsetWidth;
  inner.classList.add('reveal');
}

/* ---------- boot splash ---------- */
/* the CSS plays assemble → hold → fade on its own clock; we only
   guarantee the node goes away (and never before the show ends) */
function dismissBoot() {
  const b = document.getElementById('boot');
  if (!b || b.dataset.done) return;
  b.dataset.done = '1';
  setTimeout(() => b.remove(), 1600);
}
setTimeout(dismissBoot, 4000);

/* ---------- global motion wiring ---------- */
wireRipples();
watchSurfaces();
initFx();

/* sticky toolbars gain a shadow once their view scrolls */
let scrollTick = false;
document.addEventListener('scroll', () => {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => {
    scrollTick = false;
    document.querySelectorAll('.view').forEach((v) => {
      const tb = v.querySelector?.('.toolbar');
      if (tb) tb.classList.toggle('scrolled', v.scrollTop > 8);
    });
  });
}, { capture: true, passive: true });

window.addEventListener('hashchange', route);

/* surface persistence failures (quota exceeded, private mode) instead of
   silently dropping writes */
let warnedStorage = false;
onChange(() => {
  if (warnedStorage || !takePersistError()) return;
  warnedStorage = true;
  toast('Couldn\u2019t save — storage is full or blocked. Export your workspace from Settings.', { timeout: 10000 });
});

/* ---------- global shortcuts ---------- */

let gChord = false;
let gTimer;

const EDITABLE = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';
const typingTarget = (e) => e.target.closest?.(EDITABLE);

function authed() {
  return auth.getAccount() && auth.hasSession() && !document.body.classList.contains('auth-mode');
}

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (authed()) openPalette();
    return;
  }

  if (e.key === 'Escape') {
    if (anyMenuOpen()) { e.preventDefault(); closeTopMenu(); }
    return;
  }

  if (!authed() || typingTarget(e) || anyModalOpen() || anyMenuOpen() || isDrawerOpen()
      || e.metaKey || e.ctrlKey || e.altKey) return;

  if (gChord) {
    gChord = false;
    clearTimeout(gTimer);
    const map = { h: '#/home', i: '#/my', a: '#/all', b: '#/board', c: '#/cycles', p: '#/projects', d: '#/docs', s: '#/settings', k: '#/ai' };
    const dest = map[e.key.toLowerCase()];
    if (dest) { e.preventDefault(); nav(dest); }
    return;
  }

  switch (e.key) {
    case 'g':
      gChord = true;
      clearTimeout(gTimer);
      gTimer = setTimeout(() => (gChord = false), 900);
      break;
    case '/':
      e.preventDefault(); openPalette(); break;
    case 'c':
      e.preventDefault();
      import('./new-issue.js').then(m => m.openNewIssue()); break;
    case 'b':
      e.preventDefault(); nav('#/board'); break;
    case '?':
      e.preventDefault(); shortcutsModal(); break;
    case 't':
      e.preventDefault(); cycleTheme(); break;
  }
});

wireSidebarScrim();

/* ---------- shortcuts modal ---------- */

const SHORTCUTS = [
  ['General', [
    ['⌘ K', 'Command palette & search'],
    ['C', 'New issue'],
    ['B', 'Go to board'],
    ['T', 'Toggle theme'],
    ['?', 'This dialog'],
    ['Esc', 'Close overlays'],
  ]],
  ['Navigation', [
    ['G then H', 'Home'],
    ['G then I', 'My issues'],
    ['G then A', 'All issues'],
    ['G then B', 'Board'],
    ['G then C', 'Cycles'],
    ['G then P', 'Projects'],
    ['G then D', 'Docs'],
    ['G then K', 'AI assistant'],
  ]],
  ['Lists', [
    ['J / K', 'Move selection down / up'],
    ['↵', 'Open selected issue'],
  ]],
  ['Editor', [
    ['/ ', 'Insert block menu'],
    ['# ␣ · ## ␣ · ### ␣', 'Heading 1–3'],
    ['- ␣ · 1. ␣', 'Bullet / numbered list'],
    ['[] ␣ · [x] ␣', 'To-do item'],
    ['> ␣ · ``` ␣', 'Quote / code block'],
    ['⌘ B / I / U / E', 'Bold / italic / underline / code'],
    ['Tab / ⇧ Tab', 'Indent / outdent list items'],
    ['⇧ ↵', 'Line break within a block'],
  ]],
];

export function shortcutsModal() {
  openModal((m) => {
    m.innerHTML = `
      <div class="modal-head" style="padding-bottom:12px">
        <span class="caps">Keyboard shortcuts</span>
        <span style="flex:1"></span><kbd>esc</kbd>
      </div>
      <div style="overflow-y:auto;padding:6px 22px 22px">
        <div class="kbd-grid">
          ${SHORTCUTS.map(([group, rows]) => `
            <div style="margin-bottom:10px">
              <div class="caps" style="margin:12px 0 4px">${esc(group)}</div>
              ${rows.map(([keys, desc]) => `
                <div class="kbd-row">
                  <span>${esc(desc)}</span>
                  <span class="keys">${keys.split('·').map(k => `<kbd>${esc(k.trim())}</kbd>`).join('')}</span>
                </div>`).join('')}
            </div>`).join('')}
        </div>
      </div>`;
  }, { width: 560 });
}

/* ---------- debug/testing hook ---------- */
window.__tessera = {
  signUp: auth.signUp,
  signIn: auth.signIn,
  getAccount: auth.getAccount,
  hasSession: auth.hasSession,
  signOut: auth.signOut,
  state: S,
  setSetting: (k, v) => import('./store.js').then(m => m.setSetting(k, v)),
  initStateFor: (...a) => import('./store.js').then(m => m.initStateFor(...a)),
};
/* ---------- boot ---------- */

if (!location.hash) location.hash = auth.getAccount() && auth.hasSession() ? '#/home' : '#/welcome';
route();
