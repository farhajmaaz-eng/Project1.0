/* ---------------------------------------------------------------------------
   Tessera · fx v1 — the overdrive runtime.
   Injects the decorative chrome (grain, vignette, aura, ambient field) and
   drives it: pointer tracking with lerp smoothing, ambient parallax, and
   click shockwaves. Composited properties only, rAF-throttled, paused while
   the tab is hidden, and fully inert under prefers-reduced-motion or on
   touch devices.
--------------------------------------------------------------------------- */

import { reduceMotion } from './motion.js';

const finePointer = () =>
  matchMedia('(hover: hover) and (pointer: fine)').matches;

let started = false;

/* ---------- element injection (idempotent) ---------- */

function ensure(id, className) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    if (className) el.className = className;
    document.body.appendChild(el);
  }
  return el;
}

/* ---------- pointer engine ----------
   The aura chases the cursor with a lerp so it feels weighted rather than
   glued on; the ambient field leans a fraction toward the pointer, the
   opposite of a parallax ceiling, so the room feels deep. */

function wirePointer() {
  const aura = ensure('fx-aura');
  const ambient = ensure('fx-ambient');
  ambient.append(
    document.createElement('i'),
    document.createElement('i'),
    document.createElement('i'),
  );

  let tx = innerWidth / 2, ty = innerHeight * 0.42;  // target
  let ax = tx, ay = ty;                              // aura (lazy)
  let live = false, raf = 0;

  const tick = () => {
    raf = 0;
    ax += (tx - ax) * 0.14;
    ay += (ty - ay) * 0.14;
    aura.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0)`;

    const px = (ax / innerWidth) * 2 - 1;  // -1 .. 1
    const py = (ay / innerHeight) * 2 - 1;
    ambient.style.setProperty('--px', (px * 0.5).toFixed(3));
    ambient.style.setProperty('--py', (py * 0.5).toFixed(3));

    /* settle: once the aura is basically on target, stop paying for frames */
    const settled =
      Math.abs(tx - ax) < 0.35 && Math.abs(ty - ay) < 0.35;
    if (!settled) raf = requestAnimationFrame(tick);
    else live = false;
  };

  const wake = () => {
    if (!live) { live = true; raf = requestAnimationFrame(tick); }
  };

  addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    document.body.classList.add('fx-pointer-live');
    wake();
  }, { passive: true });

  /* leave the window → dim the lantern */
  document.addEventListener('pointerleave', () => {
    document.body.classList.remove('fx-pointer-live');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; live = false; }
    else if (!document.hidden) wake();
  });

  addEventListener('resize', wake, { passive: true });
}

/* ---------- shockwave ----------
   Every primary click lands with a ring. Cheap to make, impossible to
   unsee. Skipped for text selection drags and non-left buttons. */

function wireShockwave() {
  addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.detail > 1) return; // double-clicks get one ring, not two
    const ring = document.createElement('i');
    ring.className = 'fx-ring';
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
    document.body.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
    setTimeout(() => ring.remove(), 900); // tab-throttle safety
  }, { passive: true });
}

/* ---------- boot ---------- */

export function initFx() {
  if (started) return;
  started = true;

  ensure('fx-grain');
  ensure('fx-vignette');

  if (!reduceMotion() && finePointer()) {
    wirePointer();
    wireShockwave();
  }
}
