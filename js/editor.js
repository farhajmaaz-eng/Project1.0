/* ---------------------------------------------------------------------------
   Tessera · editor — a small block editor used by docs and issue descriptions.

   Supported blocks: p, h1, h2, h3, ul, ol, todo, quote, callout, code,
   divider. Markdown shortcuts on space, "/" command menu, tab indents,
   enter-splitting, backspace merging, arrow-key flow between blocks.
--------------------------------------------------------------------------- */

import { uid, esc, debounce, getCaretOffset, setCaretOffset, placeCaretEnd, caretRect, clamp, cleanInline } from './util.js';
import { ico } from './icons.js';
import { closeAllMenus } from './ui.js';

const LISTY = new Set(['ul', 'ol', 'todo']);
const HEADS = { '#': 'h1', '##': 'h2', '###': 'h3' };

const SLASH_ITEMS = [
  { t: 'p', label: 'Text', desc: 'Plain paragraph', icon: 'type' },
  { t: 'h1', label: 'Heading 1', desc: 'Big section heading', icon: 'type' },
  { t: 'h2', label: 'Heading 2', desc: 'Medium section heading', icon: 'type' },
  { t: 'h3', label: 'Heading 3', desc: 'Small section heading', icon: 'type' },
  { t: 'ul', label: 'Bulleted list', desc: 'Simple bullet list', icon: 'listUl' },
  { t: 'ol', label: 'Numbered list', desc: 'Ordered list', icon: 'listOl' },
  { t: 'todo', label: 'To-do', desc: 'Track tasks with checkboxes', icon: 'sqCheck' },
  { t: 'quote', label: 'Quote', desc: 'Capture a quotation', icon: 'quote' },
  { t: 'callout', label: 'Callout', desc: 'Make it stand out', icon: 'zap' },
  { t: 'code', label: 'Code', desc: 'Monospaced block', icon: 'codeIc' },
  { t: 'divider', label: 'Divider', desc: 'Visual separator', icon: 'minus' },
];

export function mountEditor({ mount, blocks, onChange, placeholder, autoFocus = false }) {
  const root = document.createElement('div');
  root.className = 'beditor';
  mount.appendChild(root);

  let model = blocks.map(b => ({ ...b }));
  let focusId = null;
  let focusOff = 0;
  let destroyed = false;

  /* ---------- persistence ---------- */
  const pushOut = debounce(() => {
    onChange(model.map(b => ({ ...b })));
  }, 420);

  const syncBlockEl = (el) => {
    const b = model.find(x => x.id === el.closest('.blk')?.dataset.id);
    const bled = el.classList?.contains('bled') ? el : el.querySelector('.bled');
    if (b && bled) {
      b.html = bled.innerHTML;
      bled.classList.toggle('blank', isBlank(bled.innerHTML));
    }
    pushOut();
  };

  /* ---------- rendering ---------- */

  function blockChrome(b) {
    switch (b.type) {
      case 'todo':
        return `<input type="checkbox" tabindex="-1" ${b.checked ? 'checked' : ''} aria-label="Toggle task">`;
      case 'ul':
        return '<span ul-marker></span>';
      case 'ol':
        return '<span ol-marker></span>';
      case 'callout':
        return `<span class="co-icon">${b.icon || '💡'}</span>`;
      case 'code':
        return `<span class="code-lang">code</span>`;
      case 'divider':
        return '';
      default:
        return '';
    }
  }

  function render() {
    root.innerHTML = '';
    model.forEach((b, i) => {
      const blk = document.createElement('div');
      blk.className = `blk t-${b.type}` + (b.type === 'todo' && b.checked ? ' checked' : '');
      blk.dataset.id = b.id;
      if (b.indent) blk.setAttribute('indent', String(b.indent));

      if (b.type === 'divider') {
        blk.innerHTML = '<hr>';
        root.appendChild(blk);
        return;
      }

      blk.innerHTML = blockChrome(b);
      const ed = document.createElement('div');
      ed.className = 'bled';
      ed.contentEditable = 'true';
      ed.spellcheck = true;
      ed.innerHTML = b.html;
      if (isBlank(b.html)) ed.classList.add('blank');

      const showPh =
        i === 0 && isBlank(b.html)
          ? (placeholder || "Write something, or press '/' for commands")
          : LISTY.has(b.type) && isBlank(b.html) ? 'List item'
          : b.type === 'code' ? ''
          : '';
      if (showPh) blk.dataset.ph = showPh;

      if (b.type === 'callout' || b.type === 'code') {
        const wrap = document.createElement('div');
        wrap.style.flex = '1';
        wrap.appendChild(ed);
        blk.appendChild(wrap);
      } else {
        blk.appendChild(ed);
      }
      root.appendChild(blk);
    });

    if (focusId) {
      const el = bledOf(focusId);
      if (el) {
        el.focus();
        try { setCaretOffset(el, focusOff); } catch { placeCaretEnd(el); }
        // scroll into view gently
        el.scrollIntoView({ block: 'nearest' });
      }
      focusId = null;
    } else if (autoFocus && model.length) {
      const first = root.querySelector('.bled');
      first?.focus();
    }
  }

  const bledOf = (id) => root.querySelector(`.blk[data-id="${id}"] > .bled, .blk[data-id="${id}"] > div > .bled`);

  /* ---------- slash menu ---------- */

  let slash = null; // { id, baseOff, query }
  let slashEl = null;
  let slashSel = 0;

  function openSlashMenu(blkId) {
    slashEl?.remove();
    slashSel = 0;
    slashEl = document.createElement('div');
    slashEl.className = 'slash';
    document.body.appendChild(slashEl);
    positionSlash(blkId);
    paintSlash('');
  }

  function positionSlash(blkId) {
    if (!slashEl) return;
    const ed = bledOf(blkId);
    const r = caretRect(ed);
    const mw = slashEl.offsetWidth || 250, mh = slashEl.offsetHeight || 200;
    let top = r.bottom + 6;
    if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    slashEl.style.left = `${clamp(r.left, 8, innerWidth - mw - 8)}px`;
    slashEl.style.top = `${top}px`;
  }

  function paintSlash(query) {
    if (!slashEl) return;
    const q = query.toLowerCase().trim();
    const items = SLASH_ITEMS.filter(it =>
      !q || it.label.toLowerCase().includes(q) || it.t.includes(q));
    if (!items.length) {
      slashEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-3);font-size:12px">No blocks match</div>';
      return;
    }
    slashSel = clamp(slashSel, 0, items.length - 1);
    slashEl.innerHTML = items.map((it, i) => `
      <button class="slash-item ${i === slashSel ? 'sel' : ''}" data-t="${it.t}">
        <span class="sl-ic">${ico(it.icon, 14)}</span>
        <span><b>${it.label}</b><span>${it.desc}</span></span>
      </button>`).join('');
    [...slashEl.querySelectorAll('.slash-item')].forEach((btn) => {
      btn.onpointerenter = () => { slashSel = [...slashEl.querySelectorAll('.slash-item')].indexOf(btn); paintSlash(query); };
      btn.onclick = () => applySlash(btn.dataset.t);
    });
  }

  function slashFilteredItems() {
    const q = (slash?.query || '').toLowerCase().trim();
    return SLASH_ITEMS.filter(it => !q || it.label.toLowerCase().includes(q) || it.t.includes(q));
  }

  function applySlash(type) {
    if (!slash) return;
    const { id, query } = slash;
    const b = model.find(x => x.id === id);
    closeSlash();
    if (!b) return;

    // strip the "/query" text the user typed
    const bled = bledOf(id);
    if (bled) {
      const txt = bled.textContent;
      const cut = txt.slice(0, Math.max(0, txt.length - (query.length + 1)));
      bled.textContent = cut;
      syncBlockEl(bled);
      b.html = cleanInline(cut);
    }

    if (type === 'divider') {
      const idx = model.findIndex(x => x.id === id);
      if (isBlank(b.html)) {
        model.splice(idx, 1, { id: uid('b'), type: 'divider', html: '', indent: 0 });
        const prev = model[idx - 1];
        focusId = prev ? prev.id : null; focusOff = 99999;
      } else {
        model.splice(idx + 1, 0, { id: uid('b'), type: 'divider', html: '', indent: 0 });
        focusNextAfter(id, 0);
      }
    } else {
      b.type = type;
      if (type !== 'callout') delete b.icon;
      focusId = id; focusOff = Math.max(0, bled ? bled.textContent.length : 0);
    }
    render(); pushOut(); onChangeImmediate();
  }

  function closeSlash() {
    slash = null;
    slashEl?.remove();
    slashEl = null;
    slashSel = 0;
  }

  function onChangeImmediate() { pushOut.cancel(); onChange(model.map(b => ({ ...b }))); }

  /* ---------- editing operations ---------- */

  const curBlkEl = (node) => node.closest?.('.blk');
  const curBled = (node) =>
    node.closest?.('.bled') ||
    curBlkEl(node)?.querySelector('.bled');

  function isBlank(html) {
    return !html || /^(\s|<br\s*\/?>)*$/i.test(html.replace(/&nbsp;/g, ' '));
  }

  function focusNextAfter(id, off) {
    const idx = model.findIndex(b => b.id === id);
    const next = model[idx + 1] || model[idx - 1];
    if (next) { focusId = next.id; focusOff = off; }
  }

  function setType(b, type) {
    b.type = type;
    if (type !== 'todo') delete b.checked;
  }

  /** markdown shortcut fired on Space */
  function mdRule(b, bled) {
    const text = bled.textContent;
    const m = text.match(/^(\#|##|###|-|\*|\d+[.)]|\[\]|\[\s\]|\[x\]|>|```)\s$/i);
    if (!m) return false;
    const tok = m[1];
    let type = null;
    if (HEADS[tok]) type = HEADS[tok];
    else if (tok === '-' || tok === '*') type = 'ul';
    else if (/^\d/.test(tok)) type = 'ol';
    else if (/^\[/.test(tok)) type = 'todo';
    else if (tok === '>') type = 'quote';
    else if (tok === '```') type = 'code';
    if (!type || b.type === 'code') return false;

    b.checked = /^\[x\]/i.test(tok);
    b.html = '';
    setType(b, type);
    focusId = b.id; focusOff = 0;
    render(); pushOut();
    return true;
  }

  function splitBlock(b, bled) {
    const off = getCaretOffset(bled) ?? bled.textContent.length;
    const text = bled.textContent;
    const before = esc(text.slice(0, off));
    const after = text.slice(off);
    const idx = model.findIndex(x => x.id === b.id);

    b.html = before;
    const carry = ['ul', 'ol', 'todo', 'quote'].includes(b.type) ? b.type : 'p';
    const nb = { id: uid('b'), type: carry, html: esc(after), indent: b.indent };
    if (carry === 'todo') nb.checked = false;
    model.splice(idx + 1, 0, nb);
    focusId = nb.id; focusOff = 0;
    render(); pushOut();
  }

  function mergeBack(b, bled) {
    const idx = model.findIndex(x => x.id === b.id);
    if (idx === 0) {
      if (LISTY.has(b.type)) { setType(b, 'p'); focusId = b.id; render(); pushOut(); }
      return;
    }
    const prev = model[idx - 1];
    if (prev.type === 'divider') {
      model.splice(idx - 1, 1); focusId = b.id; focusOff = 0; render(); pushOut(); return;
    }
    if (LISTY.has(b.type)) {
      // first turn into paragraph semantics: outdent then merge
      setType(b, 'p');
      render();
      return;
    }
    const prevEd = bledOf(prev.id);
    const prevTextLen = prevEd ? prevEd.textContent.length : 0;
    prev.html = cleanMergeHtml(prev.html, bled.textContent);
    model.splice(idx, 1);
    focusId = prev.id; focusOff = prevTextLen;
    render(); pushOut();
  }

  function cleanMergeHtml(html, extraText) {
    if (html.endsWith('<br>')) html = html.slice(0, -4);
    return html + esc(extraText);
  }

  function indent(b, dir) {
    if (!LISTY.has(b.type)) return false;
    const next = clamp((b.indent || 0) + dir, 0, 2);
    if (next === b.indent) return false;
    b.indent = next;
    render(); pushOut();
    return true;
  }

  /* ---------- events ---------- */

  root.addEventListener('input', (e) => {
    const bled = curBled(e.target);
    if (!bled) return;
    syncBlockEl(bled);
    syncBlockEl(bled);
    if (slash) {
      const off = getCaretOffset(bled) ?? bled.textContent.length;
      if (off <= slash.baseOff && slash.query === '') { closeSlash(); return; }
      const text = bled.textContent;
      slash.query = text.slice(slash.baseOff, off).replace(/^\//, '');
      if (/^\s|\s{2}/.test(slash.query)) { closeSlash(); return; }
      paintSlash(slash.query);
      positionSlash(bled.closest('.blk').dataset.id);
    }
  });

  root.addEventListener('keydown', (e) => {
    if (e.isComposing) return;

    // slash menu keyboard nav
    if (slash && slashEl) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = slashFilteredItems().length;
        if (n) {
          slashSel = (slashSel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
          paintSlash(slash.query);
        }
        return;
      }
      if (e.key === 'Enter') {
        const items = slashFilteredItems();
        e.preventDefault();
        if (items.length) applySlash(items[slashSel]?.t || items[0].t);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); closeSlash(); return; }
    }

    const bled = curBled(e.target);
    if (!bled) return;
    const blkEl = curBlkEl(e.target);
    const b = model.find(x => x.id === blkEl.dataset.id);
    if (!b) return;

    // inline formatting shortcuts
    if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u', 'e'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      const cmdMap = { b: 'bold', i: 'italic', u: 'underline', e: null };
      if (e.key.toLowerCase() === 'e') toggleCodeAroundSelection(bled);
      else document.execCommand(cmdMap[e.key.toLowerCase()]);
      syncBlockEl(bled);
      return;
    }

    if (e.key === ' ') {
      if (mdRule(b, bled)) e.preventDefault();
      return;
    }

    if (e.key === '/') {
      // open after the character lands
      setTimeout(() => {
        const off = getCaretOffset(bled) ?? bled.textContent.length;
        slash = { id: b.id, baseOff: Math.max(0, off - 1), query: '' };
        openSlashMenu(b.id);
      }, 0);
      return;
    }

    if (e.key === 'Enter') {
      if (b.type === 'code' || e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
        syncBlockEl(bled);
        return;
      }
      e.preventDefault();
      // "---" then Enter makes a divider
      if (/^-{3}$/.test(bled.textContent)) {
        b.type = 'divider'; b.html = '';
        const idx = model.findIndex(x => x.id === b.id);
        model.splice(idx + 1, 0, { id: uid('b'), type: 'p', html: '', indent: 0 });
        focusNextAfter(b.id, 0);
        render(); pushOut();
        return;
      }
      // empty list item exits the list
      if (LISTY.has(b.type) && isBlank(bled.innerHTML)) {
        if (b.indent) { indent(b, -1); return; }
        setType(b, 'p'); delete b.checked;
        focusId = b.id; focusOff = 0;
        render(); pushOut();
        return;
      }
      splitBlock(b, bled);
      return;
    }

    if (e.key === 'Backspace') {
      const off = getCaretOffset(bled);
      const sel = getSelection();
      const collapsed = sel.isCollapsed;
      if (!collapsed || off !== 0) return;
      e.preventDefault();
      if (b.indent > 0 && LISTY.has(b.type)) { indent(b, -1); return; }
      if (LISTY.has(b.type) || ['quote', 'callout', 'code', 'todo'].includes(b.type)) {
        setType(b, 'p');
        focusId = b.id; focusOff = 0;
        render(); pushOut();
        return;
      }
      mergeBack(b, bled);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      indent(b, e.shiftKey ? -1 : 1);
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const edRect = bled.getBoundingClientRect();
      const cRect = caretRect(bled);
      const atEdge = e.key === 'ArrowUp'
        ? cRect.top - edRect.top < 6
        : edRect.bottom - cRect.bottom < 6;
      if (!atEdge) return;
      e.preventDefault();
      const idx = model.findIndex(x => x.id === b.id);
      const target = e.key === 'ArrowUp' ? model[idx - 1] : model[idx + 1];
      if (!target || target.type === 'divider') return;
      focusId = target.id;
      focusOff = e.key === 'ArrowUp'
        ? (bledOf(target.id)?.textContent.length || 0)
        : 0;
      render();
      return;
    }
  });

  function toggleCodeAroundSelection(bled) {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const anc = range.startContainer.parentElement?.closest('code');
    if (anc) { anc.replaceWith(...anc.childNodes); syncBlockEl(bled); return; }
    const code = document.createElement('code');
    try { range.surroundContents(code); } catch { return; }
    sel.removeAllRanges();
    syncBlockEl(bled);
  }

  root.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) {
      const blkEl = curBlkEl(e.target);
      const b = model.find(x => x.id === blkEl.dataset.id);
      if (!b) return;
      b.checked = e.target.checked;
      blkEl.classList.toggle('checked', !!b.checked);
      pushOut();
    }
  });

  root.addEventListener('paste', (e) => {
    e.preventDefault();
    const bled = curBled(e.target);
    if (!bled) return;
    const blkEl = curBlkEl(e.target);
    const b = model.find(x => x.id === blkEl.dataset.id);
    const text = (e.clipboardData.getData('text/plain') || '').replace(/\r/g, '');
    if (!text.includes('\n')) {
      document.execCommand('insertText', false, text);
      syncBlockEl(bled);
      return;
    }
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (!lines.length) return;
    bled.textContent += lines[0];
    b.html = cleanInline(bled.innerHTML);
    let lastId = b.id;
    const idx = model.findIndex(x => x.id === b.id);
    const rest = lines.slice(1).map((line) => {
      const isBullet = /^[-*]\s+/.test(line);
      const nb = {
        id: uid('b'),
        type: isBullet ? 'ul' : 'p',
        html: esc(line.replace(/^[-*]\s+/, '')),
        indent: 0,
      };
      lastId = nb.id;
      return nb;
    });
    model.splice(idx + 1, 0, ...rest);
    focusId = rest.length ? rest[rest.length - 1].id : b.id;
    focusOff = 99999;
    render(); pushOut();
  });

  root.addEventListener('focusin', (e) => {
    if (curBled(e.target)) closeSlash();
  });

  root.addEventListener('blur', (e) => {
    const bled = curBled(e.target);
    if (bled) syncBlockEl(bled);
  }, true);

  // clicking a divider should still be harmless; clicking block gap focuses nearest
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.bled') || e.target.closest('input')) return;
    if (e.target.tagName === 'HR') return;
    // clicked padding area of a block without hitting its text: focus its editable
    const blk = e.target.closest('.blk');
    if (!blk) return;
    const ed = blk.querySelector('.bled');
    if (ed) { e.preventDefault(); placeCaretEnd(ed); ed.focus(); }
  });

  render();

  return {
    destroy() { destroyed = true; pushOut.cancel(); root.remove(); },
    flush() { pushOut.flush(); },
    focus() { const f = root.querySelector('.bled'); f?.focus(); },
    el: root,
  };
}
