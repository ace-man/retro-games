---
name: retro-game-html-standard
description: Standardize HTML arcade games for the GitHub Pages Retro Arcade and Junior Arcade gallery. Use whenever creating, editing, or reviewing a classic game in games/ or a toddler/preschool game in junior-games/ so the landing page can automatically discover, filter, sort, preview, embed, and apply Junior toddler-lock guards and shared audio/image assets.
---

# Retro & Junior Game HTML Standard

Ensure every game in `games/` (**Retro Arcade**) and `junior-games/` (**Junior Arcade**) follows a uniform metadata, embed, shared-asset, and toddler-guard contract so the root `index.html` gallery can discover, filter, sort, preview, and launch it automatically with zero manual edits.

## When to Use

- Creating a new classic retro game for `games/` or toddler/preschool game for `junior-games/`
- Updating or refactoring an existing game so it appears, previews, scales, and filters properly in the arcade gallery
- Adding shared sounds, illustrations, or toddler-lock guards to Junior Arcade games
- Reviewing a game HTML file before committing it to the repository

## Steps

### 1. File Location and Naming

- **Classic games (Retro Arcade)**: Save as a single self-contained `.html` file directly inside `games/` (for example, `games/tetris.html`, `games/snack-man.html`). Inline all CSS, JavaScript, and small assets (SVG or Canvas drawing, Web Audio API synth) so the file works identically from `games/<slug>.html`, inside an iframe, or offline.
- **Toddler & preschool games (Junior Arcade)**: Save as a top-level `.html` file directly inside `junior-games/` (for example, `junior-games/bubble-pop.html`, `junior-games/phonics-pop.html`). Keep game logic and styles inline, and place any shared scripts or reusable media in subfolders under `junior-games/` (`shared/`, `audio/`, `images/`). `arcade.js` discovers strictly top-level `.html` files, so subfolders and shared assets never appear as gallery cards.
- Use lowercase kebab-case filenames with no spaces or special characters.

### 2. Required `<head>` Metadata

Include these tags in `<head>` so the landing page parser (`DOMParser`) can index the game cleanly without running scripts:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Tetris</title>
    <meta name="description" content="Classic falling-block puzzle game with line clears, hold piece, and rising speed." />
    <meta name="game:genre" content="Puzzle" />
    <meta name="game:tags" content="blocks, classic, 1-player, keyboard, endless" />
    <meta name="game:added" content="2026-11-21" />
    <meta name="game:year" content="1984" />
    <meta name="game:controls" content="Arrow keys or WASD to move and rotate, Space to hard drop, P to pause, M to mute" />
    <meta name="game:author" content="Arcade Bot" />
  </head>
```

Field rules:

- `<title>`: Required. Human-readable game name only (no suffixes like "- Retro Game" or ".html"). Used for display, search, and A-Z sorting.
- `description`: Required. One crisp sentence (under 140 characters) shown on the cabinet card and details dialog.
- `game:genre`: Required. Pick exactly one canonical genre from this list so the genre filter stays clean and consistent:
  - `Arcade`
  - `Puzzle`
  - `Shooter`
  - `Action`
  - `Platformer`
  - `Racing`
  - `Strategy`
  - `Sports`
  - `Card & Board`
  - `Other`
- `game:tags`: Required. Comma-separated list of 2 to 5 lowercase kebab-case tags (for example: `maze, classic, 1-player, keyboard, touch`). Avoid duplicating the genre name as a tag.
- `game:added`: Required. ISO date (`YYYY-MM-DD`) when the game was added to the repo. Used by the "Recent" sort.
- `game:year`: Optional. 4-digit year of the original arcade classic or creation year (for example, `1980`).
- `game:controls`: Recommended. Short, plain-text summary of keyboard and touch controls shown in the details dialog.
- `game:author`: Optional. Creator or agent name.
- `game:color`: Optional. Hex accent color for the cabinet glow (for example, `#ffd60a`). Omit to use the gallery's default color for the chosen genre.

### 3. Iframe Preview and Fullscreen Compatibility

The landing page renders each game in two contexts: a scaled square preview tile on the gallery grid and a full-viewport iframe overlay when played (plus standalone direct opening). Design the game to work smoothly in all three:

- Fill the viewport cleanly (`html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }`) and size the canvas from `canvas.getBoundingClientRect()` (with `ResizeObserver` and `window.resize`) rather than `window.innerWidth` / `window.innerHeight`, so it adapts cleanly inside previews, overlays, and below the Junior adult control bar.
- Keep compact square gallery previews clean by hiding DOM HUD toolbars below `300px` inline size (for example, `@container stage (inline-size < 300px) { .hud-bar { display: none; } }`).
- Show an attractive title or attract screen immediately on load so the cabinet preview looks alive before any click.
- Never start audio until a user gesture (click, tap, or keypress). Unmuted audio on load breaks silent gallery previews.
- Call `event.preventDefault()` on Arrow keys and Spacebar during gameplay so key presses never scroll a host page.
- Pause automatically on `window.blur` and `document.visibilitychange` so background tabs or closed overlays do not keep running.
- Use a fixed timestep or clamped `dt` (for example, `Math.min(dt, 0.05)`) so physics stay consistent across 60 Hz, 120 Hz, and 240 Hz displays.

### 4. Junior Arcade Standards (`junior-games/`)

Every toddler/preschool game placed in `junior-games/` must follow these shared guard, asset, and touch-UX conventions:

#### A. Required Toddler-Lock Guard (`junior-games/shared/junior-guard.js`)

Include `viewport-fit=cover` in `<head>` and load the shared guard script right before `</body>`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
...
<script src="shared/junior-guard.js" defer></script>
```

What `junior-guard.js` handles automatically (do **not** duplicate these per game):

- **Touch & back-gesture blocking**: Enforces `overscroll-behavior: none`, `touch-action: none` on the play surface (with `touch-action: manipulation` on buttons), blocks left/right/top edge-swipe `touchstart` (`44px` margin) and `touchmove`, Safari `gesture*` pinch/rotate, long-press `contextmenu`, `dragstart`/`selectstart`, horizontal trackpad `wheel` swipe-back, and keyboard back shortcuts (`BrowserBack`, `GoBack`, `Alt+ArrowLeft/Right`, `Meta+[`/`]`, `Backspace`).
- **Embedded `.play` mode (`index.html`)**: Coordinates with `arcade.js`, which hides `.play-bar` and displays the slim `.play-adult-bar` (650 ms hold-to-exit **Back** button + **Exit fullscreen** / **Fullscreen** toggle), requests fullscreen (`navigationUI: "hide"`), and traps `popstate`/`hashchange`/`Escape`. `junior-guard.js` avoids rendering a duplicate bar and stays completely inert inside gallery preview tiles.
- **Standalone mode** (opened directly at `junior-games/<slug>.html`): Injects the matching slim adult top bar (`← Back` with 650 ms hold parental gate and keyboard `Enter`/`Space` activation + `Exit fullscreen` / `Fullscreen` toggle), traps `popstate` and `beforeunload`, auto-enters fullscreen on first canvas tap (until an adult exits fullscreen), and shifts `main.stage` / `#game` and `.hud-bar` via `--junior-adult-bar-h` so nothing overlaps the game HUD.
- **Layout compatibility**: Wrap the canvas and `.hud-bar` in `<main class="stage">` (or place `<canvas id="game">` directly in `<body>`) and compute canvas dimensions from `canvas.getBoundingClientRect()` with a `ResizeObserver`.

#### B. Shared Audio Storage & Playback (`junior-games/audio/`)

- **Where to store sounds**: Place reusable audio packs in subfolders under `junior-games/audio/<pack>/` (for example, `junior-games/audio/phonics/letters/<letter>.m4a` and `junior-games/audio/phonics/words/<word>.m4a`). Prefer trimmed, level-normalized `.m4a` clips (AAC) for instant touch playback, consistent voice/accent, and offline reliability; use Web Audio synthesis for lightweight chimes/pop effects. Add a short `README.md` in any new pack folder noting asset sources, licenses, and how to swap clips.
- **Reusing the British English phonics pack**: Load `<script src="audio/phonics-audio.js"></script>` before the inline game script and call `window.PhonicsAudio`:
  - `unlock()` (call on first user gesture), `setMuted(bool)`, `stop()`, `preload()`
  - `playLetter(ch)`, `playWord(word)`, `playLetterThenWord(ch, word)`
  - `createCueCycler()`, `drawCueSprite(ctx, word, cx, cy, size)`, `CUE_WORDS_BY_LETTER`, `LETTER_LIST`
- **Custom packs**: Follow the same pattern — a small zero-dependency loader script at `junior-games/audio/<pack>-audio.js` loading clips relative to `junior-games/` (`audio/<pack>/...`) with silent fallback if offline/muted.

#### C. Shared Image Storage & Rendering (`junior-games/images/`)

- **Prefer custom-made SVGs wherever possible**: Create original, custom-made `.svg` illustrations directly in-repo with a clean `viewBox` sized to whatever aspect ratio the artwork needs (square icons/objects, wide scenes, tall characters, etc.) rather than raster images or third-party assets whenever feasible — they have zero external license restrictions, stay tiny, and scale crisply to any size on Retina Canvas displays.
- **Where to store images**: Place reusable illustrations in subfolders under `junior-games/images/<pack>/` (for example, `junior-games/images/phonics/<word>.svg`). Add a `README.md` in any new pack folder documenting asset origin (custom in-repo vs any permissively licensed third-party source), license notices, and filename-swap instructions.
- **Reusing the phonics illustration pack**: Load `<script src="images/phonics-images.js"></script>` before the inline game script and call `window.PhonicsImages`:
  - `preload(words?)`, `isReady(word)`, `urlFor(word)`, `ALL_WORDS`
  - `draw(ctx, word, cx, cy, size)` — returns `true` when drawn, or `false` while loading/missing so the game seamlessly falls back to a procedural Canvas drawing or pixel sprite (`PhonicsAudio.drawCueSprite`).
- **Custom packs**: Place loader helpers at `junior-games/images/<pack>-images.js` loading from `images/<pack>/...` and always keep a procedural Canvas fallback so previews and first frames never appear blank.

#### D. Toddler Touch UX

- Use Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) on the `<canvas>` for unified touch and mouse play.
- Give game HUD controls generous touch targets (`min-inline-size` / `min-block-size` ≥ `44px–48px` on coarse pointers), safe-area padding (`env(safe-area-inset-*)`), `touch-action: manipulation`, and `:focus-visible` rings, while keeping the canvas `touch-action: none`.
- Favor gentle pacing, large forgiving hit targets, bright high-contrast visuals, and encouraging audio/celebrations with no punishing fail states.

### 5. Pre-Commit Validation Checklist

Before finishing a game file, verify:

- Classic game lives at `games/<lowercase-kebab-case>.html` with no external local asset dependencies; Junior game lives at `junior-games/<lowercase-kebab-case>.html` and uses only subfolders (`shared/`, `audio/`, `images/`) for shared scripts/assets.
- `<title>`, `description`, `game:genre` (from the canonical list), `game:tags` (2 to 5 lowercase tags), and `game:added` (`YYYY-MM-DD`) are all present in `<head>`.
- For Junior games: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />` and `<script src="shared/junior-guard.js" defer></script>` are included, and canvas sizing uses `canvas.getBoundingClientRect()` (with `ResizeObserver`).
- Game renders cleanly inside an iframe preview (no scrollbars, no overlapping HUD/adult bar, no console errors, no sound before user input) and standalone.
- `docs/index.md` is updated with the new game (and any new shared asset node) per `AGENTS.md`.

## Gotchas

- Putting multiple genres in `game:genre` (such as `Arcade, Puzzle`) creates fragmented filter entries. Put the primary genre in `game:genre` and secondary descriptors in `game:tags`.
- Using uppercase or inconsistent pluralization in `game:tags` (such as `Classic` vs `classic`, `1 player` vs `1-player`) splits tags in the filter menu. Always use lowercase kebab-case.
- Relying on `localStorage` without a unique key prefix causes games on the same GitHub Pages origin to overwrite each other's scores or progress. Prefix keys with the game slug (for example, `tetris:highscore`, `phonics-pop:stars`).
- Placing extra `.html` files directly inside `games/` or `junior-games/` causes `arcade.js` to list them as playable cabinets. Keep shared scripts, audio, images, and docs inside subfolders (`shared/`, `audio/`, `images/`).
- Sizing a Junior game canvas from `window.innerWidth` / `window.innerHeight` instead of `canvas.getBoundingClientRect()` clips the bottom edge when the standalone adult bar is mounted at the top.
- Building a custom per-game Back/Fullscreen overlay or duplicate touch-gesture blocker inside a Junior game conflicts with `shared/junior-guard.js` and `arcade.js`'s `.play-adult-bar`. Always rely on `shared/junior-guard.js`.
