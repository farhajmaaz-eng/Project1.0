/* ---------------------------------------------------------------------------
   Tessera · icons — hand-drawn 24px stroke set + status/priority glyphs
--------------------------------------------------------------------------- */

const P = {
  home: 'M4 11l8-7 8 7M6.5 9.5V19a1 1 0 001 1h9a1 1 0 001-1V9.5',
  inbox: 'M4 13h4l1.5 2.5h5L16 13h4M4 13l2.2-7A1.6 1.6 0 017.7 5h8.6a1.6 1.6 0 011.5 1L20 13v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8c.8-3.2 3.5-5 7-5s6.2 1.8 7 5',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5',
  board: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v11h-4z',
  target: 'M12 21a9 9 0 110-18 9 9 0 010 18zm0-5a4 4 0 110-8 4 4 0 010 8zm0-3.2a.8.8 0 100-1.6.8.8 0 000 1.6z',
  doc: 'M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v4h4M9.5 12h5m-5 3.5h5',
  search: 'M10.5 17a6.5 6.5 0 110-13 6.5 6.5 0 010 13zM15.5 15.5L20 20',
  plus: 'M12 5.5v13M5.5 12h13',
  sliders: 'M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5v5M9 14.5v5',
  sun: 'M12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 2.5v2m0 15v2M2.5 12h2m15 0h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19',
  moon: 'M20 13.5A8 8 0 1110 3.3a7 7 0 0010 10.2z',
  chev: 'M9.5 6.5L15.5 12l-6 5.5',
  dots: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  trash: 'M5 7h14M9.5 7V5a1 1 0 011-1h3a1 1 0 011 1v2m3.5 0l-.8 12a1 1 0 01-1 .9H7.8a1 1 0 01-1-.9L6 7m4 4v5m4-5v5',
  copy: 'M9 9V6a2 2 0 012-2h7a2 2 0 012 2v7a2 2 0 01-2 2h-3M6 21h7a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2z',
  x: 'M6.5 6.5l11 11m0-11l-11 11',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  star: 'M12 3.8l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8 2.5-5z',
  calendar: 'M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1zm3-2.5V6m8-2.5V6M4 10.5h16',
  clock: 'M12 21a9 9 0 110-18 9 9 0 010 18zm0-13.5V12l3 2',
  tag: 'M4 4h7l9 9-7 7-9-9V4zm4.5 4.5h.01',
  msg: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H9l-5 4V6z',
  arrowLeft: 'M19 12H5m6-6.5L4.5 12 11 18.5',
  arrowRight: 'M5 12h14m-6-6.5L19.5 12 13 18.5',
  enter: 'M19 5.5v6a2 2 0 01-2 2H5.5M9 9.5L5 13.5 9 17.5',
  bold: 'M7 4.5h6a3.75 3.75 0 010 7.5H7zm0 7.5h6.75a3.75 3.75 0 010 7.5H7z',
  italic: 'M15.5 4.5h-6m5 15h-6M14 4.5l-4 15',
  under: 'M7 4.5v6.5a5 5 0 0010 0V4.5M5.5 20.5h13',
  strike: 'M7 5.5C7 4 8.5 3 11 3c3.5 0 5 1.5 5 3m-9.5 4h9.5M12 10v10m0 0c-3 0-5.5-1-6.5-2.8M12 20c2.6 0 4.6-.8 5.8-2.2',
  codeIc: 'M8.5 7.5L4 12l4.5 4.5m7-9L16 12l-4.5 4.5',
  listUl: 'M8.5 6H20M8.5 12H20M8.5 18H20M4 6h.01M4 12h.01M4 18h.01',
  listOl: 'M9.5 6H20M9.5 12H20M9.5 18H20M3.5 5l1.5-1v5M3.3 11.6c.2-.7.9-1.1 1.7-1 .8 0 1.5.5 1.5 1.2 0 1.2-3.2 1.7-3.2 3.7h3.4M3.5 17.5h2.6c.7 0 1.2.5 1.2 1.1s-.6 1.2-1.3 1.2c.8 0 1.4.5 1.4 1.2S6.8 22 6 22H3.5',
  sqCheck: 'M5 5.5h14v13H5zM8.5 12l2.4 2.4 4.6-4.8',
  quote: 'M5 15.5c0-4.5 2-7.5 5.5-9.5M5 15.5c0 1.5 1 2.5 2.5 2.5S10 17 10 15.5 9 13 7.5 13 5 14 5 15.5zm8.5 0c0-4.5 2-7.5 5.5-9.5m-5.5 9.5c0 1.5 1 2.5 2.5 2.5s2.5-1 2.5-2.5-1-2.5-2.5-2.5-2.5 1-2.5 2.5z',
  minus: 'M5 12h14',
  type: 'M5 7V4.5h14V7M12 4.5V19.5m-2.8 0h5.6',
  zap: 'M13 3L5 13.5h5L11 21l8-10.5h-5L13 3z',
  book: 'M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15zm0 15A2.5 2.5 0 006.5 23H20M8 7.5h8',
  alert: 'M12 21a9 9 0 110-18 9 9 0 010 18zm0-13.5V12m0 3.5h.01',
  filter: 'M4 6h16M7 12h10m-7 6h4',
  pen: 'M14.5 5.5l4 4L8 20l-4.5.5L4 16 14.5 5.5zm-1 1l4 4',
  rotate: 'M4.5 12a7.5 7.5 0 111.8 4.9M4.5 12V7.5M4.5 12H9',
  down: 'M12 5v13m-5.5-5.5L12 18l5.5-5.5',
  up: 'M12 19V6M6.5 11.5L12 6l5.5 5.5',
  grip: 'M9 6.5h.01M9 12h.01M9 17.5h.01M15 6.5h.01M15 12h.01M15 17.5h.01',
  sparkles: 'M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7L12 4zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15zM5.5 15.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7L3.2 18l1.7-.6.6-1.7z',
  bot: 'M9 3.5h6M12 3.5V6M8 6h8a3 3 0 013 3v7a3 3 0 01-3 3H8a3 3 0 01-3-3V9a3 3 0 013-3zm1.5 5h.01m4.99 0h.01M9.5 14.5c.7.6 1.55.9 2.5.9s1.8-.3 2.5-.9',
  send: 'M4.5 12L20 4.5l-4 15.5-4.2-5.8L4.5 12zm7.3 2.2L20 4.5',
  stop: 'M8 8h8v8H8z',
  key: 'M15.5 3.5a5 5 0 013.9 8.1l1.1 1.1v2.3h-2.3l-1.2-1.2A5 5 0 1115.5 3.5zm1 4a1 1 0 100.01 0zM13 11L4 20m3.5-3.5l2 2',
  logout: 'M14 4h5a1 1 0 011 1v14a1 1 0 01-1 1h-5m-6-12l-4 4 4 4M4 12h10',
  wand: 'M6 18L18 6l-1.5-1.5L4.5 16.5 6 18zM15 4l.6 1.6L17 6l-1.4.4L15 8l-.6-1.6L13 6l1.4-.4L15 4zM19 9l.5 1.3L21 11l-1.5.7L19 13l-.5-1.3L17 11l1.5-.7L19 9zM8 4l.5 1.3L10 6l-1.5.7L8 8l-.5-1.3L6 6l1.5-.7L8 4z',
};

export function ico(name, size = 15, cls = '') {
  const d = P[name] || P.dots;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true"><path d="${d}"/></svg>`;
}

/* ---------- status glyphs (Linear-style) ---------- */

function pie(fill, frac, size) {
  const r = 5.2, cx = 12, cy = 12;
  if (frac >= 1) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
  const a = frac * Math.PI * 2 - Math.PI / 2;
  const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
  const large = frac > 0.5 ? 1 : 0;
  return `<path d="M${cx} ${cy} L${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" fill="${fill}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${fill}" stroke-width="1.6"/>`;
}

export function statusIcon(statusId, color, size = 14) {
  const c = color || 'var(--text-3)';
  switch (statusId) {
    case 'backlog':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="5.2" stroke="${c}" stroke-width="1.7" stroke-dasharray="2.6 2.9"/></svg>`;
    case 'todo':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="5.2" stroke="${c}" stroke-width="1.7"/></svg>`;
    case 'doing':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${pie(c, 0.5)}</svg>`;
    case 'review':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${pie(c, 0.78)}</svg>`;
    case 'done':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="6" fill="${c}"/>
        <path d="M9.4 12.3l1.9 1.9 3.5-3.9" stroke="#16130e" stroke-width="1.9"
          stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
    case 'canceled':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="6" fill="${c}"/>
        <path d="M9.8 9.8l4.4 4.4m0-4.4l-4.4 4.4" stroke="#16130e" stroke-width="1.9"
          stroke-linecap="round" aria-hidden="true"/></svg>`;
    default:
      return statusIcon('todo', c, size);
  }
}

/* ---------- priority glyphs ---------- */

const PRI_COLOR = {
  urgent: '#e5484d', high: '#de7b4d', medium: '#c9a55c', low: 'var(--text-3)',
};

export function priIcon(pri, size = 14) {
  if (!pri || pri === 'none') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#75717d"
      stroke-width="1.9" stroke-linecap="round" aria-hidden="true">
      <path d="M5 8.5h14M5 12.5h14M5 16.5h9"/></svg>`;
  }
  if (pri === 'urgent') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" fill="#e5484d"/>
      <path d="M12 8.2v4.2" stroke="#16130e" stroke-width="2.1" stroke-linecap="round"/>
      <circle cx="12" cy="15.6" r="1.15" fill="#16130e"/></svg>`;
  }
  const c = PRI_COLOR[pri];
  const bars = { high: [10, 7.5, 5], medium: [7.5, 5], low: [5] }[pri] || [5];
  let out = '';
  bars.forEach((w, i) => {
    const y = 7 + i * 4;
    out += `<rect x="${19.5 - w}" y="${y}" width="${w}" height="2.6" rx="1.3" fill="${c}"/>`;
  });
  for (let i = bars.length; i < 3; i++) {
    const y = 7 + i * 4;
    out += `<rect x="16" y="${y}" width="3.5" height="2.6" rx="1.3" fill="var(--line-2)"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${out}</svg>`;
}
