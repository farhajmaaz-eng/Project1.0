/* ---------------------------------------------------------------------------
   Tessera · views/settings — workspace prefs & data ownership
--------------------------------------------------------------------------- */

import { esc, debounce } from './../util.js';
import { ico } from './../icons.js';
import {
  S, you, setSetting, resetAll, exportData, importData,
  updateDoc,
} from './../store.js';
import { toast, confirmDlg } from './../ui.js';
import { avatarHTML } from './../bits.js';
import { downloadFile } from './../util.js';

export function renderSettings(view) {
  const s = S();
  const me = you();

  view.innerHTML = `
    <div class="view-inner">
      <div class="view-head"><h1>Settings</h1></div>
      <div class="view-sub">Everything lives in this browser. No account, no cloud, no telemetry.</div>

      <section class="set-section">
        <h2>Workspace</h2>
        <p>The name appears in the sidebar and sets the tone for everything else.</p>
        <div class="set-row">
          <div class="sr-main"><b>Name</b><span>Shown in the sidebar header</span></div>
          <input class="input" style="width:220px" data-ws value="${esc(s.settings.workspaceName)}"/>
        </div>
        <div class="set-row">
          <div class="sr-main"><b>Issue prefix</b><span>Keys look like ${esc(s.settings.keyPrefix)}-101</span></div>
          <input class="input mono" style="width:120px;text-transform:uppercase" maxlength="4" data-prefix value="${esc(s.settings.keyPrefix)}"/>
        </div>
      </section>

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
      </section>

      <section class="set-section">
        <h2>You</h2>
        <p>This is local — a name for your comments and assignments.</p>
        <div class="set-row">
          <div class="sr-main"><b>Display name</b><span>Used across issues and comments</span></div>
          <input class="input" style="width:220px" data-you value="${esc(me.name)}"/>
        </div>
      </section>

      <section class="set-section">
        <h2>Team</h2>
        <p>Five fictional colleagues ship the demo backlog with you.</p>
        ${s.members.filter(m => !m.you).map(m => `
          <div class="member-row">
            ${avatarHTML(m)}
            <div class="mr-name"><b>${esc(m.name)}</b><span>${esc(m.role)}</span></div>
          </div>`).join('')}
      </section>

      <section class="set-section">
        <h2>Data</h2>
        <p>Your workspace is one JSON file. Take it with you.</p>
        <div class="set-row">
          <div class="sr-main"><b>Export</b><span>Download everything as JSON</span></div>
          <button class="btn ghost sm" data-export>${ico('down', 13)} Export</button>
        </div>
        <div class="set-row">
          <div class="sr-main"><b>Import</b><span>Replace this workspace from a backup</span></div>
          <button class="btn ghost sm" data-import>${ico('up', 13)} Import…</button>
          <input type="file" accept="application/json" hidden data-file/>
        </div>
        <div class="set-row">
          <div class="sr-main"><b>Reset to demo</b><span>Wipes changes and reseeds Kestrel</span></div>
          <button class="btn danger-ghost sm" data-reset>${ico('rotate', 13)} Reset</button>
        </div>
      </section>

      <section class="set-section">
        <h2>About</h2>
        <div class="about-note">
          tessera · v1.0 — issues and docs in one weave.<br>
          vanilla js, no build step, no backend. localStorage is the database.<br>
          press <b>?</b> anywhere for keyboard shortcuts.
        </div>
      </section>
    </div>`;

  view.querySelector('[data-ws]').addEventListener('input', debounce((e) => {
    setSetting('workspaceName', e.target.value.trim() || 'Kestrel');
  }, 400));

  view.querySelector('[data-prefix]').addEventListener('input', debounce((e) => {
    setSetting('keyPrefix', (e.target.value.trim().toUpperCase() || 'KES').replace(/[^A-Z0-9]/g, ''));
  }, 400));

  view.querySelector('[data-theme-seg]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    setSetting('theme', b.dataset.v);
    import('./../main.js').then(m => m.applyThemeFromSettings());
    view.querySelectorAll('[data-theme-seg] button').forEach(x =>
      x.classList.toggle('on', x.dataset.v === b.dataset.v));
  });

  view.querySelector('[data-you]').addEventListener('input', debounce((e) => {
    me.name = e.target.value.trim() || 'You';
    import('./../store.js').then(m => m.emit());
  }, 400));

  view.querySelector('[data-export]').onclick = () => {
    downloadFile(`tessera-backup-${new Date().toISOString().slice(0, 10)}.json`, exportData());
    toast('Backup downloaded');
  };

  const fileEl = view.querySelector('[data-file]');
  view.querySelector('[data-import]').onclick = () => fileEl.click();
  fileEl.addEventListener('change', async () => {
    const f = fileEl.files[0];
    if (!f) return;
    try {
      await confirmDlg({
        title: 'Replace current workspace?',
        body: 'Importing overwrites everything in this browser with the backup file.',
        confirmLabel: 'Import',
      }) && importData(await f.text());
    } catch (err) {
      toast('That file does not look like a Tessera backup');
    }
    fileEl.value = '';
  });

  view.querySelector('[data-reset]').onclick = async () => {
    if (await confirmDlg({
      title: 'Reset to the demo workspace?',
      body: 'Every issue, page and setting you changed will be replaced by the original seed data.',
      confirmLabel: 'Reset everything',
      danger: true,
    })) resetAll();
  };
}
