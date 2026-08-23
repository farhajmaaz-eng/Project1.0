/* ---------------------------------------------------------------------------
   Tessera · main — boot, router, theme, global keyboard shortcuts
--------------------------------------------------------------------------- */

import { S, onChange } from './store.js';
import { renderSidebar } from './sidebar.js';
import { openPalette } from './palette.js';
import { openModal, closeTopMenu, anyMenuOpen, anyModalOpen } from './ui.js';
import { isDrawerOpen } from './issue-drawer.js';
import { esc } from './util.js';
import { ico } from './icons.js';
import { nav } from './nav.js';

const viewEl = document.getElementById('view');

/* ---------- theme ---------- */

const media = matchMedia('(prefers-color-scheme: light)');
media.addEventListener('change', () => {
  if (S().settings.theme === 'system') applyThemeFromSettings();
});

export function applyThemeFromSettings() {
  let pref = S().settings.theme || 'dark';
  if (pref === 'system') pref = media.matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = pref;
  const btn = document.querySelector('#sidebar .sb-foot [data-theme]');
  if (btn) btn.innerHTML = ico(pref === 'light' ? 'moon' : 'sun', 15);
}

export function cycleTheme() {
  const cur = document.documentElement.dataset.theme;
  S().settings.theme = cur === 'light' ? 'dark' : 'light';
  applyThemeFromSettings();
  import('./store.js').then(m => m.persist());
}

/* ---------- router ---------- */

const routes = {
  '#/home':        () => import('./views/home.js').then(m => m.renderHome(viewEl)),
  '#/my':          () => import('./views/issues.js').then(m => m.renderIssues(viewEl, '#/my')),
  '#/all':         () => import('./views/issues.js').then(m => m.renderIssues(viewEl, '#/all')),
  '#/board':       () => import('./views/board.js').then(m => m.renderBoard(viewEl)),
  '#/cycles':      () => import('./views/cycles.js').then(m => m.renderCycles(viewEl)),
  '#/projects':    () => import('./views/projects.js').then(m => m.renderProjects(viewEl)),
  '#/docs':        () => import('./views/docs.js').then(m => m.renderDocs(viewEl, null)),
  '#/settings':    () => import('./views/settings.js').then(m => m.renderSettings(viewEl)),
};

async function route() {
  closeTopMenu();
  const hash = location.hash || '#/home';

  const entity =
    hash.startsWith('#/cycle/')   ? ['#/', () => import('./views/cycles.js').then(m => m.renderCycle(viewEl, hash.split('/')[2]))]
  : hash.startsWith('#/project/') ? ['#/', () => import('./views/projects.js').then(m => m.renderProject(viewEl, hash.split('/')[2]))]
  : hash.startsWith('#/doc/')     ? ['#/', () => import('./views/docs.js').then(m => m.renderDocs(viewEl, hash.split('/')[2]))]
  : null;

  renderSidebar();
  applyThemeFromSettings();

  try {
    if (entity) await entity[1]();
    else if (routes[hash]) await routes[hash]();
    else { location.hash = '#/home'; return; }
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = `<div class="view-inner">${ico('alert', 20)}
      <p style="margin-top:10px;color:var(--text-2)">Something broke while rendering this view. Check the console.</p></div>`;
  }
  viewEl.scrollTop = 0;
}

window.addEventListener('hashchange', route);

/* ---------- global shortcuts ---------- */

let gChord = false;
let gTimer;

const EDITABLE = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';

function typingTarget(e) {
  return e.target.closest?.(EDITABLE);
}

document.addEventListener('keydown', (e) => {
  // palette everywhere
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
    return;
  }

  if (e.key === 'Escape') {
    if (anyMenuOpen()) { e.preventDefault(); closeTopMenu(); }
    return;
  }

  if (typingTarget(e) || anyModalOpen() || isDrawerOpen() || e.metaKey || e.ctrlKey || e.altKey) return;

  // g-chords
  if (gChord) {
    gChord = false;
    clearTimeout(gTimer);
    const map = { h: '#/home', i: '#/my', a: '#/all', b: '#/board', c: '#/cycles', p: '#/projects', d: '#/docs', s: '#/settings' };
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
      e.preventDefault();
      openPalette();
      break;
    case 'c':
      e.preventDefault();
      import('./new-issue.js').then(m => m.openNewIssue());
      break;
    case 'b':
      e.preventDefault();
      nav('#/board');
      break;
    case '?':
      e.preventDefault();
      shortcutsModal();
      break;
    case 't':
      e.preventDefault();
      cycleTheme();
      break;
  }
});

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
            <div>
              <div class="caps" style="margin:14px 0 4px">${esc(group)}</div>
              ${rows.map(([keys, desc]) => `
                <div class="kbd-row">
                  <span>${esc(desc)}</span>
                  <span class="keys">${keys.split('·').map(k => `<kbd>${esc(k.trim())}</kbd>`).join('')}</span>
                </div>`).join('')}
            </div>`).join('')}
        </div>
      </div>`;
  }, { width: 720 });
}

/* ---------- boot ---------- */

onChange(() => { /* persistence happens in store; sidebar refresh on next nav */ });

if (!location.hash) location.hash = '#/home';
route();
