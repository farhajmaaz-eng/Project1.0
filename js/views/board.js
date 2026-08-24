/* ---------------------------------------------------------------------------
   Tessera · views/board v4 — kanban with honest drag & drop, FLIP reorders,
   cascading columns and a confetti cannon for anything landing in Done.
--------------------------------------------------------------------------- */

import { esc } from './../util.js';
import { ico, statusIcon, priIcon } from './../icons.js';
import { S, status as statusOf, issueRef, updateIssue } from './../store.js';
import { avatarHTML, dueBadge } from './../bits.js';
import { openIssue } from './../issue-drawer.js';
import { openNewIssue } from './../new-issue.js';
import { confetti, flip, reduceMotion } from './../motion.js';

export function renderBoard(view) {
  const s = S();
  const visible = s.issues.filter(i => i.status !== 'canceled');

  view.innerHTML = `
    <div class="view-inner wide">
      <div class="view-head">
        <h1>Board</h1>
        <button class="btn primary" data-new>${ico('plus', 14)} New issue</button>
      </div>
      <div class="view-sub">Drag cards between columns. Everything saves instantly.</div>
      <div class="board-wrap"><div class="board" data-board></div></div>
    </div>`;

  const boardEl = view.querySelector('[data-board]');
  view.querySelector('[data-new]').onclick = () => openNewIssue();

  let dragId = null;

  /* ---- paint the columns (initial + every refresh) ---- */
  function paint() {
    const st = S();
    boardEl.innerHTML = '';
    let colIdx = 0;
    for (const cst of st.statuses) {
      if (cst.id === 'canceled') continue;
      const colIssues = st.issues
        .filter(i => i.status === cst.id)
        .sort((a, b) => a.order - b.order);

      const col = document.createElement('section');
      col.className = 'bcol';
      col.dataset.status = cst.id;
      col.style.setProperty('--i', colIdx++);
      col.innerHTML = `
        <header class="bcol-head">
          ${statusIcon(cst.id, cst.color, 14)}
          <span>${esc(cst.name)}</span>
          <span class="count" data-count>${colIssues.length}</span>
          <span style="flex:1"></span>
          <button class="icon-btn" title="Add issue" data-add>${ico('plus', 13)}</button>
        </header>
        <div class="bcards" data-cards>
          ${colIssues.map(cardHTML).join('')}
        </div>`;

      wireColumn(col);
      boardEl.appendChild(col);
    }
  }

  function wireColumn(col) {
    col.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) { openNewIssue({ status: col.dataset.status }); return; }
      const card = e.target.closest('[data-card]');
      if (card) openIssue(card.dataset.card);
    });

    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
      markDropLine(col, e.clientY);
    });
    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) { col.classList.remove('drag-over'); clearLine(col); }
    });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const lineY = takeDropIndex(col, e.clientY);
      clearLine(col);
      if (!dragId) return;
      const point = { x: e.clientX, y: e.clientY };
      const ids = [...col.querySelectorAll('[data-card]')].map(el => el.dataset.card)
        .filter(id => id !== dragId);
      const beforeId = lineY === null ? null : ids[lineY] ?? null;
      reorder(dragId, col.dataset.status, beforeId, point);
      dragId = null;
    });
  }

  boardEl.addEventListener('dragstart', (e) => {
    const card = e.target.closest('[data-card]');
    if (!card) return;
    dragId = card.dataset.card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch {}
  });
  boardEl.addEventListener('dragend', () => {
    boardEl.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    boardEl.querySelectorAll('.drop-line').forEach(el => el.remove());
  });

  function cardHTML(iss) {
    return `
      <article class="bcard" draggable="true" data-card="${iss.id}">
        <div style="display:flex;align-items:center;gap:8px">
          ${priIcon(iss.priority, 12)}
          <span class="key-chip">${issueRef(iss)}</span>
          ${iss.due ? dueBadge(iss.due) : ''}
        </div>
        <div class="bc-title">${esc(iss.title || 'Untitled')}</div>
        <footer class="bcard-foot">
          <span class="bc-labels">${iss.labels.slice(0, 4).map(l => {
            const lab = S().labels.find(x => x.id === l);
            return lab ? `<i style="background:${lab.color}" title="${esc(lab.name)}"></i>` : '';
          }).join('')}</span>
          <span class="spacer"></span>
          ${avatarHTML(S().members.find(m => m.id === iss.assignee))}
        </footer>
      </article>`;
  }

  /* drop-line bookkeeping: index of insertion point */
  let lineIdx = null;
  function markDropLine(col, y) {
    const cards = [...col.querySelectorAll('.bcards [data-card]')];
    let idx = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { idx = i; break; }
    }
    lineIdx = idx;
    let line = col.querySelector('.drop-line');
    if (!line) {
      line = document.createElement('div');
      line.className = 'drop-line';
      col.querySelector('.bcards').insertAdjacentElement('afterbegin', line);
    }
    if (idx >= cards.length) cards[cards.length - 1]?.insertAdjacentElement('afterend', line);
    else cards[idx].insertAdjacentElement('beforebegin', line);
  }
  function takeDropIndex(col, _y) { return lineIdx; }
  function clearLine(col) {
    col.querySelector('.drop-line')?.remove();
    lineIdx = null;
  }

  /* ---- reorder + immediate FLIP repaint + celebration ---- */
  function reorder(issueId, newStatus, beforeId, point) {
    const iss = S().issues.find(i => i.id === issueId);
    if (!iss) return;
    const changedStatus = iss.status !== newStatus;

    flip(boardEl, '[data-card]', () => {
      // compute new order float against live state
      let order;
      if (beforeId == null) {
        const maxOrder = Math.max(-1, ...S().issues.filter(i => i.status === newStatus && i.id !== issueId).map(i => i.order));
        order = maxOrder + 10;
      } else {
        const target = S().issues.find(i => i.id === beforeId);
        if (!target) return;
        const prev = S().issues.filter(i => i.status === newStatus && i.id !== issueId)
          .sort((a, b) => a.order - b.order);
        const ti = prev.findIndex(i => i.id === beforeId);
        const lo = ti > 0 ? prev[ti - 1].order : target.order - 20;
        order = (lo + target.order) / 2;
      }
      updateIssue(issueId, { order, ...(changedStatus ? { status: newStatus } : {}) },
        changedStatus ? `changed status to ${statusOf(newStatus).name}` : undefined);
      paint(); // repaint inside flip()'s measurement window
    });

    // settle the freshly-moved card
    requestAnimationFrame(() => {
      const moved = boardEl.querySelector(`[data-card="${issueId}"]`);
      moved?.classList.add('just-dropped');
      moved?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });

    // landed in Done → fireworks
    if (changedStatus && newStatus === 'done' && point && !reduceMotion()) {
      confetti(point.x, {
        y: Math.min(point.y, innerHeight - 60),
        count: 110,
        power: 10,
        colors: ['#6FA06B', '#B85C43', '#D3864F', '#D9A648', '#D8D0C2'],
      });
    }
  }

  paint();
}
