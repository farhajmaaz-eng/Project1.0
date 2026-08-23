/* ---------------------------------------------------------------------------
   Tessera · new-project / new-cycle modals
--------------------------------------------------------------------------- */

import { esc } from './util.js';
import { ico } from './icons.js';
import { S, createProject, createCycle, you } from './store.js';
import { openModal } from './ui.js';
import { avatarHTML } from './bits.js';

const ICONS = ['📦', '🌍', '📱', '🛠️', '🚀', '🎨', '🧪', '📈', '🔧', '🌱', '🎮', '📚'];

export function openNewProject(onDone) {
  const draft = { icon: '📦', name: '', leadId: 'me', description: '' };
  openModal((modal, close) => {
    modal.innerHTML = `
      <div class="modal-head" style="padding-bottom:10px">
        ${ico('layers', 15)}<span class="caps">New project</span>
        <span style="flex:1"></span><kbd>esc</kbd>
      </div>
      <div style="padding:8px 18px 4px">
        <input class="input" data-name placeholder="Project name"
          style="font-weight:600;font-size:16px;height:40px;border-radius:10px"/>
        <textarea class="input" data-desc rows="2" placeholder="What is this project? One honest sentence beats three vague ones."
          style="margin-top:10px"></textarea>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:12px 18px">
        ${ICONS.map(i => `<button class="icon-btn" data-icon="${i}" style="width:30px;height:30px;font-size:16px">${i}</button>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:9px;padding:2px 18px 14px">
        <span class="small faint">Lead</span>
        <select class="input" data-lead style="width:auto;height:29px;padding:3px 26px 3px 8px">
          ${S().members.map(m => `<option value="${m.id}" ${m.you ? 'selected' : ''}>${esc(m.name)}${m.you ? ' (you)' : ''}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;padding:0 18px 16px">
        <button class="btn primary" data-create disabled>Create project</button>
      </div>`;

    const nameEl = modal.querySelector('[data-name]');
    const btn = modal.querySelector('[data-create]');
    let icon = draft.icon;
    setTimeout(() => nameEl.focus(), 40);

    const paint = () => {
      btn.disabled = !nameEl.value.trim();
      modal.querySelectorAll('[data-icon]').forEach(b =>
        b.style.background = b.dataset.icon === icon ? 'var(--accent-dim)' : '');
    };
    modal.querySelectorAll('[data-icon]').forEach(b =>
      b.onclick = () => { icon = b.dataset.icon; paint(); });
    nameEl.addEventListener('input', paint);
    paint();

    btn.onclick = () => {
      if (!nameEl.value.trim()) return;
      const p = createProject({
        icon,
        name: nameEl.value.trim(),
        description: modal.querySelector('[data-desc]').value.trim(),
        leadId: modal.querySelector('[data-lead]').value,
      });
      close();
      onDone?.(p);
    };
  }, { width: 560 });
}

export function openNewCycle(onDone) {
  const iso = (d) => {
    const t = new Date();
    t.setDate(t.getDate() + d);
    return t.toISOString().slice(0, 10);
  };
  openModal((modal, close) => {
    modal.innerHTML = `
      <div class="modal-head" style="padding-bottom:10px">
        ${ico('target', 15)}<span class="caps">New cycle</span>
        <span style="flex:1"></span><kbd>esc</kbd>
      </div>
      <div style="padding:8px 18px 4px;display:flex;flex-direction:column;gap:10px">
        <input class="input" data-name placeholder="Cycle name" style="font-weight:600;height:38px;border-radius:10px"/>
        <div style="display:flex;gap:10px">
          <label style="flex:1"><span class="small faint" style="display:block;margin-bottom:4px">Starts</span>
            <input type="date" class="input" data-start value="${iso(0)}"/></label>
          <label style="flex:1"><span class="small faint" style="display:block;margin-bottom:4px">Ends</span>
            <input type="date" class="input" data-end value="${iso(13)}"/></label>
        </div>
        <textarea class="input" data-goal rows="2" placeholder="Goal — what must be true when this cycle closes?"></textarea>
      </div>
      <div style="display:flex;justify-content:flex-end;padding:6px 18px 16px">
        <button class="btn primary" data-create disabled>Create cycle</button>
      </div>`;

    const nameEl = modal.querySelector('[data-name]');
    const btn = modal.querySelector('[data-create]');
    setTimeout(() => nameEl.focus(), 40);

    nameEl.addEventListener('input', () => { btn.disabled = !nameEl.value.trim(); });

    btn.onclick = () => {
      if (!nameEl.value.trim()) return;
      const c = createCycle({
        name: nameEl.value.trim(),
        startsAt: modal.querySelector('[data-start]').value,
        endsAt: modal.querySelector('[data-end]').value,
        goal: modal.querySelector('[data-goal]').value.trim(),
      });
      close();
      onDone?.(c);
    };
  }, { width: 520 });
}
