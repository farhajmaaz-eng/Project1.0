/* ---------------------------------------------------------------------------
   Tessera · openrouter — thin client for OpenRouter's chat completions API.
   The key lives in localStorage; requests go straight from this browser tab
   to openrouter.ai. Nothing touches a server we control (there isn't one).
--------------------------------------------------------------------------- */

export const DEFAULT_MODEL = 'openai/gpt-4o-mini';

/** curated defaults; the full catalog is fetched live when a key exists */
export const CURATED_MODELS = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini · fast, cheap' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku · fast' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
];

const BASE = 'https://openrouter.ai/api/v1';

function headers(key) {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': location.origin || 'https://tessera.local',
    'X-Title': 'Tessera',
  };
}

async function apiError(res) {
  let detail = '';
  try {
    const j = await res.json();
    detail = j?.error?.message || '';
  } catch { /* keep empty */ }
  if (res.status === 401) return new Error('That key was rejected (401). Check it in Settings → AI.');
  if (res.status === 402) return new Error('This key has no credits left on OpenRouter (402).');
  if (res.status === 429) return new Error('Rate limited (429). Wait a moment and try again.');
  return new Error(detail || `OpenRouter error ${res.status}`);
}

/** quick non-streaming call to validate a key + model */
export async function testKey(key, model = DEFAULT_MODEL) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({
      model,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  if (!res.ok) throw await apiError(res);
  await res.json();
  return true;
}

export async function listModels(key) {
  const res = await fetch(`${BASE}/models`, { headers: headers(key) });
  if (!res.ok) throw await apiError(res);
  const json = await res.json();
  return (json.data || [])
    .filter(m => !m.id.includes('/image') && m.context_length !== 0)
    .map(m => m.id)
    .sort();
}

/**
 * Yields text deltas from a streaming completion.
 * for await (const delta of chatStream({...})) { ... }
 */
export async function* chatStream({ key, model, messages, signal }) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(key),
    signal,
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!res.ok) throw await apiError(res);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });

    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch { /* partial or comment line — ignore */ }
    }
  }
}
