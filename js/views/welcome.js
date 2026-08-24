/* ---------------------------------------------------------------------------
   Tessera · views/welcome — local signup / sign in. The only gate there is.
--------------------------------------------------------------------------- */

import { esc, sleep } from './../util.js';
import { ico } from './../icons.js';
import { signUp, signIn, startSession } from './../auth.js';
import { initStateFor } from './../store.js';
import { nav } from './../nav.js';
import { celebrate, reduceMotion } from './../motion.js';

const LOGO = `
<svg class="wl-logo" viewBox="0 0 32 32" aria-hidden="true">
  <rect x="3" y="3" width="12" height="12" rx="3.5" fill="#8A8578" opacity=".55"/>
  <rect x="17" y="3" width="12" height="12" rx="3.5" fill="#8A8578" opacity=".75"/>
  <rect x="3" y="17" width="12" height="12" rx="3.5" fill="#8A8578" opacity=".35"/>
  <rect x="17" y="17" width="12" height="12" rx="6" fill="var(--accent, #B85C43)"/>
</svg>`;

const POINTS = [
  ['zap', 'Issues with intent', 'Statuses, priorities, cycles and a board that respects drag & drop.'],
  ['doc', 'Docs that live next to the work', 'A block editor with slash commands, nested pages, no setup.'],
  ['sparkles', 'An assistant on tap', 'Plug in an OpenRouter key and plan with AI — streaming, private, yours.'],
];

export function renderWelcome(view, mode = 'signup') {
  document.body.classList.add('auth-mode');
  const isSignup = mode === 'signup';

  view.innerHTML = `
    <div class="welcome">
      <section class="wl-pitch">
        <div style="position:relative">
          <svg class="wl-tiles" width="210" height="210" viewBox="0 0 32 32" aria-hidden="true"
               style="position:absolute;right:-30px;top:-40px;width:190px;height:190px;opacity:.06;color:var(--text)">
            <rect x="3" y="3" width="12" height="12" rx="3.5" fill="currentColor"/>
            <rect x="17" y="3" width="12" height="12" rx="3.5" fill="currentColor"/>
            <rect x="3" y="17" width="12" height="12" rx="3.5" fill="currentColor"/>
            <rect x="17" y="17" width="12" height="12" rx="6" fill="var(--accent, #B85C43)"/>
          </svg>
        </div>
        <div class="wl-brand">${LOGO}<b>tessera</b></div>

        <div class="wl-hero">
          <h1>Plan in tiles.<br><em>Write in flow.</em></h1>
          <p>An issue tracker and a docs tool, woven into one quiet workspace.
             It runs entirely in your browser — your data never leaves this device.</p>
        </div>

        <div class="wl-points">
          ${POINTS.map(([icn, t, d]) => `
            <div class="wl-point">
              <span class="wp-ic">${ico(icn, 14)}</span>
              <div><b>${esc(t)}</b><span>${esc(d)}</span></div>
            </div>`).join('')}
        </div>

        <div class="wl-foot" style="margin-top:34px">local-first · no account servers · MIT licensed</div>
      </section>

      <section class="wl-form-pane">
        <form class="wl-card" id="wl-form" novalidate>
          <h2>${isSignup ? 'Create your workspace' : 'Welcome back'}</h2>
          <p class="wl-sub">${isSignup
            ? 'One account for this browser. No email verification theater.'
            : 'Sign in to this browser\u2019s workspace.'}</p>

          <div class="wl-fields">
            ${isSignup ? `
            <div class="wl-field">
              <label for="f-name">Your name</label>
              <input class="input" id="f-name" autocomplete="name" placeholder="Ada Lovelace" required/>
            </div>` : ''}
            <div class="wl-field">
              <label for="f-email">Email</label>
              <input class="input" id="f-email" type="email" autocomplete="email" placeholder="you@example.com" required/>
            </div>
            <div class="wl-field">
              <label for="f-pass">Password</label>
              <input class="input" id="f-pass" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="${isSignup ? 'At least 8 characters' : '••••••••'}" required/>
            </div>
            ${isSignup ? `
            <div class="wl-field">
              <label for="f-ws">Workspace name</label>
              <input class="input" id="f-ws" placeholder="Kestrel" />
            </div>` : ''}
          </div>

          <div class="wl-error" id="wl-error"></div>

          <button class="btn primary lg wl-submit" type="submit">
            ${isSignup ? `Create workspace ${ico('arrowRight', 15)}` : `Sign in ${ico('arrowRight', 15)}`}
          </button>

          <div class="wl-switch">
            ${isSignup
              ? 'By creating a workspace you agree with yourself to ship things.'
              : `Forgot the password? <button type="button" id="wl-forgot">Reset everything</button>`}
          </div>

          ${isSignup ? `
          <p class="wl-note">
            Everything — account included — is stored in this browser's localStorage and
            hashed before saving. Clearing site data erases the workspace, so export
            backups from Settings now and then.
          </p>` : ''}
        </form>
      </section>
    </div>`;

  const err = view.querySelector('#wl-error');
  const showErr = (msg) => {
    err.textContent = msg;
    err.classList.remove('show');
    void err.offsetWidth; // restart shake animation
    err.classList.add('show');
  };

  view.querySelectorAll('[data-mode]').forEach(b =>
    b.onclick = () => nav(b.dataset.mode === 'login' ? '#/login' : '#/welcome'));

  // local "reset everything" for the forgotten-password case
  view.querySelector('#wl-forgot')?.addEventListener('click', async () => {
    const ok = await import('./../ui.js').then(({ confirmDlg }) =>
      confirmDlg({
        title: 'Erase this browser\u2019s workspace?',
        body: 'Without the password there is no way back in. This removes the account and all data from this device.',
        confirmLabel: 'Erase and start over',
        danger: true,
      }));
    if (!ok) return;
    localStorage.removeItem('tessera.auth');
    localStorage.removeItem('tessera.session');
    localStorage.removeItem('tessera.v2');
    location.hash = '#/welcome';
    location.reload();
  });

  const btn = view.querySelector('.wl-submit');
  const setLoading = (on) => {
    btn.classList.toggle('wl-btn-loading', on);
    btn.innerHTML = on
      ? `<span class="spin" style="display:inline-flex">${ico('rotate', 15)}</span>`
      : (isSignup ? `Create workspace ${ico('arrowRight', 15)}` : `Sign in ${ico('arrowRight', 15)}`);
  };

  view.querySelector('#wl-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.remove('show');
    const email = view.querySelector('#f-email').value;
    const pass = view.querySelector('#f-pass').value;
    setLoading(true);
    try {
      if (isSignup) {
        const name = view.querySelector('#f-name').value;
        const wsInput = view.querySelector('#f-ws').value.trim();
        await signUp({ name, email, password: pass });
        const first = name.trim().split(/\s+/)[0] || 'My';
        initStateFor({
          name,
          workspace: wsInput || `${first}'s workspace`,
          prefix: (wsInput || `${first} workspace`)
            .split(/\s+/).map(w => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'TSK',
        });
      } else {
        await signIn(email, pass);
      }
      startSession();

      /* the send-off: button flashes green, cannons fire, then we sail home */
      if (!reduceMotion()) {
        btn.classList.add('wl-success');
        btn.innerHTML = `${ico('check', 16)} ${isSignup ? 'Workspace ready' : 'Welcome back'}`;
        celebrate();
        await sleep(650);
      }

      document.body.classList.remove('auth-mode');
      nav('#/home');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (ex) {
      showErr(ex.message);
      setLoading(false); // success path keeps its morphed state — no reset flash
    }
  });

  setTimeout(() => view.querySelector('input')?.focus(), 60);

  /* pointer parallax — the whole scene leans gently with the cursor */
  if (!reduceMotion() && matchMedia('(pointer:fine)').matches) {
    const pane = view.querySelector('.welcome');
    let raf = 0;
    pane.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = pane.getBoundingClientRect();
        pane.style.setProperty('--px', (((e.clientX - r.left) / r.width) - 0.5).toFixed(3));
        pane.style.setProperty('--py', (((e.clientY - r.top) / r.height) - 0.5).toFixed(3));
      });
    });
  }
}
