/* ---------------------------------------------------------------------------
   Tessera · tabbar — mobile bottom navigation (≤900px)
--------------------------------------------------------------------------- */

import { ico } from './icons.js';
import { S } from './store.js';

const TABS = [
  { href: '#/home', icon: 'home', label: 'Home' },
  { href: '#/all', icon: 'layers', label: 'Issues' },
  { href: '#/board', icon: 'board', label: 'Board' },
  { href: '#/docs', icon: 'doc', label: 'Docs' },
  { href: '#/ai', icon: 'sparkles', label: 'AI' },
];

export function renderTabbar() {
  let bar = document.getElementById('tabbar');
  if (!bar) {
    bar = document.createElement('nav');
    bar.id = 'tabbar';
    bar.className = 'tabbar';
    document.body.appendChild(bar);
    bar.addEventListener('click', (e) => {
      const item = e.target.closest('[data-href]');
      if (!item) return;
      location.hash = item.dataset.href;
    });
  }
  const route = location.hash || '#/home';
  const st = S();
  const myOpen = st ? st.issues.filter(i => i.assignee === 'me' && !['done', 'canceled'].includes(i.status)).length : 0;

  bar.innerHTML = TABS.map(t => {
    const on = route === t.href || (t.href !== '#/home' && route.startsWith(t.href));
    return `
      <button class="tab-item ${on ? 'on' : ''}" data-href="${t.href}">
        ${ico(t.icon, 19)}
        <span>${t.label}</span>
        ${t.href === '#/all' && myOpen ? `<span class="t-badge">${Math.min(myOpen, 99)}</span>` : ''}
      </button>`;
  }).join('');
}

export function destroyTabbar() {
  document.getElementById('tabbar')?.remove();
}
