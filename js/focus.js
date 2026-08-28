/* ---------------------------------------------------------------------------
   Tessera · focus v1 — deep-work sessions in a floating pill.
   Pick a duration from the ⌘K palette or press F; a timer pill docks to the
   bottom-left with a live progress ring, pause/resume, and a chime +
   confetti finish. Module state survives route changes — the session
   follows you around the app.
--------------------------------------------------------------------------- */

import { ico } from './icons.js';
import { openMenu, toast } from './ui.js';
import { confetti, reduceMotion } from './motion.js';

const DURATIONS = [
  [15, '15 minutes · a sprint'],
  [25, '25 minutes · the classic'],
  [50, '50 minutes · deep dive'],
  [90, '90 minutes · full immersion'],
];

const RING_C = 91.1; // circumference of the 34px progress ring

let pill = null;
let timeEl = null, arcEl = null, pauseBtn = null;
let endAt = 0, totalMs = 0, pausedLeft = 0, paused = false;
let timer = 0, running = false, titleTimer = 0;

/* ---------- picker ---------- */

export function openFocusPicker(x, y) {
  const items = [{ header: 'Focus session' }];
  if (running) {
    items.push({ value: 'stop', label: 'Stop current session', icon: ico('x', 14), danger: true });
    items.push({ sep: true });
  }
  for (const [min, lbl] of DURATIONS) {
    items.push({
      value: min, label: lbl, icon: ico('clock', 14),
      checked: running && totalMs === min * 60000,
    });
  }
  openMenu({
    x: x ?? 24,
    y: y ?? innerHeight - (running ? 260 : 220),
    items,
    minWidth: 230,
    onSelect: (v) => {
      if (v === 'stop') { stopFocus(); toast('Focus session stopped'); return; }
      startFocus(Number(v));
    },
  });
}

/* ---------- session lifecycle ---------- */

export function startFocus(minutes = 25) {
  totalMs = minutes * 60000;
  endAt = Date.now() + totalMs;
  paused = false;
  running = true;
  mountPill(minutes);
  clearInterval(timer);
  timer = setInterval(tick, 250);
  tick();
  toast(`Focus started — ${minutes} minutes`, { icon: 'clock' });
}

export function stopFocus() {
  running = false;
  paused = false;
  clearInterval(timer);
  if (pill) {
    pill.classList.add('leaving');
    const p = pill;
    setTimeout(() => p.remove(), 240);
    pill = null;
  }
}

function tick() {
  const left = Math.max(0, endAt - Date.now());
  if (timeEl) {
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    timeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (arcEl) {
    const done = 1 - left / totalMs;
    arcEl.style.strokeDashoffset = (RING_C * done).toFixed(1);
  }
  if (left <= 0) finish();
}

function finish() {
  clearInterval(timer);
  running = false;
  const mins = Math.round(totalMs / 60000);

  if (pill) {
    pill.classList.add('done');
    setTimeout(() => {
      if (!pill) return;
      pill.classList.add('leaving');
      const p = pill;
      setTimeout(() => p.remove(), 260);
      pill = null;
    }, 2600);
  }

  chime();
  if (!reduceMotion()) confetti(null, { count: 80, power: 9 });
  toast(`Focus session complete — ${mins} minutes of deep work`, { icon: 'star' });

  /* celebrate in the tab title for anyone in another tab */
  clearTimeout(titleTimer);
  if (!document.title.startsWith('✓')) {
    const original = document.title;
    document.title = `✓ ${original}`;
    titleTimer = setTimeout(() => { document.title = original; }, 4000);

function togglePause() {
  if (!running) return;
  paused = !paused;
  if (paused) {
    pausedLeft = endAt - Date.now();
    clearInterval(timer);
    pill?.classList.add('paused');
  } else {
    endAt = Date.now() + pausedLeft;
    clearInterval(timer);
    timer = setInterval(tick, 250);
    pill?.classList.remove('paused');
  }
  if (pauseBtn) {
    pauseBtn.innerHTML = paused
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5l11 6.5-11 6.5z"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.4"/><rect x="13.5" y="5" width="4" height="14" rx="1.4"/></svg>';
  }
}

/* ---------- the pill ---------- */

function mountPill(minutes) {
  if (pill) pill.remove();
  pill = document.createElement('div');
  pill.className = 'focus-pill';
  pill.setAttribute('role', 'timer');
  pill.innerHTML = `
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="14.5" fill="none" stroke="var(--line-2)" stroke-width="3"/>
      <circle class="fp-arc" cx="17" cy="17" r="14.5" fill="none" stroke="var(--accent)" stroke-width="3"
        stroke-linecap="round" stroke-dasharray="${RING_C}" stroke-dashoffset="0"
        transform="rotate(-90 17 17)" style="transition:stroke-dashoffset .3s linear"/>
    </svg>
    <div class="fp-txt">
      <b class="mono">--:--</b>
      <span>focus · ${minutes} min</span>
    </div>
    <span style="flex:1"></span>
    <button class="icon-btn" data-fp-pause title="Pause" aria-label="Pause">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.4"/><rect x="13.5" y="5" width="4" height="14" rx="1.4"/></svg>
    </button>
    <button class="icon-btn" data-fp-stop title="Stop" aria-label="Stop session">${ico('x', 14)}</button>`;
  document.body.appendChild(pill);
  timeEl = pill.querySelector('.fp-txt b');
  arcEl = pill.querySelector('.fp-arc');
  pauseBtn = pill.querySelector('[data-fp-pause]');
  pauseBtn.onclick = togglePause;
  pill.querySelector('[data-fp-stop]').onclick = () => { stopFocus(); toast('Focus session stopped'); };
}

/* ---------- chime — a soft two-note bell, WebAudio, no assets ---------- */

function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [[659.25, 0], [880, 0.18]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + at);
      gain.gain.linearRampToValueAtTime(0.14, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 1.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 1.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2600);
  } catch { /* audio is a garnish, never a dependency */ }
}

  }
}
