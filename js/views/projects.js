/* ---------------------------------------------------------------------------
   Tessera · views/projects v2 — portfolio grid with create/manage
--------------------------------------------------------------------------- */

import { esc } from './../util.js';
import { ico, statusIcon } from './../icons.js';
import {
  S, project as projectOf, member as memberOf,
  updateProject, deleteProject,
} from './../store.js';
import { issueRowHTML, wireIssueRows, emptyState, avatarHTML } from './../bits.js';
import { openIssue } from './../issue-drawer.js';
import { openNewProject } from './../new-project.js';
import { openMenu, openModal, confirmDlg, toast } from './../ui.js';
import { nav } from './../nav.js';

export function renderProjects(view) {
  const s = S();
  view.innerHTML = `
    <div class="view-inner wide">
      <div class="view-head"><h1>Projects</h1>
        <button class="btn primary" data-new>${ico('plus', 14)} New project</button>
      </div>
      <div class="view-sub">A project is a promise with a lead and a pulse.</div>
      <div class="proj-grid">
        ${s.projects.map((p) => {
          const list = s.issues.filter(i => i.project === p.id && i.status !== 'canceled');
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
              <p>${esc(p.description || 'No description yet.')}</p>
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
        <button class="pc-add" data-new2>
          ${ico('plus', 18)}<span>New project</span>
        </button>
      </div>
    </div>`;

  const openNew = () => openNewProject((p) => nav(`#/project/${p.id}`));
  view.querySelector('[data-new]').onclick = openNew;
  view.querySelector('[data-new2]').onclick = openNew;
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
        <button class="icon-btn entity-more" data-more aria-label="Project options">${ico('dots', 15)}</button>
        <div class="entity-icon">${p.icon}</div>
        <div class="entity-main">
          <h1>${esc(p.name)}</h1>
          <p>${esc(p.description || '')}</p>
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
        }).join('') || emptyState('zap', 'No issues yet',
          'This project is a blank slate. Give it its first issue.',
          '<button class="btn primary sm" id="mk">Create the first one</button>')}
      </div>
    </div>`;

  view.querySelector('[data-back]').onclick = () => nav('#/projects');
  view.querySelector('[data-new]').onclick = () =>
    import('./../new-issue.js').then(m => m.openNewIssue({ project: p.id }));
  document.getElementById('mk')?.addEventListener('click', () =>
    import('./../new-issue.js').then(m => m.openNewIssue({ project: p.id })));
  wireIssueRows(view.querySelector('[data-list]'), (id2) => openIssue(id2));

  view.querySelector('[data-more]').onclick = (e) => {
    openMenu({
      anchor: e.currentTarget,
      items: [
        { value: 'edit', label: 'Edit project', icon: ico('pen', 14) },
        { value: 'del', label: 'Delete project', icon: ico('trash', 14), danger: true },
      ],
      onSelect: async (v) => {
        if (v === 'edit') editModal(p);
        if (v === 'del') {
          const ok = await confirmDlg({
            title: `Delete “${p.name}”?`,
            body: 'Its issues are kept — they just leave the project.',
            confirmLabel: 'Delete project',
            danger: true,
          });
          if (ok) { deleteProject(p.id); toast('Project deleted'); nav('#/projects'); }
        }
      },
    });
  };

  function editModal(pp) {
    openModal((modal, close) => {
      modal.innerHTML = `
        <div class="modal-head" style="padding-bottom:10px">
          ${ico('pen', 15)}<span class="caps">Edit project</span>
        </div>
        <div style="padding:8px 18px;display:flex;flex-direction:column;gap:10px">
          <input class="input" data-name value="${esc(pp.name)}" style="font-weight:600;height:38px;border-radius:10px"/>
          <textarea class="input" data-desc rows="2">${esc(pp.description || '')}</textarea>
          <label class="small faint">Lead
            <select class="input" data-lead style="margin-top:4px;height:34px">
              ${S().members.map(m => `<option value="${m.id}" ${m.id === pp.leadId ? 'selected' : ''}>${esc(m.name)}${m.you ? ' (you)' : ''}</option>`).join('')}
            </select>
          </label>
        </div>
        <div style="display:flex;justify-content:flex-end;padding:6px 18px 16px">
          <button class="btn primary" data-save>Save</button>
        </div>`;
      modal.querySelector('[data-save]').onclick = () => {
        updateProject(pp.id, {
          name: modal.querySelector('[data-name]').value.trim() || pp.name,
          description: modal.querySelector('[data-desc]').value.trim(),
          leadId: modal.querySelector('[data-lead]').value,
        });
        close();
      };
    }, { width: 540 });
  }
}
