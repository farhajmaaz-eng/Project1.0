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
