/* ---------------------------------------------------------------------------
   Tessera · views/home v2 — greeting, live stats, onboarding, rail
--------------------------------------------------------------------------- */

import { esc, dayDiff, greeting, dayName, dateLine, countUp, toISO } from './../util.js';
import { ico } from './../icons.js';
import {
  S, you, issueRef, docById, activeCycle,
} from './../store.js';
import { issueRowHTML, wireIssueRows, emptyState, sparkline } from './../bits.js';
import { openIssue } from './../issue-drawer.js';
import { nav } from './../nav.js';
import { celebrate } from './../motion.js';

/* fires once per session, the first time Home loads fully set up */
let onboardCelebrated = false;

export function renderHome(view) {
  const s = S();
  const me = 'me';
  const now = new Date();

  const open = s.issues.filter(i => !['done', 'canceled'].includes(i.status));
  const doing = open.filter(i => i.status === 'doing');
  const mineOpen = open.filter(i => i.assignee === me);
  const overdue = mineOpen.filter(i => i.due && dayDiff(i.due) < 0);
  const weekAgoTs = Date.now() - 7 * 86400000;
  const doneThisWeek = s.issues.filter(i => i.status === 'done' && i.updatedAt > weekAgoTs);
  const dueSoon = mineOpen.filter(i => i.due && dayDiff(i.due) <= 6)
    .sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 7);

  /* 14-day activity — issues touched per day, straight from updatedAt */
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const activity = [...Array(14)].map((_, k) => {
    const dayStart = today0.getTime() - (13 - k) * 86400000;
    return s.issues.filter(i => i.updatedAt >= dayStart && i.updatedAt < dayStart + 86400000).length;
  });
  const touched = activity.reduce((a, b) => a + b, 0);

  /* momentum — consecutive days (ending today, or yesterday if today is
     still young) with at least one issue touch */
  const touchedDays = new Set(
    s.issues.filter(i => i.updatedAt).map(i => toISO(new Date(i.updatedAt))),
  );
  let streak = 0;
  const probe = new Date(); probe.setHours(0, 0, 0, 0);
  if (!touchedDays.has(toISO(probe))) probe.setDate(probe.getDate() - 1);
  while (touchedDays.has(toISO(probe)) && streak < 365) {
    streak++;
    probe.setDate(probe.getDate() - 1);
  }

  const cyc = activeCycle();
  let cycStats = null;
  if (cyc) {
    const inCycle = s.issues.filter(i => i.cycle === cyc.id);
    const closed = inCycle.filter(i => ['done', 'canceled'].includes(i.status));
    cycStats = {
      cyc,
      total: inCycle.length,
      closed: closed.length,
      pct: inCycle.length ? Math.round(closed.length / inCycle.length * 100) : 0,
      byStatus: Object.fromEntries(s.statuses.map(st => [st.id, inCycle.filter(i => i.status === st.id).length])),
    };
  }

  /* onboarding checklist — real state, not decoration */
  const steps = [
    { id: 'issue', icon: 'zap', t: 'Create your first issue', d: 'Press C anywhere, or use the button above.', href: null, action: 'new-issue', done: s.issues.length > 0 },
    { id: 'page', icon: 'doc', t: 'Start a page', d: 'Specs, meeting notes, half-formed ideas — they all go here.', done: s.docs.length > 0 },
    s.projects.length === 0
      ? { id: 'project', icon: 'layers', t: 'Group work into a project', d: 'Projects give issues a home and a pulse.', done: false }
      : null,
    { id: 'ai', icon: 'sparkles', t: 'Meet your assistant', d: 'Add an OpenRouter key to plan with AI, right here.', done: !!s.settings.openrouterKey },
  ].filter(Boolean);
  const remaining = steps.filter(x => !x.done);

  const hour = now.getHours();
  const partOfDay = hour < 5 || hour >= 22 ? 'night owl mode' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  view.innerHTML = `
    <div class="view-inner">
      <header class="home-greet">
        <h1>${esc(greeting(now))}, <em>${esc(you().name.split(' ')[0])}</em></h1>
        <p>${esc(dayName(now))} · ${esc(dateLine(now))} · ${partOfDay}${streak >= 2 ? ` · <b class="streak">🔥 ${streak}-day streak</b>` : ''}</p>
      </header>

      <div class="stat-row">
        <div class="stat"><b data-n="open">0</b><span>open issues</span></div>
        <div class="stat warn"><b data-n="doing">0</b><span>in progress</span></div>
        <div class="stat ok"><b data-n="done">0</b><span>done this week</span></div>
        <div class="stat over"><b data-n="over">0</b><span>overdue, yours</span></div>
      </div>

      ${remaining.length ? `
      <section class="onboard card" style="padding:6px 20px;margin-bottom:30px">
        <h2 style="font-size:14px;font-weight:620;padding:16px 4px 2px">Getting started
          <span class="faint small" style="font-weight:450;margin-left:6px">${steps.length - remaining.length}/${steps.length}</span>
        </h2>
        ${remaining.map(st => `
          <div class="onboard-step">
            <span class="onboard-check">${ico('check', 13)}</span>
            <div class="onboard-main">
              <b>${esc(st.t)}</b><span>${esc(st.d)}</span>
            </div>
            ${st.action === 'new-issue'
              ? `<button class="btn soft sm" data-new-issue>${ico('plus', 13)} New issue</button>`
              : `<button class="btn ghost sm" data-go="${stepHref(st.id)}">${stepVerb(st.id)} ${ico('arrowRight', 12)}</button>`}
          </div>`).join('')}
      </section>` : ''}

      <div class="home-cols">
        <div>
          ${dueSoon.length || doing.length ? `
          <section class="hsec" style="display:${dueSoon.length ? '' : 'none'}">
            <div class="hsec-head"><h2>Due soon</h2><button class="linkish" data-goto-my>my issues →</button></div>
            <div data-rows="due">${dueSoon.map(i => issueRowHTML(i)).join('')}</div>
          </section>

          <section class="hsec" style="display:${doing.length ? '' : 'none'}">
            <div class="hsec-head"><h2>In progress</h2><button class="linkish" data-goto-board>board →</button></div>
            <div data-rows="doing">${doing.slice(0, 6).map(i => issueRowHTML(i)).join('')}</div>
          </section>` : `
          <section class="hsec">
            <div class="card">${emptyState('check', 'Inbox zero from day one',
              'No open issues yet. When something needs doing, it lands here.',
              '<button class="btn primary sm" data-new-issue>Create the first one</button>')}</div>
          </section>`}
        </div>

        <aside>
          ${cycStats ? `
          <div class="rail-card">
            <h3>${esc(cycStats.cyc.name)} · ${cycStats.pct}%</h3>
            <div class="cycle-bar">${s.statuses.map(st => {
              const n = cycStats.byStatus[st.id] || 0;
              return n ? `<i style="width:${n / Math.max(1, cycStats.total) * 100}%;background:${st.color}" title="${esc(st.name)}: ${n}"></i>` : '';
            }).join('')}</div>
            <div class="stack-legend">
              ${s.statuses.filter(st => cycStats.byStatus[st.id]).map(st =>
                `<span><i style="background:${st.color}"></i>${esc(st.name)} ${cycStats.byStatus[st.id]}</span>`).join('')}
            </div>
            ${cycStats.cyc.goal ? `<p class="faint small" style="margin-top:10px;line-height:1.5">${esc(cycStats.cyc.goal)}</p>` : ''}
            <button class="btn subtle sm rail-cta" data-goto-cycle>Open cycle</button>
          </div>` : ''}

          <div class="rail-card">
            <h3>Activity · last 14 days</h3>
            ${sparkline(activity, { w: 232, h: 42 })}
            <p class="faint small" style="margin-top:8px">${touched === 1 ? '1 issue touch' : `${touched} issue touches`} — every edit counts.</p>
          </div>

          <div class="rail-card">
            <h3>Recent pages</h3>
            ${s.recents.docs.length ? s.recents.docs.slice(0, 5).map(id => {
              const d = docById(id);
              return d ? `
                <button class="mini-row" data-doc="${d.id}">
                  <span style="font-size:14px">${d.icon}</span>
                  <span class="mr-title">${esc(d.title || 'Untitled')}</span>
                </button>` : '';
            }).join('') : '<p class="faint small">Pages you edit will collect here.</p>'}
            <button class="btn subtle sm rail-cta" data-goto-docs>All docs</button>
          </div>

          <div class="rail-card">
            <h3>Try this</h3>
            <p class="small faint" style="line-height:1.7">
              Press <kbd>C</kbd> for a new issue.<br>
              Press <kbd>⌘K</kbd> to jump anywhere.<br>
              Type <kbd>/</kbd> inside any page.<br>
              Press <kbd>?</kbd> for every shortcut.
            </p>
          </div>
        </aside>
      </div>
    </div>`;

  // animated counters
  countUp(view.querySelector('[data-n="open"]'), open.length);
  countUp(view.querySelector('[data-n="doing"]'), doing.length);
  countUp(view.querySelector('[data-n="done"]'), doneThisWeek.length);
  countUp(view.querySelector('[data-n="over"]'), overdue.length);

  wireIssueRows(view.querySelector('[data-rows="due"]') || view, openIssue);
  wireIssueRows(view.querySelector('[data-rows="doing"]') || view, openIssue);
  view.querySelectorAll('[data-new-issue]').forEach(b =>
    b.onclick = () => import('./../new-issue.js').then(m => m.openNewIssue()));
  view.querySelector('[data-goto-my]')?.addEventListener('click', () => nav('#/my'));
  view.querySelector('[data-goto-board]')?.addEventListener('click', () => nav('#/board'));
  view.querySelector('[data-goto-docs]')?.addEventListener('click', () => nav('#/docs'));
  view.querySelector('[data-goto-cycle]')?.addEventListener('click', () => nav(`#/cycle/${cycStats.cyc.id}`));
  view.querySelectorAll('[data-doc]').forEach(b => b.onclick = () => nav(`#/doc/${b.dataset.doc}`));

  /* graduation — the checklist quietly completed; say it with confetti */
  if (!remaining.length && s.issues.length && !onboardCelebrated) {
    onboardCelebrated = true;
    setTimeout(celebrate, 500);
  }
}

function stepHref(id) {
  return { page: '#/docs', project: '#/projects', ai: '#/settings' }[id] || '#/docs';
}
function stepVerb(id) {
  return { page: 'Write a page', project: 'New project', ai: 'Connect' }[id] || 'Open';
}
