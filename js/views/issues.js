/* ---------------------------------------------------------------------------
   Tessera · views/issues — filterable, grouped issue lists ("My issues",
   "All issues"). Also exports the list renderer reused by cycle & project.
--------------------------------------------------------------------------- */

import { esc } from './../util.js';
import { ico, statusIcon, priIcon } from './../icons.js';
import {
  S, member as memberOf, label as labelOf, status as statusOf,
  issueRef, you, activeCycle,
} from './../store.js';
import { openMenu } from './../ui.js';
import { issueRowHTML, wireIssueRows, emptyState, labelChip, avatarHTML } from './../bits.js';
import { openIssue } from './../issue-drawer.js';
import { openNewIssue } from './../new-issue.js';
import { nav } from './../nav.js';

const cap = (w) => w[0].toUpperCase() + w.slice(1);

/* session-persisted view state */
const ui = {
  '#/all':   { f: { status: new Set(), priority: new Set(), assignee: new Set(), label: new Set() }, groupBy: 'status', q: '' },
  '#/my':    { f: { status: new Set(), priority: new Set(), assignee: new Set(), label: new Set() }, groupBy: 'status', q: '' },
};

export function renderIssues(view, route) {
  const mine = route === '#/my';
  const st = ui[route];
  const s = S();

  const order = ['urgent', 'high', 'medium', 'low', 'none'];
  const groupsOrder = {
    status: s.statuses.map(x => x.id),
    priority: order,
    assignee: [...s.members.map(m => m.id), 'none'],
  };

  function applyFilters(list) {
    return list.filter((i) => {
      if (mine && i.assignee !== you().id) return false;
      if (st.f.status.size && !st.f.status.has(i.status)) return false;
      if (st.f.priority.size && !st.f.priority.has(i.priority)) return false;
      if (st.f.assignee.size && !(i.assignee ? st.f.assignee.has(i.assignee) : st.f.assignee.has('none'))) return false;
      if (st.f.label.size && !i.labels.some(l => st.f.label.has(l))) return false;
      if (st.q && !(`${issueRef(i)} ${i.title}`.toLowerCase().includes(st.q.toLowerCase()))) return false;
      return true;
    });
  }

  view.innerHTML = `
    <div class="view-inner wide">
      <div class="view-head">
        <h1>${mine ? 'My issues' : 'All issues'}</h1>
        <button class="btn primary" data-new>${ico('plus', 14)} New issue</button>
      </div>
      <div class="toolbar">
        <div class="filters">
          <span data-f="status"></span>
          <span data-f="priority"></span>
          <span data-f="assignee"></span>
          <span data-f="label"></span>
        </div>
        <span style="flex:1"></span>
        ${!mine ? `
        <button class="fchip" data-groupby></button>` : ''}
        <label class="search-box">${ico('search', 13)}<input data-q placeholder="Filter…" value="${esc(st.q)}"/></label>
        ${mine ? '' : `
        <div class="seg" style="height:29px">
          <button class="on" data-gol_list>List</button>
          <button data-gob_board>Board</button>
        </div>`}
      </div>
      <div data-list></div>
    </div>`;

  /* ---- toolbar ---- */
  view.querySelector('[data-new]').onclick = () =>
    openNewIssue(mine ? { assignee: you().id } : {});

  const paintChips = () => {
    const chip = (key, label, count) => {
      const el = view.querySelector(`[data-f="${key}"]`);
      const n = count();
      el.innerHTML = `
        <button class="fchip ${n ? 'on' : ''}">
          ${ico('filter', 11)}${esc(label)}${n ? `· ${n}` : ''}
        </button>`;
      el.querySelector('button').onclick = (e) => openFilterMenu(key, e.currentTarget);
    };
    chip('status', 'Status', () => st.f.status.size);
    chip('priority', 'Priority', () => st.f.priority.size);
    chip('assignee', 'Assignee', () => st.f.assignee.size);
    chip('label', 'Label', () => st.f.label.size);

    const gb = view.querySelector('[data-groupby]');
    if (gb) {
      gb.innerHTML = `${ico('board', 12)} Group: ${esc(cap(st.groupBy))}`;
      gb.onclick = () => openMenu({
        anchor: gb,
        items: ['status', 'priority', 'assignee'].map(g => ({
          value: g, label: cap(g), checked: g === st.groupBy,
        })),
        onSelect: v => { st.groupBy = v; paintChips(); renderList(); },
      });
    }
  };

  function openFilterMenu(key, anchor) {
    let options;
    if (key === 'status') options = s.statuses.map(x => ({ v: x.id, l: x.name, ic: statusIcon(x.id, x.color, 13) }));
    else if (key === 'priority') options = ['urgent','high','medium','low','none'].map(p => ({ v: p, l: p === 'none' ? 'No priority' : cap(p), ic: priIcon(p, 13) }));
    else if (key === 'assignee') options = [...s.members.map(m => ({ v: m.id, l: m.name + (m.you ? ' (you)' : ''), av: m })), { v: 'none', l: 'Unassigned' }];
    else options = s.labels.map(l => ({ v: l.id, l: l.name, dot: l.color }));

    const sel = st.f[key];
    openMenu({
      anchor, minWidth: 190,
      items: options.map(o => ({
        value: o.v,
        label: o.l,
        icon: o.ic ?? (o.av ? avatarHTML(o.av) : o.dot ? `<i class="dot" style="width:9px;height:9px;border-radius:50%;background:${o.dot};display:inline-block"></i>` : null),
        checked: sel.has(o.v),
      })),
      onSelect: (v) => {
        sel.has(v) ? sel.delete(v) : sel.add(v);
        paintChips(); renderList();
      },
    });
  }

  const qEl = view.querySelector('[data-q]');
  qEl.addEventListener('input', () => { st.q = qEl.value; renderList(); });

  const boardBtn = view.querySelector('[data-gob_board]');
  boardBtn?.addEventListener('click', () => nav('#/board'));

  /* ---- list body (exported for cycle/project reuse) ---- */

  const listHost = view.querySelector('[data-list]');
  let selIdx = -1;

  function renderList() {
    const issues = applyFilters([...s.issues]).sort(byGroupThenOrder);
    selIdx = -1;

    if (!issues.length) {
      listHost.innerHTML = emptyState(
        'check',
        'Nothing here',
        mine
          ? 'No issues are assigned to you with these filters. Either you are very caught up, or very good at filters.'
          : 'No issues match these filters.',
      );
      return;
    }

    const groups = new Map();
    if (!mine || st.groupBy !== 'none') {
      for (const g of groupsOrder[st.groupBy]) groups.set(g, []);
      for (const iss of issues) {
        const g = st.groupBy === 'status' ? iss.status
          : st.groupBy === 'priority' ? iss.priority
          : (iss.assignee || 'none');
        (groups.get(g) || groups.set(g, []).get(g)).push(iss);
      }
    } else {
      groups.set('all', issues);
    }

    let html = '';
    for (const [g, list] of groups) {
      if (!list.length) continue;
      const head = st.groupBy === 'status'
        ? `${statusIcon(g, statusOf(g).color, 14)}<span class="gh-name">${esc(statusOf(g).name)}</span>`
        : st.groupBy === 'priority'
          ? `${priIcon(g, 14)}<span class="gh-name">${g === 'none' ? 'No priority' : esc(cap(g))}</span>`
          : g === 'none'
            ? `<span class="gh-name dim">Unassigned</span>`
            : `${avatarHTML(memberOf(g))}<span class="gh-name">${esc(memberOf(g)?.name)}</span>`;
      html += `
        <section class="group">
          <div class="group-head">
            ${head}
            <span class="count-pill">${list.length}</span>
            <span style="flex:1"></span>
          </div>
          ${list.map(i => issueRowHTML(i, { showStatus: st.groupBy !== 'status' })).join('')}
        </section>`;
    }
    listHost.innerHTML = html;
  }

  function byGroupThenOrder(a, b) {
    const ga = st.groupBy === 'status' ? a.status : st.groupBy === 'priority' ? a.priority : (a.assignee || 'none');
    const gb = st.groupBy === 'status' ? b.status : st.groupBy === 'priority' ? b.priority : (b.assignee || 'none');
    const ia = groupsOrder[st.groupBy].indexOf(ga);
    const ib = groupsOrder[st.groupBy].indexOf(gb);
    if (ia !== ib) return ia - ib;
    return a.order - b.order;
  }

  wireIssueRows(listHost, (id) => openIssue(id));

  /* keyboard: j/k to move, enter to open — only when not typing */
  view.tabIndex = -1;
  view.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      const rows = [...listHost.querySelectorAll('.irow')];
      if (!rows.length) return;
      selIdx = clampSel(selIdx + (e.key === 'j' ? 1 : -1), rows.length - 1);
      rows.forEach((r, i) => r.classList.toggle('sel', i === selIdx));
      rows[selIdx].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' && selIdx > -1) {
      const row = listHost.querySelectorAll('.irow')[selIdx];
      if (row) openIssue(row.dataset.issue);
    }
  });
  const clampSel = (n, hi) => Math.max(0, Math.min(hi, n));

  paintChips();
  renderList();
}
