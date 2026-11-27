---
name: retro-game-html-standard
description: Standardize single-file HTML retro games for a GitHub Pages arcade gallery. Use whenever creating, editing, or reviewing a standalone HTML retro game to place in the games/ folder so the landing page can automatically discover, filter by title, genre, tags, and date added, sort, preview, and embed it in an iframe overlay.
---

# Retro Game HTML Standard

Ensure every single-file HTML retro game in the `games/` folder follows a uniform metadata and embed contract so the root `index.html` gallery can discover, filter, sort, preview, and launch it automatically with zero manual edits.

## When to Use

- Creating a new single-file HTML retro game for the `games/` folder
- Updating or refactoring an existing game so it appears and filters properly in the arcade gallery
- Reviewing a game HTML file before committing it to the repository

## Steps

### 1. File Location and Naming

- Save every game as a single self-contained `.html` file directly inside the `games/` directory (for example, `games/tetris.html`, `games/pac-man.html`, `games/space-invaders.html`).
- Use lowercase kebab-case filenames with no spaces or special characters.
- Inline all CSS, JavaScript, and small assets (SVG or Canvas drawing, Web Audio API synth) so the file works identically from `games/<slug>.html`, inside an iframe, or offline.

### 2. Required `<head>` Metadata

Include these tags in `<head>` so the landing page parser (`DOMParser`) can index the game cleanly without running scripts:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
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

The landing page renders each game in two contexts: a scaled square preview tile on the gallery grid and a full-viewport iframe overlay when played. Design the game to work smoothly in both:

- Fill the viewport cleanly (`html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }`) and scale the canvas to fit both square previews and widescreen or mobile screens.
- Show an attractive title or attract screen immediately on load so the cabinet preview looks alive before any click.
- Never start audio until a user gesture (click, tap, or keypress). Unmuted audio on load breaks silent gallery previews.
- Call `event.preventDefault()` on Arrow keys and Spacebar during gameplay so key presses never scroll a host page.
- Pause automatically on `window.blur` and `document.visibilitychange` so background tabs or closed overlays do not keep running.
- Use a fixed timestep or clamped `dt` (for example, `Math.min(dt, 0.05)`) so physics stay consistent across 60 Hz, 120 Hz, and 240 Hz displays.

### 4. Pre-Commit Validation Checklist

Before finishing a game file, verify:

- File lives at `games/<lowercase-kebab-case>.html` with no external local asset dependencies.
- `<title>`, `description`, `game:genre` (from the canonical list), `game:tags` (2 to 5 lowercase tags), and `game:added` (`YYYY-MM-DD`) are all present in `<head>`.
- Game renders cleanly inside an iframe with no scrollbars, no console errors, and no sound before user input.

## Gotchas

- Putting multiple genres in `game:genre` (such as `Arcade, Puzzle`) creates fragmented filter entries. Put the primary genre in `game:genre` and secondary descriptors in `game:tags`.
- Using uppercase or inconsistent pluralization in `game:tags` (such as `Classic` vs `classic`, `1 player` vs `1-player`) splits tags in the filter menu. Always use lowercase kebab-case.
- Relying on `localStorage` without a unique key prefix causes games on the same GitHub Pages origin to overwrite each other's high scores. Prefix keys with the game slug (for example, `tetris:highscore`).
