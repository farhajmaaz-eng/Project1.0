/* ---------------------------------------------------------------------------
   Tessera · sidebar — brand, search, nav sections, doc tree, footer
--------------------------------------------------------------------------- */

import { ico } from './icons.js';
import { esc } from './util.js';
import {
  S, you, rootDocs, childrenDocs, activeCycle, hasKids,
} from './store.js';
import { renderTree } from './doctree.js';
import { openPalette } from './palette.js';
import { nav } from './nav.js';

const logoSVG = `
<svg class="sb-logo" viewBox="0 0 32 32" aria-hidden="true">
  <rect x="3" y="3" width="12" height="12" rx="3.5" fill="currentColor" opacity=".55"/>
  <rect x="17" y="3" width="12" height="12" rx="3.5" fill="currentColor" opacity=".75"/>
  <rect x="3" y="17" width="12" height="12" rx="3.5" fill="currentColor" opacity=".35"/>
  <rect x="17" y="17" width="12" height="12" rx="6" fill="#d9a05b"/>
</svg>`;

export function renderSidebar() {
  const sb = document.getElementById('sidebar');
  const s = S();
  const route = location.hash || '#/home';
  const me = you();
  const cyc = activeCycle();

  const item = (href, icon, label, { count = '', on = false, extraHTML = '' } = {}) => `
    <button class="sb-item ${route === href || (href !== '#/home' && route.startsWith(href)) ? 'on' : ''}"
            data-nav="${href}">
      <span class="si-ic">${ico(icon, 15)}</span>
      <span class="si-label">${label}</span>
      ${count !== '' ? `<span class="si-count">${count}</span>` : ''}
      ${extraHTML}
    </button>`;

  const openCount = s.issues.filter(i => !['done', 'canceled'].includes(i.status)).length;
  const myOpen = s.issues.filter(i => i.assignee === me.id && !['done', 'canceled'].includes(i.status)).length;

  // favorites + roots for the docs section
  const docsHostId = 'sb-doc-tree';

  sb.innerHTML = `
    <div class="sb-brand">
      ${logoSVG}
      <button class="sb-ws" data-home>${esc(s.settings.workspaceName)}</button>
      <button class="icon-btn menu-btn-show" data-menu-toggle aria-label="Menu">${ico('x', 15)}</button>
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
      </nav>

      <nav class="sb-section">
        <div class="sb-head"><span class="caps">Planning</span></div>
        ${item('#/cycles', 'target', 'Cycles')}
        ${cyc ? `<div style="padding:0 8px 2px"><span class="faint small mono" style="display:block;padding-left:24px">${esc(cyc.name)} · ends soon</span></div>` : ''}
        ${item('#/projects', 'zap', 'Projects')}
      </nav>

      <nav class="sb-section sb-tree">
        <div class="sb-head">
          <span class="caps">Docs</span>
          <button class="icon-btn" data-newdoc title="New page">${ico('plus', 13)}</button>
        </div>
        <div id="${docsHostId}"></div>
      </nav>
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
  sb.querySelector('[data-newdoc]').onclick = () =>
    import('./views/docs.js').then(m => m.createAndOpenPage());
  sb.querySelectorAll('[data-nav]').forEach((b) =>
    b.onclick = () => { nav(b.dataset.nav); sb.classList.remove('open'); });
  sb.querySelector('[data-settings]').onclick = () => nav('#/settings');
  sb.querySelector('[data-theme]').onclick = () =>
    import('./main.js').then(m => m.cycleTheme());
  sb.querySelector('[data-me]').onclick = () => nav('#/settings');
  sb.querySelector('[data-menu-toggle]').onclick = () => sb.classList.remove('open');

  const treeHost = sb.querySelector(`#${docsHostId}`);
  const favs = s.docs.filter(d => d.favorite);
  let html = '';
  if (favs.length) {
    html += favs.map(d => `
      <button class="sb-item ${route === `#/doc/${d.id}` ? 'on' : ''}" data-doc="${d.id}" style="height:28px;font-size:13px">
        <span class="sb-twist leaf">${ico('chev', 11)}</span>
        <span class="sb-doc-icon">${d.icon}</span>
        <span class="si-label">${esc(d.title || 'Untitled')}</span>
      </button>`).join('');
  }
  html += '<div data-subtree></div>';
  treeHost.innerHTML = html;
  renderTree(treeHost.querySelector('[data-subtree]'), {
    activeId: route.startsWith('#/doc/') ? route.split('/')[2] : null,
    compact: true,
  });
  treeHost.querySelectorAll('[data-subtree] [data-doc-id]').forEach((row) => {
    row.onclick = (e) => {
      if (e.target.closest('[data-twist], [data-more]')) return;
      nav(`#/doc/${row.dataset.docId}`);
      sb.classList.remove('open');
    };
  });
  treeHost.querySelectorAll('[data-doc]').forEach((b) => {
    b.onclick = () => { nav(`#/doc/${b.dataset.doc}`); sb.classList.remove('open'); };
  });
}
