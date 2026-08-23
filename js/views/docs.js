/* ---------------------------------------------------------------------------
   Tessera · views/docs — the writing side. Tree pane + block editor page.
--------------------------------------------------------------------------- */

import { esc, uid, htmlToText, debounce } from './../util.js';
import { ico } from './../icons.js';
import {
  S, docById, docPath, updateDoc, createDoc,
} from './../store.js';
import { toast, openMenu } from './../ui.js';
import { renderTree, isExpanded, toggleExpand } from './../doctree.js';
import { mountEditor } from './../editor.js';
import { nav } from './../nav.js';
import { emptyState } from './../bits.js';

const EMOJI = ['📄','🌱','🗺️','📝','🧭','🎨','✅','🎯','💡','🔥','📌','🧪','🚀','🛠️','📚','🗓️','🔁','⭐','🧩','🔭','💬','⚖️','🏗️','🧵','🪄','🍀'];

let editor = null;
let currentId = null;

export function createAndOpenPage(parentId = null) {
  const d = createDoc({ parentId });
  if (parentId) isExpanded(parentId) || toggleExpand(parentId);
  nav(`#/doc/${d.id}`);
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
      </aside>
      <div class="doc-pane" data-pane></div>
    </div>`;

  view.querySelector('[data-newpage]').onclick = () => createAndOpenPage(null);
  const treeHost = view.querySelector('[data-tree]');
  const paintTree = () => {
    const active = currentId || (s.docs[0] && s.docs[0].id) || null;
    renderTree(treeHost, { activeId: active, compact: true });
    treeHost.querySelectorAll('[data-doc-id]').forEach((row) => {
      row.onclick = (e) => {
        if (e.target.closest('[data-twist], [data-more]')) return;
        nav(`#/doc/${row.dataset.docId}`);
      };
    });
  };
  paintTree();

  const pane = view.querySelector('[data-pane]');
  if (!doc) {
    const first = s.docs.find(d => d.favorite) || s.docs[0];
    if (first) { nav(`#/doc/${first.id}`); return; }
    pane.innerHTML = `
      <div class="doc-landing">
        ${emptyState('doc', 'A quiet place to think',
          'Pages hold the reasoning behind the work — specs, notes, plans. Start one.',
          '<button class="btn primary" data-first>New page</button>')}
      </div>`;
    pane.querySelector('[data-first]').onclick = () => createAndOpenPage(null);
    return;
  }

  currentId = doc.id;

  /* ---------- page ---------- */
  pane.innerHTML = `
    <article class="doc-page">
      <nav class="crumbs doc-crumb" data-crumbs></nav>
      <div class="doc-title-row">
        <button class="doc-bigicon" title="Change icon" data-icon>${doc.icon}</button>
        <input class="doc-title" data-title placeholder="Untitled" value="" />
      </div>
      <div class="doc-meta">
        <button class="icon-btn" style="width:22px;height:22px;${doc.favorite ? 'color:var(--accent)' : ''}"
                title="${doc.favorite ? 'Unfavorite' : 'Favorite'}" data-fav>${ico('star', 13)}</button>
        <span class="mono" data-words></span>
        <span class="sep-dot"></span>
        <span class="mono" data-edited></span>
        <span style="flex:1"></span>
        <button class="icon-btn" style="width:24px;height:24px" title="Page options" data-pagemore>${ico('dots', 14)}</button>
      </div>
      <div class="doc-body" data-body></div>
      <div class="doc-foot"><span>/ for blocks · drag nothing, it's all keyboard here</span><span data-saved></span></div>
    </article>`;

  const titleEl = pane.querySelector('[data-title]');
  titleEl.value = doc.title;
  titleEl.addEventListener('input', debounce(() => {
    updateDoc(doc.id, { title: titleEl.value });
    paintTree();
    flashSaved();
  }, 350));
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.focus();
    }
  });

  // breadcrumbs
  const path = docPath(doc.id);
  pane.querySelector('[data-crumbs]').innerHTML = `
    <button data-root>Docs</button>
    ${path.slice(0, -1).map(d => `<span>${ico('chev', 11)}</span><button data-goto="${d.id}">${esc(d.title || 'Untitled')}</button>`).join('')}
    <span>${ico('chev', 11)}</span><span class="cur">${esc(doc.title || 'Untitled')}</span>`;
  pane.querySelector('[data-crumbs] [data-root]').onclick = () => nav('#/docs');
  pane.querySelectorAll('[data-goto]').forEach(b =>
    b.onclick = () => nav(`#/doc/${b.dataset.goto}`));

  // favorite
  pane.querySelector('[data-fav]').onclick = (e) => {
    updateDoc(doc.id, { favorite: !doc.favorite });
    e.currentTarget.style.color = doc.favorite ? '' : 'var(--accent)';
    toast(doc.favorite ? 'Removed from favorites' : 'Added to favorites');
  };

  // more menu
  import('./../doctree.js').then(({ pageMenu }) => {
    pane.querySelector('[data-pagemore]').onclick = (e) =>
      pageMenu(e.currentTarget, doc.id, () => { paintTree(); });
  });

  // icon picker
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

  // stats
  const wordsEl = pane.querySelector('[data-words]');
  const editedEl = pane.querySelector('[data-edited]');
  function refreshStats() {
    const text = docById(doc.id)?.blocks.map(b => htmlToText(b.html)).join(' ') || '';
    const n = (text.match(/\S+/g) || []).length;
    wordsEl.textContent = n ? `${n} words` : '';
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

  // blocks editor
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
