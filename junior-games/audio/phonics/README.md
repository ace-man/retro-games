# British English Phonics Audio Pack

Shared audio assets for the toddler phonics games in `junior-games/`:
- `phonics-pop.html`
- `phonics-trace.html`
- `word-builder.html`

## Folder Layout

- `letters/` — Pure lowercase letter sounds (no letter names, no extra "uh"):
  `s.m4a`, `a.m4a`, `t.m4a`, `p.m4a`, `i.m4a`, `n.m4a`
- `words/` — Spoken British English target words and cycling cue words:
  - **Word Builder Stage 1:** `tap`, `sat`, `pat`, `sap`, `at`
  - **Word Builder Stage 2:** `pin`, `pan`, `tin`, `ant`, `sit`, `nap`, `sip`, `pit`, `in`
  - **Cue words (3 per letter, sharing `ant`, `tap`, `pan`):**
    - `s`: `snake`, `sun`, `sock`
    - `a`: `apple`, `ant`, `alligator`
    - `t`: `tap`, `tent`, `tiger`
    - `p`: `pan`, `pig`, `penguin`
    - `i`: `igloo`, `ink`, `insect`
    - `n`: `net`, `nest`, `nut`

## Swapping In Your Own Voice Anytime

Every sound is loaded by filename (`letters/<letter>.m4a` or `words/<word>.m4a`). You can replace any single clip — or all of them — with your own voice without editing any HTML or JS:

1. Record the sound or word in **Voice Memos** on iPhone or Mac (which saves directly as `.m4a`).
2. Trim leading silence so playback feels instant on tap.
3. Rename the file to match the target clip (for example `a.m4a` or `apple.m4a`) and overwrite the file in `letters/` or `words/`.

If you record in `.wav`, convert to `.m4a` on macOS with:

```sh
afconvert -f m4af -d aac -b 64000 my-recording.wav junior-games/audio/phonics/letters/a.m4a
```

## Audio Sources & Credits

- **`letters/*.m4a`**: British English Phase 2 synthetic phonics recordings from [hellodeborahuk/buzzphonics](https://github.com/hellodeborahuk/buzzphonics) (Copyright (c) 2022 Debbie Dann, **MIT License**), trimmed and level-normalized for instant touch playback.
- **`words/*.m4a`**: British English (`en-GB-LibbyNeural`) word recordings cached locally as `.m4a` for consistent volume, accent, and offline reliability.
