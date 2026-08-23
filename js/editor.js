/* ---------------------------------------------------------------------------
   Tessera · editor v2 — block editor used by docs and issue descriptions.

   Blocks: p, h1, h2, h3, ul, ol, todo, quote, callout, code, divider,
   toggle, table, image. Markdown shortcuts, "/" command menu, tab indents
   (nest anything under a toggle), enter-splitting, backspace merging/outdent,
   arrow flow, ⌘B/I/U/E, and a block-handle menu (turn into / move / dup /
   delete).
--------------------------------------------------------------------------- */

import { uid, esc, debounce, getCaretOffset, setCaretOffset, placeCaretEnd, caretRect, clamp, cleanInline } from './util.js';
import { ico } from './icons.js';
import { openMenu } from './ui.js';

const LISTY = new Set(['ul', 'ol', 'todo']);
const HEADS = { '#': 'h1', '##': 'h2', '###': 'h3' };
const NO_INDENT = new Set(['code', 'divider', 'image', 'table']);

const SLASH_ITEMS = [
  { t: 'p', label: 'Text', desc: 'Plain paragraph', icon: 'type' },
  { t: 'h1', label: 'Heading 1', desc: 'Big section heading', icon: 'type' },
  { t: 'h2', label: 'Heading 2', desc: 'Medium section heading', icon: 'type' },
  { t: 'h3', label: 'Heading 3', desc: 'Small section heading', icon: 'type' },
  { t: 'ul', label: 'Bulleted list', desc: 'Simple bullet list', icon: 'listUl' },
  { t: 'ol', label: 'Numbered list', desc: 'Ordered list', icon: 'listOl' },
  { t: 'todo', label: 'To-do', desc: 'Track tasks with checkboxes', icon: 'sqCheck' },
  { t: 'toggle', label: 'Toggle', desc: 'Collapsible section', icon: 'chev' },
  { t: 'table', label: 'Table', desc: 'Editable grid', icon: 'board' },
  { t: 'quote', label: 'Quote', desc: 'Capture a quotation', icon: 'quote' },
  { t: 'callout', label: 'Callout', desc: 'Make it stand out', icon: 'zap' },
  { t: 'code', label: 'Code', desc: 'Monospaced block', icon: 'codeIc' },
  { t: 'image', label: 'Image', desc: 'Embed from a URL', icon: 'doc' },
  { t: 'divider', label: 'Divider', desc: 'Visual separator', icon: 'minus' },
];

export function mountEditor({ mount, blocks, onChange, placeholder, autoFocus = false }) {
  const root = document.createElement('div');
  root.className = 'beditor';
  mount.appendChild(root);

  let model = blocks.map(b => ({ ...b }));
  let focusId = null;
  let focusOff = 0;

  /* ---------- persistence ---------- */
  const pushOut = debounce(() => {
    onChange(model.map(b => ({ ...b })));
  }, 420);

  function onChangeImmediate() { pushOut.cancel(); onChange(model.map(b => ({ ...b }))); }

  const syncBlockEl = (el) => {
    const blkEl = el.closest?.('.blk');
    const b = model.find(x => x.id === blkEl?.dataset.id);
    const bled = el.classList?.contains('bled') ? el : el.querySelector('.bled');
    if (b && bled) {
      b.html = bled.innerHTML;
      bled.classList.toggle('blank', isBlank(bled.innerHTML));
    }
    pushOut();
  };

  /* ---------- helpers ---------- */

  const bledOf = (id) =>
    root.querySelector(`.blk[data-id="${id}"] > .bled, .blk[data-id="${id}"] > div > .bled`);

  const isBlank = (html) =>
    !html || /^(\s|<br\s*\/?>)*$/i.test(String(html).replace(/&nbsp;/g, ' '));

  /** ids hidden because an ancestor toggle above them is collapsed */
  function computeHidden() {
    const hidden = new Set();
    const stack = []; // {indent} of open+collapsed toggles
    for (const b of model) {
      while (stack.length && stack[stack.length - 1] >= b.indent) stack.pop();
      const covered = stack.length > 0;
      if (covered) hidden.add(b.id);
      if (b.type === 'toggle' && b.collapsed && !covered) stack.push(b.indent ?? 0);
    }
    return hidden;
  }

  /* ---------- rendering ---------- */

  function blockChrome(b) {
    switch (b.type) {
      case 'todo':
        return `<input type="checkbox" tabindex="-1" ${b.checked ? 'checked' : ''} aria-label="Toggle task">`;
      case 'toggle':
        return `<button class="tg-chevron ${b.collapsed ? 'closed' : ''}" tabindex="-1" aria-label="Toggle section">${ico('chev', 12)}</button>`;
      case 'ul':
        return '<span ul-marker></span>';
      case 'ol':
        return '<span ol-marker></span>';
      case 'callout':
        return `<span class="co-icon">${b.icon || '💡'}</span>`;
      case 'divider':
        return '';
      case 'image':
        return '';
      default:
        return '';
    }
  }

  function buildEditable(blk, b, i) {
    const ed = document.createElement('div');
    ed.className = 'bled';
    ed.contentEditable = 'true';
    ed.spellcheck = true;
    ed.innerHTML = b.html || '';
    if (isBlank(b.html)) ed.classList.add('blank');

    let showPh = '';
    if (i === 0 && isBlank(b.html)) showPh = placeholder || "Write something, or press '/' for commands";
    else if (b.type === 'toggle') showPh = isBlank(b.html) ? 'Toggle title' : '';
    else if (LISTY.has(b.type) && isBlank(b.html)) showPh = 'List item';
    else if (b.type === 'image') showPh = isBlank(b.html) ? 'Write a caption…' : '';
    if (showPh) blk.dataset.ph = showPh;
    blk.appendChild(ed);
    return ed;
  }

  function buildTable(blk, b) {
    const wrap = document.createElement('div');
    wrap.className = 'tbl-wrap';
    const rows = b.rows?.length ? b.rows : [['', ''], ['', ''], ['', '']];
    const table = document.createElement('table');
    table.className = 'btbl';
    rows.forEach((r, ri) => {
      const tr = document.createElement('tr');
      r.forEach((c, ci) => {
        const td = document.createElement(ri === 0 ? 'th' : 'td');
        td.className = 'tcell';
        td.contentEditable = 'true';
        td.dataset.r = ri;
        td.dataset.c = ci;
        td.innerHTML = c || '';
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    wrap.appendChild(table);

    const tools = document.createElement('span');
    tools.className = 'tbl-tools';
    tools.innerHTML = `
      <button data-t="r+" title="Add row">${ico('plus', 11)}</button>
      <button data-t="c+" title="Add column">${ico('plus', 11)}</button>
      <button data-t="r-" title="Delete row">${ico('minus', 11)}</button>
      <button data-t="c-" title="Delete column">${ico('minus', 11)}</button>`;
    wrap.appendChild(tools);

    blk.appendChild(wrap);

    tools.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-t]');
      if (!btn) return;
      e.stopPropagation();
      const t = btn.dataset.t;
      if (t === 'r+') b.rows.push(new Array(b.rows[0].length).fill(''));
      if (t === 'c+') b.rows.forEach(r => r.push(''));
      if (t === 'r-' && b.rows.length > 1) b.rows.pop();
      if (t === 'c-' && b.rows[0].length > 1) b.rows.forEach(r => r.pop());
      render(); pushOut();
    });

    // keep model in sync while typing in any cell
    wrap.addEventListener('input', (e) => {
      if (!e.target.classList?.contains('tcell')) return;
      const r = +e.target.dataset.r, c = +e.target.dataset.c;
      if (b.rows[r]) b.rows[r][c] = e.target.innerHTML;
      pushOut();
    });
    wrap.addEventListener('keydown', (e) => {
      if (!e.target.classList?.contains('tcell')) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        const cells = [...wrap.querySelectorAll('.tcell')];
        const i = cells.indexOf(e.target);
        const next = cells[e.key === 'Tab' && !e.shiftKey ? i + 1 : i - 1];
        if (next) { next.focus(); placeCaretEnd(next); }
      }
      if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
    });
    wrap.addEventListener('paste', (e) => {
      if (!e.target.classList?.contains('tcell')) return;
      e.preventDefault();
      const text = (e.clipboardData.getData('text/plain') || '').replace(/\n+/g, ' ');
      document.execCommand('insertText', false, text);
    });
  }

  function buildImage(blk, b) {
    const wrap = document.createElement('div');
    wrap.className = 'img-wrap';
    if (b.src) {
      const img = document.createElement('img');
      img.src = b.src;
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = () => wrap.classList.add('img-broken');
      wrap.appendChild(img);
    } else {
      wrap.classList.add('img-broken');
    }
    blk.appendChild(wrap);
  }

  function render() {
    const hidden = computeHidden();
    root.innerHTML = '';

    model.forEach((b, i) => {
      const blk = document.createElement('div');
      blk.className = `blk t-${b.type}` +
        (b.type === 'todo' && b.checked ? ' checked' : '') +
        (hidden.has(b.id) ? ' blk-hidden' : '');
      blk.dataset.id = b.id;
      if (b.indent) blk.setAttribute('indent', String(b.indent));

      const grip = document.createElement('button');
      grip.className = 'blk-grip';
      grip.title = 'Click to edit block · drag not needed';
      grip.innerHTML = ico('dots', 13);
      grip.tabIndex = -1;
      grip.addEventListener('click', (e) => { e.stopPropagation(); blockMenu(grip, b); });
      blk.appendChild(grip);

      if (b.type === 'divider') {
        blk.insertAdjacentHTML('beforeend', '<hr>');
        root.appendChild(blk);
        return;
      }
      if (b.type === 'table') {
        buildTable(blk, b);
        root.appendChild(blk);
        return;
      }

      blk.insertAdjacentHTML('beforeend', blockChrome(b));

      if (b.type === 'image') {
        buildImage(blk, b);
        const cap = buildEditable(blk, b, -1);
        void cap;
      } else if (b.type === 'callout' || b.type === 'code') {
        const wrapDiv = document.createElement('div');
        wrapDiv.style.flex = '1';
        if (b.type === 'code') wrapDiv.insertAdjacentHTML('afterbegin', '<span class="code-lang">code</span>');
        blk.querySelector('.co-icon') ? blk.appendChild(wrapDiv) : blk.appendChild(wrapDiv);
        wrapDiv.appendChild(buildEditable(blk, b, -1));
      } else {
        blk.appendChild(buildEditable(blk, b, i));
      }

      root.appendChild(blk);
    });

    if (focusId) {
      const el = bledOf(focusId);
      if (el && !el.closest('.blk-hidden')) {
        el.focus();
        try { setCaretOffset(el, focusOff); } catch { placeCaretEnd(el); }
        el.scrollIntoView({ block: 'nearest' });
      }
      focusId = null;
    } else if (autoFocus && model.length) {
      root.querySelector('.blk:not(.blk-hidden) .bled')?.focus();
    }
  }

  /* ---------- slash menu ---------- */

  let slash = null;   // { id, baseOff, query }
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

  const slashFilteredItems = () => {
    const q = (slash?.query || '').toLowerCase().trim();
    return SLASH_ITEMS.filter(it => !q || it.label.toLowerCase().includes(q) || it.t.includes(q));
  };

  function closeSlash() {
    slash = null;
    slashEl?.remove();
    slashEl = null;
    slashSel = 0;
  }

  function applySlash(type) {
    if (!slash) return;
    const { id, query } = slash;
    const b = model.find(x => x.id === id);
    closeSlash();
    if (!b) return;

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
    } else if (type === 'image') {
      promptForImageUrl((url) => {
        if (!url) return;
        const idx = model.findIndex(x => x.id === id);
        const imgBlk = { id: uid('b'), type: 'image', html: '', src: url, indent: 0 };
        if (isBlank(b.html)) model.splice(idx, 1, imgBlk);
        else model.splice(idx + 1, 0, imgBlk);
        focusId = null;
        render(); pushOut(); onChangeImmediate();
      });
      return; // re-render happens after the modal resolves
    } else if (type === 'table') {
      b.type = 'table';
      b.rows = [['', ''], ['', ''], ['', '']];
      focusId = null;
    } else {
      b.type = type;
      if (type !== 'callout') delete b.icon;
      focusId = id; focusOff = Math.max(0, bled ? bled.textContent.length : 0);
    }
    render(); pushOut(); onChangeImmediate();
  }

  function promptForImageUrl(cb) {
    import('./ui.js').then(({ openModal }) => {
      openModal((modal, close) => {
        modal.innerHTML = `
          <div class="modal-head" style="padding-bottom:10px">
            ${ico('doc', 15)}<span class="caps">Embed image</span>
          </div>
          <div style="padding:6px 18px">
            <input class="input" data-url placeholder="https://…/picture.jpg"
              style="height:38px;border-radius:10px;font-size:13px" spellcheck="false"/>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px 16px">
            <button class="btn ghost" data-x>Cancel</button>
            <button class="btn primary" data-ok disabled>Embed</button>
          </div>`;
        const inp = modal.querySelector('[data-url]');
        const ok = modal.querySelector('[data-ok]');
        setTimeout(() => inp.focus(), 40);
        inp.addEventListener('input', () => { ok.disabled = !inp.value.trim(); });
        const done = () => { const v = inp.value.trim(); close(); cb(v); };
        ok.onclick = done;
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && inp.value.trim()) done();
        });
        modal.querySelector('[data-x]').onclick = close;
      }, { width: 480 });
    });
  }

  /* ---------- block handle menu ---------- */

  function blockMenu(anchor, b) {
    const idx = model.findIndex(x => x.id === b.id);
    const canTurnInto = !['image'].includes(b.type);
    const items = [];
    if (canTurnInto) {
      items.push({ header: 'Turn into' });
      for (const it of SLASH_ITEMS.filter(x => !['image', 'table', 'divider'].includes(x.t))) {
        items.push({ value: 'into:' + it.t, label: it.label, icon: ico(it.icon, 13), checked: b.type === it.t });
      }
      items.push({ sep: true });
    }
    items.push(
      { value: 'dup', label: 'Duplicate', icon: ico('copy', 14) },
      { value: 'up', label: 'Move up', icon: ico('up', 14) },
      { value: 'down', label: 'Move down', icon: ico('down', 14) },
      { sep: true },
      { value: 'del', label: 'Delete', icon: ico('trash', 14), danger: true },
    );

    openMenu({
      anchor, minWidth: 190,
      onSelect: (v) => {
        const i = model.findIndex(x => x.id === b.id);
        if (v.startsWith('into:')) {
          const t = v.slice(5);
          if (b.type === 'table' && t !== 'table') delete b.rows;
          if (t === 'toggle') b.collapsed = false;
          if (b.type === 'table') { b.type = t; b.html = ''; delete b.rows; }
          else b.type = t;
          if (t === 'todo') b.checked = !!b.checked;
          focusId = b.id; focusOff = 0;
        }
        if (v === 'dup') {
          const copy = JSON.parse(JSON.stringify(b));
          copy.id = uid('b');
          model.splice(i + 1, 0, copy);
          focusId = copy.id; focusOff = 99999;
        }
        if (v === 'up' && i > 0) {
          model.splice(i - 1, 0, model.splice(i, 1)[0]);
          focusId = b.id; focusOff = 99999;
        }
        if (v === 'down' && i < model.length - 1) {
          model.splice(i + 1, 0, model.splice(i, 1)[0]);
          focusId = b.id; focusOff = 0;
        }
        if (v === 'del') {
          model.splice(i, 1);
          if (!model.some(x => x.type !== 'divider')) {
            model.unshift({ id: uid('b'), type: 'p', html: '', indent: 0 });
          }
          const nxt = model[i] || model[model.length - 1];
          focusId = nxt?.id ?? null; focusOff = 0;
        }
        render(); pushOut(); onChangeImmediate();
      },
    });
  }

  /* ---------- editing operations ---------- */

  const curBlkEl = (node) => node.closest?.('.blk');
  const curBled = (node) =>
    node.closest?.('.bled') || curBlkEl(node)?.querySelector('.bled');

  function focusNextAfter(id, off) {
    const idx = model.findIndex(b => b.id === id);
    const next = model[idx + 1] || model[idx - 1];
    if (next) { focusId = next.id; focusOff = off; }
  }

  function setType(b, type) {
    b.type = type;
    if (type !== 'todo') delete b.checked;
    if (type === 'toggle') b.collapsed = false;
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

    // Enter at the end of a toggle title creates a child inside it
    if (b.type === 'toggle' && off >= text.length) {
      b.html = before;
      model.splice(idx + 1, 0, { id: uid('b'), type: 'p', html: '', indent: (b.indent || 0) + 1 });
      focusId = model[idx + 1].id; focusOff = 0;
      render(); pushOut();
      return;
    }

    b.html = before;
    const carry = LISTY.has(b.type) ? b.type : 'p';
    const nb = { id: uid('b'), type: carry, html: esc(after), indent: b.indent };
    if (carry === 'todo') nb.checked = false;
    model.splice(idx + 1, 0, nb);
    focusId = nb.id; focusOff = 0;
    render(); pushOut();
  }

  function mergeBack(b, bled) {
    const idx = model.findIndex(x => x.id === b.id);
    if (idx === 0) {
      if (b.type !== 'p' && !NO_INDENT.has(b.type)) { setType(b, 'p'); focusId = b.id; render(); pushOut(); }
      return;
    }
    const prev = model[idx - 1];
    if (prev.type === 'divider' || prev.type === 'image' || prev.type === 'table') {
      model.splice(idx - 1, 1); focusId = b.id; focusOff = 0; render(); pushOut(); return;
    }
    if (LISTY.has(b.type)) {
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
    if (NO_INDENT.has(b.type)) return false;
    const next = clamp((b.indent || 0) + dir, 0, 3);
    if (next === b.indent) return false;
    b.indent = next;
    render(); pushOut();
    return true;
  }

  /* ---------- events ---------- */

  root.addEventListener('input', (e) => {
    if (e.target.classList?.contains('tcell')) return; // tables handle themselves
    const bled = curBled(e.target);
    if (!bled) return;
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
    if (e.target.classList?.contains('tcell')) return; // table nav handled locally

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
      if (/^-{3}$/.test(bled.textContent)) {
        b.type = 'divider'; b.html = '';
        const idx = model.findIndex(x => x.id === b.id);
        model.splice(idx + 1, 0, { id: uid('b'), type: 'p', html: '', indent: 0 });
        focusNextAfter(b.id, 0);
        render(); pushOut();
        return;
      }
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
      if (!sel.isCollapsed || off !== 0) return;
      e.preventDefault();
      if ((b.indent || 0) > 0) { indent(b, -1); return; }
      if (b.type === 'image' && isBlank(b.html)) {
        const i = model.findIndex(x => x.id === b.id);
        model.splice(i, 1, { id: uid('b'), type: 'p', html: '', indent: 0 });
        focusId = b.id; focusOff = 0;
        render(); pushOut();
        return;
      }
      if (b.type !== 'p' && !['image', 'table'].includes(b.type)) {
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
      // move to nearest visible editable in direction
      const all = [...root.querySelectorAll('.blk:not(.blk-hidden)')]
        .filter(x => x.querySelector('.bled'));
      const i = all.indexOf(blkEl);
      const target = all[e.key === 'ArrowUp' ? i - 1 : i + 1];
      if (!target) return;
      e.preventDefault();
      const tb = model.find(x => x.id === target.dataset.id);
      if (!tb || tb.type === 'divider') return;
      focusId = tb.id;
      focusOff = e.key === 'ArrowUp'
        ? (bledOf(tb.id)?.textContent.length || 0)
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
    if (e.target.matches('.blk > input[type="checkbox"]')) {
      const blkEl = curBlkEl(e.target);
      const b = model.find(x => x.id === blkEl.dataset.id);
      if (!b) return;
      b.checked = e.target.checked;
      blkEl.classList.toggle('checked', !!b.checked);
      pushOut();
    }
    if (e.target.classList?.contains('tg-chevron') === false) return;
  });

  // toggle collapse
  root.addEventListener('click', (e) => {
    const chev = e.target.closest('.tg-chevron');
    if (chev) {
      const blkEl = chev.closest('.blk');
      const b = model.find(x => x.id === blkEl.dataset.id);
      if (!b) return;
      b.collapsed = !b.collapsed;
      render(); pushOut();
      return;
    }
    if (e.target.tagName === 'IMG' && e.target.closest('.img-wrap')) {
      // click broken/normal image → replace source
      const blkEl = e.target.closest('.blk');
      const b = model.find(x => x.id === blkEl.dataset.id);
      if (b) promptForImageUrl((url) => {
        if (!url) return;
        b.src = url;
        render(); pushOut(); onChangeImmediate();
      });
    }
  });

  root.addEventListener('paste', (e) => {
    const bled = curBled(e.target);
    if (!bled) return;
    e.preventDefault();
    const blkEl = curBlkEl(e.target);
    const b = model.find(x => x.id === blkEl.dataset.id);
    const text = (e.clipboardData.getData('text/plain') || '').replace(/\r/g, '');
    if (!text.includes('\n')) {
      document.execCommand('insertText', false, text);
      syncBlockEl(bled);
      return;
    }
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    bled.textContent += lines[0];
    b.html = cleanInline(bled.innerHTML);
    let lastId = b.id;
    const idx = model.findIndex(x => x.id === b.id);
    const rest = lines.slice(1).map((line) => {
      const isBullet = /^[-*]\s+/.test(line);
      const nb = { id: uid('b'), type: isBullet ? 'ul' : 'p', html: esc(line.replace(/^[-*]\s+/, '')), indent: 0 };
      lastId = nb.id;
      return nb;
    });
    model.splice(idx + 1, 0, ...rest);
    focusId = lastId; focusOff = 99999;
    render(); pushOut();
  });

  root.addEventListener('focusin', (e) => {
    if (curBled(e.target)) closeSlash();
  });

  root.addEventListener('blur', (e) => {
    const bled = curBled(e.target);
    if (bled) syncBlockEl(bled);
  }, true);

  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.bled') || e.target.closest('input') || e.target.closest('.tbl-tools') || e.target.closest('.tg-chevron') || e.target.closest('.blk-grip')) return;
    if (e.target.tagName === 'HR' || e.target.tagName === 'TD' || e.target.tagName === 'TH' || e.target.tagName === 'IMG') return;
    const blk = e.target.closest('.blk');
    if (!blk || blk.classList.contains('blk-hidden')) return;
    const ed = blk.querySelector('.bled');
    if (ed) { e.preventDefault(); placeCaretEnd(ed); ed.focus(); }
  });

  render();

  return {
    destroy() { pushOut.cancel(); root.remove(); },
    flush() { pushOut.flush(); },
    focus() { const f = root.querySelector('.bled'); f?.focus(); },
    el: root,
  };
}
