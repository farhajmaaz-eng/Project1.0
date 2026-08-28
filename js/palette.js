/* ---------------------------------------------------------------------------
   Tessera · palette — ⌘K command menu: navigation, search, actions
--------------------------------------------------------------------------- */

import { esc, fuzzy, markHtml, htmlToText } from './util.js';
import { ico } from './icons.js';
import { S, issueById, docById, project as projectOf, issueRef, docPath } from './store.js';
import { openModal } from './ui.js';
import { nav } from './nav.js';
import { openIssue } from './issue-drawer.js';

export function openPalette(initialQuery = '') {
  let sel = 0;
  let flat = [];

  const handle = openModal((modal, close) => {
    modal.classList.remove('modal');
    modal.classList.add('palette');

    modal.innerHTML = `
      <div class="palette-input">
        ${ico('search', 17)}
        <input type="text" placeholder="Type a command or search…" autocomplete="off" spellcheck="false" />
        <kbd>esc</kbd>
      </div>
      <div class="palette-list"></div>
      <div class="palette-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span style="margin-left:auto"><kbd>/</kbd> quick search anywhere</span>
      </div>`;
    const input = modal.querySelector('input');
    const listEl = modal.querySelector('.palette-list');
    input.value = initialQuery;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    const go = (hash) => { nav(hash); close(); };

    const staticItems = [
      { group: 'Actions', icon: 'plus', label: 'New issue', kbd: 'C', run: () => { close(); import('./new-issue.js').then(m => m.openNewIssue()); } },
      { group: 'Actions', icon: 'doc', label: 'New page', run: () => { close(); import('./views/docs.js').then(m => m.createAndOpenPage()); } },
      { group: 'Actions', icon: 'clock', label: 'Start a focus session', kbd: 'F', run: () => { close(); import('./focus.js').then(m => m.openFocusPicker()); } },
      {
        group: 'Actions', icon: S().settings.theme === 'light' ? 'moon' : 'sun',
        label: `Switch to ${S().settings.theme === 'light' ? 'dark' : 'light'} theme`, run: () => { close(); import('./main.js').then(m => m.cycleTheme()); },
      },
      { group: 'Go to', icon: 'home', label: 'Home', kbd: 'G H', run: () => go('#/home') },
      { group: 'Go to', icon: 'user', label: 'My issues', kbd: 'G I', run: () => go('#/my') },
      { group: 'Go to', icon: 'layers', label: 'All issues', kbd: 'G A', run: () => go('#/all') },
      { group: 'Go to', icon: 'board', label: 'Board', kbd: 'G B', run: () => go('#/board') },
      { group: 'Go to', icon: 'target', label: 'Cycles', kbd: 'G C', run: () => go('#/cycles') },
      { group: 'Go to', icon: 'zap', label: 'Projects', kbd: 'G P', run: () => go('#/projects') },
      { group: 'Go to', icon: 'doc', label: 'Docs', kbd: 'G D', run: () => go('#/docs') },
      { group: 'Go to', icon: 'sliders', label: 'Settings', run: () => go('#/settings') },
    ];

    function build(query) {
      const q = query.trim();
      const groups = new Map();
      const add = (item) => {
        if (!groups.has(item.group)) groups.set(item.group, []);
        groups.get(item.group).push(item);
      };
      flat = [];

      if (!q) {
        // recents first
        const s = S();
        for (const id of s.recents.issues.slice(0, 4)) {
          const iss = issueById(id);
          if (iss) add({
            group: 'Recent issues', icon: null,
            label: iss.title || 'Untitled',
            sub: issueRef(iss),
            run: () => { close(); openIssue(id); },
          });
        }
        for (const id of s.recents.docs.slice(0, 4)) {
          const d = docById(id);
          if (d) add({
            group: 'Recent pages', icon: null, emoji: d.icon,
            label: d.title || 'Untitled',
            sub: 'page',
            run: () => go(`#/doc/${id}`),
          });
        }
        for (const it of staticItems) add(it);
      } else {
        const scored = [];
        for (const it of staticItems) {
          const f = fuzzy(q, `${it.label} ${it.group}`);
          if (f) scored.push({ score: f.score + 40, item: { ...it, marks: f.marks } });
        }
        for (const iss of S().issues) {
          const f = fuzzy(q, `${issueRef(iss)} ${iss.title}`);
          if (f) scored.push({ score: f.score, item: {
            group: 'Issues', icon: null,
            label: iss.title || 'Untitled', sub: issueRef(iss), marks: f.marks,
            run: () => { close(); openIssue(iss.id); },
          }});
        }
        for (const d of S().docs) {
          if (d.trashed) continue;
          const f = fuzzy(q, d.title || 'Untitled');
          if (f) scored.push({ score: f.score - 2, item: {
            group: 'Pages', icon: null, emoji: d.icon,
            label: d.title || 'Untitled', sub: 'page', marks: f.marks,
            run: () => go(`#/doc/${d.id}`),
          }});
        }
        // full-text page contents (title misses but body hits)
        if (q.length >= 3) {
          let added = 0;
          for (const d of S().docs) {
            if (added >= 4) break;
            if (d.trashed) continue;
            const text = d.blocks.map(b => htmlToText(b.html)).join(' ');
            const idx = text.toLowerCase().indexOf(q.toLowerCase());
            if (idx === -1) continue;
            if ((d.title || '').toLowerCase().includes(q.toLowerCase())) continue; // already listed
            const start = Math.max(0, idx - 42);
            const snippet = (start > 0 ? '…' : '') + text.slice(start, idx + q.length + 60).trim() + '…';
            scored.push({ score: 12 - added, item: {
              group: 'Page contents', icon: null, emoji: d.icon,
              label: `${d.title || 'Untitled'} — ${snippet}`, sub: 'match',
              run: () => go(`#/doc/${d.id}`),
            }});
            added++;
          }
        }
        for (const p of S().projects) {
          const f = fuzzy(q, p.name);
          if (f) scored.push({ score: f.score - 4, item: {
            group: 'Projects', icon: 'zap',
            label: p.name, sub: 'project', marks: f.marks,
            run: () => go(`#/project/${p.id}`),
          }});
        }
        scored.sort((a, b) => b.score - a.score);
        scored.slice(0, 18).forEach(({ item }) => add(item));
      }

      // flatten with selection index
      flat = [];
      let html = '';
      for (const [group, items] of groups) {
        html += `<div class="palette-group caps">${esc(group)}</div>`;
        for (const it of items) {
          const idx = flat.length;
          const iconHTML = it.emoji
            ? `<span class="pi-ic" style="font-size:14px;width:16px;text-align:center">${it.emoji}</span>`
            : `<span class="pi-ic">${ico(it.icon || 'doc', 15)}</span>`;
          html += `
            <button class="pal-item ${idx === sel ? 'sel' : ''}" data-idx="${idx}" style="--i:${Math.min(idx, 12)}">
              ${iconHTML}
              <span class="pi-label">${markHtml(it.label, it.marks)}</span>
              ${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : it.sub ? `<span class="pi-sub">${esc(it.sub)}</span>` : ''}
            </button>`;
          flat.push(it);
        }
      }
      listEl.innerHTML = html || '<div class="palette-empty">Nothing matches.</div>';
    }

    /* the opening paint cascades in; keystrokes swap instantly */
    listEl.classList.add('fresh');
    const settle = () => listEl.classList.remove('fresh');
    setTimeout(settle, 600);
    input.addEventListener('input', settle, { once: true });

    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.pal-item');
      if (btn) flat[+btn.dataset.idx]?.run();
    });

    input.addEventListener('input', () => { sel = 0; build(input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!flat.length) return;
        sel = (sel + (e.key === 'ArrowDown' ? 1 : flat.length - 1)) % flat.length;
        [...listEl.querySelectorAll('.pal-item')].forEach((b, i) =>
          b.classList.toggle('sel', i === sel));
        listEl.querySelector('.pal-item.sel')?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        flat[sel]?.run();
      }
    });

    build(initialQuery);
    setTimeout(() => listEl.querySelector('.pal-item.sel')?.scrollIntoView({ block: 'nearest' }), 0);
  });

  return handle;
}
