/* ---------------------------------------------------------------------------
   Tessera · bits — small HTML factories shared by every view
--------------------------------------------------------------------------- */

import { esc, initials, dueBadgeInfo } from './util.js';
import { ico, statusIcon, priIcon } from './icons.js';
import { member, label as labelOf, status as statusOf, issueRef } from './store.js';

export function avatarHTML(m, lg = false) {
  if (!m) return `<span class="avatar ${lg ? 'lg' : ''}" style="background:var(--raise);color:var(--text-3);border:1px dashed var(--line-2)">?</span>`;
  return `<span class="avatar ${lg ? 'lg' : ''}" style="background:${m.color}" title="${esc(m.name)}">${esc(initials(m.name))}</span>`;
}

export function labelChip(lid) {
  const l = labelOf(lid);
  if (!l) return '';
  return `<span class="chip"><i class="dot" style="background:${l.color}"></i>${esc(l.name)}</span>`;
}

export function statusPill(statusId) {
  const s = statusOf(statusId);
  return `<span class="chip" title="${esc(s.name)}">${statusIcon(s.id, s.color, 12)}${esc(s.name)}</span>`;
}

export function priGlyph(pri) {
  return `<span class="ir-pri" title="${esc(pri)}">${priIcon(pri)}</span>`;
}

export function dueBadge(iso) {
  if (!iso) return '';
  const info = dueBadgeInfo(iso);
  return `<span class="badge-due ${info.cls}">${ico('calendar', 10)} ${esc(info.label)}</span>`;
}

export function assigneeAvatar(id, lg = false) {
  return avatarHTML(member(id), lg);
}

/** standard compact row used in lists (home, issues, cycle, project) */
export function issueRowHTML(iss, { showAssignee = true, showStatus = false } = {}) {
  const chips = iss.labels.slice(0, 2).map(labelChip).join('');
  const more = iss.labels.length > 2
    ? `<span class="key-chip">+${iss.labels.length - 2}</span>` : '';
  const done = iss.status === 'done' || iss.status === 'canceled';
  return `
    <div class="irow ${done ? 'done-row' : ''}" data-issue="${iss.id}" tabindex="0">
      ${showStatus ? statusPill(iss.status) : ''}
      ${priGlyph(iss.priority)}
      <span class="key-chip ir-key">${issueRef(iss)}</span>
      <span class="ir-title">${esc(iss.title || 'Untitled')}</span>
      <span class="ir-labels">${chips}${more}</span>
      <span class="ir-right">
        ${iss.comments?.length ? `<span class="faint mono" style="display:inline-flex;align-items:center;gap:3px">${ico('msg', 11)}${iss.comments.length}</span>` : ''}
        ${dueBadge(iss.due)}
        ${showAssignee ? assigneeAvatar(iss.assignee) : ''}
      </span>
    </div>`;
}

/** click + keyboard activation for any container with [data-issue] rows */
export function wireIssueRows(container, onOpen) {
  container.addEventListener('click', (e) => {
    const row = e.target.closest('[data-issue]');
    if (row) onOpen(row.dataset.issue);
  });
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const row = e.target.closest?.('[data-issue]');
    if (row) { onOpen(row.dataset.issue); }
  });
}

export function emptyState(iconName, title, body, actionHTML = '') {
  return `
    <div class="empty">
      ${ico(iconName, 30)}
      <h3>${esc(title)}</h3>
      <p>${body}</p>
      ${actionHTML}
    </div>`;
}
