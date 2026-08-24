/* ---------------------------------------------------------------------------
   Tessera · ui v4 — toasts, dropdown menus, modal shell, confirm dialog
--------------------------------------------------------------------------- */

import { ico } from './icons.js';
import { esc } from './util.js';
import { reduceMotion } from './motion.js';

const overlayHost = () => document.getElementById('overlays');

/* ================= toast ================= */

/**
 * toast('Saved', { icon:'check', tone:'ok', action:{label,fn}, timeout })
 * A countdown hairline shows exactly how long the toast lives; hovering
 * holds it open. The animation itself is the clock — no drift.
 */
export function toast(msg, opts = {}) {
  const host = document.getElementById('toasts');
  const t = document.createElement('div');
  const tone = opts.tone || 'ok';
  if (opts.icon !== null) t.className = `toast ${tone}`;
  else t.className = 'toast';

  const iconName = opts.icon ?? (tone === 'danger' ? 'alert' : 'check');
  t.innerHTML = `
    ${iconName ? `<span class="t-ic">${ico(iconName, 13)}</span>` : ''}
    ${msg ? `<span>${msg}</span>` : ''}
    ${opts.action ? `<button class="t-action">${esc(opts.action.label)}</button>` : ''}
    <button class="icon-btn t-x" aria-label="Dismiss">${ico('x', 13)}</button>
    <i class="t-life"></i>`;
  host.appendChild(t);

  let gone = false;
  const kill = () => {
    if (gone) return;
    gone = true;
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 240);
  };

  if (opts.action) {
    t.querySelector('.t-action').onclick = () => { opts.action.fn(); kill(); };
  }
  t.querySelector('.t-x').onclick = kill;

  const ttl = opts.timeout ?? (opts.action ? 6000 : 3200);
  const life = t.querySelector('.t-life');

  if (!reduceMotion()) {
    // the bar is the timer: its animationend retires the toast
    life.style.animationDuration = `${ttl}ms`;
    life.addEventListener('animationend', kill, { once: true });
    // safety: if animations are throttled in a hidden tab, fall back
    const fallback = setTimeout(kill, ttl + 1500);
    t.addEventListener('pointerenter', () => clearTimeout(fallback), { once: true });
  } else {
    life.remove();
    setTimeout(kill, ttl);
  }
}

/* ================= dropdown menu ================= */

let openMenus = [];
export const anyMenuOpen = () => openMenus.length > 0;
export function closeTopMenu() {
  const m = openMenus.pop();
  if (m) m.close();
  return openMenus.length;
}
export function closeAllMenus() {
  while (openMenus.length) openMenus.pop().close();
}

/**
 * items: array of
 *   { header: 'text' }
 *   { sep: true }
 *   { value, label, icon?, kbd?, danger?, checked?, disabled? }
 * Returns a close function.
 */
export function openMenu({ anchor, x, y, items, onSelect, minWidth }) {
  const popper = document.createElement('div');
  popper.className = 'menu';
  if (minWidth) popper.style.minWidth = minWidth + 'px';

  items.forEach((it, i) => {
    if (it.sep) { popper.appendChild(Object.assign(document.createElement('div'), { className: 'menu-sep' })); return; }
    if (it.header) {
      const h = document.createElement('div');
      h.className = 'menu-head';
      h.textContent = it.header;
      popper.appendChild(h);
      return;
    }
    const b = document.createElement('button');
    b.className = 'menu-item' + (it.danger ? ' danger' : '') + (it.checked ? ' checked' : '');
    b.dataset.idx = i;
    b.style.setProperty('--i', i);
    b.innerHTML = `
      ${it.icon ? `<span class="mi-ic">${it.icon}</span>` : ''}
      <span class="mi-label">${esc(it.label)}</span>
      ${it.kbd ? `<span class="mi-kbd"><kbd>${esc(it.kbd)}</kbd></span>` : ''}
      ${it.checked ? `<span class="mi-check">${ico('check', 13)}</span>` : ''}`;
    b.onclick = () => { close(); onSelect?.(it.value, it); };
    popper.appendChild(b);
  });

  overlayHost().appendChild(popper);
  popper.style.visibility = 'hidden';

  const r = anchor?.getBoundingClientRect();
  const px = x ?? (r ? r.left : 20);
  const py = y ?? (r ? r.bottom + 6 : 20);
  requestAnimationFrame(() => {
    const mw = popper.offsetWidth, mh = popper.offsetHeight;
    let left = Math.min(px, innerWidth - mw - 10);
    let top = py;
    if (py + mh > innerHeight - 12) {
      top = r ? Math.max(10, r.top - mh - 6) : Math.max(10, innerHeight - mh - 12);
    }
    popper.style.left = `${Math.max(8, left)}px`;
    popper.style.top = `${top}px`;
    popper.style.visibility = '';
  });

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
    const btns = [...popper.querySelectorAll('.menu-item')];
    if (!btns.length) return;
    e.preventDefault();
    let idx = btns.findIndex(b => b.classList.contains('sel'));
    idx = e.key === 'ArrowUp'
      ? (idx <= 0 ? btns.length - 1 : idx - 1)
      : (idx === -1 || idx === btns.length - 1 ? 0 : idx + 1);
    btns.forEach(b => b.classList.remove('sel'));
    btns[idx].classList.add('sel');
    btns[idx].focus();
    if (e.key === 'Enter') btns[idx].click();
  };
  // focus first item for arrow-key nav
  popper.tabIndex = -1;
  requestAnimationFrame(() => {
    const first = popper.querySelector('.menu-item');
    first?.focus();
  });
  popper.addEventListener('keydown', onKey);

  const onDown = (e) => { if (!popper.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', onDown), 0);

  function close() {
    document.removeEventListener('pointerdown', onDown);
    popper.remove();
    const i = openMenus.findIndex(m => m.close === close);
    if (i > -1) openMenus.splice(i, 1);
    onClose?.();
  }
  let onClose = null;

  const handle = { close, setOnClose: (fn) => { onClose = fn; }, get open() { return !!popper.isConnected; } };
  openMenus.push(handle);
  return handle;
}

/* convenience: property-style picker used all over */
export function pickOne(anchor, options, current, onPick, extraHead) {
  const items = [];
  if (extraHead) items.push({ header: extraHead });
  for (const o of options) {
    items.push({
      value: o.value,
      label: o.label,
      icon: o.icon,
      checked: String(o.value) === String(current),
    });
  }
  return openMenu({ anchor, items, onSelect: (v) => onPick(v) });
}

/* ================= modal shell ================= */

let openModals = [];

export function openModal(buildContent, { width } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'scrim';
  const modal = document.createElement('div');
  modal.className = 'modal';
  if (width) modal.style.width = `min(${width}px, calc(100vw - 40px))`;
  wrap.appendChild(modal);
  overlayHost().appendChild(wrap);

  const close = () => {
    if (closing) return;
    closing = true;
    document.removeEventListener('keydown', keyHandler, true);
    const finish = () => {
      wrap.remove();
      openModals = openModals.filter(m => m !== close);
      onClose?.();
    };
    if (reduceMotion()) finish();
    else {
      wrap.classList.add('closing');
      modal.classList.add('closing');
      setTimeout(finish, 170);
    }
  };
  let closing = false;
  let onClose = null;

  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
  const keyHandler = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  };
  document.addEventListener('keydown', keyHandler, true);

  buildContent(modal, close);
  openModals.push(close);
  const handle = { close, el: modal, setOnClose: (fn) => { onClose = fn; } };
  return handle;
}

export function anyModalOpen() { return openModals.length > 0; }

/* ================= confirm ================= */

export function confirmDlg({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    openModal((m, close) => {
      m.innerHTML = `
        <div style="padding:22px 22px 4px">
          <h3 style="font-family:var(--serif);font-weight:520;font-size:17px">${esc(title)}</h3>
          ${body ? `<p style="color:var(--text-2);font-size:13px;margin-top:7px;line-height:1.55">${body}</p>` : ''}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;padding:16px 22px 18px">
          <button class="btn ghost" data-a="no">Cancel</button>
          <button class="btn ${danger ? 'danger-ghost' : 'primary'}" data-a="yes">${esc(confirmLabel)}</button>
        </div>`;
      m.querySelector('[data-a="no"]').onclick = () => { done(false); close(); };
      m.querySelector('[data-a="yes"]').onclick = () => { done(true); close(); };
      setTimeout(() => m.querySelector('[data-a="yes"]').focus(), 30);
    }).setOnClose(() => done(false));
  });
}
