/* ---------------------------------------------------------------------------
   Tessera · views/cycles v2 — overview grid + cycle detail with management
--------------------------------------------------------------------------- */

import { esc, todayISO, fmtFull, relDay } from './../util.js';
import { ico, statusIcon } from './../icons.js';
import { S, cycle as cycleOf, status as statusOf, updateCycle, deleteCycle } from './../store.js';
import { issueRowHTML, wireIssueRows, emptyState } from './../bits.js';
import { openIssue } from './../issue-drawer.js';
import { openNewCycle } from './../new-project.js';
import { openMenu, confirmDlg, toast } from './../ui.js';
import { nav } from './../nav.js';

export function renderCycles(view) {
  const s = S();
  const now = todayISO();

  view.innerHTML = `
    <div class="view-inner wide">
      <div class="view-head"><h1>Cycles</h1>
        <button class="btn primary" data-new>${ico('plus', 14)} New cycle</button>
      </div>
      <div class="view-sub">Two-week rhythms. What doesn't fit waits — that's the point.</div>
      <div class="proj-grid">
        ${s.cycles.map((c) => {
          const list = s.issues.filter(i => i.cycle === c.id);
          const closed = list.filter(i => ['done', 'canceled'].includes(i.status)).length;
          const totalPts = list.filter(i => i.estimate).reduce((a, i) => a + i.estimate, 0);
          const donePts = list.filter(i => ['done', 'canceled'].includes(i.status) && i.estimate).reduce((a, i) => a + i.estimate, 0);
          const pct = list.length ? Math.round(closed / list.length * 100) : 0;
          const state = c.startsAt <= now && c.endsAt >= now ? 'active' : c.startsAt > now ? 'upcoming' : 'past';
          return `
            <button class="proj-card" data-cycle="${c.id}">
              <div class="pc-top">
                ${ico('target', 16)}
                <h3>${esc(c.name)}</h3>
                <span class="state-chip ${state}">${state === 'active' ? '<i class="pulse"></i>' : ''}${state}</span>
              </div>
              <p>${esc(c.goal || 'No goal set — a cycle without a finish line is just two weeks.')}</p>
              <div class="cycle-bar" style="margin-bottom:9px"><i style="width:${pct}%;background:var(--accent)"></i></div>
              <div class="pc-meta">
                <span class="mono">${esc(relDay(c.startsAt))} – ${esc(relDay(c.endsAt))}</span>
                <span style="flex:1"></span>
                <span>${closed}/${list.length} closed</span>
                ${totalPts ? `<span class="mono" title="Completed points / total points">${donePts}/${totalPts} pts</span>` : ''}
              </div>
            </button>`;
        }).join('')}
        <button class="pc-add" data-new2>
          ${ico('plus', 18)}<span>New cycle</span>
        </button>
      </div>
    </div>`;

  view.querySelectorAll('[data-cycle]').forEach(b =>
    b.onclick = () => nav(`#/cycle/${b.dataset.cycle}`));
  const openNew = () => openNewCycle((c) => nav(`#/cycle/${c.id}`));
  view.querySelector('[data-new]').onclick = openNew;
  view.querySelector('[data-new2]').onclick = openNew;
}

export function renderCycle(view, id) {
  const s = S();
  const c = cycleOf(id);
  if (!c) { nav('#/cycles'); return; }

  const list = s.issues.filter(i => i.cycle === c.id);
  const closed = list.filter(i => ['done', 'canceled'].includes(i.status));
  const pct = list.length ? Math.round(closed.length / list.length * 100) : 0;
  const state = c.startsAt <= todayISO() && c.endsAt >= todayISO() ? 'active' : c.startsAt > todayISO() ? 'upcoming' : 'past';

  const byStatus = s.statuses.map(st => ({ st, n: list.filter(i => i.status === st.id).length })).filter(x => x.n);
  const totalPts = list.filter(i => i.estimate).reduce((a, i) => a + i.estimate, 0);
  const donePts = list.filter(i => ['done', 'canceled'].includes(i.status) && i.estimate).reduce((a, i) => a + i.estimate, 0);

  view.innerHTML = `
    <div class="view-inner wide">
      <nav class="crumbs">
        <button data-back>Cycles</button> ${ico('chev', 11)}
        <span class="cur">${esc(c.name)}</span>
      </nav>
      <header class="entity-head card">
        <button class="icon-btn entity-more" data-more aria-label="Cycle options">${ico('dots', 15)}</button>
        <div class="entity-icon">${ico('target', 20)}</div>
        <div class="entity-main">
          <h1>${esc(c.name)} <span class="count-pill" style="vertical-align:3px">${list.length}</span></h1>
          <p class="mono faint">${esc(fmtFull(c.startsAt))} → ${esc(fmtFull(c.endsAt))}</p>
          ${c.goal ? `<p style="margin-top:8px">${esc(c.goal)}</p>` : ''}
        </div>
        <div class="entity-side">
          <span class="state-chip ${state}">${state === 'active' ? '<i class="pulse"></i>' : ''}${state}</span>
          <span class="progress-num"><b>${closed.length}</b>/${list.length} closed</span>
          ${totalPts ? `<span class="progress-num mono" title="Completed points / total points">${donePts}/${totalPts} pts</span>` : ''}
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
        }).join('') || emptyState('target', 'Empty cycle',
          'Nothing scheduled here yet. Open an issue and assign it to this cycle.',
          `<button class="btn primary sm" onclick="void 0" id="mk">Create an issue</button>`)}
      </div>
    </div>`;

  view.querySelector('[data-back]').onclick = () => nav('#/cycles');

  view.querySelector('[data-more]').onclick = (e) => {
    openMenu({
      anchor: e.currentTarget,
      items: [
        { value: 'edit', label: 'Edit cycle', icon: ico('pen', 14) },
        { value: 'del', label: 'Delete cycle', icon: ico('trash', 14), danger: true },
      ],
      onSelect: async (v) => {
        if (v === 'edit') {
          import('./../new-project.js').then(({ openNewCycle }) => {
            openModalEdit(c);
          });
        }
        if (v === 'del') {
          const ok = await confirmDlg({
            title: `Delete ${c.name}?`,
            body: 'Issues in this cycle stay; they just go back to the backlog.',
            confirmLabel: 'Delete cycle',
            danger: true,
          });
          if (ok) { deleteCycle(c.id); toast('Cycle deleted'); nav('#/cycles'); }
        }
      },
    });
  };

  function openModalEdit(cc) {
    import('./../ui.js').then(({ openModal: om }) => {
      om((modal, close) => {
        modal.innerHTML = `
          <div class="modal-head" style="padding-bottom:10px">
            ${ico('target', 15)}<span class="caps">Edit cycle</span>
          </div>
          <div style="padding:8px 18px;display:flex;flex-direction:column;gap:10px">
            <input class="input" data-name value="${esc(cc.name)}" style="font-weight:600;height:38px;border-radius:10px"/>
            <div style="display:flex;gap:10px">
              <label style="flex:1"><span class="small faint">Starts</span><input type="date" class="input" data-start value="${cc.startsAt}"/></label>
              <label style="flex:1"><span class="small faint">Ends</span><input type="date" class="input" data-end value="${cc.endsAt}"/></label>
            </div>
            <textarea class="input" data-goal rows="2" placeholder="Goal">${esc(cc.goal || '')}</textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;padding:0 18px 16px">
            <button class="btn primary" data-save>Save</button>
          </div>`;
        modal.querySelector('[data-save]').onclick = () => {
          updateCycle(cc.id, {
            name: modal.querySelector('[data-name]').value.trim() || cc.name,
            startsAt: modal.querySelector('[data-start]').value,
            endsAt: modal.querySelector('[data-end]').value,
            goal: modal.querySelector('[data-goal]').value.trim(),
          });
          close();
        };
      }, { width: 520 });
    });
  }

  document.getElementById('mk')?.addEventListener('click', () =>
    import('./../new-issue.js').then(m => m.openNewIssue({ cycle: c.id })));

  wireIssueRows(view.querySelector('[data-list]'), (id2) => openIssue(id2));
}
