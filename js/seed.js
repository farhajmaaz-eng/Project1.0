/* ---------------------------------------------------------------------------
   Tessera · seed — a believable workspace so the app never opens empty.
   Fictional team: Kestrel, five people shipping a website relaunch,
   an iOS beta and some platform work. Today-relative dates keep it fresh.
--------------------------------------------------------------------------- */

import { uid, toISO } from './util.js';

const dOff = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const ts = (daysAgo, h = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, Math.floor(Math.random() * 50) + 5, 0, 0);
  return d.getTime();
};

const B = (type, html, extra = {}) => ({ id: uid('b'), type, html, indent: 0, ...extra });

// Cycle windows relative to today: current cycle started 6 days ago, runs 14d.
const cycStart = -6, cycEnd = 7;

export function buildSeed() {
  const members = [
    { id: 'm1', name: 'Farhaj Maaz', role: 'Founder · Eng', color: '#d08768', you: true },
    { id: 'm2', name: 'Priya Raghavan', role: 'Product', color: '#b48ead' },
    { id: 'm3', name: 'Marcus Webb', role: 'iOS', color: '#81a1c1' },
    { id: 'm4', name: 'Elena Sokolova', role: 'Design', color: '#a3be8c' },
    { id: 'm5', name: 'Jonas Lindqvist', role: 'Platform', color: '#8fbcbb' },
  ];

  const labels = [
    { id: 'bug', name: 'Bug', color: '#e5484d' },
    { id: 'feature', name: 'Feature', color: '#4cb782' },
    { id: 'design', name: 'Design', color: '#f2994a' },
    { id: 'infra', name: 'Infra', color: '#7b88a8' },
    { id: 'docs', name: 'Docs', color: '#9d7cd8' },
    { id: 'perf', name: 'Perf', color: '#e2b93d' },
    { id: 'a11y', name: 'Accessibility', color: '#4fa3e3' },
  ];

  const statuses = [
    { id: 'backlog', name: 'Backlog', color: '#75717d' },
    { id: 'todo', name: 'Todo', color: '#98a0ae' },
    { id: 'doing', name: 'In Progress', color: '#e2b93d' },
    { id: 'review', name: 'In Review', color: '#9d7cd8' },
    { id: 'done', name: 'Done', color: '#4cb782' },
    { id: 'canceled', name: 'Canceled', color: '#5c5866' },
  ];

  const cycles = [
    { id: 'cy1', name: 'Cycle 23', startsAt: dOff(cycStart), endsAt: dOff(cycEnd), goal: 'Ship the relaunch beta behind the flag and clear every P1 from the board.' },
    { id: 'cy2', name: 'Cycle 24', startsAt: dOff(cycEnd + 1), endsAt: dOff(cycEnd + 14), goal: 'Mobile beta feedback pass, recurring tasks, and infra cleanup.' },
  ];

  const projects = [
    { id: 'p1', icon: '🌍', name: 'Website Relaunch', leadId: 'm4', statusId: 'doing',
      description: 'Rebuild the marketing site on the new design system. Faster, accessible, and actually pleasant to maintain.' },
    { id: 'p2', icon: '📱', name: 'iOS Beta', leadId: 'm3', statusId: 'doing',
      description: 'TestFlight build of the companion app. Small surface area, high polish bar.' },
    { id: 'p3', icon: '🛠️', name: 'Platform Hardening', leadId: 'm5', statusId: 'todo',
      description: 'SLOs, alerting, preview environments — the unglamorous work that keeps 3am pages away.' },
  ];

  /* ---- issues ---- */
  // helper to keep the table readable
  let k = 100;
  const I = (o) => ({
    id: uid('i'), key: ++k, title: '', blocks: [], status: 'todo', priority: 'none',
    assignee: null, labels: [], project: null, cycle: null, due: null,
    order: k * 10, comments: [], activity: [],
    createdAt: ts(12), updatedAt: ts(3),
    ...o,
  });

  const issues = [
    I({
      title: 'Set up preview deployments for every PR', status: 'done', priority: 'high',
      assignee: 'm5', labels: ['infra'], project: 'p3', cycle: 'cy1',
      blocks: [B('p', `Every pull request should get its own URL within two minutes of push. No exceptions, no manual steps.`),
        B('ul', `Netlify-style build per branch`), B('ul', `Seeded demo data so reviewers can click around`)],
      due: dOff(-4), createdAt: ts(13), updatedAt: ts(4),
      activity: [
        { id: uid('a'), at: ts(13), actorId: 'm5', text: 'created the issue' },
        { id: uid('a'), at: ts(4, 16), actorId: 'm5', text: 'changed status to Done' },
      ],
      comments: [{ id: uid('c'), authorId: 'm1', at: ts(5, 9),
        body: `This already saved us twice this week. Reviewers actually leave feedback now that they can see the thing.` }],
    }),
    I({
      title: 'Dark mode contrast fails WCAG AA on badges', status: 'done', priority: 'medium',
      assignee: 'm4', labels: ['design', 'a11y'], project: 'p1', cycle: 'cy1',
      blocks: [B('p', `Label chips sit at ~2.9:1 against the card background. Needs 4.5:1.`),
        B('p', ``), B('h3', `Fix`), B('p', `Darken chip text two steps and add a hairline border instead of relying on fill alone.`)],
      due: dOff(-2), createdAt: ts(11), updatedAt: ts(2),
      activity: [
        { id: uid('a'), at: ts(11), actorId: 'm4', text: 'created the issue' },
        { id: uid('a'), at: ts(2, 15), actorId: 'm4', text: 'changed status to Done' },
      ],
    }),
    I({
      title: 'Avatar uploads fail on Safari 16.4', status: 'done', priority: 'urgent',
      assignee: 'm1', labels: ['bug'], project: 'p1', cycle: 'cy1',
      blocks: [B('p', `HEIC input crashes the resizer. We were only testing JPEGs — of course.`),
        B('code', `await createImageBitmap(file) // throws on HEIC`, { type: 'code', lang: '' })],
      due: dOff(-1), createdAt: ts(10), updatedAt: ts(1),
      activity: [
        { id: uid('a'), at: ts(10), actorId: 'm1', text: 'created the issue' },
        { id: uid('a'), at: ts(1, 12), actorId: 'm1', text: 'changed status to Done' },
      ],
      comments: [{ id: uid('c'), authorId: 'm4', at: ts(1, 14), body: `Confirmed fixed on 16.4 and 17. Closing the QA thread too.` }],
    }),
    I({
      title: 'Write the changelog for 0.9', status: 'done', priority: 'low',
      assignee: 'm2', labels: ['docs'], project: 'p1', cycle: 'cy1',
      blocks: [B('p', `Voice: confident but not breathless. One line per user-visible change, links where useful.`)],
      due: dOff(-3), createdAt: ts(14), updatedAt: ts(3),
      activity: [{ id: uid('a'), at: ts(14), actorId: 'm2', text: 'created the issue' }],
    }),
    I({
      title: 'Keyboard focus escapes the command palette', status: 'doing', priority: 'urgent',
      assignee: 'm1', labels: ['bug', 'a11y'], project: 'p1', cycle: 'cy1',
      blocks: [B('p', `Tab moves focus into the page behind the overlay while the palette is open. Screen readers announce background content mid-search.`),
        B('todo', `Trap Tab/Shift+Tab inside the palette`, {}), B('todo', `Return focus to the trigger element on close`), B('todo', `Add aria-activedescendant on the list`)],
      due: dOff(1), createdAt: ts(6), updatedAt: ts(0, 9),
      activity: [
        { id: uid('a'), at: ts(6), actorId: 'm1', text: 'created the issue' },
        { id: uid('a'), at: ts(0, 9), actorId: 'm1', text: 'changed priority to Urgent' },
      ],
    }),
    I({
      title: 'Reduce cold start on /search edge function', status: 'doing', priority: 'high',
      assignee: 'm5', labels: ['perf'], project: 'p3', cycle: 'cy1',
      blocks: [B('p', `P95 cold start is 1.9s — mostly the index being rebuilt per isolate. Snapshot the index at deploy time and mmap it.`)],
      due: dOff(3), createdAt: ts(9), updatedAt: ts(1, 17),
      comments: [{ id: uid('c'), authorId: 'm1', at: ts(1, 18), body: `If the snapshot trick gets us under 400ms, ship it before touching anything else.` }],
      activity: [{ id: uid('a'), at: ts(9), actorId: 'm5', text: 'created the issue' }],
    }),
    I({
      title: 'Empty states need an illustration pass', status: 'doing', priority: 'medium',
      assignee: 'm4', labels: ['design'], project: 'p1',
      blocks: [B('p', `Every empty state is currently grey text on grey background. They should feel like a door, not a wall.`)],
      createdAt: ts(8), updatedAt: ts(2, 11),
      activity: [{ id: uid('a'), at: ts(8), actorId: 'm4', text: 'created the issue' }],
    }),
    I({
      title: 'Billing page shows stale invoice currency', status: 'review', priority: 'high',
      assignee: 'm2', labels: ['bug'], project: 'p1', cycle: 'cy1',
      blocks: [B('p', `After switching workspace currency, invoices render the old symbol until hard refresh. Cache key doesn't include currency.`)],
      due: dOff(2), createdAt: ts(7), updatedAt: ts(0, 14),
      activity: [{ id: uid('a'), at: ts(7), actorId: 'm2', text: 'created the issue' }],
    }),
    I({
      title: 'Onboarding checklist drops state on refresh', status: 'review', priority: 'medium',
      assignee: 'm3', labels: ['bug', 'feature'], project: 'p2', cycle: 'cy1',
      blocks: [B('p', `Steps ticked on day one come unticked after a kill-and-restart. Persist checklist completion keyed by install id.`)],
      createdAt: ts(9), updatedAt: ts(1, 10),
      activity: [{ id: uid('a'), at: ts(9), actorId: 'm3', text: 'created the issue' }],
    }),
    I({
      title: 'Fix flaky signup e2e test', status: 'todo', priority: 'urgent',
      assignee: 'm1', labels: ['bug', 'infra'], project: 'p3', cycle: 'cy1',
      blocks: [B('p', `Fails roughly one run in four on CI. The assertion races the welcome email worker. Add an explicit wait on the mail sink.`)],
      due: dOff(0), createdAt: ts(4), updatedAt: ts(0, 8),
      activity: [{ id: uid('a'), at: ts(4), actorId: 'm1', text: 'created the issue' }],
    }),
    I({
      title: 'Renew TLS cert for api.kestrel.dev', status: 'todo', priority: 'urgent',
      assignee: 'm5', labels: ['infra'], project: 'p3',
      blocks: [B('p', `Expires in nine days. The renewal job silently failed twice — alerting gap, tracked separately.`)],
      due: dOff(-2), createdAt: ts(3), updatedAt: ts(2, 19),
      comments: [{ id: uid('c'), authorId: 'm5', at: ts(2, 19), body: `Cert bot config was pointing at the old DNS provider. Re-ran manually, watching the next window before closing this.` }],
      activity: [{ id: uid('a'), at: ts(3), actorId: 'm5', text: 'created the issue' }],
    }),
    I({
      title: 'Reply to TestFlight feedback thread #47', status: 'todo', priority: 'medium',
      assignee: 'm3', labels: ['docs'], project: 'p2',
      blocks: [B('p', `Six reports about haptics on the share sheet. Thank people, explain what changed in build 214.`)],
      due: dOff(0), createdAt: ts(2), updatedAt: ts(2),
      activity: [{ id: uid('a'), at: ts(2), actorId: 'm3', text: 'created the issue' }],
    }),
    I({
      title: 'Migrate avatars to the CDN', status: 'todo', priority: 'medium',
      assignee: 'm5', labels: ['infra', 'perf'], project: 'p3', cycle: 'cy2',
      blocks: [B('p', `Origin serves 40% of traffic as avatar bytes. Move to the CDN with a cache-forever policy and hashed filenames.`)],
      due: dOff(10), createdAt: ts(5), updatedAt: ts(5),
      activity: [{ id: uid('a'), at: ts(5), actorId: 'm5', text: 'created the issue' }],
    }),
    I({
      title: 'Support recurring tasks', status: 'todo', priority: 'high',
      assignee: 'm2', labels: ['feature'], project: 'p2', cycle: 'cy2',
      blocks: [B('p', `Weekly and monthly recurrences only. When a task completes, spawn the next instance with fresh timestamps and carry over the description.`),
        B('callout', `Keep the model dumb: no cron syntax, no natural language. A recurrence is a period plus an anchor date.`, { type: 'callout', icon: '💡' })],
      createdAt: ts(6), updatedAt: ts(6),
      activity: [{ id: uid('a'), at: ts(6), actorId: 'm2', text: 'created the issue' }],
    }),
    I({
      title: 'Add keyboard shortcut cheatsheet', status: 'todo', priority: 'low',
      assignee: 'm1', labels: ['docs'], project: 'p1',
      blocks: [B('p', `Press ? anywhere. Should mirror the real bindings — generate it from the shortcut registry rather than hand-maintaining a list.`)],
      createdAt: ts(7), updatedAt: ts(7),
      activity: [{ id: uid('a'), at: ts(7), actorId: 'm1', text: 'created the issue' }],
    }),
    I({
      title: 'Localize date formats', status: 'todo', priority: 'low',
      assignee: 'm4', labels: ['feature'], project: 'p1',
      blocks: [B('p', `Dates are hardcoded US-style. Use Intl with the workspace locale; start with en-GB and de.`)],
      createdAt: ts(8), updatedAt: ts(8),
      activity: [{ id: uid('a'), at: ts(8), actorId: 'm4', text: 'created the issue' }],
    }),
    I({
      title: 'Offline mode for docs', status: 'backlog', priority: 'medium',
      assignee: 'm1', labels: ['feature'], project: 'p2',
      blocks: [B('p', `Everything is local-first already — this is mostly about sync conflicts once multiple devices exist. Park until the collab spike lands.`)],
      createdAt: ts(20), updatedAt: ts(20),
      activity: [{ id: uid('a'), at: ts(20), actorId: 'm1', text: 'created the issue' }],
    }),
    I({
      title: 'Rate-limit public share links', status: 'backlog', priority: 'high',
      assignee: 'm5', labels: ['infra'], project: 'p3',
      blocks: [B('p', `Shared doc links are unthrottled right now. Token bucket per link, generous ceiling, 429s logged.`)],
      createdAt: ts(15), updatedAt: ts(15),
      activity: [{ id: uid('a'), at: ts(15), actorId: 'm5', text: 'created the issue' }],
    }),
    I({
      title: 'Redesign notification preferences', status: 'backlog', priority: 'low',
      assignee: 'm4', labels: ['design'], project: 'p1',
      blocks: [B('p', `Current toggles imply granularity we don't have. Either ship per-project mutes or simplify the copy to match reality.`)],
      createdAt: ts(18), updatedAt: ts(18),
      activity: [{ id: uid('a'), at: ts(18), actorId: 'm4', text: 'created the issue' }],
    }),
    I({
      title: 'Audit bundle size budget', status: 'backlog', priority: 'medium',
      assignee: 'm5', labels: ['perf'], project: 'p3',
      blocks: [B('p', `Main chunk crept past 240kb gzipped. Set a CI budget and fail the check, not just a warning.`)],
      createdAt: ts(22), updatedAt: ts(22),
      activity: [{ id: uid('a'), at: ts(22), actorId: 'm5', text: 'created the issue' }],
    }),
    I({
      title: 'Draft launch announcement', status: 'backlog', priority: 'medium',
      assignee: 'm2', labels: ['docs'], project: 'p1',
      blocks: [B('p', `Blog post plus a short email. Lead with what users can do now that they couldn't last month — skip the tech stack tour.`)],
      createdAt: ts(10), updatedAt: ts(10),
      activity: [{ id: uid('a'), at: ts(10), actorId: 'm2', text: 'created the issue' }],
    }),
    I({
      title: 'Explore WebGL hero animation', status: 'canceled', priority: 'none',
      assignee: 'm4', labels: ['design'], project: 'p1',
      blocks: [B('p', `Prototype looked great and cost 300kb plus constant GPU work on laptops. Not worth it. Static art direction won.`)],
      createdAt: ts(25), updatedAt: ts(12),
      activity: [
        { id: uid('a'), at: ts(25), actorId: 'm4', text: 'created the issue' },
        { id: uid('a'), at: ts(12), actorId: 'm4', text: 'canceled the issue' },
      ],
    }),
    I({
      title: 'Kickoff: mobile beta scoping', status: 'done', priority: 'none',
      assignee: 'm3', labels: [], project: 'p2',
      blocks: [B('p', `Scope agreed: read-only dashboard, search, and push notifications. Everything else waits for v1 signals.`)],
      createdAt: ts(30), updatedAt: ts(24),
      activity: [{ id: uid('a'), at: ts(30), actorId: 'm3', text: 'created the issue' }],
    }),
  ];

  /* ---- docs ---- */
  const D = (id, icon, title, parentId, blocks, extra = {}) =>
    ({ id, icon, title, parentId, blocks, favorite: false, createdAt: ts(21), updatedAt: ts(2), ...extra });

  const docs = [
    D('d1', '🌱', 'Start here', null, [
      B('p', `This workspace is small on purpose. Three projects, one active cycle, and a handful of pages that people actually keep up to date. Here's how we work:`),
      B('h2', `The shape of things`),
      B('ul', `Issues live on the board and get pulled into a two-week cycle. If it isn't in a cycle, it isn't a promise — it's a maybe.`),
      B('ul', `Decisions get written down as docs, linked from the issue that spawned them. Meetings produce notes, notes produce todos.`),
      B('ul', `Everything you're reading right now is stored in your browser. No server, no account, no telemetry.`),
      B('divider', ''),
      B('h2', `Try these three things`),
      B('todo', `Press ⌘K (or Ctrl K) and jump anywhere`, {}),
      B('todo', `Open the board, then drag a card between columns`, {}),
      B('todo', `Type “/” in any document and watch the menu appear`, {}),
      B('callout', `Everything is editable. This sentence included. Click into it.`, { type: 'callout', icon: '✏️' }),
      B('quote', `Plans are worthless, but planning is everything.`, {}),
      B('p', `— someone who planned a lot`),
    ], { favorite: true }),

    D('d2', '🗺️', 'Roadmap — Q3 2026', null, [
      B('p', `Three bets, ranked. If new work doesn't serve one of these, it goes to the backlog without guilt.`),
      B('ol', `Relaunch the website and measure whether trial signups move.`),
      B('ol', `Get the iOS beta into twenty real hands, not twenty polite ones.`),
      B('ol', `Make infrastructure boring. Pages at 3am are a product decision, not bad luck.`),
      B('p', `Full context in <code>the-bets</code> below — each bet has an owner and a falsifiable success metric.`),
    ]),
    D('d3', '🎯', 'The three bets', 'd2', [
      B('h2', `1 · Website relaunch`),
      B('p', `Owner: Elena. Success: signup conversion up 15% over six weeks, LCP under 1.2s on 4G. Failure looks like a prettier site with the same numbers.`),
      B('h2', `2 · iOS beta`),
      B('p', `Owner: Marcus. Success: 20 TestFlight testers with week-4 retention above 40%. We will ask blunt questions in the feedback survey.`),
      B('h2', `3 · Platform hardening`),
      B('p', `Owner: Jonas. Success: zero Sev-1s in September, MTTR under 30 minutes when one happens anyway.`),
    ]),
    D('d4', '✅', 'Launch checklist', 'd2', [
      B('h2', `Week of launch`),
      B('todo', `Final copy review with Priya`, { checked: true }),
      B('todo', `Lighthouse ≥ 95 on all top pages`, { checked: true }),
      B('todo', `Redirect map reviewed by two people`, {}),
      B('todo', `Analytics events verified end-to-end`, {}),
      B('todo', `Rollback plan written and rehearsed`, {}),
      B('h2', `After`),
      B('todo', `Changelog published`, { checked: true }),
      B('todo', `Thank-you notes to the beta testers`, {}),
    ]),
    D('d5', '📝', 'Meeting notes', null, [
      B('p', `One page per meeting, newest at the bottom of the tree. Notes without action items get deleted after a month.`),
    ]),
    D('d6', '🗓️', 'Weekly sync — Aug 20', 'd5', [
      B('p', `<strong>Present:</strong> everyone. Forty minutes, timer enforced.`),
      B('h3', `Decisions`),
      B('ul', `Preview URLs become mandatory before review — no more “works on my machine” reviews.`),
      B('ul', `Recurring tasks slip to Cycle 24. Priya writes the spec first this time.`),
      B('ul', `The WebGL hero is dead. We mourn briefly and move on.`),
      B('h3', `Action items`),
      B('todo', `Jonas drafts the rate-limiting proposal`, { checked: true }),
      B('todo', `Marcus schedules five tester calls`, {}),
      B('todo', `Farhaj pairs with Jonas on the search cold-start`, {}),
    ]),
    D('d7', '🔁', 'Retro — Cycle 22', 'd5', [
      B('h3', `Went well`),
      B('ul', `Estimates finally got honest once we stopped pretending half-days don't exist.`),
      B('ul', `Design and engineering pairing on the badge contrast fix took 40 minutes total.`),
      B('h3', `Went sideways`),
      B('ul', `Two urgent interrupts ate the middle week. Next time they enter the cycle explicitly or wait.`),
      B('h3', `Trying next cycle`),
      B('ul', `No new work enters the board on Fridays. Friday is for finishing.`),
    ]),
    D('d8', '🧭', 'Engineering principles', null, [
      B('quote', `Boring technology, sharp product.`, {}),
      B('ol', `Choose the tool the team can debug at 3am, not the one that demos best.`),
      B('ol', `If a feature needs a paragraph of configuration docs, redesign it.`),
      B('ol', `Latency is a feature. So is not having the feature.`),
      B('ol', `Delete code with more ceremony than you add it.`),
      B('callout', `When in doubt, optimize for the person who joins the team in six months.`, { type: 'callout', icon: '💡' }),
    ]),
    D('d9', '🎨', 'Voice & tone', null, [
      B('p', `We sound like a competent colleague: direct, warm, allergic to hype.`),
      B('ul', `Say what it does, then why it matters. Never just the adjectives.`),
      B('ul', `One exclamation mark per document, maximum. Usually zero.`),
      B('ul', `“Fast” needs a number next to it or it doesn't ship.`),
      B('ul', `Humor is welcome in docs people choose to read. Never in error messages.`),
    ]),
  ];

  return {
    v: 1,
    settings: { workspaceName: 'Kestrel', keyPrefix: 'KES', theme: 'dark', youId: 'm1' },
    seq: k + 1,
    members, labels, statuses, priorities: ['urgent', 'high', 'medium', 'low', 'none'],
    projects, cycles, issues, docs,
    recents: { issues: [], docs: [] },
    filters: {},
  };
}
