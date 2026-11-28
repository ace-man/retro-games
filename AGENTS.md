# AGENTS.md

Instructions for AI coding agents working in `retro-games`.

## 1. Purpose of `./docs/index.md` and `./docs/implementation/`

These docs exist to **avoid bloating your context window with unnecessary context that is not needed for your current task**:

- **`./docs/index.md`** is a compact graph index (nodes, exact paths, game aliases, edges, and key symbols). Use it to locate and read **only** the exact files relevant to your task — avoiding broad directory scans, speculative `grep`/`find` output, and filename guesswork (several games use non-English or custom filenames).
- **`./docs/implementation/`** holds thin, focused architectural docs (starting with `./docs/implementation/overview.md`) describing high-level structure, cross-file relationships, and contracts. Use them to understand how subsystems connect **without reading unrelated source files** into your context window — and only read the doc(s) relevant to your current task (skip them for isolated single-file edits).

## 2. Orient Using the Docs First

Before searching the repository with `grep`, `find`, or filename guesses:

1. **Read `./docs/index.md` first** to identify the minimal set of files needed for your task.
2. **Read relevant docs in `./docs/implementation/`** (e.g., `./docs/implementation/overview.md`) **only when your task needs architectural or cross-file context** (such as landing page shell behavior, discovery/caching flow, or game contracts).
3. **Treat the code as the source of truth.** Docs are intentionally thin reference layers — always verify exact implementation details in the targeted source files before editing.

## 3. Keep `./docs/index.md` Up to Date

Whenever your changes alter the repository's structure or navigable elements, update `./docs/index.md` in the same task:

- **Adding, renaming, moving, or removing a game** in `games/` or `junior-games/`: add, update, or remove its row in the **Game Catalog Nodes** table with exact path, title, aliases, genre, year, and accent color.
- **Adding, renaming, moving, or removing a file, folder, or section**: update **Core Nodes** and **Edges (Relationships)**.
- **Adding or renaming a major symbol, DOM anchor, or config section** in the landing page shell: update **Key Symbols & DOM Anchors**.

Do not bloat `./docs/index.md` with implementation minutiae or line numbers; keep each entry concise and path-accurate so it remains cheap to load into context.

## 4. Keep `./docs/implementation/` Up to Date

Update `./docs/implementation/overview.md` (or add a small focused doc under `./docs/implementation/` only when a genuinely new subsystem is introduced) **only when structural or behavioral context changes**, such as:

- New top-level folders, sections, or landing page modes
- Changes to how games are discovered, cached, or launched
- Changes to the `<meta name="game:*">` contract or cross-file relationships

Keep updates brief, modular, and high-level so agents only load the architectural context they need — routine bug fixes, visual tweaks, or adding another standard game file do **not** require rewriting implementation docs (updating `./docs/index.md` is enough for new games).

## 5. Quick Repo Conventions

- **Classic games** go in `./games/<slug>.html` (shown under **Retro Arcade**).
- **Toddler / preschool games** go in `./junior-games/<slug>.html` (shown under **Junior Arcade**).
- Each game must be a self-contained single-file HTML document with full-viewport, zero-scrollbar layout and `<meta name="game:*">` tags (`genre`, `tags`, `added`, `year`, `controls`, `author`, `color`) plus `<title>` and `<meta name="description">`.
