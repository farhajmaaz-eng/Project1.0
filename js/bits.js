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

/** SVG progress ring — draws itself in on mount (see views.css .pring-arc) */
export function progressRing(pct, { size = 44, stroke = 4, color = 'var(--accent)', label } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, pct / 100)));
  return `
    <span class="pring" style="width:${size}px;height:${size}px" role="img" aria-label="${pct}%">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
          stroke="var(--line-2)" stroke-width="${stroke}"/>
        <circle class="pring-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
          stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
          stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
          style="--c:${c.toFixed(1)};--off:${off.toFixed(1)};
                 transition:stroke-dashoffset .6s var(--ease-out)"
          transform="rotate(-90 ${size / 2} ${size / 2})"/>
      </svg>
      <b class="pring-num mono">${label ?? `${Math.round(pct)}%`}</b>
    </span>`;
}

/** tiny inline sparkline that sketches itself left to right on mount */
export function sparkline(values, { w = 150, h = 34, color = 'var(--accent)' } = {}) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) =>
    `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return `
    <svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>
      <circle cx="${w}" cy="${(h - (values[values.length - 1] / max) * (h - 4) - 2).toFixed(1)}"
        r="2.6" fill="${color}"/>
    </svg>`;
}
