/* ---------------------------------------------------------------------------
   Tessera · new-issue — quick composer modal
--------------------------------------------------------------------------- */

import { esc } from './util.js';
import { ico, statusIcon, priIcon } from './icons.js';
import {
  S, status as statusOf, member as memberOf,
  createIssue,
} from './store.js';
import { openModal, openMenu } from './ui.js';
import { avatarHTML } from './bits.js';
import { mountEditor } from './editor.js';
import { openIssue } from './issue-drawer.js';
import { todayISO } from './util.js';

const cap = (w) => w[0].toUpperCase() + w.slice(1);

export function openNewIssue(prefill = {}) {
  const draft = {
    title: '',
    blocks: [{ id: 'b0', type: 'p', html: '', indent: 0 }],
    status: prefill.status || 'todo',
    priority: 'none',
    assignee: null,
    labels: [],
    project: prefill.project ?? null,
    cycle: prefill.cycle ?? null,
    due: null,
  };

  let editor = null;

  openModal((modal, close) => {
    modal.innerHTML = `
      <div class="modal-head" style="padding-bottom:10px">
        ${ico('zap', 15)}
        <span class="caps">New issue</span>
        <span style="flex:1"></span>
        <kbd>esc</kbd>
      </div>
      <div style="padding:6px 18px 0">
        <input class="ni-title" placeholder="Issue title"
          style="width:100%;border:0;outline:none;background:none;font-weight:600;font-size:17px;padding:8px 2px" />
      </div>
      <div class="ni-desc"><div data-editor style="min-height:52px"></div></div>
      <div class="ni-props">
        <button class="fchip" data-p="status"></button>
        <button class="fchip" data-p="priority"></button>
        <button class="fchip" data-p="assignee"></button>
        <button class="fchip" data-p="labels"></button>
        <button class="fchip" data-p="project"></button>
        <button class="fchip" data-p="cycle"></button>
        <button class="fchip" data-p="due">${ico('calendar', 12)}<span>Due date</span></button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-top:1px solid var(--line)">
        <button class="btn primary" data-create disabled>Create issue</button>
        <span class="faint small mono">⌘↵ to create</span>
      </div>`;

    const titleEl = modal.querySelector('.ni-title');
    const createBtn = modal.querySelector('[data-create]');
    setTimeout(() => titleEl.focus(), 30);

    editor = mountEditor({
      mount: modal.querySelector('[data-editor]'),
      blocks: draft.blocks,
      placeholder: 'Add a description…',
      onChange: (b) => { draft.blocks = b; },
    });

    const paint = () => {
      const st = statusOf(draft.status);
      modal.querySelector('[data-p="status"]').innerHTML =
        `${statusIcon(st.id, st.color, 13)}<span>${esc(st.name)}</span>`;
      modal.querySelector('[data-p="priority"]').innerHTML =
        `${priIcon(draft.priority, 13)}<span>${draft.priority === 'none' ? 'Priority' : cap(draft.priority)}</span>`;
      const m = draft.assignee ? memberOf(draft.assignee) : null;
      modal.querySelector('[data-p="assignee"]').innerHTML = m
        ? `${avatarHTML(m)}<span>${esc(m.name.split(' ')[0])}</span>` : `<span>Assignee</span>`;
      modal.querySelector('[data-p="labels"]').innerHTML =
        draft.labels.length ? draft.labels.map(lid => chipFor(lid)).join('') : '<span>Labels</span>';
      const p = S().projects.find(x => x.id === draft.project);
      modal.querySelector('[data-p="project"]').innerHTML = p
        ? `<span style="font-size:13px">${p.icon}</span><span>${esc(p.name)}</span>` : '<span>Project</span>';
      const c = S().cycles.find(x => x.id === draft.cycle);
      modal.querySelector('[data-p="cycle"]').innerHTML = c
        ? `${ico('target', 12)}<span>${esc(c.name)}</span>` : '<span>Cycle</span>';
      modal.querySelector('[data-p="due"] span').textContent = draft.due || 'Due date';

      createBtn.disabled = !titleEl.value.trim();
    };

    function chipFor(lid) {
      const l = S().labels.find(x => x.id === lid);
      return l ? `<span class="chip"><i class="dot" style="background:${l.color}"></i>${esc(l.name)}</span>` : '';
    }

    modal.querySelector('.ni-props').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-p]');
      if (!btn) return;
      const k = btn.dataset.p;
      if (k === 'status') openMenu({
        anchor: btn,
        items: S().statuses.map(s => ({ value: s.id, label: s.name, icon: statusIcon(s.id, s.color, 14), checked: s.id === draft.status })),
        onSelect: v => { draft.status = v; paint(); },
      });
      if (k === 'priority') openMenu({
        anchor: btn,
        items: ['urgent', 'high', 'medium', 'low', 'none'].map(p => ({
          value: p, label: p === 'none' ? 'No priority' : cap(p), icon: priIcon(p, 14), checked: p === draft.priority })),
        onSelect: v => { draft.priority = v; paint(); },
      });
      if (k === 'assignee') openMenu({
        anchor: btn, header: 'Assign to',
        items: [{ id: null, name: 'Unassigned' }, ...S().members].map(m => ({
          value: m.id, label: m.name + (m.you ? ' (you)' : ''), icon: avatarHTML(m), checked: m.id === draft.assignee })),
        onSelect: v => { draft.assignee = v; paint(); },
      });
      if (k === 'labels') {
        const sel = new Set(draft.labels);
        openMenu({
          anchor: btn, header: 'Toggle labels',
          items: S().labels.map(l => ({
            value: l.id, label: l.name,
            icon: `<i class="dot" style="width:9px;height:9px;border-radius:50%;background:${l.color};display:inline-block"></i>`,
            checked: sel.has(l.id),
          })),
          onSelect: v => { sel.has(v) ? sel.delete(v) : sel.add(v); draft.labels = [...sel]; paint(); },
        });
      }
      if (k === 'project') openMenu({
        anchor: btn,
        items: [{ value: null, label: 'No project' }, ...S().projects.map(p => ({
          value: p.id, label: p.name, icon: `<span style="font-size:13px">${p.icon}</span>`,
        }))].map(o => ({ ...o, checked: o.value === draft.project })),
        onSelect: v => { draft.project = v; paint(); },
      });
      if (k === 'cycle') openMenu({
        anchor: btn,
        items: [{ value: null, label: 'Backlog' }, ...S().cycles.map(c => ({
          value: c.id, label: c.name, icon: ico('target', 14),
        }))].map(o => ({ ...o, checked: o.value === draft.cycle })),
        onSelect: v => { draft.cycle = v; paint(); },
      });
      if (k === 'due') {
        if (btn.querySelector('input')) return;
        const prev = btn.innerHTML;
        btn.innerHTML = `<input type="date" value="${esc(draft.due || '')}"
          style="border:0;background:none;outline:none;color:var(--text);font-size:12px;padding:0"/>`;
        const inp = btn.querySelector('input');
        inp.focus();
        inp.showPicker?.();
        const done = () => {
          draft.due = inp.value || null;
          paint();
        };
        inp.addEventListener('change', done);
        inp.addEventListener('blur', done);
        inp.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === 'Escape') { ev.stopPropagation(); paint(); }
        });
      }
    });

    titleEl.addEventListener('input', paint);

    const submit = () => {
      if (!titleEl.value.trim()) return;
      editor?.flush();
      const iss = createIssue({
        ...draft,
        title: titleEl.value.trim(),
        blocks: draft.blocks.some(b => !isBlankB(b.html)) ? draft.blocks : [],
      });
      close();
      openIssue(iss.id);
    };
    createBtn.onclick = submit;
    modal.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
    });

    paint();
  }, { width: 620 });
}

function isBlankB(html) {
  return !html || /^(\s|<br\s*\/?>)*$/i.test(String(html).replace(/&nbsp;/g, ' '));
}
