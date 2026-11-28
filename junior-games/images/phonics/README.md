# Phonics SVG Illustration Pack

High-resolution, toddler-friendly vector illustrations (`.svg`, normalized to `256×256` with original `viewBox` preserved for crisp Retina Canvas rendering) shared across:

- `junior-games/phonics-pop.html`
- `junior-games/phonics-trace.html`
- `junior-games/word-builder.html`

Loaded via [`junior-games/images/phonics-images.js`](../phonics-images.js) with automatic fallback to procedural pixel-art sprites while loading or if an image file is missing.

## Sources & Licensing

### 1. Microsoft Fluent Emoji — Color SVGs (17 objects)

Licensed under the **MIT License** (`Copyright (c) Microsoft Corporation`) from [`microsoft/fluentui-emoji`](https://github.com/microsoft/fluentui-emoji):

- `alligator.svg` (Crocodile), `apple.svg` (Red apple)
- `insect.svg` (Lady beetle), `nap.svg` (Sleeping face), `nest.svg` (Nest with eggs)
- `nut.svg` (Chestnut), `pan.svg` (Cooking), `penguin.svg` (Penguin)
- `pig.svg` (Pig face), `pin.svg` (Pushpin), `sip.svg` (Cup with straw)
- `snake.svg` (Snake), `sock.svg` (Socks), `sun.svg` (Sun with face)
- `tent.svg` (Tent), `tiger.svg` (Tiger face), `tin.svg` (Canned food)

> MIT License — Copyright (c) Microsoft Corporation. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, subject to the MIT license notice.

### 2. Custom Storybook Vector SVGs (12 objects & action scenes)

Original vector artwork created in-repo in matching soft-shaded rounded style (no external license restrictions):

- `ant.svg`, `at.svg`, `igloo.svg`, `in.svg`, `ink.svg`, `net.svg`, `pat.svg`, `pit.svg`, `sap.svg`, `sat.svg`, `sit.svg`, `tap.svg`

## Swapping in Custom Images

Replace any `<word>.svg` file in this folder with your own square SVG (keeping the exact lowercase filename, e.g. `apple.svg`, `tap.svg`, `sat.svg`). No code changes are required.
