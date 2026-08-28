/* ---------------------------------------------------------------------------
   Tessera · views/ai — OpenRouter-powered assistant.
   Streaming chat with optional workspace context. Key stays in localStorage;
   requests go browser → openrouter.ai directly.
--------------------------------------------------------------------------- */

import { esc, htmlToText } from './../util.js';
import { ico } from './../icons.js';
import {
  S, you, setSetting, setAI, pushMessage, emit, status as statusOf,
  issueRef, project as projectOf, docPath,
} from './../store.js';
import { toast } from './../ui.js';
import { renderMarkdown } from './../md.js';
import { CURATED_MODELS, chatStream, testKey, listModels } from './../openrouter.js';

let streaming = null; // AbortController while a completion is running

export function renderAI(view) {
  const s = S();

  view.innerHTML = `<div class="view-inner"><div class="ai-shell" data-shell></div></div>`;
  const shell = view.querySelector('[data-shell]');

  if (!s.settings.openrouterKey) {
    renderSetup(shell);
    return;
  }
  renderChat(shell);
}

/* ---------------- setup panel ---------------- */

function renderSetup(shell) {
  shell.innerHTML = `
    <div style="display:flex;align-items:center;gap:9px;padding:6px 0 16px">
      <h1>Assistant</h1>
    </div>
    <div class="ai-setup">
      <div class="ai-orb">${ico('sparkles', 24)}</div>
      <h2>Connect an assistant</h2>
      <p>
        Paste an OpenRouter API key and every model on their shelf — GPT, Claude,
        Gemini, Llama, DeepSeek — becomes your planning partner. Streaming,
        markdown-aware, and aware of your workspace when you want it to be.
      </p>
      <div class="ai-key-row">
        <input class="input" data-key type="password" placeholder="sk-or-v1-…" autocomplete="off" spellcheck="false"/>
        <button class="btn primary lg" data-save>Connect</button>
      </div>
      <p class="small-print">
        Stored only in this browser's localStorage · requests go straight to
        openrouter.ai · get a key at
        <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">openrouter.ai/settings/keys</a>
      </p>
    </div>`;

  const inp = shell.querySelector('[data-key]');
  setTimeout(() => inp.focus(), 60);
  const save = () => {
    const key = inp.value.trim();
    if (!key) return;
    setSetting('openrouterKey', key);
    toast('Assistant connected');
    import('./../main.js').then(m => m.applyThemeFromSettings());
  };
  shell.querySelector('[data-save]').onclick = save;
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}

/* ---------------- chat ---------------- */

function docBodyText(d) {
  return (d.blocks || []).map(b => {
    if (b.type === 'table' && Array.isArray(b.rows)) {
      return b.rows.map(r => r.map(c => htmlToText(c)).join(' | ')).join('\n');
    }
    if (b.type === 'divider') return '';
    return htmlToText(b.html || '');
  }).filter(Boolean).join('\n').trim();
}

function buildContext() {
  const s = S();
  const lines = [];
  lines.push(`User: ${you().name}. Workspace: ${s.settings.workspaceName}.`);
  if (s.projects.length) {
    lines.push(`Projects: ${s.projects.map(p => `${p.name}${p.description ? ` (${p.description.slice(0, 80)})` : ''}`).join('; ')}`);
  }
  const cyc = activeCycleInfo();
  if (cyc) lines.push(`Active cycle: ${cyc.name} (${cyc.startsAt} → ${cyc.endsAt})${cyc.goal ? `, goal: ${cyc.goal}` : ''}`);

  /* issues — with descriptions so the assistant can actually read them */
  const open = s.issues.filter(i => !['done', 'canceled'].includes(i.status));
  const recentDone = s.issues.filter(i => i.status === 'done')
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  if (open.length || recentDone.length) {
    lines.push('', 'ISSUES');
    for (const i of open.slice(0, 30)) {
      const pr = projectOf(i.project)?.name || '';
      const desc = (i.blocks || []).map(b => htmlToText(b.html)).join(' ').replace(/\s+/g, ' ').trim().slice(0, 260);
      lines.push(`- ${issueRef(i)} [${statusOf(i.status).name}|${i.priority}] ${i.title || '(untitled)'}`
        + `${pr ? ` — ${pr}` : ''}${i.due ? `, due ${i.due}` : ''}`
        + (desc ? `\n  ${desc}` : ''));
    }
    if (open.length > 30) lines.push(`…and ${open.length - 30} more open issues`);
    if (recentDone.length) {
      lines.push(`Recently completed: ${recentDone.map(i => issueRef(i) + ' ' + (i.title || '')).join('; ')}`);
    }
  }

  /* documents — full contents, budgeted */
  const docs = s.docs
    .filter(d => !d.trashed)
    .filter(d => d.blocks.some(b => htmlToText(b.html).trim()) || (d.blocks || []).some(b => b.type === 'table'))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (docs.length) {
    lines.push('', 'DOCUMENTS (current full text)');
    const perDoc = Math.max(500, Math.floor(14000 / docs.length));
    let used = 0, shown = 0;
    for (const d of docs) {
      if (used > 15000) { lines.push(`…${docs.length - shown} more documents omitted for length.`); break; }
      const path = docPath(d.id).map(x => x.title || 'Untitled').join(' / ');
      let body = docBodyText(d);
      if (!body) body = '(empty page)';
      if (body.length > perDoc) body = body.slice(0, perDoc) + ' …(truncated)';
      lines.push(`\n### ${path}\n${body}`);
      used += body.length; shown++;
    }
  }
  return lines.join('\n');
}

function activeCycleInfo() {
  const now = new Date().toISOString().slice(0, 10);
  return S().cycles.find(c => c.startsAt <= now && c.endsAt >= now) || null;
}

/* Some models (Qwen-style templates especially) hallucinate tool-call tokens.
   We provide no tools — strip any such artifacts out of the stream. */
const TOOL_PATTERNS = [
  /<\|[a-z_]+(?:\|[^|>]*)?>/gi,                       // <|tool_call_start|>, <|im_end|>…
  /<tool_call[^>]*>[\s\S]*?<\/tool_call>/gi,          // <tool_call>{json}</tool_call>
  /<\/?(?:tool_response|function_call|function_result)[^>]*>/gi,
  /\[(?:read|write|edit|search|list_files|read_file|open_file|get_file|run)\([^\]\n]{0,240}\)\]/gi,
];
export function sanitizeAIText(s = '') {
  for (const p of TOOL_PATTERNS) s = s.replace(p, '');
  return s;
}
/** stream-safe: also hides a trailing fragment that could be a half-arrived tag */
function cleanForDisplay(raw = '') {
  let s = sanitizeAIText(raw);
  s = s.replace(/\[[^\]\n]{0,80}\([^)\]]*$/, ''); // dangling [read(path='…
  const m = s.match(/(?:<[^<>]{0,60}|<\|[^|]{0,40})$/);
  if (m) s = s.slice(0, m.index);
  return s;
}

function systemPrompt(useContext) {
  let p = 'You are Tessera\u2019s assistant, embedded in a personal issue tracker + docs workspace. ';
  p += 'Be concise, concrete and practical. Prefer markdown with short lists. ';
  p += 'When asked to plan or break work down, suggest issues with clear titles and acceptance criteria. ';
  p += '\n\nIMPORTANT RULES:';
  p += '\n1. You have NO tools, NO file access and NO function calling. Never emit tool-call syntax of any kind';
  p += ' — no <|tool_call_start|>, no <tool_call>, no [read(...)] style markers. Answer in plain markdown only.';
  p += '\n2. When WORKSPACE CONTEXT is provided it contains the user\u2019s real issues and the current text of their documents.';
  p += ' Treat it as ground truth: quote real issue keys (e.g. KES-3), real page titles and real details from it.';
  p += ' If something is not in the context, say you don\u2019t have it rather than inventing it.';
  p += '\n3. To change data, describe exactly what to change — the user applies edits in the app.';
  if (useContext) p += '\n\nWORKSPACE CONTEXT\n' + buildContext();
  return p;
}

function renderChat(shell) {
  const s = S();
  const thread = s.ai.thread;

  shell.innerHTML = `
    <header class="ai-head">
      <h1>Assistant</h1>
      <button class="chip clickable" data-model>${ico('bot', 12)}<span>${esc(shortModel(s.ai.model))}</span></button>
      <label class="switch" title="Include workspace context">
        <input type="checkbox" data-ctx ${s.ai.useContext ? 'checked' : ''}/><i></i>
      </label>
      <span class="faint small">context</span>
      <button class="icon-btn" data-newchat title="New chat">${ico('plus', 16)}</button>
    </header>

    <div class="ai-thread" data-thread></div>
    <div class="ai-suggest" data-suggest></div>

    <div class="ai-composer">
      <textarea rows="1" data-input placeholder="Ask anything — “plan my week”, “break down auth flow”…"></textarea>
      <div class="ai-comp-foot">
        <span class="hint faint small mono">${navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+↵ to send</span>
        <button class="send-btn" data-send ${streaming ? '' : ''}>${ico('send', 15)}</button>
      </div>
    </div>`;

  const threadEl = shell.querySelector('[data-thread]');
  const input = shell.querySelector('[data-input]');
  const sendBtn = shell.querySelector('[data-send]');
  const suggestEl = shell.querySelector('[data-suggest]');

  /* header controls */
  shell.querySelector('[data-model]').onclick = () => openModelPicker({
    onPick: (id) => {
      setAI({ model: id });
      shell.querySelector('[data-model] span').textContent = shortModel(id);
    },
  });
  shell.querySelector('[data-newchat]').onclick = async () => {
    if (thread.length && !confirmClear()) return;
    stopStreaming();
    setAI({ thread: [] });
    paintThread();
  };
  shell.querySelector('[data-ctx]').addEventListener('change', (e) =>
    setAI({ useContext: e.target.checked }));

  /* suggestions */
  const SUGGESTIONS = [
    ['zap', 'Summarize my open issues'],
    ['target', 'Plan my next week'],
    ['doc', 'Draft a launch checklist'],
    ['board', 'Break down "user authentication" into tasks'],
  ];
  if (!thread.length) {
    suggestEl.innerHTML = SUGGESTIONS.map(([icn, t]) =>
      `<button class="sug-chip" data-q="${esc(t)}">${ico(icn, 13)}${esc(t)}</button>`).join('');
    suggestEl.querySelectorAll('[data-q]').forEach(b =>
      b.onclick = () => { input.value = b.dataset.q; input.dispatchEvent(new Event('input')); submit(); });
  }

  function paintThread() {
    const t = S().ai.thread;
    threadEl.innerHTML = '';
    if (!t.length && !streaming) {
      suggestEl.style.display = '';
    } else {
      suggestEl.style.display = 'none';
    }
    for (const m of t) appendMsg(m.role, m.content);
    scrollDown(true);
  }

  function appendMsg(role, content, streamingNow = false) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${role === 'user' ? 'user' : 'ai'}`;
    if (role === 'user') {
      wrap.innerHTML = `
        <div class="msg-body"><div class="bubble">${esc(content)}</div></div>
        <span class="msg-avatar avatar" style="background:${S().members.find(m => m.you)?.color || '#3ECF8E'}">${initials()}</span>`;
    } else {
      const isLast = !streamingNow
        && S().ai.thread.length
        && S().ai.thread[S().ai.thread.length - 1].content === content;
      wrap.innerHTML = `
        <span class="msg-avatar">${ico('sparkles', 14)}</span>
        <div class="msg-body-ai">
          <div class="md" data-md>${renderMarkdown(content)}${streamingNow ? '<span class="stream-cursor"></span>' : ''}</div>
          ${!streamingNow ? `
          <div class="msg-meta">
            <button class="icon-btn" data-copy title="Copy" style="width:22px;height:22px">${ico('copy', 12)}</button>
            ${isLast ? `<button class="icon-btn" data-regen title="Regenerate" style="width:22px;height:22px">${ico('rotate', 12)}</button>` : ''}
          </div>` : ''}
        </div>`;
      wrap.querySelector('[data-copy]')?.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => toast('Copied'));
      });
      wrap.querySelector('[data-regen]')?.addEventListener('click', () => regenerate());
    }
    threadEl.appendChild(wrap);
    return wrap;
  }

  /** drop the last assistant reply and ask again */
  function regenerate() {
    if (streaming) return;
    const t = S().ai.thread;
    if (!t.length || t[t.length - 1].role !== 'assistant') return;
    t.pop();
    emit();
    paintThread();
    runCompletion();
  }

  function initials() {
    return (you()?.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }
  function scrollDown(instant = false) {
    threadEl.scrollTop = threadEl.scrollHeight;
    if (instant) threadEl.parentElement.scrollTop = threadEl.parentElement.scrollHeight;
  }

  function setError(msg) {
    const old = threadEl.querySelector('.ai-error');
    if (old) old.remove();
    if (!msg) return;
    const div = document.createElement('div');
    div.className = 'ai-error';
    div.textContent = msg;
    threadEl.appendChild(div);
    scrollDown();
  }

  /* composer */
  const autosize = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 190) + 'px';
  };
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
  });
  sendBtn.onclick = () => streaming ? stopStreaming() : submit();

  function stopStreaming() {
    streaming?.abort();
    streaming = null;
  }

  async function submit() {
    const q = input.value.trim();
    if (!q || streaming) return;
    setError(null);
    input.value = ''; autosize();
    pushMessage('user', q);
    appendMsg('user', q);
    scrollDown();
    runCompletion();
  }

  /** streams a completion for the current thread (used by send + regenerate) */
  async function runCompletion() {
    if (streaming) return;

    const msgs = [
      { role: 'system', content: systemPrompt(S().ai.useContext) },
      ...S().ai.thread.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    ];

    // placeholder bubble
    const holder = appendMsg('assistant', '', true);
    const mdHost = holder.querySelector('[data-md]');
    mdHost.innerHTML = '<span class="faint small">thinking…</span>';
    scrollDown();

    streaming = new AbortController();
    sendBtn.classList.add('stop');
    sendBtn.innerHTML = ico('stop', 14);

    let acc = '';
    let framePending = false;
    const paintStream = () => {
      if (framePending) return;
      framePending = true;
      requestAnimationFrame(() => {
        mdHost.innerHTML = renderMarkdown(cleanForDisplay(acc)) + '<span class="stream-cursor"></span>';
        scrollDown();
        framePending = false;
      });
    };

    try {
      for await (const delta of chatStream({
        key: S().settings.openrouterKey,
        model: S().ai.model,
        messages: msgs,
        signal: streaming.signal,
      })) {
        acc += delta;
        paintStream();
      }
      const clean = sanitizeAIText(acc).trim() || '(empty response)';
      pushMessage('assistant', clean);
      holder.remove();
      appendMsg('assistant', clean);
      scrollDown();
    } catch (err) {
      if (err.name === 'AbortError') {
        if (acc.trim()) pushMessage('assistant', acc + ' …');
        holder.remove();
        appendMsg('assistant', acc ? acc + ' …' : '_Stopped._');
      } else {
        holder.remove();
        if (acc.trim()) { pushMessage('assistant', acc); appendMsg('assistant', acc); }
        setError(err.message + (String(err.message).includes('401')
          ? ' You can update the key in Settings → AI.' : ''));
      }
    } finally {
      streaming = null;
      sendBtn.classList.remove('stop');
      sendBtn.innerHTML = ico('send', 15);
      scrollDown();
    }
  }

  /* model picker — searchable, shared with Settings */
  async function pickModel() { /* replaced by openModelPicker */ }

  paintThread();
}

function shortModel(id = '') {
  const known = CURATED_MODELS.find(m => m.id === id);
  if (known) return id.split('/').pop();
  return id.split('/').pop() || id;
}

function confirmClear() {
  // lightweight inline confirm; avoids modal dependency loops
  return window.confirm('Clear this conversation?');
}

/* ---------------------------------------------------------------------------
   openModelPicker — searchable browser for the whole OpenRouter catalog.
   Used from the assistant header and from Settings → AI.
--------------------------------------------------------------------------- */

export function openModelPicker({ current, onPick } = {}) {
  current = current ?? S().ai.model;
  let sel = 0;
  let results = [];

  import('./../ui.js').then(({ openModal: om }) => {
    om((modal, close) => {
      modal.classList.remove('modal');
      modal.classList.add('palette');
      modal.innerHTML = `
        <div class="palette-input">
          ${ico('search', 16)}
          <input type="text" placeholder="Search models — try “sonnet”, “llama”, “free”…" autocomplete="off" spellcheck="false"/>
          <kbd>esc</kbd>
        </div>
        <div class="palette-list" data-list></div>
        <div class="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span style="margin-left:auto">catalog fetched live from OpenRouter</span>
        </div>`;

      const input = modal.querySelector('input');
      const listEl = modal.querySelector('[data-list]');
      setTimeout(() => input.focus(), 40);

      async function ensureCatalog() {
        if (S().ai.modelsCache) return S().ai.modelsCache;
        try {
          const all = await listModels(S().settings.openrouterKey);
          setAI({ modelsCache: all });
          return all;
        } catch {
          return null; // offline / bad key — curated still works
        }
      }

      function paint(q = '') {
        const query = q.trim().toLowerCase();
        const curated = CURATED_MODELS
          .filter(m => !query || m.label.toLowerCase().includes(query) || m.id.toLowerCase().includes(query))
          .map(m => ({ id: m.id, label: m.label, curated: true }));

        const cache = S().ai.modelsCache || [];
        const extra = cache
          .filter(id => !CURATED_MODELS.some(c => c.id === id))
          .filter(id => !query || id.toLowerCase().includes(query))
          .slice(0, query ? 40 : 25)
          .map(id => ({ id, label: '', curated: false }));

        // exact-id escape hatch
        const exactLooksLikeId = /^[a-z0-9_-]+\/[a-z0-9._:-]+$/i.test(q.trim()) &&
          !curated.some(m => m.id === q.trim()) && !extra.some(m => m.id === q.trim());
        if (exactLooksLikeId) extra.unshift({ id: q.trim(), label: 'use exactly', curated: false });

        results = [...curated, ...extra];
        sel = Math.min(sel, Math.max(0, results.length - 1));

        if (!results.length && !loading) {
          listEl.innerHTML = `<div class="palette-empty">No models match “${esc(q)}”.<br>Load failed? You can still type a full id like <b>vendor/model</b>.</div>`;
          return;
        }

        let html = '';
        let lastCurated = null;
        results.forEach((m, i) => {
          if (m.curated !== lastCurated) {
            html += `<div class="palette-group caps">${m.curated ? 'Curated' : 'All models'}</div>`;
            lastCurated = m.curated;
          }
          html += `
            <button class="pal-item ${i === sel ? 'sel' : ''}" data-i="${i}">
              ${m.id === current ? `<span class="mpick-check">${ico('check', 13)}</span>` : `<span style="width:13px"></span>`}
              <span class="mpick-id">${markId(m.id, query)}</span>
              ${m.label && m.label !== m.id ? `<span class="mpick-note">${esc(m.label)}</span>` : ''}
            </button>`;
        });
        if (loading) {
          html += `<div style="padding:10px 12px"><span class="faint small">${ico('rotate', 12)} loading full catalog…</span></div>`;
        }
        listEl.innerHTML = html;

        [...listEl.querySelectorAll('.pal-item')].forEach((btn) => {
          btn.onclick = () => pick(results[+btn.dataset.i]);
          btn.onpointerenter = () => {
            sel = +btn.dataset.i;
            [...listEl.querySelectorAll('.pal-item')].forEach(b2 => b2.classList.toggle('sel', b2 === btn));
          };
        });
        listEl.querySelector('.pal-item.sel')?.scrollIntoView({ block: 'nearest' });
      }

      function markId(id, query) {
        if (!query) return esc(id);
        const i = id.toLowerCase().indexOf(query);
        if (i === -1) return esc(id);
        return esc(id.slice(0, i)) + '<b>' + esc(id.slice(i, i + query.length)) + '</b>' + esc(id.slice(i + query.length));
      }

      function pick(m) {
        if (!m) return;
        setAI({ model: m.id });
        close();
        onPick?.(m.id);
      }

      input.addEventListener('input', () => { sel = 0; paint(input.value); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!results.length) return;
          sel = (sel + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length;
          [...listEl.querySelectorAll('.pal-item')].forEach((b, i) =>
            b.classList.toggle('sel', i === sel));
          listEl.querySelector('.pal-item.sel')?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          pick(results[sel]);
        }
      });

      let loading = true;
      paint();
      ensureCatalog().then(() => { loading = false; paint(input.value); });
    }, { width: 580 });
  });
}
