# Repository Graph Index

Fast lookup map of repository elements modeled as **nodes** and **edges** so LLMs and contributors can locate exact paths, game filenames, and code anchors without blind searching or spelling guesses.

> The code is always the source of truth. Keep this file updated when adding, renaming, moving, or removing files, games, sections, or major elements (see `AGENTS.md`).

---

## Core Nodes

| Node ID | Kind | Path | Role / Summary |
| :--- | :--- | :--- | :--- |
| `shell:index` | `entry` | `index.html` | Landing page HTML: header, Retro/Junior tab switcher, controls, dual tabpanels, play overlay, details dialog |
| `shell:styles` | `stylesheet` | `arcade.css` | Neon arcade & Junior Arcade visual themes, tab switcher styles, cabinet grid, responsive & reduced-motion rules |
| `shell:runtime` | `script` | `arcade.js` | Repo detection, GitHub Contents API + `localStorage` caching, dual-section state, metadata parser, previews, play modal |
| `dir:games` | `directory` | `games/` | Classic retro browser games rendered in the **Retro Arcade** section |
| `dir:junior-games` | `directory` | `junior-games/` | Toddler-friendly browser games rendered in the **Junior Arcade** section |
| `dir:junior-audio` | `directory` | `junior-games/audio/phonics/` | Shared British English phonics `.m4a` clips (`letters/`, `words/`) & voice-swap `README.md` |
| `junior:phonics-audio` | `script` | `junior-games/audio/phonics-audio.js` | Shared Web Audio / HTMLAudio British phonics playback engine + 18 cycling cue-word sprites (`window.PhonicsAudio`) |
| `doc:index` | `doc` | `docs/index.md` | This graph-style repository index |
| `doc:overview` | `doc` | `docs/implementation/overview.md` | Thin architecture and cross-file relationship overview |
| `doc:agents` | `doc` | `AGENTS.md` | Agent workflow rules for using and maintaining `docs/index.md` and `docs/implementation/` |
| `skill:retro-standard` | `skill` | `.agents/skills/retro-game-html-standard/SKILL.md` | Single-file HTML retro game metadata, embed, and validation standard |
| `meta:readme` | `doc` | `README.md` | Short repository title and tagline |
| `meta:license` | `config` | `LICENSE` | MIT License |

---

## Edges (Relationships)

```text
shell:index   --loads-->       shell:styles
shell:index   --loads-->       shell:runtime
shell:runtime --discovers-->   dir:games         (section key: "arcade")
shell:runtime --discovers-->   dir:junior-games  (section key: "junior")
shell:runtime --renders-into--> shell:index      (#panel-arcade, #panel-junior, .play, dialog.details)
shell:styles  --themes-->      shell:index       (default + body[data-section="junior"])
dir:games     --contains-->    game:*
dir:junior-games --contains--> junior:*
junior:phonics-pop, junior:phonics-trace, junior:word-builder --loads--> junior:phonics-audio
junior:phonics-audio --plays--> dir:junior-audio
doc:agents    --governs-->     doc:index
doc:agents    --governs-->     doc:overview
skill:retro-standard --governs--> dir:games, dir:junior-games
doc:overview  --describes-->   shell:index, shell:styles, shell:runtime, dir:games, dir:junior-games
```

---

## Game Catalog Nodes

Exact filenames and display aliases (note non-English filenames and renamed classics).

### Retro Arcade (`dir:games` -> `games/`)

| Node ID | Path | Title | Aliases / Inspiration | Genre | Year | Accent |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `game:barrel-jumper` | `games/barrel-jumper.html` | Barrel Jumper | Donkey Kong, barrels, ladders | Platformer | 1981 | `#ff4d6d` |
| `game:blokris` | `games/blokris.html` | Blokris | Tetris, falling blocks | Puzzle | 2026 | `#00f0ff` |
| `game:borrel-belle` | `games/borrel-belle.html` | Borrel Belle | Bubble Bobble, cave critters | Platformer | 1986 | `#38f2ff` |
| `game:bubble-pop` | `games/bubble-pop.html` | Bubble Pop | Toddler bubble popper | Arcade | 2026 | `#ff6ec7` |
| `game:motordiefstal` | `games/motordiefstal-op-groot-skaal.html` | Motordiefstal op Groot Skaal | GTA, top-down crime sandbox | Action | 1997 | `#ff2e93` |
| `game:neon-drift` | `games/neon-drift.html` | Neon Drift | OutRun, synthwave highway racer | Racing | 1986 | `#ff2a85` |
| `game:slang` | `games/slang.html` | Slang | Snake, neon serpent | Arcade | 1976 | `#39ff14` |
| `game:snack-man` | `games/snack-man.html` | Snack-Man | Maze chomper, pellets, ghosts | Arcade | 1980 | `#ffd60a` |

### Junior Arcade (`dir:junior-games` -> `junior-games/`)

| Node ID | Path | Title | Audience / Notes | Genre | Year | Accent |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `junior:bubble-pop` | `junior-games/bubble-pop.html` | Bubble Pop | Toddlers & kids, touch/click popping | Arcade | 2026 | `#ff6ec7` |
| `junior:shape-tracer` | `junior-games/shape-tracer.html` | Shape Tracer | Toddlers & kids, shape tracing & spoken naming | Puzzle | 2026 | `#38d9ff` |
| `junior:letter-tracer` | `junior-games/letter-tracer.html` | Letter Tracer | Toddlers & kids, A–Z letter tracing & phonics sounds | Puzzle | 2026 | `#ff9f43` |
| `junior:animal-sorter` | `junior-games/animal-sorter.html` | Animal Sorter | Toddlers & kids, touch drag animals to pictorial habitats | Puzzle | 2026 | `#39e58c` |
| `junior:phonics-pop` | `junior-games/phonics-pop.html` | Phonics Pop | Toddlers, 2-stage s/a/t/p/i/n phonics bubble popping | Arcade | 2026 | `#ff5ca8` |
| `junior:phonics-trace` | `junior-games/phonics-trace.html` | Phonics Trace | Toddlers, 2-stage lowercase s/a/t/p/i/n neon path tracing | Puzzle | 2026 | `#38d9ff` |
| `junior:word-builder` | `junior-games/word-builder.html` | Word Builder | Toddlers, 2-stage drag-and-drop phonics word building & blending | Puzzle | 2026 | `#ffe14d` |

---

## Key Symbols & DOM Anchors

Quick pointers inside the landing page shell so you know which file owns which concept.

| Anchor / Symbol | Owner Node | Purpose |
| :--- | :--- | :--- |
| `.section-tablist`, `#tab-arcade`, `#tab-junior` | `shell:index` | Accessible 2-section tab toggle (`role="tablist"`, `focusgroup="tablist nomemory"`) |
| `#panel-arcade`, `#panel-junior` | `shell:index` | Dedicated section `tabpanel`s (`hidden="until-found"` when inactive) |
| `.junior-hero`, `.junior-space`, `.grid--junior` | `shell:index`, `shell:styles` | Dedicated toddler-friendly banner and card styling for Junior Arcade |
| `body[data-section="junior"]` | `shell:styles`, `shell:runtime` | Active-section attribute driving Junior theme accents on controls and switcher |
| `.play`, `dialog.details` | `shell:index`, `shell:runtime` | Full-viewport game play overlay (with fullscreen toggle) and Game Info modal |
| `CONFIG.sections` | `shell:runtime` | Maps section keys (`arcade`, `junior`) to repo folders (`games`, `junior-games`) and UI copy |
| `detectRepo()` | `shell:runtime` | Resolves `owner/repo` from `?repo=`, `CONFIG`, or `*.github.io` |
| `fetchDirectoryListing()`, `fetchGameMeta()` | `shell:runtime` | GitHub Contents API fetch + ETag/SHA `localStorage` caching (`retroArcade:v1:*`) |
| `parseGameHtml()` | `shell:runtime` | Parses `<title>` and `<meta name="game:*">` contract from each game file |
| `setActiveSection()` | `shell:runtime` | Switches Retro/Junior tabs, panels, theme, title, URL hash (`#junior`), and preview observer |
| `openGame()`, `closeGame()`, `syncFromHash()` | `shell:runtime` | Launches/closes iframe overlay and syncs `#play=<section>/<file>` & `#junior` hashes |
| `meta[name="game:*"]` | `dir:games`, `dir:junior-games` | Game metadata contract: `genre`, `tags`, `added`, `year`, `controls`, `author`, `color` |
