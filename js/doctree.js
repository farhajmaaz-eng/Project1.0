/* ---------------------------------------------------------------------------
   Tessera · doctree — nested page tree shared by the sidebar and docs view
--------------------------------------------------------------------------- */

import { esc } from './util.js';
import { ico } from './icons.js';
import { S, childrenDocs, hasKids, docById } from './store.js';
import { toast, openMenu } from './ui.js';
import { deleteDocTree, restoreDocs, updateDoc, createDoc } from './store.js';
import { uid } from './util.js';

/* session expand/collapse state */
const expanded = new Set(['d2', 'd5']);

export const isExpanded = (id) => expanded.has(id);
export const toggleExpand = (id) => {
  expanded.has(id) ? expanded.delete(id) : expanded.add(id);
  return expanded.has(id);
};

/**
 * Renders tree rows into `host`. Rows are buttons with data-doc-id,
 * data-twist (expand caret), data-more (context menu), data-addchild.
 */
export function renderTree(host, { activeId, compact = false } = {}) {
  const rows = [];
  const walk = (pid, depth) => {
    for (const d of childrenDocs(pid)) {
      const kids = hasKids(d.id);
      const open = expanded.has(d.id);
      rows.push(`
        <div style="display:flex;align-items:center">
          <button class="sb-item ${d.id === activeId ? 'on' : ''} ${compact ? '' : ''}"
                  data-doc-id="${d.id}" data-depth="${depth}" title="${esc(d.title || 'Untitled')}">
            <span class="sb-twist ${kids ? (open ? 'open' : '') : 'leaf'}" data-twist="${d.id}">
              ${ico('chev', 11)}
            </span>
            <span class="sb-doc-icon">${d.icon}</span>
            <span class="si-label">${esc(d.title || 'Untitled')}</span>
          </button>
          <button class="icon-btn" style="width:22px;height:22px;margin-left:-24px;position:relative;z-index:2;
                  opacity:0" data-more="${d.id}" title="Page options">${ico('dots', 13)}</button>
        </div>`);
      if (kids && open) walk(d.id, depth + 1);
    }
  };
  walk(null, 0);
  host.innerHTML = rows.join('') ||
    `<p class="faint small" style="padding:4px 8px">No pages yet.</p>`;

  host.querySelectorAll('[data-more]').forEach((b) => {
    let hideTimer;
    const row = b.closest('div');
    row.addEventListener('pointerenter', () => { clearTimeout(hideTimer); b.style.opacity = ''; });
    row.addEventListener('pointerleave', () => { hideTimer = setTimeout(() => (b.style.opacity = '0'), 40); });
    b.onclick = (e) => {
      e.stopPropagation();
      pageMenu(e.currentTarget, b.dataset.more, () => renderTree(host, { activeId, compact }));
    };
  });

  host.querySelectorAll('[data-twist]').forEach((tw) => {
    tw.addEventListener('pointerdown', (e) => e.stopPropagation());
    tw.onclick = (e) => {
      e.stopPropagation();
      toggleExpand(tw.dataset.twist);
      renderTree(host, { activeId, compact });
    };
  });
}

/** context menu for a single doc row */
export function pageMenu(anchor, docId, rerender) {
  openMenu({
    anchor, minWidth: 190,
    items: [
      { value: 'add', label: 'Add sub-page', icon: ico('plus', 14) },
      { value: 'fav', label: docById(docId)?.favorite ? 'Remove from favorites' : 'Favorite', icon: ico('star', 14) },
      { value: 'dup', label: 'Duplicate', icon: ico('copy', 14) },
      { value: 'exportmd', label: 'Export as Markdown', icon: ico('down', 14) },
      { value: 'print', label: 'Print / PDF', icon: ico('doc', 14) },
      { sep: true },
      { value: 'del', label: 'Move to trash', icon: ico('trash', 14), danger: true },
    ],
    onSelect: (v) => {
      if (v === 'add') {
        import('./views/docs.js').then(m => m.createAndOpenPage(docId));
        expanded.add(docId);
        rerender?.();
        return;
      }
      if (v === 'print') { window.print(); return; }
      if (v === 'fav') {
        const d = docById(docId);
        updateDoc(docId, { favorite: !d.favorite });
        rerender?.();
      }
      if (v === 'dup') {
        const src = docById(docId);
        createDoc({
          parentId: src.parentId,
          icon: src.icon,
          title: `${src.title || 'Untitled'} (copy)`,
          blocks: src.blocks.map(b => ({ ...b, id: uid('b') })),
          favorite: false,
        });
        toast('Page duplicated');
        rerender?.();
      }
      if (v === 'exportmd') {
        const d = docById(docId);
        import('./md.js').then(({ blocksToMarkdown }) => {
          import('./util.js').then(({ downloadFile }) => {
            const md = blocksToMarkdown(d.blocks, d.title || 'Untitled');
            const safe = (d.title || 'page').replace(/[^\w\d-]+/g, '-').slice(0, 40) || 'page';
            downloadFile(`${safe}.md`, md, 'text/markdown');
            toast('Markdown downloaded');
          });
        });
      }
      if (v === 'del') {
        const snaps = deleteDocTree(docId);
        const count = snaps.length;
        toast(count > 1 ? `${count} pages moved to trash` : 'Page moved to trash', {
          action: { label: 'Undo', fn: () => { restoreDocs(snaps); } },
        });
        import('./nav.js').then(({ nav }) => nav('#/docs'));
        rerender?.();
      }
    },
  });
}
