/* ---------------------------------------------------------------------------
   Tessera · sidebar v2 — brand, search, collapsible sections, doc tree, footer
--------------------------------------------------------------------------- */

import { ico } from './icons.js';
import { esc } from './util.js';
import {
  S, you, activeCycle,
} from './store.js';
import { renderTree } from './doctree.js';
import { openPalette } from './palette.js';
import { nav } from './nav.js';

const logoSVG = `
<svg class="sb-logo" viewBox="0 0 32 32" aria-hidden="true">
  <rect x="3" y="3" width="12" height="12" rx="3.5" fill="currentColor" opacity=".55"/>
  <rect x="17" y="3" width="12" height="12" rx="3.5" fill="currentColor" opacity=".75"/>
  <rect x="3" y="17" width="12" height="12" rx="3.5" fill="currentColor" opacity=".35"/>
  <rect x="17" y="17" width="12" height="12" rx="6" fill="var(--accent, #8f80f3)"/>
</svg>`;

const collapsedSections = new Set();

export function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.querySelector('.sb-scrim')?.remove();
}

export function renderSidebar() {
  const sb = document.getElementById('sidebar');
  const s = S();
  if (!s) return;
  const route = location.hash || '#/home';
  const me = you();

  const item = (href, icon, label, { count = '' } = {}) => `
    <button class="sb-item ${route === href || (href !== '#/home' && route.startsWith(href)) ? 'on' : ''}"
            data-nav="${href}">
      <span class="si-ic">${ico(icon, 15)}</span>
      <span class="si-label">${label}</span>
      ${count !== '' ? `<span class="si-count">${count}</span>` : ''}
    </button>`;

  const openCount = s.issues.filter(i => !['done', 'canceled'].includes(i.status)).length;
  const myOpen = s.issues.filter(i => i.assignee === 'me' && !['done', 'canceled'].includes(i.status)).length;
  const cyc = activeCycle();

  const section = (id, title, inner) => {
    const isCollapsed = collapsedSections.has(id);
    return `
      <nav class="sb-section" data-section="${id}">
        <div class="sb-head">
          <button class="caps sb-fold" data-fold="${id}" style="display:flex;align-items:center;gap:5px">
            <span class="sb-twist ${isCollapsed ? '' : 'open'}" style="width:14px;height:14px">${ico('chev', 10)}</span>
            <span>${title}</span>
          </button>
          <button class="icon-btn" data-newdoc title="New page">${ico('plus', 13)}</button>
        </div>
        <div ${isCollapsed ? 'hidden' : ''}>${inner}</div>
      </nav>`;
  };

  sb.innerHTML = `
    <div class="sb-brand">
      ${logoSVG}
      <button class="sb-ws" data-home>${esc(s.settings.workspaceName)}</button>
      <button class="icon-btn menu-btn-show" data-menu-toggle aria-label="Close menu">${ico('x', 15)}</button>
    </div>

    <button class="sb-search" data-search>
      ${ico('search', 14)}
      <span>Search…</span>
      <kbd>⌘K</kbd>
    </button>

    <div class="sb-scroll">
      <nav class="sb-section">
        ${item('#/home', 'home', 'Home')}
        ${item('#/my', 'user', 'My issues', { count: myOpen || '' })}
        ${item('#/all', 'layers', 'All issues', { count: openCount })}
        ${item('#/board', 'board', 'Board')}
        ${item('#/ai', 'sparkles', 'Assistant')}
      </nav>

      ${section('planning', 'Planning', `
        ${item('#/cycles', 'target', 'Cycles')}
        ${cyc ? `<div style="padding:0 8px 2px"><span class="faint small mono" style="display:block;padding-left:24px">${esc(cyc.name)} · ends soon</span></div>` : ''}
        ${item('#/projects', 'zap', 'Projects')}
      `)}

      ${section('docs', 'Docs', `<div id="sb-doc-tree"></div>`)}
    </div>

    <footer class="sb-foot">
      <button class="icon-btn" data-theme title="Toggle theme">${ico(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun', 15)}</button>
      <button class="icon-btn" data-settings title="Settings">${ico('sliders', 15)}</button>
      <span style="flex:1"></span>
      <button class="sb-me" data-me>
        <span class="avatar" style="background:${me.color}">${esc(me.name.split(' ').map(w => w[0]).slice(0, 2).join(''))}</span>
        <span class="who"><b>${esc(me.name)}</b><span>${esc(me.role)}</span></span>
      </button>
    </footer>`;

  sb.querySelector('[data-home]').onclick = () => nav('#/home');
  sb.querySelector('[data-search]').onclick = () => openPalette();
  sb.querySelectorAll('[data-newdoc]').forEach((b) =>
    b.onclick = () => import('./views/docs.js').then(m => m.createAndOpenPage()));
  sb.querySelectorAll('[data-nav]').forEach((b) =>
    b.onclick = () => { nav(b.dataset.nav); closeSidebar(); });
  sb.querySelector('[data-settings]').onclick = () => { nav('#/settings'); closeSidebar(); };
  sb.querySelector('[data-theme]').onclick = () => import('./main.js').then(m => m.cycleTheme());
  sb.querySelector('[data-me]').onclick = () => { nav('#/settings'); closeSidebar(); };
  sb.querySelector('[data-menu-toggle]').onclick = closeSidebar;

  sb.querySelectorAll('[data-fold]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.fold;
      collapsedSections.has(id) ? collapsedSections.delete(id) : collapsedSections.add(id);
      renderSidebar();
    };
  });

  const treeHost = sb.querySelector('#sb-doc-tree');
  if (treeHost) {
    renderTree(treeHost, {
      activeId: route.startsWith('#/doc/') ? route.split('/')[2] : null,
      compact: true,
    });
    treeHost.querySelectorAll('[data-doc-id]').forEach((row) => {
      row.onclick = (e) => {
        if (e.target.closest('[data-twist], [data-more]')) return;
        nav(`#/doc/${row.dataset.docId}`);
        closeSidebar();
      };
    });
  }
}

export function wireSidebarScrim() {
  document.addEventListener('pointerdown', (e) => {
    if (!document.getElementById('sidebar')?.classList.contains('open')) return;
    const sb = document.getElementById('sidebar');
    if (sb.contains(e.target)) return;
    if (e.target.closest('.menu, .modal, .drawer')) return;
    closeSidebar();
  });
}
