/* ---------------------------------------------------------------------------
   Tessera · motion v4 — the overkill engine.
   Confetti physics, pointer ripples, 3D tilt, spotlight tracking, FLIP
   layout animation. All vanilla, all guarded by prefers-reduced-motion,
   all transform/opacity (composited) wherever the browser allows.
--------------------------------------------------------------------------- */

export const reduceMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/* touch devices have no hover — pointer-follow effects there only fight
   scrolling and leave stray transforms behind */
export const noHover = () =>
  matchMedia('(hover: none)').matches;

const raf = requestAnimationFrame;

/* ===========================================================================
   CONFETTI — a full canvas particle system spawned on demand.
   burst(x, y, { count, spread, colors, power, gravity, shapes })
   ======================================================================== */

let fxCanvas = null;
let fxCtx = null;
let fxParticles = [];
let fxRunning = false;

function ensureCanvas() {
  if (fxCanvas?.isConnected) return;
  fxCanvas = document.createElement('canvas');
  fxCanvas.className = 'fx-canvas';
  /* 100% of the fixed inset — never vw/vh, which overflow iOS viewports */
  Object.assign(fxCanvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '999',
  });
  document.body.appendChild(fxCanvas);
  const dpr = Math.min(2, devicePixelRatio || 1);
  fxCanvas.width = innerWidth * dpr;
  fxCanvas.height = innerHeight * dpr;
  fxCtx = fxCanvas.getContext('2d');
  fxCtx.scale(dpr, dpr);
}

const DEFAULT_COLORS = ['#3ECF8E', '#93EBC6', '#5B8CFF', '#E8EBF4', '#E5B454', '#F0715C'];

/**
 * Fire a burst of confetti from a viewport point.
 * Accepts an element too — bursts from its center.
 */
export function confetti(target, opts = {}) {
  if (reduceMotion()) return;
  const {
    count = 90,
    spread = Math.PI / 1.6,
    startAngle = -Math.PI / 2,
    power = 11,
    gravity = 0.24,
    colors = DEFAULT_COLORS,
    shapes = ['rect', 'circle', 'streamer'],
    drift = 1,
  } = opts;

  let x, y;
  if (typeof target === 'number') { x = target; y = opts.y ?? innerHeight / 2; }
  else if (target instanceof Element) {
    const r = target.getBoundingClientRect();
    x = r.left + r.width / 2; y = r.top + r.height / 2;
  } else { x = innerWidth / 2; y = innerHeight * 0.38; }

  /* small screens get proportionally less confetti — same show, sane load */
  const areaScale = innerWidth < 700 ? 0.55 : 1;
  const n = Math.round(count * areaScale);

  ensureCanvas();
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (Math.random() - 0.5) * spread;
    const velocity = power * (0.45 + Math.random() * 0.75);
    fxParticles.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      g: gravity * (0.85 + Math.random() * 0.3),
      drag: 0.985 + Math.random() * 0.008,
      color: colors[(Math.random() * colors.length) | 0],
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      shape: shapes[(Math.random() * shapes.length) | 0],
      tilt: Math.random() * Math.PI,
      life: 0,
      ttl: 95 + Math.random() * 55,
      drift,
    });
  }
  if (!fxRunning) { fxRunning = true; raf(tickConfetti); }
}

function tickConfetti() {
  if (!fxCtx) { fxRunning = false; return; }
  fxCtx.clearRect(0, 0, innerWidth, innerHeight);
  fxParticles = fxParticles.filter((p) => p.life < p.ttl && p.y < innerHeight + 40);
  for (const p of fxParticles) {
    p.life++;
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.g;
    p.x += p.vx + Math.sin(p.life * 0.06 + p.tilt) * p.drift;
    p.y += p.vy;
    p.rot += p.vr;

    const fade = p.life > p.ttl * 0.72 ? 1 - (p.life - p.ttl * 0.72) / (p.ttl * 0.28) : 1;
    fxCtx.save();
    fxCtx.translate(p.x, p.y);
    fxCtx.rotate(p.rot);
    fxCtx.globalAlpha = Math.max(0, fade);
    fxCtx.fillStyle = p.color;
    if (p.shape === 'circle') {
      fxCtx.beginPath();
      fxCtx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
      fxCtx.fill();
    } else if (p.shape === 'streamer') {
      fxCtx.fillRect(-p.w / 2, -p.h / 2 + Math.sin(p.life * 0.25) * 3, p.w * 0.55, p.h);
    } else {
      // fluttering rect: fake 3D flip via width oscillation
      const wobble = Math.abs(Math.sin(p.life * 0.14 + p.tilt));
      fxCtx.fillRect((-p.w * wobble) / 2, -p.h / 2, p.w * wobble, p.h);
    }
    fxCtx.restore();
  }
  if (fxParticles.length) raf(tickConfetti);
  else {
    fxRunning = false;
    fxCtx.clearRect(0, 0, innerWidth, innerHeight);
    fxCanvas.remove();
    fxCanvas = null; fxCtx = null;
  }
}

/** small celebratory pop around a point (subtask done, label added…) */
export function miniBurst(el) {
  confetti(el, { count: 16, power: 6.5, spread: Math.PI / 2, gravity: 0.18 });
}

/** big moment — fires three angled cannons across the screen */
export function celebrate() {
  if (reduceMotion()) return;
  setTimeout(() => confetti(innerWidth * 0.12, { y: innerHeight * 0.72, count: 70, startAngle: -Math.PI / 2.6, power: 15, spread: Math.PI / 3.4 }), 0);
  setTimeout(() => confetti(innerWidth * 0.88, { y: innerHeight * 0.72, count: 70, startAngle: -(Math.PI - Math.PI / 2.6), power: 15, spread: Math.PI / 3.4 }), 60);
  setTimeout(() => confetti(innerWidth / 2, { y: innerHeight * 0.3, count: 60, power: 9 }), 200);
}

/* ===========================================================================
   RIPPLES — one delegated listener for every button-ish surface.
   ======================================================================== */

const RIPPLE_SEL = '.btn, .fchip, .tab-item, .sb-item, .menu-item, .pal-item, .mini-row, .sug-chip, .seg button';

export function wireRipples(root = document) {
  if (reduceMotion()) return;
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest?.(RIPPLE_SEL);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (!el.isConnected) return;

    const rect = el.getBoundingClientRect();
    const d = Math.max(rect.width, rect.height) * 2.1;
    const rip = document.createElement('span');
    rip.className = 'ripple';
    rip.style.cssText =
      `width:${d}px;height:${d}px;left:${e.clientX - rect.left - d / 2}px;top:${e.clientY - rect.top - d / 2}px`;
    const hasPos = getComputedStyle(el).position !== 'static';
    if (!hasPos) el.style.position = 'relative';
    el.appendChild(rip);
    rip.addEventListener('animationend', () => rip.remove(), { once: true });
  }, { passive: true });
}

/* ===========================================================================
   TILT — subtle 3D perspective that leans toward the pointer.
   attachTilt(el, { max = 5, scale = 1.01, glare = true })
   ======================================================================== */

export function attachTilt(el, { max = 4.5, scale = 1.012, lift = 3 } = {}) {
  if (reduceMotion() || noHover() || el.__tilt) return;
  el.__tilt = true;
  let frame = 0;

  el.addEventListener('pointermove', (e) => {
    if (frame) return;
    frame = raf(() => {
      frame = 0;
      if (!el.isConnected) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform =
        `perspective(700px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(${-lift}px) scale(${scale})`;
      el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
    });
  });

  el.addEventListener('pointerleave', () => {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    el.style.transform = '';
  });
}

/* ===========================================================================
   SPOTLIGHT — a soft radial highlight that follows the cursor.
   Sets --mx/--my on the element; CSS paints it. Zero layout work.
   ======================================================================== */

export function attachSpotlight(el, pad = 0) {
  if (el.__spot) return;
  el.__spot = true;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  }, { passive: true });
  void pad;
}

/* ===========================================================================
   MAGNET — elements gravitate a few px toward the cursor. Silly. Keep.
   ======================================================================== */

export function magnetize(el, strength = 5) {
  if (reduceMotion() || noHover() || el.__magnet) return;
  el.__magnet = true;
  let frame = 0;
  el.addEventListener('pointermove', (e) => {
    if (frame) return;
    frame = raf(() => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${(dx / r.width) * strength * 2}px, ${(dy / r.height) * strength}px)`;
    });
  });
  el.addEventListener('pointerleave', () => {
    if (frame) cancelAnimationFrame(frame);
    el.style.transform = '';
  });
}

/* ===========================================================================
   FLIP — First-Last-Invert-Play for list reorders & filter changes.
   flip(container, mutate, '[data-issue]')
   ======================================================================== */

export function flip(container, selector, mutate) {
  if (reduceMotion() || !container) { mutate(); return; }
  const keyOf = (el) => el.dataset.issue || el.dataset.card || el.dataset.flipKey || el;
  const before = new Map();
  container.querySelectorAll(selector).forEach((el) => {
    const r = el.getBoundingClientRect();
    before.set(keyOf(el), { top: r.top, left: r.left });
  });

  mutate();

  container.querySelectorAll(selector).forEach((el) => {
    const key = keyOf(el);
    const old = before.get(key);
    if (!old) {
      // newly appeared — fade/rise in
      el.style.animation = 'rise .3s var(--ease-out) backwards';
      setTimeout(() => { el.style.animation = ''; }, 350);
      return;
    }
    const r = el.getBoundingClientRect();
    const dx = old.left - r.left;
    const dy = old.top - r.top;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 340, easing: 'cubic-bezier(.22,.9,.3,1)', composite: 'replace' },
    );
  });
}

/* ===========================================================================
   STAGGER — tag children with --i so pure CSS can choreograph them.
   ======================================================================== */

export function stagger(container, selector = ':scope > *', cap = 14) {
  if (!container) return;
  container.querySelectorAll(selector).forEach((el, i) => {
    el.style.setProperty('--i', Math.min(i, cap));
  });
}

/* ===========================================================================
   AUTO-TILT — watch the DOM for cards that should tilt/glow.
   One MutationObserver, debounced, whole-app coverage.
   ======================================================================== */

const TILT_SEL = '.proj-card:not(.pc-add), .stat';
const SPOT_SEL = '.stat, .rail-card, .entity-head, .onboard';

let scanQueued = false;
export function watchSurfaces(root = document.body) {
  if (reduceMotion() || noHover()) return;
  const scan = () => {
    scanQueued = false;
    root.querySelectorAll(TILT_SEL).forEach((el) => attachTilt(el));
    root.querySelectorAll(SPOT_SEL).forEach((el) => attachSpotlight(el));
  };
  const queue = () => {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(scan, 80);
  };
  queue();
  new MutationObserver(queue).observe(root, { childList: true, subtree: true });
}
