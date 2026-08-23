/* ---------------------------------------------------------------------------
   Tessera · issue drawer — slide-over editor for a single issue
--------------------------------------------------------------------------- */

import { esc } from './util.js';
import { ico, statusIcon, priIcon } from './icons.js';
import {
  S, issueById, member as memberOf, label as labelOf, status as statusOf,
  project as projectOf, cycle as cycleOf, issueRef, you,
  updateIssue, deleteIssue, addComment, touchRecent, emit,
} from './store.js';
import { toast, openMenu } from './ui.js';
import { avatarHTML, labelChip } from './bits.js';
import { mountEditor } from './editor.js';
import { nav } from './nav.js';

let current = null; // active drawer handle
let currentId = null;

export function isDrawerOpen() { return !!current; }
export function closeDrawer() { current?.close(); current = null; }

export function openIssue(id) {
  const existing = issueById(id);
  if (!existing) return;
  if (currentId === id && current) return;
  closeDrawer();
  currentId = id;
  touchRecent('issues', id);

  const wrap = document.createElement('div');
  wrap.className = 'drawer-wrap';
  wrap.innerHTML = `
    <div class="drawer-scrim"></div>
    <aside class="drawer" role="dialog" aria-label="Issue">
      <div class="drawer-bar">
        <span class="key-chip" data-ref></span>
        <span class="save-dot">${ico('check', 11)} saved</span>
        <span style="flex:1"></span>
        <button class="icon-btn" data-more aria-label="More actions">${ico('dots', 16)}</button>
        <button class="icon-btn" data-close aria-label="Close">${ico('x', 16)}</button>
      </div>
      <div class="drawer-body"></div>
    </aside>`;
  document.getElementById('overlays').appendChild(wrap);

  let editor = null;

  const close = () => {
    editor?.flush();
    wrap.remove();
    document.removeEventListener('keydown', keyHandler, true);
    current = null;
    currentId = null;
  };
  current = { close };

  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  };
  document.addEventListener('keydown', keyHandler, true);

  wrap.querySelector('.drawer-scrim').onclick = close;
  wrap.querySelector('[data-close]').onclick = close;

  const body = wrap.querySelector('.drawer-body');

  /* ---------- rendering ---------- */

  function renderAll() {
    const iss = issueById(currentId);
    if (!iss) { close(); return; }
    const s = S();

    wrap.querySelector('[data-ref]').textContent = issueRef(iss);

    body.innerHTML = `
      <textarea class="is-title" rows="1" placeholder="Issue title">${esc(iss.title)}</textarea>
      <div class="is-cols">
        <section style="min-width:0">
          <div class="caps is-desc-label">Description</div>
          <div data-editor></div>
          <div class="activity" data-activity></div>
        </section>
        <aside class="props">
          <div class="prop-row"><label>Status</label><button class="prop-btn" data-prop="status"></button></div>
          <div class="prop-row"><label>Priority</label><button class="prop-btn" data-prop="priority"></button></div>
          <div class="prop-row"><label>Assignee</label><button class="prop-btn" data-prop="assignee"></button></div>
          <div class="prop-row"><label>Labels</label><button class="prop-btn" data-prop="labels"></button></div>
          <div class="prop-row"><label>Project</label><button class="prop-btn" data-prop="project"></button></div>
          <div class="prop-row"><label>Cycle</label><button class="prop-btn" data-prop="cycle"></button></div>
          <div class="prop-row"><label>Due</label><input type="date" class="input" style="padding:4px 7px;font-size:12px;background:none;border-color:var(--line)" data-due value="${iss.due || ''}"/></div>
        </aside>
      </div>`;

    // title
    const titleEl = body.querySelector('.is-title');
    autosize(titleEl);
    titleEl.addEventListener('input', () => {
      autosize(titleEl);
      updateIssue(iss.id, { title: titleEl.value });
      flashSaved();
    });

    // description editor
    const edHost = body.querySelector('[data-editor]');
    editor = mountEditor({
      mount: edHost,
      blocks: iss.blocks,
      placeholder: 'Add a description…',
      onChange: (blocks) => {
        updateIssue(iss.id, { blocks });
        flashSaved();
        renderActivity();
      },
    });

    // due date
    body.querySelector('[data-due]').addEventListener('change', (e) => {
      updateIssue(iss.id, { due: e.target.value || null },
        e.target.value ? `set due date to ${e.target.value}` : 'cleared the due date');
      flashSaved();
    });

    renderProps();
    renderActivity();
  }

  function autosize(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }

  function renderProps() {
    const iss = issueById(currentId);
    if (!iss) return;
    const st = statusOf(iss.status);
    body.querySelector('[data-prop="status"]').innerHTML =
      `${statusIcon(st.id, st.color, 13)}<span>${esc(st.name)}</span>`;

    body.querySelector('[data-prop="priority"]').innerHTML =
      `${priIcon(iss.priority, 13)}<span>${iss.priority === 'none' ? '<span class="ph">Priority</span>' : esc(cap(iss.priority))}</span>`;

    const m = iss.assignee ? memberOf(iss.assignee) : null;
    body.querySelector('[data-prop="assignee"]').innerHTML = m
      ? `${avatarHTML(m)}<span>${esc(m.name.split(' ')[0])}</span>`
      : `<span class="ph">Unassigned</span>`;

    const lblBtn = body.querySelector('[data-prop="labels"]');
    lblBtn.innerHTML = iss.labels.length
      ? `<span class="prop-multi">${iss.labels.map(labelChip).join('')}</span>`
      : `<span class="ph">Labels</span>`;

    const p = iss.project ? projectOf(iss.project) : null;
    body.querySelector('[data-prop="project"]').innerHTML = p
      ? `<span style="font-size:14px">${p.icon}</span><span>${esc(p.name)}</span>`
      : `<span class="ph">Project</span>`;

    const c = iss.cycle ? cycleOf(iss.cycle) : null;
    body.querySelector('[data-prop="cycle"]').innerHTML = c
      ? `<span class="ph" style="color:var(--text)"><b>${esc(c.name)}</b></span>`
      : `<span class="ph">Cycle</span>`;
  }

  function renderActivity() {
    const iss = issueById(currentId);
    if (!iss) return;
    const host = body.querySelector('[data-activity]');
    const items = [
      ...iss.activity.map(a => ({ kind: 'act', at: a.at, actorId: a.actorId, text: a.text })),
      ...iss.comments.map(c => ({ kind: 'cmt', at: c.at, c })),
    ].sort((a, b) => a.at - b.at);

    host.innerHTML = `
      <div class="caps" style="margin-bottom:6px">Activity & comments</div>
      ${items.map((it) => it.kind === 'act' ? `
        <div class="act-item">
          ${avatarHTML(memberOf(it.actorId))}
          <div class="act-line"><b>${esc(name(it.actorId))}</b> <span>${esc(it.text)}</span></div>
          <time>${agoShort(it.at)}</time>
        </div>` : `
        <div class="comment">
          ${avatarHTML(memberOf(it.c.authorId))}
          <div class="c-body">
            <div class="c-head"><b>${esc(name(it.c.authorId))}</b><time>${agoShort(it.c.at)} ago</time></div>
            <div class="c-text">${esc(it.c.body)}</div>
          </div>
        </div>`).join('')}
      <div class="composer">
        ${avatarHTML(you())}
        <div class="composer-box">
          <textarea rows="1" placeholder="Leave a comment…"></textarea>
          <div class="composer-foot">
            <span class="hint faint small mono">⌘↵ to post</span>
            <button class="btn primary sm" data-post disabled>Comment</button>
          </div>
        </div>
      </div>`;

    const ta = host.querySelector('.composer textarea');
    const btn = host.querySelector('[data-post]');
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
      btn.disabled = !ta.value.trim();
    });
    const submit = () => {
      if (!ta.value.trim()) return;
      addComment(iss.id, ta.value);
      toast('Comment added');
    };
    btn.onclick = submit;
    ta.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  }

  const name = (id) => memberOf(id)?.name || 'Someone';
  const agoShort = (ts) => {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };
  const cap = (w) => w[0].toUpperCase() + w.slice(1);

  /* ---------- property menus ---------- */

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-prop]');
    if (!btn) return;
    const iss = issueById(currentId);
    if (!iss) return;
    const kind = btn.dataset.prop;

    if (kind === 'status') {
      openMenu({
        anchor: btn, minWidth: 190,
        items: S().statuses.map((st) => ({
          value: st.id, label: st.name, icon: statusIcon(st.id, st.color, 14),
          checked: st.id === iss.status,
        })),
        onSelect: (v) => {
          if (v !== iss.status) {
            updateIssue(iss.id, { status: v }, `changed status to ${statusOf(v).name}`);
            flashSaved(); renderAll();
          }
        },
      });
    }
    if (kind === 'priority') {
      openMenu({
        anchor: btn, minWidth: 170,
        items: ['urgent', 'high', 'medium', 'low', 'none'].map((p) => ({
          value: p, label: p === 'none' ? 'No priority' : cap(p), icon: priIcon(p, 14),
          checked: p === iss.priority,
        })),
        onSelect: (v) => {
          if (v !== iss.priority) {
            updateIssue(iss.id, { priority: v }, `changed priority to ${v === 'none' ? 'none' : cap(v)}`);
            flashSaved();
          }
        },
      });
    }
    if (kind === 'assignee') {
      openMenu({
        anchor: btn, minWidth: 200,
        header: 'Assign to',
        items: [{ id: null, name: 'Unassigned' }, ...S().members].map((m) => ({
          value: m.id, label: m.name + (m.you ? ' (you)' : ''),
          icon: avatarHTML(m), checked: m.id === iss.assignee,
        })),
        onSelect: (v) => {
          if (v !== iss.assignee) {
            updateIssue(iss.id, { assignee: v }, v ? `assigned to ${name(v)}` : 'unassigned the issue');
            flashSaved();
          }
        },
      });
    }
    if (kind === 'labels') {
      const sel = new Set(iss.labels);
      openMenu({
        anchor: btn, minWidth: 190, header: 'Toggle labels',
        items: S().labels.map((l) => ({
          value: l.id, label: l.name,
          icon: `<i class="dot" style="width:9px;height:9px;border-radius:50%;background:${l.color};display:inline-block"></i>`,
          checked: sel.has(l.id),
        })),
        onSelect: (v) => {
          sel.has(v) ? sel.delete(v) : sel.add(v);
          updateIssue(iss.id, { labels: [...sel] });
          flashSaved(); renderProps();
        },
      });
    }
    if (kind === 'project') {
      openMenu({
        anchor: btn, minWidth: 210,
        items: [{ value: null, label: 'No project' }, ...S().projects.map(p => ({
          value: p.id, label: p.name, icon: `<span style="font-size:13px">${p.icon}</span>`,
        }))].map(o => ({ ...o, checked: o.value === iss.project })),
        onSelect: (v) => {
          updateIssue(iss.id, { project: v });
          flashSaved();
        },
      });
    }
    if (kind === 'cycle') {
      openMenu({
        anchor: btn, minWidth: 180,
        items: [{ value: null, label: 'Backlog (no cycle)' }, ...S().cycles.map(c => ({
          value: c.id, label: c.name, icon: ico('target', 14),
        }))].map(o => ({ ...o, checked: o.value === iss.cycle })),
        onSelect: (v) => {
          updateIssue(iss.id, { cycle: v });
          flashSaved();
        },
      });
    }
  });

  /* ---------- more menu ---------- */

  wrap.querySelector('[data-more]').onclick = (e) => {
    const idxInStore = S().issues.findIndex(i => i.id === currentId);
    openMenu({
      anchor: e.currentTarget,
      items: [
        { value: 'duetoday', label: 'Due today', icon: ico('calendar', 14) },
        { value: 'clearDue', label: 'Clear due date', icon: ico('x', 14) },
        { sep: true },
        { value: 'del', label: 'Delete issue', icon: ico('trash', 14), danger: true, kbd: '⌫' },
      ],
      onSelect: (v) => {
        if (v === 'duetoday') {
          updateIssue(currentId, { due: new Date().toISOString().slice(0, 10) }, 'set due date to today');
          flashSaved();
        }
        if (v === 'clearDue') { updateIssue(currentId, { due: null }); flashSaved(); }
        if (v === 'del') {
          const snap = deleteIssue(currentId);
          close();
          if (snap) {
            toast(`Deleted ${issueRef(snap)}`, {
              action: { label: 'Undo', fn: () => {
                S().issues.splice(Math.min(idxInStore, S().issues.length), 0, snap);
                emit();
              }},
            });
          }
        }
      },
    });
  };

  /* saved indicator */
  const saveDot = wrap.querySelector('.save-dot');
  let saveTimer;
  function flashSaved() {
    saveDot.classList.add('show');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveDot.classList.remove('show'), 1400);
  }

  renderAll();

  return { close };
}

/* convenience used by board/list context menus */
export function quickStatus(issueId, anchorEl) {
  const iss = issueById(issueId);
  if (!iss) return;
  openMenu({
    anchor: anchorEl, minWidth: 180,
    items: S().statuses.map((st) => ({
      value: st.id, label: st.name, icon: statusIcon(st.id, st.color, 14),
      checked: st.id === iss.status,
    })),
    onSelect: (v) => updateIssue(issueId, { status: v }, `changed status to ${statusOf(v).name}`),
  });
}
