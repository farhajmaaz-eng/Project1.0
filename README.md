# Tessera

**Issues and docs, in one weave.** A keyboard-driven workspace that blends the
parts of Linear worth copying (cycles, a board with honest drag & drop,
keyboard everything) with the parts of Notion worth keeping (nested pages, a
block editor, `/` commands) — plus an AI assistant you connect yourself.

No backend. No build step. Your account, workspace and API key all live in
this browser's localStorage; exports are one JSON file away in Settings.

## Running it

```sh
python3 -m http.server 8080   # or: npx serve .
```

Open http://localhost:8080, create your workspace, go. GitHub Pages works as-is.

## The docs side (the Notion half)

- **Covers** — gradient covers above the page icon, one click to set or swap
- **Templates** — Meeting notes / Weekly plan / Project brief when creating a page
- **Toggle blocks** — collapsible sections; Tab nests anything under them
- **Tables** — editable cells, header row, add/remove rows & columns
- **Images** — embed by URL, with captions; click to replace
- **Block handles** — hover any block: turn into any type, duplicate, move up/down, delete
- **Trash** — deleted pages are recoverable until purged
- **Full-text search** — ⌘K finds pages by body content with snippets
- **Print / PDF** — clean print stylesheet per page; export as Markdown too
- Reading time, word count, favorites, nested sub-pages

## Feature highlights

- **AI subtask generation** — open any issue, hit *Generate*, review the
  AI's proposed breakdown (edit priorities, uncheck what you don't want),
  and create them as real linked subtasks in one click.
- **Subtasks** — inline composer in the drawer, progress bar, done-toggle,
  parent breadcrumbs on children.
- **Searchable model picker** — fuzzy search across OpenRouter's entire live
  catalog from the assistant header or Settings; exact-id escape hatch for
  anything not listed.
- **Issue deep links** — `#/issue/<id>` routes; copy-link button in the drawer.
- **Regenerate** the last assistant reply, due-date quick picks
  (Today / Tomorrow / Next week), duplicate issues, export any page as
  Markdown.
- **Installable & offline** — PWA manifest, generated icons, service worker
  that caches the shell (network-first for navigations so deploys land).

## What changed in v2

- **Real onboarding** — local signup/sign-in (salted SHA-256, no plaintext),
  session gating, sign out, and a workspace that starts empty instead of
  pretending to be someone else's.
- **AI assistant** — plug in an OpenRouter key from Settings → AI and get
  streaming chat with markdown rendering, a model picker (full catalog fetched
  live), optional workspace context ("summarize my open issues" actually reads
  them), stop/regenerate, and copy-to-clipboard. The key never leaves this
  browser; requests go straight to openrouter.ai.
- **Full UI pass** — new motion system (staggered view reveals, springy
  overlays, count-up stats), refined surfaces and controls, collapsible sidebar
  sections, better empty states everywhere, and a proper mobile layout:
  bottom tab bar, slim top bar, sheet-style drawer, snap-scrolling board.

## Keyboard shortcuts

Press `?` anywhere. Highlights:

| Key | Action |
| --- | --- |
| `⌘K` | Command palette |
| `C` | New issue |
| `G` then `H/I/A/B/C/P/D/K` | Home / My / All / Board / Cycles / Projects / Docs / AI |

## Architecture

Vanilla ES modules, hand-written CSS, zero dependencies:

```
js/
├── main.js          boot, auth gate, router, shortcuts, motion
├── auth.js          local accounts (hashed) + session
├── store.js         state + localStorage persistence (v2 schema)
├── editor.js        block editor engine
├── openrouter.js    streaming client + model catalog
├── md.js            tiny markdown renderer for AI output
├── ai.js            assistant page          (js/views/)
├── welcome.js       signup / sign-in screens
├── palette.js       ⌘K command menu
├── issue-drawer.js  slide-over issue editor
├── doctree.js       nested page tree
├── tabbar.js        mobile bottom navigation
└── views/           home, issues, board, cycles, projects, docs, settings
```

## Privacy notes

- Passwords are hashed before storage; sessions are a local flag.
- The OpenRouter key is stored locally and stripped from exports.
- There is no server. "Delete everything" in Settings actually means it.

---

MIT licensed. Built by Farhaj Maaz.
