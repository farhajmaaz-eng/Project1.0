/* ---------------------------------------------------------------------------
   Tessera · views/cycles — cycle overview + its issues
--------------------------------------------------------------------------- */

import { esc, todayISO, fmtFull, relDay, dayDiff } from './../util.js';
import { ico, statusIcon } from './../icons.js';
import { S, cycle as cycleOf, status as statusOf } from './../store.js';
import { issueRowHTML, wireIssueRows, emptyState } from './../bits.js';
import { openIssue } from './../issue-drawer.js';
import { openNewIssue } from './../new-issue.js';
import { nav } from './../nav.js';

export function renderCycles(view) {
  const s = S();
  const now = todayISO();

  view.innerHTML = `
    <div class="view-inner wide">
      <div class="view-head"><h1>Cycles</h1></div>
      <div class="view-sub">Two-week rhythms. What doesn't fit waits — that's the point.</div>
      <div class="proj-grid">
        ${s.cycles.map((c) => {
          const list = s.issues.filter(i => i.cycle === c.id);
          const closed = list.filter(i => ['done', 'canceled'].includes(i.status)).length;
          const pct = list.length ? Math.round(closed / list.length * 100) : 0;
          const state = c.startsAt <= now && c.endsAt >= now ? 'active'
            : c.startsAt > now ? 'upcoming' : 'past';
          return `
            <button class="proj-card" data-cycle="${c.id}">
              <div class="pc-top">
                ${ico('target', 16)}
                <h3>${esc(c.name)}</h3>
                <span class="state-chip ${state}">${state === 'active' ? '<i class="pulse"></i>' : ''}${state}</span>
              </div>
              <p>${esc(c.goal)}</p>
              <div class="cycle-bar" style="margin-bottom:9px"><i style="width:${pct}%;background:var(--accent)"></i></div>
              <div class="pc-meta">
                <span class="mono">${esc(relDay(c.startsAt))} – ${esc(relDay(c.endsAt))}</span>
                <span style="flex:1"></span>
                <span>${closed}/${list.length} closed</span>
              </div>
            </button>`;
        }).join('')}
        ${s.cycles.length === 0 ? emptyState('target', 'No cycles yet', 'Create your first two-week rhythm from the issue drawer.') : ''}
      </div>
    </div>`;

  view.querySelectorAll('[data-cycle]').forEach(b =>
    b.onclick = () => nav(`#/cycle/${b.dataset.cycle}`));
}

export function renderCycle(view, id) {
  const s = S();
  const c = cycleOf(id);
  if (!c) { nav('#/cycles'); return; }

  const list = s.issues.filter(i => i.cycle === c.id);
  const closed = list.filter(i => ['done', 'canceled'].includes(i.status));
  const pct = list.length ? Math.round(closed.length / list.length * 100) : 0;
  const state = c.startsAt <= todayISO() && c.endsAt >= todayISO() ? 'active' : c.startsAt > todayISO() ? 'upcoming' : 'past';

  const byStatus = s.statuses.map(st => ({ st, n: list.filter(i => i.status === st.id).length }))
    .filter(x => x.n);

  view.innerHTML = `
    <div class="view-inner wide">
      <nav class="crumbs">
        <button data-back>Cycles</button> ${ico('chev', 11)}
        <span class="cur">${esc(c.name)}</span>
      </nav>
      <header class="entity-head card">
        <div class="entity-icon">${ico('target', 20)}</div>
        <div class="entity-main">
          <h1>${esc(c.name)} <span class="count-pill" style="vertical-align:3px">${list.length}</span></h1>
          <p class="mono faint">${esc(fmtFull(c.startsAt))} → ${esc(fmtFull(c.endsAt))}</p>
          <p style="margin-top:8px">${esc(c.goal)}</p>
        </div>
        <div class="entity-side">
          <span class="state-chip ${state}">${state === 'active' ? '<i class="pulse"></i>' : ''}${state}</span>
          <span class="progress-num"><b>${closed.length}</b>/${list.length} closed</span>
          <div class="cycle-bar" style="width:180px">
            ${byStatus.map(({ st, n }) => `<i style="width:${n / Math.max(1, list.length) * 100}%;background:${st.color}" title="${esc(st.name)}"></i>`).join('')}
          </div>
        </div>
      </header>

      <div data-list>
        ${s.statuses.map((st) => {
          const sub = list.filter(i => i.status === st.id).sort((a, b) => a.order - b.order);
          if (!sub.length) return '';
          return `
            <section class="group">
              <div class="group-head">
                ${statusIcon(st.id, st.color, 14)}
                <span class="gh-name">${esc(st.name)}</span>
                <span class="count-pill">${sub.length}</span>
              </div>
              ${sub.map(i => issueRowHTML(i)).join('')}
            </section>`;
        }).join('') || emptyState('target', 'Empty cycle', 'Nothing scheduled here yet. Add issues from the drawer or create one directly.')}
      </div>
    </div>`;

  view.querySelector('[data-back]').onclick = () => nav('#/cycles');
  wireIssueRows(view.querySelector('[data-list]'), (id) => openIssue(id));
}
