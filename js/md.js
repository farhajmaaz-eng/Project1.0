/* ---------------------------------------------------------------------------
   Tessera · md — tiny markdown renderer for assistant output.
   Escapes everything first, then re-adds a strict allowlist of formatting.
--------------------------------------------------------------------------- */

import { esc } from './util.js';

/** blocks (editor model) → markdown string, for page export */
export function blocksToMarkdown(blocks = [], title = '') {
  const out = [];
  if (title) out.push(`# ${title}`, '');
  let olCounter = 0;
  for (const b of blocks) {
    const text = (b.html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(b|strong)>/gi, '**')
      .replace(/<\/?(i|em)>/gi, '_')
      .replace(/<\/?(s|strike)>/gi, '~~')
      .replace(/<code>/g, '`').replace(/<\/code>/g, '`')
      .replace(/<[^>]+>/g, '');
    const t = text; // already entity-escaped in model; leave as-is for md
    switch (b.type) {
      case 'h1': out.push(`## ${t}`, ''); break;
      case 'h2': out.push(`### ${t}`, ''); break;
      case 'h3': out.push(`#### ${t}`, ''); break;
      case 'ul': out.push(`${'  '.repeat(b.indent || 0)}- ${t}`); olCounter = 0; break;
      case 'ol': olCounter++; out.push(`${'  '.repeat(b.indent || 0)}${olCounter}. ${t}`); break;
      case 'todo': out.push(`${'  '.repeat(b.indent || 0)}- [${b.checked ? 'x' : ' '}] ${t}`); olCounter = 0; break;
      case 'quote': out.push(`> ${t}`, ''); break;
      case 'callout': out.push(`> ${b.icon || '💡'} **Note**`, `> ${t}`, ''); break;
      case 'code': out.push('```', b.html || '', '```', ''); break;
      case 'divider': out.push('---', ''); break;
      default:
        if (!t.trim() && !t.includes('<br')) { out.push(''); }
        else { out.push(t, ''); }
        olCounter = 0;
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function renderMarkdown(src = '') {
  // fenced code blocks first
  const blocks = [];
  let text = src.replace(/```(\w*)\n?([\s\S]*?)(?:```|$)/g, (_, lang, code) => {
    blocks.push({ lang, code });
    return `\u0000B${blocks.length - 1}\u0000`;
  });

  text = esc(text);

  // inline code
  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  // bold / italic / strike
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  text = text.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');
  text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  // links
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // block-level pass
  const lines = text.split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol'

  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  for (const raw of lines) {
    const line = raw;

    const bm = line.match(/^\u0000B(\d+)\u0000\s*$/);
    if (bm) {
      flushList();
      const b = blocks[+bm[1]];
      out.push(`<pre><code>${esc(b.code.replace(/\n$/, ''))}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      flushList();
      const level = Math.min(h[1].length + 1, 5);
      out.push(`<h${level}>${h[2]}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushList(); out.push('<hr>'); continue; }

    const q = line.match(/^&gt;\s?(.*)/);
    if (q) {
      flushList();
      out.push(`<blockquote>${q[1]}</blockquote>`);
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const want = ul ? 'ul' : 'ol';
      if (list !== want) { flushList(); out.push(`<${want}>`); list = want; }
      out.push(`<li>${(ul || ol)[1]}</li>`);
      continue;
    }

    flushList();
    if (line.trim() === '') continue;
    out.push(`<p>${line}</p>`);
  }
  flushList();

  let html = out.join('');
  // restore any code placeholders that ended up inline mid-paragraph
  html = html.replace(/\u0000B(\d+)\u0000/g, (_, n) => {
    const b = blocks[+n];
    return `<pre><code>${esc(b.code)}</code></pre>`;
  });
  return html;
}
