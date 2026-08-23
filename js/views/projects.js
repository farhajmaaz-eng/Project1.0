/* ---------------------------------------------------------------------------
   Tessera · views/projects — portfolio grid + per-project board
--------------------------------------------------------------------------- */

import { esc } from './../util.js';
import { ico, statusIcon } from './../icons.js';
import {
  S, project as projectOf, member as memberOf, status as statusOf,
} from './../store.js';
import { issueRowHTML, wireIssueRows, emptyState, avatarHTML } from './../bits.js';
import { openIssue } from './../issue-drawer.js';
import { openNewIssue } from './../new-issue.js';
import { nav } from './../nav.js';

export function renderProjects(view) {
  const s = S();
  view.innerHTML = `
    <div class="view-inner wide">
      <div class="view-head"><h1>Projects</h1>
        <button class="btn primary" data-new>${ico('plus', 14)} New issue</button>
      </div>
      <div class="view-sub">A project is a promise with a lead and a pulse.</div>
      <div class="proj-grid">
        ${s.projects.map((p) => {
          const list = s.issues.filter(i => i.project === p.id && !['canceled'].includes(i.status));
          const closed = list.filter(i => i.status === 'done').length;
          const pct = list.length ? Math.round(closed / list.length * 100) : 0;
          const lead = memberOf(p.leadId);
          return `
            <button class="proj-card" data-project="${p.id}">
              <div class="pc-top">
                <span class="pc-emoji">${p.icon}</span>
                <h3>${esc(p.name)}</h3>
                <span class="count-pill">${pct}%</span>
              </div>
              <p>${esc(p.description)}</p>
              <div class="cycle-bar" style="margin-bottom:12px">
                ${s.statuses.filter(st => st.id !== 'canceled').map(st => {
                  const n = list.filter(i => i.status === st.id).length;
                  return n ? `<i style="width:${n / Math.max(1, list.length) * 100}%;background:${st.color}" title="${esc(st.name)}"></i>` : '';
                }).join('')}
              </div>
              <div class="pc-meta">
                ${avatarHTML(lead)}
                <span>${esc(lead?.name.split(' ')[0] || '—')} leads</span>
                <span style="flex:1"></span>
                <span>${closed}/${list.length} done</span>
              </div>
            </button>`;
        }).join('')}
      </div>
    </div>`;
  view.querySelector('[data-new]').onclick = () => openNewIssue({});
  view.querySelectorAll('[data-project]').forEach(b =>
    b.onclick = () => nav(`#/project/${b.dataset.project}`));
}

export function renderProject(view, id) {
  const s = S();
  const p = projectOf(id);
  if (!p) { nav('#/projects'); return; }
  const lead = memberOf(p.leadId);

  const list = s.issues.filter(i => i.project === p.id);
  const done = list.filter(i => i.status === 'done').length;
  const pct = list.length ? Math.round(done / list.length * 100) : 0;

  view.innerHTML = `
    <div class="view-inner wide">
      <nav class="crumbs">
        <button data-back>Projects</button> ${ico('chev', 11)}
        <span class="cur">${esc(p.name)}</span>
      </nav>
      <header class="entity-head card">
        <div class="entity-icon">${p.icon}</div>
        <div class="entity-main">
          <h1>${esc(p.name)}</h1>
          <p>${esc(p.description)}</p>
        </div>
        <div class="entity-side">
          <span style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-2)">
            ${avatarHTML(lead)} ${esc(lead?.name || '')}
          </span>
          <span class="progress-num"><b>${done}</b>/${list.length} done</span>
          <div class="cycle-bar" style="width:180px"><i style="width:${pct}%;background:var(--accent)"></i></div>
          <button class="btn ghost sm" data-new>${ico('plus', 12)} New issue</button>
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
        }).join('') || emptyState('zap', 'No issues yet', 'This project is a blank slate. Give it its first issue.')}
      </div>
    </div>`;

  view.querySelector('[data-back]').onclick = () => nav('#/projects');
  view.querySelector('[data-new]').onclick = () => openNewIssue({ project: p.id });
  wireIssueRows(view.querySelector('[data-list]'), (id2) => openIssue(id2));
}
