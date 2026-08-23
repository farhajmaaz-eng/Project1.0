/* ---------------------------------------------------------------------------
   Tessera · views/home — the morning page
--------------------------------------------------------------------------- */

import { esc, dayDiff, todayISO, greeting, dayName, dateLine } from './../util.js';
import { ico } from './../icons.js';
import {
  S, you, issueRef, docById, activeCycle, status as statusOf,
} from './../store.js';
import { issueRowHTML, wireIssueRows, avatarHTML } from './../bits.js';
import { openIssue } from './../issue-drawer.js';
import { nav } from './../nav.js';

export function renderHome(view) {
  const s = S();
  const me = you().id;
  const now = new Date();

  const open = s.issues.filter(i => !['done', 'canceled'].includes(i.status));
  const doing = open.filter(i => i.status === 'doing');
  const mineOpen = open.filter(i => i.assignee === me);
  const overdue = mineOpen.filter(i => i.due && dayDiff(i.due) < 0);
  const weekAgoTs = Date.now() - 7 * 86400000;
  const doneThisWeek = s.issues.filter(i => i.status === 'done' && i.updatedAt > weekAgoTs);
  const dueSoon = mineOpen.filter(i => i.due && dayDiff(i.due) <= 6)
    .sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 7);

  const cyc = activeCycle();
  let cycStats = null;
  if (cyc) {
    const inCycle = s.issues.filter(i => i.cycle === cyc.id);
    const closed = inCycle.filter(i => i.status === 'done' || i.status === 'canceled');
    const pct = inCycle.length ? Math.round(closed.length / inCycle.length * 100) : 0;
    const byStatus = {};
    for (const st of s.statuses) byStatus[st.id] = inCycle.filter(i => i.status === st.id).length;
    cycStats = { cyc, total: inCycle.length, closed: closed.length, pct, byStatus };
  }

  const hour = now.getHours();
  const partOfDay = hour < 5 || hour >= 22 ? 'night owl mode' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  view.innerHTML = `
    <div class="view-inner">
      <header class="home-greet">
        <h1>${esc(greeting(now))}, <em>${esc(you().name.split(' ')[0])}</em></h1>
        <p>${esc(dayName(now))} · ${esc(dateLine(now))} · ${partOfDay}</p>
      </header>

      <div class="stat-row">
        <div class="stat"><b>${open.length}</b><span>open issues</span></div>
        <div class="stat warn"><b>${doing.length}</b><span>in progress</span></div>
        <div class="stat ok"><b>${doneThisWeek.length}</b><span>done this week</span></div>
        <div class="stat over"><b>${overdue.length}</b><span>overdue, yours</span></div>
      </div>

      <div class="home-cols">
        <div>
          <section class="hsec">
            <div class="hsec-head"><h2>Due soon</h2><button class="linkish" data-goto-my>my issues →</button></div>
            <div data-rows="due">
              ${dueSoon.length ? dueSoon.map(i => issueRowHTML(i)).join('')
                : '<p class="faint small" style="padding:6px 2px">Nothing due in the next week. Suspicious.</p>'}
            </div>
          </section>

          <section class="hsec">
            <div class="hsec-head"><h2>In progress</h2><button class="linkish" data-goto-board>board →</button></div>
            <div data-rows="doing">
              ${doing.length ? doing.slice(0, 6).map(i => issueRowHTML(i)).join('')
                : '<p class="faint small" style="padding:6px 2px">Nothing moving. Drag something onto the board?</p>'}
            </div>
          </section>
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
            <p class="faint small" style="margin-top:10px;line-height:1.5">${esc(cycStats.cyc.goal)}</p>
            <button class="btn subtle sm" style="margin-top:10px" data-goto-cycle>Open cycle</button>
          </div>` : ''}

          <div class="rail-card">
            <h3>Recent pages</h3>
            ${s.recents.docs.length ? s.recents.docs.slice(0, 5).map(id => {
              const d = docById(id);
              return d ? `
                <button class="mini-row" data-doc="${d.id}">
                  <span style="font-size:14px">${d.icon}</span>
                  <span class="mr-title">${esc(d.title || 'Untitled')}</span>
                </button>` : '';
            }).join('') : '<p class="faint small">No pages yet.</p>'}
            <button class="btn subtle sm" style="margin-top:8px" data-goto-docs>All docs</button>
          </div>
        </aside>
      </div>
    </div>`;

  wireIssueRows(view.querySelector('[data-rows="due"]'), openIssue);
  wireIssueRows(view.querySelector('[data-rows="doing"]'), openIssue);
  view.querySelector('[data-goto-my]').onclick = () => nav('#/my');
  view.querySelector('[data-goto-board]').onclick = () => nav('#/board');
  view.querySelector('[data-goto-docs]').onclick = () => nav('#/docs');
  view.querySelector('[data-goto-cycle]')?.addEventListener('click', () => nav(`#/cycle/${cycStats.cyc.id}`));
  view.querySelectorAll('[data-doc]').forEach((b) => {
    b.onclick = () => nav(`#/doc/${b.dataset.doc}`);
  });
}
