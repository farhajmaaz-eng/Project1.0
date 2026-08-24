/* ---------------------------------------------------------------------------
   Tessera · views/settings v2 — profile, workspace, appearance, AI, data
--------------------------------------------------------------------------- */

import { esc, debounce } from './../util.js';
import { ico } from './../icons.js';
import {
  S, you, setSetting, setAI, resetAll, exportData, importData,
  addLabel, updateLabel, deleteLabel,
} from './../store.js';
import { toast, confirmDlg } from './../ui.js';
import { avatarHTML } from './../bits.js';
import { downloadFile } from './../util.js';
import { signOut, getAccount } from './../auth.js';
import { CURATED_MODELS, testKey } from './../openrouter.js';

const SECTIONS = [
  ['profile', 'user', 'Profile'],
  ['workspace', 'layers', 'Workspace'],
  ['ai', 'sparkles', 'AI assistant'],
  ['appearance', 'sun', 'Appearance'],
  ['labels', 'tag', 'Labels'],
  ['data', 'down', 'Data & backup'],
  ['about', 'book', 'About'],
];

export function renderSettings(view) {
  const s = S();
  const me = you();
  const acct = getAccount();

  view.innerHTML = `
    <div class="view-inner">
      <div class="view-head"><h1>Settings</h1>
        <button class="btn ghost" data-signout>${ico('logout', 14)} Sign out</button>
      </div>
      <div class="view-sub">Everything lives in this browser. No account servers, no telemetry.</div>

      <div class="settings-shell">
        <nav class="set-nav">
          ${SECTIONS.map(([id, icn, lbl]) =>
            `<button data-sec="${id}">${ico(icn, 15)}${lbl}</button>`).join('')}
        </nav>

        <div data-body></div>
      </div>
    </div>`;

  const body = view.querySelector('[data-body]');

  const paint = (sec) => {
    view.querySelectorAll('[data-sec]').forEach(b =>
      b.classList.toggle('on', b.dataset.sec === sec));
    body.innerHTML = '';
    body.className = `reveal`;

    if (sec === 'profile') body.appendChild(profileSection(s, me, acct));
    if (sec === 'workspace') body.appendChild(workspaceSection(s));
    if (sec === 'ai') body.appendChild(aiSection(s));
    if (sec === 'appearance') body.appendChild(appearanceSection(s, view));
    if (sec === 'labels') body.appendChild(labelsSection(s));
    if (sec === 'data') body.appendChild(dataSection());
    if (sec === 'about') body.appendChild(aboutSection());

    wireSection(sec, body, view);
  };

  view.querySelectorAll('[data-sec]').forEach(b =>
    b.onclick = () => paint(b.dataset.sec));

  view.querySelector('[data-signout]').onclick = async () => {
    const ok = await confirmDlg({
      title: 'Sign out?',
      body: 'The workspace stays on this device — you\u2019ll need your password to get back in.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
    signOut();
    location.hash = '#/login';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  paint('ai');
}

/* ---------- sections ---------- */

function profileSection(s, me, acct) {
  const el = document.createElement('div');
  el.innerHTML = `
    <section class="set-section">
      <h2>Profile</h2>
      <p>Local identity for this workspace.</p>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;padding:16px;background:var(--bg-2);border-radius:var(--r-l)">
        ${avatarHTML(me, true)}
        <div style="flex:1;min-width:0">
          <b style="font-size:14.5px">${esc(me.name)}</b>
          <div class="faint small mono" style="margin-top:2px">${esc(acct?.email || '')}</div>
        </div>
      </div>
      <div class="set-row">
        <div class="sr-main"><b>Display name</b><span>Used across issues and comments</span></div>
        <input class="input" style="width:220px" data-you value="${esc(me.name)}"/>
      </div>
    </section>`;
  return el;
}

function workspaceSection(s) {
  const el = document.createElement('div');
  el.innerHTML = `
    <section class="set-section">
      <h2>Workspace</h2>
      <p>The name appears in the sidebar and sets the tone for everything else.</p>
      <div class="set-row">
        <div class="sr-main"><b>Name</b><span>Shown in the sidebar header</span></div>
        <input class="input" style="width:220px" data-ws value="${esc(s.settings.workspaceName)}"/>
      </div>
      <div class="set-row">
        <div class="sr-main"><b>Issue prefix</b><span>Keys look like ${esc(s.settings.keyPrefix)}-1</span></div>
        <input class="input mono" style="width:120px;text-transform:uppercase" maxlength="4" data-prefix value="${esc(s.settings.keyPrefix)}"/>
      </div>
    </section>`;
  return el;
}

function aiSection(s) {
  const el = document.createElement('div');
  const hasKey = !!s.settings.openrouterKey;
  el.innerHTML = `
    <section class="set-section">
      <h2>AI assistant</h2>
      <p>Bring your own key from OpenRouter — one account, hundreds of models.
         Requests go directly from this browser to openrouter.ai.</p>
      <div class="set-row" style="align-items:flex-start">
        <div class="sr-main"><b>API key</b>
          <span>${hasKey ? 'A key is saved. Replace it any time.' : 'Get one at openrouter.ai/settings/keys'}</span>
        </div>
        <div style="display:flex;gap:8px;width:min(340px,60%)">
          <input class="input mono" type="password" data-okey placeholder="${hasKey ? '••••••••••••••••' : 'sk-or-v1-…'}"
            autocomplete="off" spellcheck="false" style="font-size:12px"/>
          <button class="btn ghost sm" data-savekey style="flex:none">Save</button>
        </div>
      </div>
      <div class="set-row">
        <div class="sr-main"><b>Model</b><span>Used by the assistant page</span></div>
        <button class="btn ghost" data-model style="width:min(340px,60%);justify-content:flex-start;gap:8px">
          ${ico('bot', 13)}
          <span style="flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.ai.model)}</span>
          ${ico('chev', 12)}
        </button>
      </div>
      <div class="set-row">
        <div class="sr-main"><b>Connection</b><span>Send a tiny test request</span></div>
        <button class="btn ghost sm" data-testkey>${ico('zap', 13)} Test connection</button>
      </div>
      ${hasKey ? `
      <div class="set-row">
        <div class="sr-main"><b>Remove key</b><span>The assistant page will ask again next time</span></div>
        <button class="btn danger-ghost sm" data-removekey>Remove</button>
      </div>` : ''}
    </section>`;
  return el;
}

function appearanceSection(s, view) {
  const el = document.createElement('div');
  el.innerHTML = `
    <section class="set-section">
      <h2>Appearance</h2>
      <p>Warm graphite after dark, warm paper before noon.</p>
      <div class="set-row">
        <div class="sr-main"><b>Theme</b><span>Applies immediately</span></div>
        <div class="seg" data-theme-seg>
          ${[['dark', 'moon', 'Dark'], ['light', 'sun', 'Light'], ['system', 'sliders', 'System']].map(([v, icn, lbl]) =>
            `<button data-v="${v}" class="${s.settings.theme === v ? 'on' : ''}">${ico(icn, 13)}${lbl}</button>`).join('')}
        </div>
      </div>
    </section>`;
  return el;
}

function labelsSection(s) {
  const el = document.createElement('div');
  el.innerHTML = `
    <section class="set-section">
      <h2>Labels</h2>
      <p>Small taxonomy, big clarity. Renames cascade everywhere.</p>
      <div data-labels>
        ${s.labels.map(l => `
          <div class="label-row" data-lid="${l.id}">
            <input type="color" value="${l.color}" data-color/>
            <input class="lr-name" value="${esc(l.name)}" data-name/>
            <span class="count-pill">${s.issues.filter(i => i.labels.includes(l.id)).length}</span>
            <button class="icon-btn" data-del title="Delete label" style="width:24px;height:24px">${ico('trash', 13)}</button>
          </div>`).join('') || '<p class="faint small" style="padding:10px 0">No labels yet.</p>'}
      </div>
      <button class="btn soft sm" style="margin-top:12px" data-addlabel>${ico('plus', 13)} Add label</button>
    </section>`;
  return el;
}

function dataSection() {
  const el = document.createElement('div');
  el.innerHTML = `
    <section class="set-section">
      <h2>Data & backup</h2>
      <p>Your workspace is one JSON file. Take it with you.</p>
      <div class="set-row">
        <div class="sr-main"><b>Export</b><span>Download everything as JSON (API key excluded)</span></div>
        <button class="btn ghost sm" data-export>${ico('down', 13)} Export</button>
      </div>
      <div class="set-row">
        <div class="sr-main"><b>Import</b><span>Replace this workspace from a backup</span></div>
        <button class="btn ghost sm" data-import>${ico('up', 13)} Import…</button>
        <input type="file" accept="application/json" hidden data-file/>
      </div>
      <div class="set-row">
        <div class="sr-main"><b>Erase workspace</b><span>Start over with a clean slate</span></div>
        <button class="btn danger-ghost sm" data-reset>${ico('rotate', 13)} Erase</button>
      </div>
    </section>
    <section class="set-section">
      <h2>Danger zone</h2>
      <p>Delete the local account together with all workspace data.</p>
      <button class="btn danger-ghost sm" data-nuke>${ico('trash', 13)} Delete everything</button>
    </section>`;
  return el;
}

function aboutSection() {
  const el = document.createElement('div');
  el.innerHTML = `
    <section class="set-section">
      <h2>About</h2>
      <div class="about-note">
        tessera · v2.0 — issues and docs in one weave.<br>
        vanilla js, no build step, no backend. localStorage is the database.<br>
        AI through OpenRouter · bring your own key.<br><br>
        press <b>?</b> anywhere for keyboard shortcuts.
      </div>
    </section>`;
  return el;
}

/* ---------- section wiring ---------- */

function wireSection(sec, body, view) {
  if (sec === 'profile') {
    body.querySelector('[data-you]').addEventListener('input', debounce((e) => {
      you().name = e.target.value.trim() || 'You';
      import('./../store.js').then(m => m.emit());
    }, 400));
  }

  if (sec === 'workspace') {
    body.querySelector('[data-ws]').addEventListener('input', debounce((e) => {
      setSetting('workspaceName', e.target.value.trim() || `${you().name.split(' ')[0]}'s workspace`);
    }, 400));
    body.querySelector('[data-prefix]').addEventListener('input', debounce((e) => {
      setSetting('keyPrefix', (e.target.value.trim().toUpperCase() || 'TSK').replace(/[^A-Z0-9]/g, ''));
    }, 400));
  }

  if (sec === 'ai') {
    const inp = body.querySelector('[data-okey]');
    body.querySelector('[data-savekey]').onclick = () => {
      const k = inp.value.trim();
      if (!k) { toast('Paste a key first'); return; }
      setSetting('openrouterKey', k);
      toast('Key saved');
    };
    body.querySelector('[data-testkey]').onclick = async (e) => {
      const btn = e.currentTarget;
      const key = S().settings.openrouterKey || inp.value.trim();
      if (!key) { toast('Save or paste a key first'); return; }
      btn.disabled = true;
      btn.innerHTML = `<span class="spin" style="display:inline-flex">${ico('rotate', 13)}</span> Testing…`;
      try {
        await testKey(key, S().ai.model);
        toast(`Works — ${S().ai.model.split('/').pop()} responded`);
      } catch (err) {
        toast(err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `${ico('zap', 13)} Test connection`;
      }
    };
    body.querySelector('[data-removekey]')?.addEventListener('click', () => {
      setSetting('openrouterKey', '');
      toast('Key removed');
      renderSettings(view.closest('.view') || document.getElementById('view'));
    });
    body.querySelector('[data-model]').onclick = () => {
      import('./ai.js').then(({ openModelPicker }) => {
        openModelPicker({
          current: S().ai.model,
          onPick: (id) => {
            setAI({ model: id });
            body.querySelector('[data-model] span').textContent = id;
            toast(`Model set to ${id.split('/').pop()}`);
          },
        });
      });
    };
  }

  if (sec === 'appearance') {
    body.querySelector('[data-theme-seg]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      setSetting('theme', b.dataset.v);
      import('./../main.js').then(m => m.themeWipe(b, () => m.applyThemeFromSettings()));
      body.querySelectorAll('[data-theme-seg] button').forEach(x =>
        x.classList.toggle('on', x.dataset.v === b.dataset.v));
    });
  }

  if (sec === 'labels') {
    body.querySelectorAll('.label-row').forEach((row) => {
      const id = row.dataset.lid;
      row.querySelector('[data-color]').addEventListener('change', (e) =>
        updateLabel(id, { color: e.target.value }));
      row.querySelector('[data-name]').addEventListener('input', debounce((e) =>
        updateLabel(id, { name: e.target.value.trim() || 'Label' }), 350));
      row.querySelector('[data-del]').onclick = async () => {
        const l = S().labels.find(x => x.id === id);
        const ok = await confirmDlg({
          title: `Delete “${l?.name}”?`,
          body: 'It will be removed from every issue that wears it.',
          confirmLabel: 'Delete',
          danger: true,
        });
        if (ok) deleteLabel(id);
      };
    });
    body.querySelector('[data-addlabel]').onclick = () => {
      const palette = ['#e5484d', '#f2994a', '#e2b93d', '#4cb782', '#3ba3a0', '#5c7cfa', '#9d7cd8', '#d96fa8'];
      addLabel('New label', palette[S().labels.length % palette.length]);
      body.querySelector('[data-labels] .label-row:last-child [data-name]')?.focus();
    };
  }

  if (sec === 'data') {
    body.querySelector('[data-export]').onclick = () => {
      downloadFile(`tessera-backup-${new Date().toISOString().slice(0, 10)}.json`, exportData());
      toast('Backup downloaded');
    };
    const fileEl = body.querySelector('[data-file]');
    body.querySelector('[data-import]').onclick = () => fileEl.click();
    fileEl.addEventListener('change', async () => {
      const f = fileEl.files[0];
      if (!f) return;
      try {
        const ok = await confirmDlg({
          title: 'Replace current workspace?',
          body: 'Importing overwrites everything in this browser with the backup file.',
          confirmLabel: 'Import',
        });
        if (ok) importData(await f.text());
      } catch {
        toast('That file does not look like a Tessera export');
      }
      fileEl.value = '';
    });
    body.querySelector('[data-reset]').onclick = async () => {
      if (await confirmDlg({
        title: 'Erase the whole workspace?',
        body: 'Every issue, page, project and cycle goes away. Your login stays.',
        confirmLabel: 'Erase everything',
        danger: true,
      })) resetAll();
    };
    body.querySelector('[data-nuke]').onclick = async () => {
      if (await confirmDlg({
        title: 'Delete everything?',
        body: 'Removes the local account AND the entire workspace from this browser. There is no undo.',
        confirmLabel: 'Delete it all',
        danger: true,
      })) {
        localStorage.removeItem('tessera.auth');
        localStorage.removeItem('tessera.session');
        localStorage.removeItem('tessera.v2');
        location.hash = '#/welcome';
        location.reload();
      }
    };
  }
}
