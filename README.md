# Tessera

**Issues and docs, in one weave.** A local-first workspace that blends the parts
of Linear I missed (keyboard-first issue tracking, cycles, a board that respects
drag & drop) with the parts of Notion I kept reaching for (nested pages, a block
editor, `/` commands) — without a server, an account, or a build step.

Everything you write lives in your browser's localStorage. Close the tab, come
back, it's all there. Export it as JSON any time from Settings.

## Running it

It's static files. Any of these work:

```sh
# simplest — Python is already on your machine
python3 -m http.server 8080

# or Node
npx serve .
```

Then open http://localhost:8080. Deploying to GitHub Pages or any static host
is just "push the folder".

## What's inside

**The Linear half**

- Issues with status, priority, assignee, labels, project, cycle and due date
- Kanban board with real drag & drop (drop-line insertion, not just column swaps)
- Two-week cycles with progress, scope and goal; projects with leads and pulse bars
- My issues / All issues with multi-select filters and grouping by status,
  priority or assignee
- An issue drawer with live-saving properties, comments and an activity trail

**The Notion half**

- Nested pages with favorites, emoji icons, duplication and subtree delete+undo
- A hand-rolled block editor: headings, lists, to-dos, quotes, callouts, code,
  dividers — with markdown shortcuts (`# `, `- `, `1. `, `[] `, `> `, ` ``` `)
- A `/` command menu, tab indents, enter-splitting, backspace merging, arrow-key
  flow between blocks, ⌘B/I/U/E inline formatting

**The glue**

- ⌘K command palette with fuzzy search across issues, pages, projects, actions
- j/k list navigation, `g`-chords for jumping between views
- Light/dark/system themes, undo toasts for destructive actions, JSON export/import

## Keyboard shortcuts

Press `?` anywhere inside the app. The highlights:

| Key | Action |
| --- | --- |
| `⌘K` | Command palette |
| `C` | New issue |
| `/` | Search |
| `G` then `H/I/A/B/C/P/D` | Home / My issues / All / Board / Cycles / Projects / Docs |
| `J` / `K` · `↵` | Move in lists · open selection |

## The demo data

First launch seeds a fictional five-person team ("Kestrel") with 23 issues,
two cycles, three projects and nine connected pages — including a **Start here**
page that doubles as the manual. Reset or wipe it from Settings.

## Stack, such as it is

Vanilla JavaScript ES modules, hand-written CSS, zero dependencies, zero build.
`js/` is organized as small modules: a store with pub/sub persistence, a block
editor engine, a tiny menu/modal/toast layer, and one file per view.

```
js/
├── main.js          boot, router, global shortcuts
├── store.js         state + localStorage persistence
├── seed.js          the demo workspace
├── editor.js        block editor engine
├── palette.js       ⌘K command menu
├── issue-drawer.js  slide-over issue editor
├── doctree.js       nested page tree (shared sidebar/docs)
├── ui.js            menus, modals, toasts, confirm
├── bits.js          shared HTML fragments
├── icons.js         hand-drawn SVG icon set
└── views/           home, issues, board, cycles, projects, docs, settings
```

## Roadmap ideas

Real-time collaboration would need a backend (CRDT per doc, websockets for
presence). Recurring tasks, saved filter views and page templates are all
doable client-side. See `Roadmap — Q3 2026` in the app. Yes, the roadmap page
about the app lives inside the app.

---

MIT licensed. Built by Farhaj Maaz.
