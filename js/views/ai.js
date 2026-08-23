/* ---------------------------------------------------------------------------
   Tessera · views/ai — OpenRouter-powered assistant.
   Streaming chat with optional workspace context. Key stays in localStorage;
   requests go browser → openrouter.ai directly.
--------------------------------------------------------------------------- */

import { esc, sleep } from './../util.js';
import { ico } from './../icons.js';
import {
  S, you, setSetting, setAI, pushMessage, status as statusOf,
  issueRef, project as projectOf,
} from './../store.js';
import { toast, openMenu } from './../ui.js';
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

function buildContext() {
  const s = S();
  const lines = [];
  lines.push(`User: ${you().name}. Workspace: ${s.settings.workspaceName}.`);
  if (s.projects.length) {
    lines.push(`Projects: ${s.projects.map(p => `${p.name}${p.description ? ` (${p.description.slice(0, 80)})` : ''}`).join('; ')}`);
  }
  const cyc = activeCycleInfo();
  if (cyc) lines.push(`Active cycle: ${cyc.name} (${cyc.startsAt} → ${cyc.endsAt})${cyc.goal ? `, goal: ${cyc.goal}` : ''}`);
  const open = s.issues.filter(i => !['done', 'canceled'].includes(i.status));
  if (open.length) {
    lines.push(`Open issues (${open.length}):`);
    for (const i of open.slice(0, 40)) {
      const pr = projectOf(i.project)?.name || '';
      lines.push(`- ${issueRef(i)} [${statusOf(i.status).name}|${i.priority}] ${i.title || '(untitled)'}${pr ? ` — ${pr}` : ''}${i.due ? `, due ${i.due}` : ''}`);
    }
    if (open.length > 40) lines.push(`…and ${open.length - 40} more`);
  }
  const docs = s.docs.slice(-10);
  if (docs.length) lines.push(`Recent pages: ${docs.map(d => d.title || 'Untitled').join('; ')}`);
  return lines.join('\n');
}

function activeCycleInfo() {
  const now = new Date().toISOString().slice(0, 10);
  return S().cycles.find(c => c.startsAt <= now && c.endsAt >= now) || null;
}

function systemPrompt(useContext) {
  let p = 'You are Tessera\u2019s assistant, embedded in a personal issue tracker + docs workspace. ';
  p += 'Be concise, concrete and practical. Prefer markdown with short lists. ';
  p += 'When asked to plan or break work down, suggest issues with clear titles and acceptance criteria. ';
  p += 'Never invent issues that were not listed in the context.';
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
  shell.querySelector('[data-model]').onclick = (e) => pickModel(e.currentTarget);
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
        <span class="msg-avatar avatar" style="background:${S().members.find(m => m.you)?.color || '#d9a05b'}">${initials()}</span>`;
    } else {
      wrap.innerHTML = `
        <span class="msg-avatar">${ico('sparkles', 14)}</span>
        <div class="msg-body-ai">
          <div class="md" data-md>${renderMarkdown(content)}${streamingNow ? '<span class="stream-cursor"></span>' : ''}</div>
          ${!streamingNow ? `
          <div class="msg-meta">
            <button class="icon-btn" data-copy title="Copy" style="width:22px;height:22px">${ico('copy', 12)}</button>
          </div>` : ''}
        </div>`;
      wrap.querySelector('[data-copy]')?.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => toast('Copied'));
      });
    }
    threadEl.appendChild(wrap);
    return wrap;
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
        mdHost.innerHTML = renderMarkdown(acc) + '<span class="stream-cursor"></span>';
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
        if (!acc) mdHost.innerHTML = '<span class="stream-cursor"></span>';
        acc += delta;
        paintStream();
      }
      pushMessage('assistant', acc || '(empty response)');
      holder.remove();
      appendMsg('assistant', acc);
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

  /* model picker */
  async function pickModel(anchor) {
    const st = S();
    const cached = st.ai.modelsCache;
    let items = CURATED_MODELS.map(m => ({
      value: m.id, label: m.label, checked: m.id === st.ai.model,
    }));
    items.push({ sep: true });
    items.push({
      value: '__refresh__', label: cached ? `Refresh catalog (${cached.length})` : 'Load full catalog',
      icon: ico('rotate', 13),
    });
    if (cached) {
      const extra = cached.filter(id => !CURATED_MODELS.some(c => c.id === id));
      if (extra.length) {
        items.push({ header: 'All models' });
        for (const id of extra) items.push({ value: id, label: id, checked: id === st.ai.model });
      }
    }

    openMenu({
      anchor, minWidth: 250, maxHeight: 320,
      items,
      onSelect: async (v) => {
        if (v === '__refresh__') {
          toast('Loading models…');
          try {
            const all = await listModels(st.settings.openrouterKey);
            setAI({ modelsCache: all });
            toast(`${all.length} models available`);
          } catch (err) {
            toast(err.message);
          }
          return;
        }
        setAI({ model: v });
        shell.querySelector('[data-model] span').textContent = shortModel(v);
      },
    });
  }

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
