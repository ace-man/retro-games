(() => {
  "use strict";

  const BASE_PATH = "images/phonics";

  const ALL_WORDS = [
    // Cycling cue words (3 per letter)
    "snake", "sun", "sock",
    "apple", "ant", "alligator",
    "tap", "tent", "tiger",
    "pan", "pig", "penguin",
    "igloo", "ink", "insect",
    "net", "nest", "nut",
    // Additional Word Builder words (tap, pan, ant shared above)
    "sat", "pat", "sap", "at",
    "pin", "tin", "sit", "nap", "sip", "pit", "in",
  ];

  // In-memory image cache: word -> { img, loaded, failed }
  const cache = new Map();

  function normalizeWord(word) {
    return String(word || "").trim().toLowerCase();
  }

  function urlFor(word) {
    return `${BASE_PATH}/${encodeURIComponent(normalizeWord(word))}.svg`;
  }

  function ensureEntry(word) {
    const key = normalizeWord(word);
    if (!key) return null;
    if (cache.has(key)) return cache.get(key);

    const entry = { img: null, loaded: false, failed: false };
    cache.set(key, entry);

    if (typeof Image !== "function") {
      entry.failed = true;
      return entry;
    }

    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      entry.loaded = img.naturalWidth > 0 && img.naturalHeight > 0;
      if (!entry.loaded) entry.failed = true;
    };
    img.onerror = () => {
      entry.failed = true;
    };
    img.src = urlFor(key);
    entry.img = img;
    return entry;
  }

  function preload(words) {
    const list = Array.isArray(words) && words.length ? words : ALL_WORDS;
    for (let i = 0; i < list.length; i++) {
      ensureEntry(list[i]);
    }
  }

  function isReady(word) {
    const entry = cache.get(normalizeWord(word));
    return !!(entry && entry.loaded && entry.img);
  }

  /**
   * Draw the SVG illustration centered at (cx, cy) inside a size x size square.
   * Returns true if the SVG was drawn, or false if still loading / unavailable
   * so callers can seamlessly fall back to procedural pixel-art sprites.
   */
  function draw(ctx, word, cx, cy, size) {
    if (!ctx || !word || !(size > 0)) return false;
    const entry = ensureEntry(word);
    if (!entry || !entry.loaded || !entry.img) return false;

    const nw = entry.img.naturalWidth || 256;
    const nh = entry.img.naturalHeight || 256;
    const scale = Math.min(size / nw, size / nh);
    const dw = nw * scale;
    const dh = nh * scale;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) {
      ctx.imageSmoothingQuality = "high";
    }
    ctx.drawImage(entry.img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
    return true;
  }

  window.PhonicsImages = {
    BASE_PATH,
    ALL_WORDS,
    urlFor,
    preload,
    isReady,
    draw,
  };
})();
