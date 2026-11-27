# AGENTS.md

Instructions for AI coding agents working in `retro-games`.

## 1. Orient Using the Docs First

Before searching the repository with `grep`, `find`, or filename guesses:

1. **Read `./docs/index.md` first.** It acts as a lightweight graph index (nodes, exact paths, game aliases, edges, and key symbols) so you can go straight to the right file without spelling guesswork (several games use non-English or custom filenames).
2. **Read `./docs/implementation/overview.md`** when you need architectural context on how the landing page shell, game folders, and discovery/caching flow connect.
3. **Treat the code as the source of truth.** Docs are intentionally thin reference layers — always verify exact implementation details against the source files before editing.

## 2. Keep `./docs/index.md` Up to Date

Whenever your changes alter the repository's structure or navigable elements, update `./docs/index.md` in the same task:

- **Adding, renaming, moving, or removing a game** in `games/` or `junior-games/`: add, update, or remove its row in the **Game Catalog Nodes** table with exact path, title, aliases, genre, year, and accent color.
- **Adding, renaming, moving, or removing a file, folder, or section**: update **Core Nodes** and **Edges (Relationships)**.
- **Adding or renaming a major symbol, DOM anchor, or config section** in the landing page shell: update **Key Symbols & DOM Anchors**.

Do not bloat `./docs/index.md` with implementation minutiae or line numbers; keep each entry concise and path-accurate.

## 3. Keep `./docs/implementation/` Up to Date

Update `./docs/implementation/overview.md` (or add a small focused doc under `./docs/implementation/` only when a genuinely new subsystem is introduced) **only when structural or behavioral context changes**, such as:

- New top-level folders, sections, or landing page modes
- Changes to how games are discovered, cached, or launched
- Changes to the `<meta name="game:*">` contract or cross-file relationships

Keep updates brief and high-level — routine bug fixes, visual tweaks, or adding another standard game file do **not** require rewriting implementation docs (updating `./docs/index.md` is enough for new games).

## 4. Quick Repo Conventions

- **Classic games** go in `./games/<slug>.html` (shown under **Retro Arcade**).
- **Toddler / preschool games** go in `./junior-games/<slug>.html` (shown under **Junior Arcade**).
- Each game must be a self-contained single-file HTML document with full-viewport, zero-scrollbar layout and `<meta name="game:*">` tags (`genre`, `tags`, `added`, `year`, `controls`, `author`, `color`) plus `<title>` and `<meta name="description">`.
