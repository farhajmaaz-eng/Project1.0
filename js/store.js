/* ---------------------------------------------------------------------------
   Tessera · store — single source of truth, persisted to localStorage.
   No framework: views read `S()`, call mutators, then re-render themselves.
--------------------------------------------------------------------------- */

import { buildSeed } from './seed.js';
import { uid, todayISO } from './util.js';

const KEY = 'tessera.v1';
const listeners = new Set();

let state;
try {
  state = JSON.parse(localStorage.getItem(KEY));
} catch { /* corrupted — reseed below */ }

if (!state || state.v !== 1) {
  state = buildSeed();
}

export const S = () => state;

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Tessera: could not save to localStorage', e);
  }
}
const save = debounceSave();
function debounceSave() {
  let t;
  return () => { clearTimeout(t); t = setTimeout(persist, 180); };
}
persist();

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() {
  save();
  listeners.forEach((fn) => fn(state));
}

/* ---------- lookups ---------- */

export const you = () => state.members.find(m => m.id === state.settings.youId);
export const member = (id) => state.members.find(m => m.id === id) || null;
export const label = (id) => state.labels.find(l => l.id === id) || null;
export const status = (id) => state.statuses.find(s => s.id === id) || state.statuses[0];
export const project = (id) => state.projects.find(p => p.id === id) || null;
export const cycle = (id) => state.cycles.find(c => c.id === id) || null;
export const issueById = (id) => state.issues.find(i => i.id === id) || null;
export const docById = (id) => state.docs.find(d => d.id === id) || null;

export const issueRef = (iss) =>
  `${state.settings.keyPrefix}-${iss.key}`;

export const activeCycle = () => {
  const now = todayISO();
  return state.cycles.find(c => c.startsAt <= now && c.endsAt >= now) || null;
};

export function childrenDocs(pid) {
  return state.docs.filter(d => d.parentId === pid)
    .sort((a, b) => a.createdAt - b.createdAt);
}
export function rootDocs() {
  return childrenDocs(null);
}
export function docPath(id) {
  const path = [];
  let cur = docById(id);
  while (cur) { path.unshift(cur); cur = cur.parentId ? docById(cur.parentId) : null; }
  return path;
}
export function docSubtreeIds(id) {
  const out = [id];
  const walk = (pid) => state.docs.filter(d => d.parentId === pid).forEach(d => { out.push(d.id); walk(d.id); });
  walk(id);
  return out;
}
export function hasKids(id) {
  return state.docs.some(d => d.parentId === id);
}

/* ---------- queries ---------- */

export function filterIssues(opts = {}) {
  return state.issues.filter((i) => {
    if (opts.project !== undefined && i.project !== opts.project) return false;
    if (opts.cycle !== undefined && i.cycle !== opts.cycle) return false;
    if (opts.assignee !== undefined && i.assignee !== opts.assignee) return false;
    if (opts.status !== undefined && i.status !== opts.status) return false;
    if (opts.priority !== undefined && i.priority !== opts.priority) return false;
    if (opts.label && !i.labels.includes(opts.label)) return false;
    return true;
  });
}

export function byStatusOrder(a, b) {
  const sa = state.statuses.findIndex(s => s.id === a.status);
  const sb = state.statuses.findIndex(s => s.id === b.status);
  if (sa !== sb) return sa - sb;
  return a.order - b.order;
}

export function groupIssues(list, key) {
  const groups = new Map();
  for (const iss of list) {
    const g = key === 'status' ? iss.status
      : key === 'priority' ? iss.priority
      : key === 'assignee' ? (iss.assignee || 'none')
      : 'all';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(iss);
  }
  return groups;
}

export function groupTitle(key, g) {
  if (key === 'status') return status(g).name;
  if (key === 'priority') return g[0].toUpperCase() + g.slice(1);
  if (g === 'none') return 'Unassigned';
  const m = member(g);
  return m ? m.name : 'Unknown';
}

/* ---------- mutations ---------- */

function nextKeyNum() { return state.seq++; }

export function logAct(issueId, text) {
  const iss = issueById(issueId);
  if (!iss) return;
  iss.activity.push({ id: uid('a'), at: Date.now(), actorId: state.settings.youId, text });
  iss.updatedAt = Date.now();
}

export function createIssue(patch = {}) {
  const maxOrder = Math.max(0, ...state.issues.filter(i => i.status === (patch.status || 'todo')).map(i => i.order));
  const iss = {
    id: uid('i'), key: nextKeyNum(), title: '', blocks: [],
    status: patch.status || 'todo', priority: 'none', assignee: null,
    labels: [], project: patch.project ?? null, cycle: patch.cycle ?? null,
    due: null, order: maxOrder + 10,
    comments: [], activity: [{ id: uid('a'), at: Date.now(), actorId: state.settings.youId, text: 'created the issue' }],
    createdAt: Date.now(), updatedAt: Date.now(),
    ...patch,
  };
  state.issues.unshift(iss);
  touchRecent('issues', iss.id);
  emit();
  return iss;
}

export function updateIssue(id, patch, actText) {
  const iss = issueById(id);
  if (!iss) return;
  Object.assign(iss, patch, { updatedAt: Date.now() });
  if (actText) logAct(id, actText);
  emit();
}

/** returns a snapshot for undo */
export function deleteIssue(id) {
  const idx = state.issues.findIndex(i => i.id === id);
  if (idx === -1) return null;
  const [snap] = state.issues.splice(idx, 1);
  state.recents.issues = state.recents.issues.filter(x => x !== id);
  emit();
  return snap;
}

export function restoreIssueSnapshot(snap, atIndex = 0) {
  state.issues.splice(atIndex, 0, snap);
  emit();
}

export function addComment(issueId, body) {
  const iss = issueById(issueId);
  if (!iss || !body.trim()) return;
  iss.comments.push({ id: uid('c'), authorId: state.settings.youId, at: Date.now(), body: body.trim() });
  iss.updatedAt = Date.now();
  emit();
}

/* docs */

export function createDoc(patch = {}) {
  const doc = {
    id: uid('d'), icon: '📄', title: '', parentId: null,
    blocks: [{ id: uid('b'), type: 'p', html: '', indent: 0 }],
    favorite: false, createdAt: Date.now(), updatedAt: Date.now(),
    ...patch,
  };
  state.docs.push(doc);
  touchRecent('docs', doc.id);
  emit();
  return doc;
}

export function updateDoc(id, patch) {
  const d = docById(id);
  if (!d) return;
  Object.assign(d, patch, { updatedAt: Date.now() });
  emit();
}

/** deletes a doc and its subtree; returns snapshots array for undo */
export function deleteDocTree(id) {
  const ids = docSubtreeIds(id);
  const snaps = [];
  // capture original indices so undo can rebuild order roughly
  for (const did of ids) {
    const idx = state.docs.findIndex(d => d.id === did);
    if (idx > -1) snaps.push({ idx, doc: state.docs[idx] });
  }
  state.docs = state.docs.filter(d => !ids.includes(d.id));
  state.recents.docs = state.recents.docs.filter(x => !ids.includes(x));
  emit();
  return snaps.reverse(); // restore in reverse index order later
}

export function restoreDocs(snaps) {
  snaps.forEach(({ idx, doc }) => state.docs.splice(Math.min(idx, state.docs.length), 0, doc));
  emit();
}

/* misc */

export function touchRecent(kind, id) {
  const arr = state.recents[kind];
  const i = arr.indexOf(id);
  if (i > -1) arr.splice(i, 1);
  arr.unshift(id);
  if (arr.length > 12) arr.length = 12;
}

export function setSetting(k, v) {
  state.settings[k] = v;
  emit();
}

export function resetAll() {
  localStorage.removeItem(KEY);
  state = buildSeed();
  persist();
  location.hash = '#/home';
  location.reload();
}

export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const next = JSON.parse(json);
  if (!next || typeof next !== 'object' || !Array.isArray(next.issues)) {
    throw new Error('Not a Tessera export');
  }
  state = next;
  persist();
  location.reload();
}
