/* ---------------------------------------------------------------------------
   Tessera · issue drawer v2 — slide-over editor with subtasks, AI breakdown,
   due-date quick picks, deep links and duplication.
--------------------------------------------------------------------------- */

import { esc, uid } from './util.js';
import { ico, statusIcon, priIcon } from './icons.js';
import {
  S, issueById, member as memberOf, label as labelOf, status as statusOf,
  project as projectOf, cycle as cycleOf, issueRef, you,
  updateIssue, deleteIssue, addComment, touchRecent, emit,
  childrenIssues, createIssue, duplicateIssue, logAct,
} from './store.js';
import { toast, openMenu, openModal } from './ui.js';
import { avatarHTML, labelChip } from './bits.js';
import { mountEditor } from './editor.js';
import { chatStream } from './openrouter.js';
import { sanitizeAIText } from './views/ai.js';

let current = null; // active drawer handle
let currentId = null;

export function isDrawerOpen() { return !!current; }
export function closeDrawer() {
  current?.close();
  current = null;
}

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
        <button class="icon-btn" style="width:24px;height:24px" data-copylink title="Copy link">${ico('key', 13)}</button>
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

    wrap.querySelector('[data-ref]').textContent = issueRef(iss);

    const parent = iss.parent ? issueById(iss.parent) : null;

    body.innerHTML = `
      ${parent ? `
      <nav class="crumbs" style="margin-bottom:10px">
        <span class="faint">subtask of</span>
        <button data-openparent="${parent.id}">${issueRef(parent)} · ${esc(parent.title || 'Untitled')}</button>
      </nav>` : ''}
      <textarea class="is-title" rows="1" placeholder="Issue title">${esc(iss.title)}</textarea>
      <div class="is-cols">
        <section style="min-width:0">
          <div class="caps is-desc-label">Description</div>
          <div data-editor></div>
          <div class="subsec" data-subtasks></div>
          <div class="activity" data-activity></div>
        </section>
        <aside class="props">
          <div class="prop-row"><label>Status</label><button class="prop-btn" data-prop="status"></button></div>
          <div class="prop-row"><label>Priority</label><button class="prop-btn" data-prop="priority"></button></div>
          <div class="prop-row"><label>Assignee</label><button class="prop-btn" data-prop="assignee"></button></div>
          <div class="prop-row"><label>Labels</label><button class="prop-btn" data-prop="labels"></button></div>
          <div class="prop-row"><label>Project</label><button class="prop-btn" data-prop="project"></button></div>
          <div class="prop-row"><label>Cycle</label><button class="prop-btn" data-prop="cycle"></button></div>
          <div class="prop-row"><label>Due</label><button class="prop-btn" data-prop="due"></button></div>
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

    body.querySelector('[data-openparent]')?.addEventListener('click', (e) =>
      openIssue(e.currentTarget.dataset.openparent));

    renderProps();
    renderSubtasks();
    renderActivity();
  }

  function autosize(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }

  /* ---------- props ---------- */

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

    body.querySelector('[data-prop="labels"]').innerHTML = iss.labels.length
      ? `<span class="prop-multi">${iss.labels.map(labelChip).join('')}</span>`
      : `<span class="ph">Labels</span>`;

    const p = iss.project ? projectOf(iss.project) : null;
    body.querySelector('[data-prop="project"]').innerHTML = p
      ? `<span style="font-size:14px">${p.icon}</span><span>${esc(p.name)}</span>`
      : `<span class="ph">Project</span>`;

    const c = iss.cycle ? cycleOf(iss.cycle) : null;
    body.querySelector('[data-prop="cycle"]').innerHTML = c
      ? `<span style="color:var(--text)"><b>${esc(c.name)}</b></span>`
      : `<span class="ph">Cycle</span>`;

    body.querySelector('[data-prop="due"]').innerHTML = iss.due
      ? `${ico('calendar', 12)}<span>${esc(dueLabel(iss.due))}</span>`
      : `<span class="ph">Due date</span>`;
  }

  function dueLabel(iso) {
    const diff = Math.round((new Date(iso + 'T12:00') - new Date(todayStr() + 'T12:00')) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return new Date(iso + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  const todayStr = () => new Date().toISOString().slice(0, 10);
  function isoAddDays(base, n) {
    const d = base ? new Date(base + 'T12:00') : new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- subtasks ---------- */

  function renderSubtasks() {
    const iss = issueById(currentId);
    if (!iss) return;
    const host = body.querySelector('[data-subtasks]');
    if (!host) return;
    const kids = childrenIssues(iss.id);
    const closed = kids.filter(k => ['done', 'canceled'].includes(k.status)).length;

    host.innerHTML = `
      <div class="subsec-head">
        <span class="caps">Subtasks</span>
        ${kids.length ? `
          <span class="count-pill">${closed}/${kids.length}</span>
          <span class="sub-progress"><i style="width:${kids.length ? closed / kids.length * 100 : 0}%"></i></span>` : ''}
        <span style="flex:1"></span>
        <button class="btn ai-btn sm" data-generate title="Generate subtasks with AI">${ico('sparkles', 12)} Generate</button>
      </div>
      <div data-kids>
        ${kids.map(k => {
          const done = ['done', 'canceled'].includes(k.status);
          return `
          <div class="subrow ${done ? 'done' : ''}" data-kid="${k.id}">
            <span data-toggle="${k.id}" style="display:inline-flex;cursor:pointer" title="${done ? 'Reopen' : 'Mark done'}">
              ${statusIcon(done ? 'done' : k.status, statusOf(k.status).color, 14)}
            </span>
            <span class="sr-title">${esc(k.title || 'Untitled')}</span>
            <span class="ir-pri">${priIcon(k.priority, 12)}</span>
            ${memberOf(k.assignee) ? avatarHTML(memberOf(k.assignee)) : ''}
          </div>`;
        }).join('')}
      </div>
      <div class="sub-add">
        ${ico('plus', 13)}
        <input data-addsub placeholder="Add a subtask and press ↵"/>
      </div>`;

    // toggle done
    host.querySelectorAll('[data-toggle]').forEach(el =>
      el.onclick = (e) => {
        e.stopPropagation();
        const kid = issueById(el.dataset.toggle);
        const nowDone = !['done', 'canceled'].includes(kid.status);
        updateIssue(kid.id, { status: nowDone ? 'done' : 'todo' },
          nowDone ? 'completed a subtask' : 'reopened a subtask');
      });
    // open kid on click
    host.querySelectorAll('.subrow').forEach(row =>
      row.onclick = () => openIssue(row.dataset.kid));
    // inline composer
    host.querySelector('[data-addsub]').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const val = e.currentTarget.value.trim();
      if (!val) return;
      createIssue({
        title: val,
        parent: iss.id,
        project: iss.project,
        cycle: iss.cycle,
        labels: [...iss.labels],
      });
      toast('Subtask added');
      e.currentTarget.value = '';
      renderSubtasks();
    });
    // AI generate
    host.querySelector('[data-generate]').onclick = () => aiSubtasks(iss);
  }

  async function aiSubtasks(iss) {
    const key = S().settings.openrouterKey;
    if (!key) {
      toast('Connect an assistant first — Settings → AI');
      return;
    }
    const desc = (iss.blocks || []).map(b =>
      (b.html || '').replace(/<[^>]+>/g, ' ').trim()).join(' ').slice(0, 1400);
    const source = `Title: ${iss.title || '(untitled)'}${desc ? `\nDetails: ${desc}` : ''}`;

    openModal((modal, close) => {
      modal.innerHTML = `
        <div class="modal-head" style="padding-bottom:6px">
          <span class="ai-orb" style="width:30px;height:30px;border-radius:10px">${ico('sparkles', 14)}</span>
          <h3 style="font-family:var(--serif);font-weight:500;font-size:17px">Suggested subtasks</h3>
          <span style="flex:1"></span><kbd>esc</kbd>
        </div>
        <div style="padding:10px 20px;color:var(--text-2);font-size:12.5px;line-height:1.5">
          For <b>${esc(iss.title || 'this issue')}</b> — uncheck anything you don't want, adjust priorities, then create them all linked to this issue.
        </div>
        <div data-results style="padding:6px 18px 8px;min-height:120px">
          <div class="skeleton" style="height:14px;margin:10px 0"></div>
          <div class="skeleton" style="height:14px;margin:10px 0;width:85%"></div>
          <div class="skeleton" style="height:14px;margin:10px 0;width:70%"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;padding:10px 20px 16px">
          <button class="btn ghost" data-cancel>Cancel</button>
          <button class="btn primary" data-create disabled>Create subtasks</button>
        </div>`;

      modal.querySelector('[data-cancel]').onclick = close;

      (async () => {
        const messages = [
          { role: 'system', content: 'You decompose issues into concrete, actionable subtasks. Respond ONLY with a JSON array — no prose, no markdown fences — of at most 6 objects shaped {"title":"imperative subtask","priority":"urgent|high|medium|low"}.' },
          { role: 'user', content: source },
        ];
        let acc = '';
        for await (const delta of chatStream({
          key, model: S().ai.model, messages,
        })) acc += delta;

        const items = parseSubtasks(sanitizeAIText(acc));
        if (!items.length) throw new Error('The model did not return usable tasks. Try again or rephrase.');

        const resEl = modal.querySelector('[data-results]');
        resEl.innerHTML = items.map((it, i) => `
          <div class="gen-item">
            <input type="checkbox" checked data-i="${i}"/>
            <span class="g-title">${esc(it.title)}</span>
            <select data-p="${i}">
              ${['urgent', 'high', 'medium', 'low', 'none'].map(p =>
                `<option value="${p}" ${p === it.priority ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>`).join('');

        const btn = modal.querySelector('[data-create]');
        const syncBtn = () => {
          const n = [...resEl.querySelectorAll('input[type=checkbox]')].filter(c => c.checked).length;
          btn.disabled = n === 0;
          btn.textContent = `Create ${n || ''} subtask${n === 1 ? '' : 's'}`;
        };
        resEl.addEventListener('change', syncBtn);
        syncBtn();

        btn.onclick = () => {
          let made = 0;
          resEl.querySelectorAll('.gen-item').forEach((row, i) => {
            if (!row.querySelector('input[type=checkbox]').checked) return;
            createIssue({
              title: items[i].title,
              priority: row.querySelector('select').value,
              parent: iss.id,
              project: iss.project,
              cycle: iss.cycle,
              labels: [...iss.labels],
            });
            made++;
          });
          close();
          toast(`Created ${made} subtask${made === 1 ? '' : 's'}`);
          logAct(iss.id, `added ${made} subtasks via AI`);
          renderAll();
        };
      })().catch((err) => {
        modal.querySelector('[data-results]').innerHTML =
          `<div class="ai-error">${esc(err.message)}</div>`;
      });
    }, { width: 560 });
  }

  /* ---------- activity ---------- */

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
  const cap = (wd) => wd[0].toUpperCase() + wd.slice(1);

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
    if (kind === 'due') {
      openMenu({
        anchor: btn, minWidth: 170,
        items: [
          { value: 'today', label: 'Today', icon: ico('calendar', 14), checked: iss.due === todayStr() },
          { value: 'tomorrow', label: 'Tomorrow', icon: ico('calendar', 14), checked: iss.due === isoAddDays(todayStr(), 1) },
          { value: 'week', label: 'Next week', icon: ico('calendar', 14), checked: iss.due === isoAddDays(todayStr(), 7) },
          { value: 'custom', label: 'Pick a date…', icon: ico('pen', 14) },
          { sep: true },
          { value: 'clear', label: 'Clear due date', icon: ico('x', 14), danger: !iss.due },
        ],
        onSelect: (v) => {
          if (v === 'custom') { inlineDatePicker(btn, iss); return; }
          const due = v === 'clear' ? null
            : v === 'today' ? todayStr()
            : v === 'tomorrow' ? isoAddDays(todayStr(), 1)
            : isoAddDays(todayStr(), 7);
          updateIssue(iss.id, { due }, due ? `set due date` : 'cleared the due date');
          flashSaved();
        },
      });
    }
  });

  /** swaps the due prop button into a real date input, commits on change */
  function inlineDatePicker(btn, iss) {
    const inp = document.createElement('input');
    inp.type = 'date';
    inp.className = 'input';
    inp.value = iss.due || todayStr();
    inp.style.cssText = 'padding:3px 6px;font-size:12px;background:none;width:100%';
    btn.replaceWith(inp);
    inp.focus();
    inp.showPicker?.();
    const commit = () => {
      updateIssue(iss.id, { due: inp.value || null },
        inp.value ? 'set due date' : 'cleared the due date');
      flashSaved();
      renderAll();
    };
    inp.addEventListener('change', commit);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); commit(); }
    });
  }

  /* ---------- bar actions ---------- */

  wrap.querySelector('[data-copylink]').onclick = () => {
    const url = `${location.origin}${location.pathname}#/issue/${currentId}`;
    navigator.clipboard.writeText(url).then(
      () => toast('Link copied'),
      () => toast(url),
    );
  };

  wrap.querySelector('[data-more]').onclick = (e) => {
    const idxInStore = S().issues.findIndex(i => i.id === currentId);
    openMenu({
      anchor: e.currentTarget,
      items: [
        { value: 'copylink', label: 'Copy link', icon: ico('key', 14) },
        { value: 'dup', label: 'Duplicate issue', icon: ico('copy', 14) },
        { value: 'duetoday', label: 'Due today', icon: ico('calendar', 14) },
        { value: 'clearDue', label: 'Clear due date', icon: ico('x', 14) },
        { sep: true },
        { value: 'del', label: 'Delete issue', icon: ico('trash', 14), danger: true, kbd: '⌫' },
      ],
      onSelect: (v) => {
        if (v === 'copylink') {
          const url = `${location.origin}${location.pathname}#/issue/${currentId}`;
          navigator.clipboard.writeText(url).then(() => toast('Link copied'));
        }
        if (v === 'dup') {
          const copy = duplicateIssue(currentId);
          toast(`${issueRef(copy)} created`);
        }
        if (v === 'duetoday') {
          updateIssue(currentId, { due: todayStr() }, 'set due date to today');
          flashSaved();
        }
        if (v === 'clearDue') { updateIssue(currentId, { due: null }); flashSaved(); }
        if (v === 'del') {
          const snap = deleteIssue(currentId);
          close();
          if (snap) {
            toast(`Deleted ${issueRef(snap.snap)}`, {
              action: { label: 'Undo', fn: () => { restoreFromSnap(snap); } },
            });
          }
        }
      },
    });
  };

  function restoreFromSnap({ snap, idx }) {
    import('./store.js').then(m => m.restoreIssue({ snap, idx }));
  }

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

function parseSubtasks(raw = '') {
  try {
    let t = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
    const start = t.indexOf('[');
    const end = t.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    const arr = JSON.parse(t.slice(start, end + 1));
    const okPri = new Set(['urgent', 'high', 'medium', 'low']);
    return arr
      .map(x => ({
        title: String(x?.title ?? x ?? '').trim().slice(0, 140),
        priority: okPri.has(x?.priority) ? x.priority : 'medium',
      }))
      .filter(x => x.title.length > 1)
      .slice(0, 8);
  } catch {
    return [];
  }
}
