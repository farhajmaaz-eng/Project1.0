/* ---------------------------------------------------------------------------
   Tessera · views/docs v3 — covers, templates, trash, print, reading time.
   The Notion-grade writing surface.
--------------------------------------------------------------------------- */

import { esc, uid, htmlToText, debounce } from './../util.js';
import { ico } from './../icons.js';
import {
  S, docById, docPath, updateDoc, createDoc,
} from './../store.js';
import { toast } from './../ui.js';
import { renderTree, isExpanded, toggleExpand } from './../doctree.js';
import { mountEditor } from './../editor.js';
import { nav } from './../nav.js';
import { emptyState } from './../bits.js';

const EMOJI = ['📄','🌱','🗺️','📝','🧭','🎨','✅','🎯','💡','🔥','📌','🧪','🚀','🛠️','📚','🗓️','🔁','⭐','🧩','🔭','💬','⚖️','🏗️','🧵','🪄','🍀'];

const COVERS = [
  'linear-gradient(135deg,#d9a05b 0%,#8a5432 100%)',
  'linear-gradient(135deg,#8f8aa5 0%,#33323e 100%)',
  'linear-gradient(135deg,#58b98c 0%,#1e4d38 100%)',
  'linear-gradient(135deg,#9d7cd8 0%,#453168 100%)',
  'linear-gradient(135deg,#e5484d 0%,#5f1d20 100%)',
  'linear-gradient(135deg,#4fa3e3 0%,#20415e 100%)',
  'linear-gradient(135deg,#e2b93d 0%,#6d520f 100%)',
  'linear-gradient(180deg,#40404d 0%,#131318 100%)',
];

/* ---------- page templates ---------- */
const B = (type, html, extra = {}) => ({ id: uid('b'), type, html, indent: 0, ...extra });
const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const TEMPLATES = [
  { id: 'empty', icon: '📄', name: 'Empty page', desc: 'A blank canvas.' },
  { id: 'meeting', icon: '🗓️', name: 'Meeting notes', desc: 'Attendees, decisions, action items.' },
  { id: 'weekly', icon: '📆', name: 'Weekly plan', desc: 'Focus, schedule, reflections.' },
  { id: 'brief', icon: '📋', name: 'Project brief', desc: 'Overview, goals, risks, scope.' },
];

function buildTemplate(id) {
  switch (id) {
    case 'meeting':
      return { icon: '🗓️', title: `Meeting notes — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, blocks: [
        B('p', `<strong>Date:</strong> ${today()} · <strong>Time:</strong> · <strong>Where:</strong>`),
        B('h3', 'Attendees'),
        B('ul', ''),
        B('callout', 'One line: why did this meeting exist?', { type: 'callout', icon: '🎯' }),
        B('h2', 'Decisions'),
        B('ul', ''),
        B('h2', 'Action items'),
        B('todo', '', {}),
        B('todo', '', {}),
        B('toggle', 'Parking lot', {}),
        B('p', '', { indent: 1 }),
      ] };
    case 'weekly':
      return { icon: '📆', title: `Week ${Math.ceil((((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 86400000) + 1) / 7)} plan`, blocks: [
        B('h2', 'Theme of the week'),
        B('quote', 'One sentence that would make this week a win.'),
        B('h2', 'Focus areas'),
        B('todo', '', {}), B('todo', '', {}), B('todo', '', {}),
        B('h2', 'Schedule'),
        B('table', '', { rows: [['Day', 'Plan'], ['Mon', ''], ['Tue', ''], ['Wed', '']] }),
        B('h2', 'Reflections'),
        B('p', ''),
      ] };
    case 'brief':
      return { icon: '📋', title: 'Project brief', blocks: [
        B('p', '<strong>Owner:</strong> · <strong>Status:</strong> draft · <strong>Target:</strong>'),
        B('h2', 'Overview'),
        B('p', 'Two sentences max. What is this and why now?'),
        B('h2', 'Goals'),
        B('ol', ''),
        B('ol', ''),
        B('h2', 'Non-goals'),
        B('ul', ''),
        B('callout', 'Biggest risk and how we\u2019ll see it coming.', { type: 'callout', icon: '⚠️' }),
        B('h2', 'Scope'),
        B('table', '', { rows: [['In scope', 'Out of scope'], [' ', ' ']] }),
      ] };
    default:
      return { icon: '📄', title: '', blocks: [{ id: uid('b'), type: 'p', html: '', indent: 0 }] };
  }
}

let editor = null;
let currentId = null;
let trashUnsub = null;

export function createAndOpenPage(parentId = null) {
  import('./../ui.js').then(({ openModal }) => {
    openModal((modal, close) => {
      modal.innerHTML = `
        <div class="modal-head" style="padding-bottom:12px">
          ${ico('plus', 15)}<span class="caps">New page</span>
          <span style="flex:1"></span><kbd>esc</kbd>
        </div>
        <div class="tpl-grid">
          ${TEMPLATES.map(t => `
            <button class="tpl-card" data-tpl="${t.id}">
              <span class="tpl-icon">${t.icon}</span>
              <b>${esc(t.name)}</b>
              <span>${esc(t.desc)}</span>
            </button>`).join('')}
        </div>`;
      modal.querySelectorAll('[data-tpl]').forEach(btn => {
        btn.onclick = () => {
          const tpl = buildTemplate(btn.dataset.tpl);
          const d = createDoc({
            parentId,
            icon: tpl.icon,
            title: tpl.title,
            blocks: tpl.blocks,
          });
          if (parentId && !isExpanded(parentId)) toggleExpand(parentId);
          close();
          nav(`#/doc/${d.id}`);
          setTimeout(() => toast('Page created from template'), 50);
        };
      });
    }, { width: 560 });
  });
}

export function renderDocs(view, id) {
  const s = S();
  const doc = id ? docById(id) : null;

  view.innerHTML = `
    <div class="docs-shell">
      <aside class="doc-tree-pane">
        <div class="doc-tree-head">
          <span class="caps">Pages</span>
          <button class="icon-btn" data-newpage title="New page">${ico('plus', 14)}</button>
        </div>
        <div data-tree></div>
        <div class="trash-sec" data-trash></div>
      </aside>
      <div class="doc-pane" data-pane></div>
    </div>`;

  view.querySelector('[data-newpage]').onclick = () => createAndOpenPage(null);
  const treeHost = view.querySelector('[data-tree]');
  const paintTree = () => {
    const active = currentId || null;
    renderTree(treeHost, { activeId: active, compact: true });
    treeHost.querySelectorAll('[data-doc-id]').forEach((row) => {
      row.onclick = (e) => {
        if (e.target.closest('[data-twist], [data-more]')) return;
        nav(`#/doc/${row.dataset.docId}`);
      };
    });
    paintTrash();
  };

  function paintTrash() {
    const host = view.querySelector('[data-trash]');
    if (!host) return; // view navigated away; subscription cleaned up below
    const trashed = S().docs.filter(d => d.trashed);
    host.innerHTML = `
      <div class="sb-section sb-tree" style="margin-top:22px">
        <div class="sb-head"><span class="caps">Trash (${trashed.length})</span>
          ${trashed.length ? `<button class="icon-btn" data-emptytrash title="Empty trash">${ico('trash', 12)}</button>` : ''}
        </div>
        ${trashed.map(d => `
          <div class="sb-item" style="height:28px;font-size:12.5px;color:var(--text-3)">
            <span class="sb-twist leaf">${ico('chev', 11)}</span>
            <span class="sb-doc-icon">${d.icon}</span>
            <span class="si-label" style="text-decoration:line-through">${esc(d.title || 'Untitled')}</span>
            <button class="icon-btn" style="width:20px;height:20px" data-restore="${d.id}" title="Restore">${ico('rotate', 11)}</button>
            <button class="icon-btn" style="width:20px;height:20px" data-purge="${d.id}" title="Delete forever">${ico('x', 11)}</button>
          </div>`).join('') || ''}
      </div>`;
    host.querySelector('[data-emptytrash]')?.addEventListener('click', () => {
      import('./../store.js').then(m => { m.emptyTrash(); toast('Trash emptied'); });
    });
    host.querySelectorAll('[data-restore]').forEach(b =>
      b.onclick = () => { import('./../store.js').then(m => m.restoreTrashed(b.dataset.restore)); toast('Restored'); });
    host.querySelectorAll('[data-purge]').forEach(b =>
      b.onclick = () => { import('./../store.js').then(m => { m.purgeDoc(b.dataset.purge); }); });
  }

  if (trashUnsub) trashUnsub();
  import('./../store.js').then(m => { trashUnsub = m.onChange(() => paintTrash()); });

  paintTree();

  const pane = view.querySelector('[data-pane]');
  if (!doc || doc.trashed) {
    const first = s.docs.find(d => d.favorite && !d.trashed) || s.docs.find(d => !d.trashed);
    if (first && !id) { nav(`#/doc/${first.id}`); return; }
    pane.innerHTML = `
      <div class="doc-landing">
        ${emptyState('doc', 'A quiet place to think',
          'Pages hold the reasoning behind the work — specs, notes, plans. Start one.',
          '<button class="btn primary" data-first>New page</button>')}
      </div>`;
    pane.querySelector('[data-first]').onclick = () => createAndOpenPage(null);
    currentId = null;
    return;
  }

  currentId = doc.id;

  /* ---------- page ---------- */
  pane.innerHTML = `
    <article class="doc-page">
      ${doc.cover ? `<div class="doc-cover" data-cover style="background:${esc(doc.cover)}"><button class="cover-change" data-coverchange>${ico('pen', 13)} Change cover</button></div>` : `
      <button class="cover-add" data-coveradd>${ico('down', 13)} Add cover</button>`}
      <nav class="crumbs doc-crumb" data-crumbs style="${doc.cover ? 'margin-top:14px' : ''}"></nav>
      <div class="doc-title-row ${doc.cover ? 'with-cover' : ''}">
        <button class="doc-bigicon" title="Change icon" data-icon>${doc.icon}</button>
        <input class="doc-title" data-title placeholder="Untitled" value="" />
      </div>
      <div class="doc-meta">
        <button class="icon-btn" style="width:22px;height:22px;${doc.favorite ? 'color:var(--accent)' : ''}"
                title="${doc.favorite ? 'Unfavorite' : 'Favorite'}" data-fav>${ico('star', 13)}</button>
        <span class="mono" data-words></span>
        <span class="sep-dot"></span>
        <span class="mono" data-read></span>
        <span class="sep-dot"></span>
        <span class="mono" data-edited></span>
        <span style="flex:1"></span>
        <button class="icon-btn" style="width:24px;height:24px" title="Page options" data-pagemore>${ico('dots', 14)}</button>
      </div>
      <div class="doc-body" data-body></div>
      <div class="doc-foot"><span>/ for blocks · tab nests · ? for shortcuts</span><span data-saved></span></div>
    </article>`;

  /* title */
  const titleEl = pane.querySelector('[data-title]');
  titleEl.value = doc.title;
  titleEl.addEventListener('input', debounce(() => {
    updateDoc(doc.id, { title: titleEl.value });
    paintTree();
    flashSaved();
  }, 350));
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); editor?.focus(); }
  });

  /* breadcrumbs */
  const path = docPath(doc.id);
  pane.querySelector('[data-crumbs]').innerHTML = `
    <button data-root>Docs</button>
    ${path.slice(0, -1).map(d => `<span>${ico('chev', 11)}</span><button data-goto="${d.id}">${esc(d.title || 'Untitled')}</button>`).join('')}
    <span>${ico('chev', 11)}</span><span class="cur">${esc(doc.title || 'Untitled')}</span>`;
  pane.querySelector('[data-crumbs] [data-root]').onclick = () => nav('#/docs');
  pane.querySelectorAll('[data-goto]').forEach(b =>
    b.onclick = () => nav(`#/doc/${b.dataset.goto}`));

  /* favorite */
  pane.querySelector('[data-fav]').onclick = (e) => {
    updateDoc(doc.id, { favorite: !doc.favorite });
    e.currentTarget.style.color = doc.favorite ? '' : 'var(--accent)';
  };

  /* more menu (via doctree.pageMenu) + print */
  import('./../doctree.js').then(({ pageMenu }) => {
    pane.querySelector('[data-pagemore]').onclick = (e) => pageMenu(e.currentTarget, doc.id, paintTree);
  });

  /* cover */
  const openCoverPicker = (anchor) => {
    import('./../ui.js').then(({ openMenu }) => {
      openMenu({
        anchor,
        items: [
          ...COVERS.map((c, i) => ({
            value: c, label: `Cover ${i + 1}`,
            icon: `<i style="display:inline-block;width:16px;height:12px;border-radius:4px;background:${c}"></i>`,
            checked: doc.cover === c,
          })),
          { sep: true },
          { value: '__none__', label: 'Remove cover', icon: ico('x', 14), danger: true },
        ],
        onSelect: (v) => {
          updateDoc(doc.id, { cover: v === '__none__' ? '' : v });
          renderDocs(view, id); // re-render chrome
        },
      });
    });
  };
  pane.querySelector('[data-coverchange]')?.addEventListener('click', (e) => {
    e.stopPropagation(); openCoverPicker(e.currentTarget);
  });
  pane.querySelector('[data-coveradd]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openCoverPicker(e.currentTarget);
  });

  /* icon picker */
  pane.querySelector('[data-icon]').onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'menu';
    pop.style.left = `${r.left}px`;
    pop.style.top = `${Math.min(r.bottom + 6, innerHeight - 220)}px`;
    pop.innerHTML = `<div class="emoji-grid">${EMOJI.map(em =>
      `<button>${em}</button>`).join('')}</div>`;
    document.getElementById('overlays').appendChild(pop);
    pop.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      e.currentTarget.textContent = b.textContent;
      updateDoc(doc.id, { icon: b.textContent });
      paintTree();
      pop.remove();
    });
    setTimeout(() => {
      const off = (ev2) => { if (!pop.contains(ev2.target)) { pop.remove(); document.removeEventListener('pointerdown', off); } };
      document.addEventListener('pointerdown', off);
    }, 0);
  };

  /* stats */
  const wordsEl = pane.querySelector('[data-words]');
  const readEl = pane.querySelector('[data-read]');
  const editedEl = pane.querySelector('[data-edited]');
  function refreshStats() {
    const text = docById(doc.id)?.blocks.map(b => htmlToText(b.html)).join(' ') || '';
    const n = (text.match(/\S+/g) || []).length;
    wordsEl.textContent = n ? `${n} words` : '';
    readEl.textContent = n >= 10 ? `${Math.max(1, Math.round(n / 200))} min read` : '';
    editedEl.textContent = `edited ${agoStr(docById(doc.id)?.updatedAt)}`;
  }
  function agoStr(ts) {
    const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const savedEl = pane.querySelector('[data-saved]');
  let savedTimer;
  function flashSaved() {
    savedEl.innerHTML = '<span class="saved-flash">saved</span>';
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { savedEl.innerHTML = ''; }, 1600);
  }

  editor?.destroy();
  editor = mountEditor({
    mount: pane.querySelector('[data-body]'),
    blocks: doc.blocks,
    onChange: debounce((blocks) => {
      updateDoc(doc.id, { blocks });
      refreshStats();
      flashSaved();
    }, 250),
  });

  refreshStats();
}
