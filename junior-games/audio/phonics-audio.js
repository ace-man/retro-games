(() => {
  "use strict";

  const BASE_PATH = "audio/phonics";
  const LETTER_LIST = ["s", "a", "t", "p", "i", "n"];

  // -------------------------------------------------------------------------
  // Multiple Cycling British English Cue Words & 12x12 Pixel-Art Sprites
  // 3 distinct, toddler-friendly cue words per letter (pure initial phoneme)
  // -------------------------------------------------------------------------
  const CUE_WORDS_BY_LETTER = {
    s: ["snake", "sun", "sock"],
    a: ["apple", "ant", "alligator"],
    t: ["tap", "tent", "tiger"],
    p: ["pan", "pig", "penguin"],
    i: ["igloo", "ink", "insect"],
    n: ["net", "nest", "nut"],
  };

  const CUE_SPRITES = {
    // --- s ---
    snake: {
      palette: { G: "#3fe070", D: "#1d8f44", Y: "#ffe14d", R: "#ff4d6d", W: "#ffffff", K: "#120b2e" },
      rows: [
        "....GGGG....",
        "...GWGKGG...",
        "..GGGGGGGG..",
        ".R.GGGGDD...",
        "...GGDD.....",
        "....GGGGGG..",
        "......GGDDG.",
        ".....GGDDGG.",
        "..GGGGDDGG..",
        ".GGYGGGGG...",
        "..GGGGGG....",
        "............",
      ],
    },
    sun: {
      palette: { Y: "#ffe14d", O: "#ff9f43", W: "#fff8cc", K: "#2b1606", P: "#ff5ca8" },
      rows: [
        ".....OO.....",
        ".O...OO...O.",
        "..O.YYYY.O..",
        "...YYWWYY...",
        "..YWWYYYYY..",
        "OOYKYYYYKYOO",
        "OOYYYYYYYYOO",
        "..YPYYYYPY..",
        "...YYKKYY...",
        "..O.YYYY.O..",
        ".O...OO...O.",
        ".....OO.....",
      ],
    },
    sock: {
      palette: { W: "#ffffff", R: "#ff4d6d", B: "#38d9ff", Y: "#ffe14d", D: "#2487c9" },
      rows: [
        ".....WWWW...",
        ".....RRRR...",
        ".....WWWW...",
        ".....BBBB...",
        ".....BBBB...",
        ".....YYYY...",
        "....BBBBB...",
        "...BBBBBB...",
        "..RRBBBDD...",
        ".RRRBBDD....",
        "..RRDDD.....",
        "............",
      ],
    },

    // --- a ---
    apple: {
      palette: { R: "#ff3b6b", L: "#ff85a3", D: "#b81d48", G: "#52f277", B: "#9c6236" },
      rows: [
        "......BB....",
        ".....BGGG...",
        ".....BGG....",
        "..RRR..RRR..",
        ".RLLRRRRRRR.",
        ".RLRRRRRRDR.",
        ".RRRRRRRRDR.",
        ".RRRRRRRRDR.",
        ".RRRRRRRDRR.",
        "..RRRRRRDR..",
        "...RRDRRR...",
        "....R..R....",
      ],
    },
    ant: {
      palette: { R: "#d9434e", L: "#ff7a84", D: "#8f1d28", K: "#120b2e", W: "#ffffff", G: "#52f277" },
      rows: [
        "............",
        "..K..K......",
        "...KK.......",
        "..RWRR......",
        ".RLKRR.RR...",
        "..RRRRRRRRR.",
        "...K.RRLRRR.",
        "..K..K.RDRR.",
        ".K..K..K..K.",
        "............",
        "GGGGGGGGGGGG",
        "............",
      ],
    },
    alligator: {
      palette: { G: "#3fe070", D: "#1d8f44", L: "#9dffb8", W: "#ffffff", K: "#120b2e", Y: "#ffe14d" },
      rows: [
        "............",
        "......W.W...",
        ".....GKGK...",
        "..GGGGGGGG..",
        ".GWWWWWWWWG.",
        ".GGGGGGGGGG.",
        "....DDGGGGGG",
        "..GGGGGGLLLG",
        ".GGGGGGGLLDG",
        "GGGDDGGGGGD.",
        "..GG..GG....",
        "............",
      ],
    },

    // --- t ---
    tap: {
      palette: { M: "#c8e0f4", S: "#7ba7cc", H: "#ffffff", C: "#38d9ff", B: "#1e90ff" },
      rows: [
        "...HHHHHH...",
        ".....MM.....",
        "....MMMM....",
        "MMMMMMMMS...",
        "MHHHHMMMMS..",
        "MMMMMMMMMS..",
        ".......MMS..",
        ".......CC...",
        "......CCCC..",
        "......CBBC..",
        ".......CC...",
        "............",
      ],
    },
    tent: {
      palette: { O: "#ff9f43", Y: "#ffe14d", R: "#ff4d6d", D: "#1d143d", G: "#3fe070", W: "#ffffff" },
      rows: [
        ".....RR.....",
        ".....OO.....",
        "....OYYO....",
        "....OYYO....",
        "...OOYYOO...",
        "..OOYYYYOO..",
        "..OOYDDYOO..",
        ".OOYDDDDYOO.",
        ".OOYDDDDYOO.",
        "OOYDDDDDDYOO",
        "GGGGGGGGGGGG",
        "............",
      ],
    },
    tiger: {
      palette: { O: "#ff9f43", L: "#ffd19e", K: "#1a112e", W: "#ffffff", P: "#ff5ca8", Y: "#ffe14d" },
      rows: [
        ".OO......OO.",
        "OKOO....OOKO",
        ".OOOOOOOOOO.",
        ".OOKOOOOOKO.",
        ".OOOOOOOOOO.",
        "KOOWKOOOWKOO",
        "KOOOOOOOOOOK",
        ".OOWWPPWWOO.",
        ".OOWWWWWWO..",
        "..OOWKKWOO..",
        "...OOOOOO...",
        "............",
      ],
    },

    // --- p ---
    pan: {
      palette: { D: "#3b4259", M: "#64708f", L: "#a6b4d4", W: "#ffffff", Y: "#ffe14d", O: "#ff9f43" },
      rows: [
        "............",
        ".....DDDD...",
        "...DDMMMMDD.",
        "..DMMWWWWMMD",
        "..DMWWYYWWMD",
        ".DMMWYYYYWMD",
        "DDMDMWYYOWMD",
        "DLD.DMWWWWMD",
        "DD...DDMMDD.",
        ".......DD...",
        "............",
        "............",
      ],
    },
    pig: {
      palette: { P: "#ff8cc6", L: "#ffc4e2", D: "#d94f94", K: "#1a112e", W: "#ffffff" },
      rows: [
        ".PP......PP.",
        "PDDP....PDDP",
        ".PPPPPPPPPP.",
        ".PLLLLLLLLP.",
        ".PPWKPPWKPP.",
        ".PPPPPPPPPP.",
        ".PPDDDDDDPP.",
        ".PPDKPPKDPP.",
        ".PPDDDDDDPP.",
        "..PPPPPPPP..",
        "...PPPPPP...",
        "............",
      ],
    },
    penguin: {
      palette: { D: "#232a47", M: "#3d4870", W: "#ffffff", K: "#0b081a", O: "#ff9f43", Y: "#ffe14d" },
      rows: [
        "....DDDD....",
        "...DDDDDD...",
        "..DDWDDWDD..",
        "..DWKDDKWD..",
        "..DDDOODDD..",
        "..DWWWWWWDD.",
        ".DDWWWWWWDD.",
        ".DMWWWWWWMD.",
        ".DDWWWWWWDD.",
        "..DDWWWWDD..",
        "...OO..OO...",
        "..OOO..OOO..",
      ],
    },

    // --- i ---
    igloo: {
      palette: { W: "#eef9ff", B: "#8fd8ff", C: "#4bb8f0", D: "#1d2754" },
      rows: [
        "............",
        "....WWWW....",
        "..WWBWWBWW..",
        ".WWBBBBBBWW.",
        ".WBBWWWWBBW.",
        "WBBBBBBBBBBW",
        "WBWWDDDDWWBW",
        "WBBDDDDDDBBW",
        "WBWDDDDDDWBW",
        "CCCCCCCCCCCC",
        "BBBBBBBBBBBB",
        "............",
      ],
    },
    ink: {
      palette: { P: "#6c5ce7", B: "#38d9ff", D: "#241b5c", W: "#ffffff", G: "#c8d6e5", K: "#120b2e" },
      rows: [
        "....GGGG....",
        "....GWWG....",
        ".....GG.....",
        "...GGGGGG...",
        "..GGWWWWGG..",
        "..GWWBBBBG..",
        "..GBBPPPPB..",
        "..GPPPPDPB..",
        "..GPPPPDPB..",
        "..GDDDDDDB..",
        "...GGGGGG...",
        "............",
      ],
    },
    insect: {
      palette: { R: "#ff4d6d", D: "#b81d48", K: "#18102e", W: "#ffffff", G: "#52f277" },
      rows: [
        "...K....K...",
        "....K..K....",
        "....KKKK....",
        "...KWWKWK...",
        "..KRRRRRRK..",
        ".KRRKRRKRRK.",
        ".KRRRRRRRRK.",
        ".KRKRRRRKRK.",
        "..KRRKRRRK..",
        "...KRRRRK...",
        "..K..KK..K..",
        "............",
      ],
    },

    // --- n ---
    net: {
      palette: { B: "#c88a4b", D: "#8a5627", C: "#38d9ff", W: "#d8f8ff", O: "#ff9f43" },
      rows: [
        "....OOOO....",
        "..OOCCCCOO..",
        ".OCWCWCWCWO.",
        ".OCCWCWCWCO.",
        ".OCWCWCWCWO.",
        "..OCCCCCCOO.",
        "...OOCCOO...",
        ".....BB.....",
        "....BBD.....",
        "...BBD......",
        "..BBD.......",
        ".BD.........",
      ],
    },
    nest: {
      palette: { B: "#c88a4b", D: "#8a5627", L: "#e6b47a", C: "#70e4ff", W: "#e6fbff", K: "#3a220c" },
      rows: [
        "............",
        "............",
        "...CC..CC...",
        "..CWWCCWWC..",
        "..CCCCCCCC..",
        ".BCCCCCCCCB.",
        "BBLBBLBBLBBB",
        "BDDDBDDDBDDD",
        ".BBLBBDBBLB.",
        "..DDDDDDDD..",
        "...BBBBBB...",
        "............",
      ],
    },
    nut: {
      palette: { D: "#6e401b", M: "#a6632c", L: "#d99452", H: "#f5c78e", K: "#3d220d" },
      rows: [
        ".....DD.....",
        ".....DD.....",
        "..DDDDDDDD..",
        ".DDKDDDDKDD.",
        ".DDDDDDDDDD.",
        "..MMMMMMMM..",
        "..MLLMMMMM..",
        "..MLHMMMMD..",
        "..MLMMMMMD..",
        "...MMMMMD...",
        "....MMMD....",
        ".....DD.....",
      ],
    },
  };

  // -------------------------------------------------------------------------
  // Audio Buffer Cache & Hybrid British English Playback Engine
  // Plays cached .m4a clips (Web Audio API with HTMLAudio fallback for file://)
  // and falls back gracefully to en-GB speechSynthesis if offline/missing.
  // -------------------------------------------------------------------------
  let audioCtx = null;
  let unlocked = false;
  let muted = false;
  let activeSource = null;
  let activeHtmlAudio = null;
  let seqTimer = null;
  let playToken = 0;

  const bufferCache = new Map(); // key -> AudioBuffer
  const pendingFetch = new Map(); // key -> Promise<AudioBuffer | null>
  const failedKeys = new Set();

  function keyFor(kind, name) {
    return `${kind}/${String(name).toLowerCase()}`;
  }

  function urlFor(kind, name) {
    return `${BASE_PATH}/${kind}/${encodeURIComponent(String(name).toLowerCase())}.m4a`;
  }

  function unlock(externalCtx) {
    unlocked = true;
    if (externalCtx) {
      audioCtx = externalCtx;
    } else if (!audioCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) {
        try {
          audioCtx = new Ctor();
        } catch (_) {
          audioCtx = null;
        }
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function setMuted(isMuted) {
    muted = !!isMuted;
    if (muted) stop();
  }

  function stop() {
    playToken += 1;
    if (seqTimer) {
      clearTimeout(seqTimer);
      seqTimer = null;
    }
    if (activeSource) {
      try {
        activeSource.onended = null;
        activeSource.stop();
      } catch (_) {}
      activeSource = null;
    }
    if (activeHtmlAudio) {
      try {
        activeHtmlAudio.onended = null;
        activeHtmlAudio.pause();
        activeHtmlAudio.currentTime = 0;
      } catch (_) {}
      activeHtmlAudio = null;
    }
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }

  function loadBuffer(kind, name) {
    const key = keyFor(kind, name);
    if (bufferCache.has(key)) return Promise.resolve(bufferCache.get(key));
    if (failedKeys.has(key)) return Promise.resolve(null);
    if (pendingFetch.has(key)) return pendingFetch.get(key);
    if (!audioCtx || typeof fetch !== "function" || location.protocol === "file:") {
      return Promise.resolve(null);
    }

    const url = urlFor(kind, name);
    const p = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((ab) => {
        if (!audioCtx) return null;
        // Safari older compatibility: decodeAudioData supports promise on modern browsers
        return new Promise((resolve, reject) => {
          const ret = audioCtx.decodeAudioData(ab.slice(0), resolve, reject);
          if (ret && typeof ret.then === "function") {
            ret.then(resolve, reject);
          }
        });
      })
      .then((buf) => {
        if (buf) bufferCache.set(key, buf);
        pendingFetch.delete(key);
        return buf || null;
      })
      .catch(() => {
        failedKeys.add(key);
        pendingFetch.delete(key);
        return null;
      });

    pendingFetch.set(key, p);
    return p;
  }

  function preload(letters, words) {
    if (!audioCtx || location.protocol === "file:") return;
    (letters || LETTER_LIST).forEach((ch) => loadBuffer("letters", ch));
    (words || []).forEach((w) => loadBuffer("words", w));
  }

  function fallbackSpeakWord(word, onEnded) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") {
      if (onEnded) onEnded();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      const uk =
        voices.find((v) => /en[-_]gb/i.test(v.lang || "") && /libby|sonia|serena|kate|martha|google uk english female/i.test(v.name || "")) ||
        voices.find((v) => /en[-_]gb/i.test(v.lang || "")) ||
        voices.find((v) => /^en/i.test(v.lang || ""));
      if (uk) u.voice = uk;
      u.lang = (uk && uk.lang) || "en-GB";
      u.rate = 0.88;
      u.pitch = 1.05;
      u.onend = () => {
        if (onEnded) onEnded();
      };
      u.onerror = () => {
        if (onEnded) onEnded();
      };
      window.speechSynthesis.speak(u);
    } catch (_) {
      if (onEnded) onEnded();
    }
  }

  function playHtmlFallback(url, gain, token, fallbackFn, onEnded) {
    try {
      const el = new Audio(url);
      el.volume = Math.max(0, Math.min(1, gain));
      activeHtmlAudio = el;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (activeHtmlAudio === el) activeHtmlAudio = null;
        if (token === playToken && onEnded) onEnded();
      };
      el.onended = finish;
      el.onerror = () => {
        if (done) return;
        done = true;
        if (activeHtmlAudio === el) activeHtmlAudio = null;
        if (token === playToken) {
          if (fallbackFn) fallbackFn(onEnded);
          else if (onEnded) onEnded();
        }
      };
      const pr = el.play();
      if (pr && typeof pr.catch === "function") {
        pr.catch(() => {
          if (!done && token === playToken) {
            done = true;
            if (activeHtmlAudio === el) activeHtmlAudio = null;
            if (fallbackFn) fallbackFn(onEnded);
            else if (onEnded) onEnded();
          }
        });
      }
    } catch (_) {
      if (token === playToken) {
        if (fallbackFn) fallbackFn(onEnded);
        else if (onEnded) onEnded();
      }
    }
  }

  function playClip(kind, name, opts) {
    const o = opts || {};
    const onEnded = typeof o.onEnded === "function" ? o.onEnded : null;
    if (muted || !unlocked) {
      if (onEnded) onEnded();
      return;
    }

    const gainVal = typeof o.gain === "number" ? o.gain : o.soft ? 0.58 : 1.0;
    if (!o.keepPlaying) stop();
    const myToken = playToken;

    const key = keyFor(kind, name);
    const url = urlFor(kind, name);
    const fallbackFn = kind === "words" ? (cb) => fallbackSpeakWord(name, cb) : null;

    const startBuffer = (buf) => {
      if (myToken !== playToken || muted) return;
      if (!buf || !audioCtx) {
        playHtmlFallback(url, gainVal, myToken, fallbackFn, onEnded);
        return;
      }
      try {
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(gainVal, audioCtx.currentTime);
        src.connect(g);
        g.connect(audioCtx.destination);
        activeSource = src;
        src.onended = () => {
          if (activeSource === src) activeSource = null;
          if (myToken === playToken && onEnded) onEnded();
        };
        src.start(0);
      } catch (_) {
        playHtmlFallback(url, gainVal, myToken, fallbackFn, onEnded);
      }
    };

    if (bufferCache.has(key)) {
      startBuffer(bufferCache.get(key));
    } else if (audioCtx && location.protocol !== "file:" && !failedKeys.has(key)) {
      loadBuffer(kind, name).then((buf) => {
        if (myToken !== playToken || muted) return;
        startBuffer(buf);
      });
    } else {
      playHtmlFallback(url, gainVal, myToken, fallbackFn, onEnded);
    }
  }

  function playLetter(ch, opts) {
    if (!ch) return;
    playClip("letters", String(ch).toLowerCase(), opts);
  }

  function playWord(word, opts) {
    if (!word) return;
    playClip("words", String(word).toLowerCase(), opts);
  }

  function playLetterThenWord(ch, word, opts) {
    const o = opts || {};
    const gapMs = typeof o.gapMs === "number" ? o.gapMs : 150;
    if (muted || !unlocked) return;
    stop();
    const myToken = playToken;
    playClip("letters", String(ch).toLowerCase(), {
      keepPlaying: true,
      gain: o.gain,
      onEnded: () => {
        if (myToken !== playToken || muted) return;
        seqTimer = setTimeout(() => {
          seqTimer = null;
          if (myToken !== playToken || muted) return;
          playClip("words", String(word).toLowerCase(), {
            keepPlaying: true,
            gain: o.gain,
            onEnded: o.onEnded,
          });
        }, gapMs);
      },
    });
  }

  // Per-letter cue cycling helper
  function createCueCycler() {
    const idxMap = {};
    return {
      next(ch) {
        const list = CUE_WORDS_BY_LETTER[ch] || [];
        if (!list.length) return "";
        const i = idxMap[ch] || 0;
        idxMap[ch] = (i + 1) % list.length;
        return list[i];
      },
      peek(ch) {
        const list = CUE_WORDS_BY_LETTER[ch] || [];
        if (!list.length) return "";
        const i = idxMap[ch] || 0;
        return list[i];
      },
    };
  }

  function drawCueSprite(ctx, word, cx, cy, size) {
    const sprite = CUE_SPRITES[word];
    if (!sprite) return;
    const rows = sprite.rows;
    const n = rows.length;
    const cell = size / n;
    const x0 = cx - size / 2;
    const y0 = cy - size / 2;
    for (let r = 0; r < n; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === ".") continue;
        const col = sprite.palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(
          Math.floor(x0 + c * cell),
          Math.floor(y0 + r * cell),
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }
  }

  function getAllCueWords() {
    return Object.values(CUE_WORDS_BY_LETTER).flat();
  }

  window.PhonicsAudio = {
    BASE_PATH,
    LETTER_LIST,
    CUE_WORDS_BY_LETTER,
    CUE_SPRITES,
    unlock,
    setMuted,
    stop,
    preload,
    playLetter,
    playWord,
    playLetterThenWord,
    createCueCycler,
    drawCueSprite,
    getAllCueWords,
  };
})();
