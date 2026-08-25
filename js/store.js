/* ---------------------------------------------------------------------------
   Tessera · store v2 — single source of truth, persisted to localStorage.
   Starts EMPTY: no demo data. The workspace you get is the one you build.
--------------------------------------------------------------------------- */

import { DEFAULT_MODEL } from './openrouter.js';
import { uid, cleanInline, esc, htmlToText } from './util.js';

const KEY = 'tessera.v2';
const listeners = new Set();

let state = null;
try { state = JSON.parse(localStorage.getItem(KEY)); } catch { /* reseed below */ }
if (state && state.v === 2 && !state.views) {
  state.views = []; // v2.0–v2.2 workspaces gain saved-views support
}
if (state && state.v !== 2) state = null;

export const S = () => state;

export function initStateFor({ name, email, workspace, prefix }) {
  if (state) return;
  state = {
    v: 2,
    settings: {
      workspaceName: workspace || `${name.split(' ')[0]}'s workspace`,
      keyPrefix: prefix || 'TSK',
      theme: 'dark',
      openrouterKey: '',
    },
    seq: 1,
    members: [{ id: 'me', name: name.trim(), role: 'Admin', color: '#C17338', you: true }],
    labels: [
      { id: 'bug', name: 'Bug', color: '#B34A3E' },
      { id: 'feature', name: 'Feature', color: '#5F8A5E' },
      { id: 'design', name: 'Design', color: '#C2743B' },
      { id: 'docs', name: 'Docs', color: '#7D6FA0' },
      { id: 'infra', name: 'Infra', color: '#64708A' },
    ],
    statuses: [
      { id: 'backlog', name: 'Backlog', color: '#77808A' },
      { id: 'todo', name: 'Todo', color: '#9AA3AD' },
      { id: 'doing', name: 'In Progress', color: '#D9A648' },
      { id: 'review', name: 'In Review', color: '#A97BA5' },
      { id: 'done', name: 'Done', color: '#6FA06B' },
      { id: 'canceled', name: 'Canceled', color: '#5F6B72' },
    ],
    priorities: ['urgent', 'high', 'medium', 'low', 'none'],
    projects: [],
    cycles: [],
    issues: [],
    docs: [],
    recents: { issues: [], docs: [] },
    ai: { model: DEFAULT_MODEL, useContext: true, thread: [], modelsCache: null },
  };
  persist();
}

export function persist() {
  if (!state) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) {
    console.warn('Tessera: could not save to localStorage', e);
    lastPersistError = e; // surfaced as a toast by the UI layer
  }
}
let lastPersistError = null;
export const takePersistError = () => { const e = lastPersistError; lastPersistError = null; return e; };
const save = (() => { let t; return () => { clearTimeout(t); t = setTimeout(persist, 180); }; })();
persist();

/* Never lose writes: flush to disk when the tab hides or closes. The
   debounced save alone loses data if the tab dies within its 180ms window —
   this is exactly how an API key could appear to "not stick". */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
  window.addEventListener('pagehide', persist);
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() {
  save();
  listeners.forEach((fn) => fn(state));
}

/* ---------- lookups ---------- */

export const you = () => state?.members.find(m => m.you) || null;
export const member = (id) => state?.members.find(m => m.id === id) || null;
export const label = (id) => state?.labels.find(l => l.id === id) || null;
export const status = (id) => state ? (state.statuses.find(s => s.id === id) || state.statuses[0]) : null;
export const project = (id) => state?.projects.find(p => p.id === id) || null;
export const cycle = (id) => state?.cycles.find(c => c.id === id) || null;
export const issueById = (id) => state?.issues.find(i => i.id === id) || null;
export const docById = (id) => state?.docs.find(d => d.id === id) || null;

export const issueRef = (iss) => `${state.settings.keyPrefix}-${iss.key}`;

export function childrenIssues(parentId) {
  return state.issues.filter(i => i.parent === parentId).sort((a, b) => a.key - b.key);
}

export function activeCycle() {
  if (!state) return null;
  const now = new Date().toISOString().slice(0, 10);
  return state.cycles.find(c => c.startsAt <= now && c.endsAt >= now) || null;
}

export function childrenDocs(pid) {
  return state.docs.filter(d => d.parentId === pid && !d.trashed).sort((a, b) => a.createdAt - b.createdAt);
}
export const rootDocs = () => childrenDocs(null);
export const trashedDocs = () =>
  state.docs.filter(d => d.trashed).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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
export const hasKids = (id) => state.docs.some(d => d.parentId === id);

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

export function groupIssues(list, key) {
  const groups = new Map();
  /* unknown status ids (imports, older schemas) fold into the first
     status instead of spawning phantom groups that vanish from the board */
  const knownStatus = (id) => (state.statuses.some(s => s.id === id) ? id : state.statuses[0].id);
  for (const iss of list) {
    const g = key === 'status' ? knownStatus(iss.status)
      : key === 'priority' ? iss.priority
      : key === 'assignee' ? (iss.assignee || 'none')
      : 'all';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(iss);
  }
  return groups;
}

/* ---------- mutations ---------- */

const nextKeyNum = () => state.seq++;

export function logAct(issueId, text) {
  const iss = issueById(issueId);
  if (!iss) return;
  iss.activity.push({ id: uid('a'), at: Date.now(), actorId: 'me', text });
  iss.updatedAt = Date.now();
}

export function createIssue(patch = {}) {
  const st = patch.status || 'todo';
  const maxOrder = Math.max(0, ...state.issues.filter(i => i.status === st).map(i => i.order));
  const iss = {
    id: uid('i'), key: nextKeyNum(), title: '', blocks: [],
    status: st, priority: 'none', assignee: null,
    labels: [], project: patch.project ?? null, cycle: patch.cycle ?? null,
    parent: null,
    due: null, order: maxOrder + 10,
    comments: [], activity: [{ id: uid('a'), at: Date.now(), actorId: 'me', text: 'created the issue' }],
    createdAt: Date.now(), updatedAt: Date.now(),
    ...patch,
  };
  state.issues.unshift(iss);
  touchRecent('issues', iss.id);
  emit();
  return iss;
}

/** near-faithful clone; fresh identity + timestamps */
export function duplicateIssue(id) {
  const src = issueById(id);
  if (!src) return null;
  const clone = JSON.parse(JSON.stringify(src));
  delete clone.id;   // fresh identity — a copy must never collide with its source
  delete clone.key;
  delete clone.order;
  return createIssue({
    ...clone,
    title: `${src.title || 'Untitled'} (copy)`,
    comments: [],
    blocks: JSON.parse(JSON.stringify(src.blocks || [])),
    activity: [{ id: uid('a'), at: Date.now(), actorId: 'me', text: 'duplicated from ' + issueRef(src) }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export function updateIssue(id, patch, actText) {
  const iss = issueById(id);
  if (!iss) return;
  Object.assign(iss, patch, { updatedAt: Date.now() });
  if (actText) logAct(id, actText);
  emit();
}

/** returns a snapshot + original index for undo */
export function deleteIssue(id) {
  const idx = state.issues.findIndex(i => i.id === id);
  if (idx === -1) return null;
  const [snap] = state.issues.splice(idx, 1);
  state.recents.issues = state.recents.issues.filter(x => x !== id);
  emit();
  return { snap, idx };
}

export function restoreIssue({ snap, idx }) {
  state.issues.splice(Math.min(idx, state.issues.length), 0, snap);
  emit();
}

export function addComment(issueId, body) {
  const iss = issueById(issueId);
  if (!iss || !body.trim()) return;
  iss.comments.push({ id: uid('c'), authorId: 'me', at: Date.now(), body: body.trim() });
  iss.updatedAt = Date.now();
  emit();
}

/* projects */

export function createProject(patch = {}) {
  const p = {
    id: uid('p'), icon: '📦', name: '', leadId: 'me',
    statusId: 'doing', description: '',
    ...patch,
  };
  state.projects.push(p);
  emit();
  return p;
}
export function updateProject(id, patch) {
  const p = project(id);
  if (!p) return;
  Object.assign(p, patch);
  emit();
}
/** detaches its issues rather than deleting them */
export function deleteProject(id) {
  state.projects = state.projects.filter(p => p.id !== id);
  state.issues.forEach(i => { if (i.project === id) i.project = null; });
  emit();
}

/* cycles */

export function createCycle(patch = {}) {
  const n = state.cycles.length + 1;
  const c = {
    id: uid('cy'), name: `Cycle ${n}`, goal: '',
    startsAt: patch.startsAt || new Date().toISOString().slice(0, 10),
    endsAt: patch.endsAt || '',
    ...patch,
  };
  state.cycles.push(c);
  state.cycles.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  emit();
  return c;
}
export function updateCycle(id, patch) {
  const c = cycle(id);
  if (!c) return;
  Object.assign(c, patch);
  state.cycles.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  emit();
}
export function deleteCycle(id) {
  state.cycles = state.cycles.filter(c => c.id !== id);
  state.issues.forEach(i => { if (i.cycle === id) i.cycle = null; });
  emit();
}

/* labels */

export function addLabel(name, color) {
  const l = { id: uid('l'), name: name.trim() || 'Label', color };
  state.labels.push(l);
  emit();
  return l;
}
export function updateLabel(id, patch) {
  const l = label(id);
  if (!l) return;
  Object.assign(l, patch);
  emit();
}
export function deleteLabel(id) {
  state.labels = state.labels.filter(l => l.id !== id);
  state.issues.forEach(i => { i.labels = i.labels.filter(x => x !== id); });
  emit();
}

/* docs */

export function createDoc(patch = {}) {
  const doc = {
    id: uid('d'), icon: '📄', title: '', parentId: null,
    blocks: [{ id: uid('b'), type: 'p', html: '', indent: 0 }],
    favorite: false, cover: '', trashed: false,
    createdAt: Date.now(), updatedAt: Date.now(),
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
/** moves a page + its subtree to the trash (recoverable) */
export function deleteDocTree(id) {
  const ids = new Set(docSubtreeIds(id));
  const snaps = [];
  state.docs.forEach((d, idx) => {
    if (ids.has(d.id)) { d.trashed = true; d.trashedAt = Date.now(); snaps.push({ idx, doc: d }); }
  });
  state.recents.docs = state.recents.docs.filter(x => !ids.has(x));
  emit();
  return snaps;
}

export function restoreTrashed(id) {
  const ids = new Set(docSubtreeIds(id));
  state.docs.forEach(d => { if (ids.has(d.id)) { d.trashed = false; delete d.trashedAt; } });
  emit();
}

export function purgeDoc(id) {
  const ids = new Set(docSubtreeIds(id));
  // only purge when every member is already trashed
  if (!state.docs.filter(d => ids.has(d.id)).every(d => d.trashed)) return false;
  state.docs = state.docs.filter(d => !ids.has(d.id));
  emit();
  return true;
}

export function emptyTrash() {
  const roots = state.docs.filter(d =>
    d.trashed && (!d.parentId || !state.docs.find(x => x.id === d.parentId)?.trashed));
  const ids = new Set();
  roots.forEach(r => docSubtreeIds(r.id).forEach(i => ids.add(i)));
  state.docs = state.docs.filter(d => !ids.has(d.id));
  emit();
}
export function restoreDocs(snaps) {
  snaps.forEach(({ doc }) => {
    const d = docById(doc.id);
    if (d) { d.trashed = false; delete d.trashedAt; }
  });
  emit();
}

/* ---------- saved views ---------- */

export function createView({ name, icon = '🔎', filters, groupBy }) {
  const v = {
    id: uid('v'), name: (name || 'Untitled view').trim(), icon,
    filters: JSON.parse(JSON.stringify(filters || {})),
    groupBy: groupBy || 'status',
    createdAt: Date.now(),
  };
  state.views.push(v);
  emit();
  return v;
}
export const getView = (id) => state?.views.find(v => v.id === id) || null;
export function updateView(id, patch) {
  const v = getView(id);
  if (!v) return;
  Object.assign(v, patch);
  emit();
}
export function deleteView(id) {
  state.views = state.views.filter(v => v.id !== id);
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
  if (k === 'openrouterKey' || k === 'workspaceName' || k === 'keyPrefix') {
    persist(); // credentials & identity: write-through, never wait on the debounce
  }
}

export function setAI(patch) {
  Object.assign(state.ai, patch);
  emit();
}

export function pushMessage(role, content) {
  state.ai.thread.push({ role, content, at: Date.now() });
  if (state.ai.thread.length > 80) state.ai.thread.splice(0, state.ai.thread.length - 80);
  emit();
}

export function resetAll() {
  localStorage.removeItem(KEY);
  localStorage.removeItem('tessera.auth');
  localStorage.removeItem('tessera.session');
  location.hash = '#/welcome';
  location.reload();
}

/** export without secrets */
export function exportData() {
  const clone = JSON.parse(JSON.stringify(state));
  delete clone.settings.openrouterKey;
  return JSON.stringify(clone, null, 2);
}

/** imported files are untrusted: strip every tag/attribute outside the editor's
    allowlist before the content ever reaches innerHTML */
function sanitizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map(b => {
    if (b.type === 'table' && Array.isArray(b.rows)) {
      b.rows = b.rows.map(row => Array.isArray(row) ? row.map(c => cleanInline(String(c ?? ''))) : []);
      return b;
    }
    if (typeof b.html === 'string') b.html = cleanInline(b.html);
    return b;
  });
}
function sanitizeImported(ws) {
  ws.issues.forEach(i => {
    i.blocks = sanitizeBlocks(i.blocks || []);
    i.title = String(i.title ?? '');
    i.comments?.forEach(c => { c.body = htmlToText(String(c.body ?? '')); });
  });
  ws.docs.forEach(d => {
    d.blocks = sanitizeBlocks(d.blocks || []);
    d.title = String(d.title ?? '');
  });
}

export function importData(json) {
  const next = JSON.parse(json);
  if (!next || typeof next !== 'object' || !Array.isArray(next.issues)) {
    throw new Error('Not a Tessera export');
  }
  next.v = 2;
  next.ai = next.ai || { model: DEFAULT_MODEL, useContext: true, thread: [] };
  next.settings = next.settings || {};
  delete next.settings.openrouterKey; // never trust (or carry over) keys from a file
  sanitizeImported(next);
  state = next;
  persist();
  location.reload();
}
