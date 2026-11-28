(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Maintainer Configuration (not shown to players)
  // Leave owner/repo blank to auto-detect on *.github.io.
  // For local testing, fill these in or open ?repo=owner/repo.
  // ---------------------------------------------------------------------------
  const CONFIG = {
    owner: "",
    repo: "",
    branch: "", // Leave blank to use the repository's default branch
    sections: {
      arcade: {
        dir: "games",
        label: "Retro Arcade",
        backLabel: "← Arcade",
        countWord: " GAMES",
        emptyText: "No games are on the arcade floor yet — check back soon!",
        pageTitle: "Retro Arcade",
        cardHeadingTag: "h2",
        coinText: "INSERT COIN",
        startText: "▶ PRESS START",
      },
      junior: {
        dir: "junior-games",
        label: "Junior Arcade",
        backLabel: "← Junior Arcade",
        countWord: " JUNIOR GAMES",
        emptyText: "No junior games are ready yet — check back soon!",
        pageTitle: "Junior Arcade | Retro Arcade",
        cardHeadingTag: "h3",
        coinText: "READY TO PLAY",
        startText: "▶ TAP TO PLAY",
      },
    },
    defaultSection: "arcade",
    dirCacheTtlMs: 10 * 60 * 1000, // 10 minutes before revalidating via ETag
    metaFetchConcurrency: 6,
  };

  const SECTION_KEYS = Object.keys(CONFIG.sections);
  const SUPPORTS_FOCUSGROUP = Object.hasOwn(HTMLElement.prototype, "focusGroup");

  const GENRE_COLORS = {
    Arcade: "var(--pac)",
    Puzzle: "var(--inky)",
    Shooter: "var(--blinky)",
    Action: "var(--clyde)",
    Platformer: "var(--mint)",
    Racing: "var(--pinky)",
    Strategy: "var(--maze-bright)",
    Sports: "var(--mint)",
    "Card & Board": "var(--dot)",
    Other: "var(--pac)",
  };

  const CACHE_PREFIX = "retroArcade:v1:";

  const els = {
    tablist: document.querySelector(".section-tablist"),
    sectionTabs: Object.fromEntries(
      SECTION_KEYS.map((key) => [key, document.querySelector(`[data-section-tab="${key}"]`)])
    ),
    sectionCounts: Object.fromEntries(
      SECTION_KEYS.map((key) => [key, document.querySelector(`[data-section-count="${key}"]`)])
    ),
    sectionPanels: Object.fromEntries(
      SECTION_KEYS.map((key) => [key, document.querySelector(`[data-section-panel="${key}"]`)])
    ),
    sectionStatus: Object.fromEntries(
      SECTION_KEYS.map((key) => [key, document.querySelector(`[data-status="${key}"]`)])
    ),
    sectionLoading: Object.fromEntries(
      SECTION_KEYS.map((key) => [key, document.querySelector(`[data-loading="${key}"]`)])
    ),
    sectionGrids: Object.fromEntries(
      SECTION_KEYS.map((key) => [key, document.querySelector(`[data-grid="${key}"]`)])
    ),
    sectionEmpty: Object.fromEntries(
      SECTION_KEYS.map((key) => [key, document.querySelector(`[data-empty="${key}"]`)])
    ),
    sectionEmptyReset: Object.fromEntries(
      SECTION_KEYS.map((key) => [key, document.querySelector(`[data-empty-reset="${key}"]`)])
    ),
    search: document.getElementById("search"),
    filterToggle: document.querySelector(".models-toggle"),
    filterValue: document.querySelector("[data-models-value]"),
    filterPanel: document.getElementById("models-panel"),
    filterList: document.querySelector(".models-list"),
    filterClear: document.querySelector(".models-clear"),
    sortButtons: Array.from(document.querySelectorAll(".sort-keys .chip")),
    count: document.querySelector("[data-count]"),
    countWord: document.querySelector("[data-count-word]"),
    play: document.querySelector(".play"),
    playBar: document.querySelector(".play-bar"),
    playBack: document.querySelector(".play-back"),
    playName: document.getElementById("play-name"),
    playStats: document.querySelector(".play-stats"),
    playFullscreen: document.querySelector(".play-fullscreen"),
    playDetailsBtn: document.querySelector(".play-details-toggle"),
    playAdultBar: document.querySelector(".play-adult-bar"),
    playAdultBack: document.querySelector(".play-adult-back"),
    playAdultHint: document.getElementById("play-adult-hint"),
    playAdultFullscreen: document.querySelector(".play-adult-fullscreen"),
    playAdultFsIcon: document.querySelector(".play-adult-fs-icon"),
    playAdultFsLabel: document.querySelector(".play-adult-fs-label"),
    detailsDialog: document.querySelector("dialog.details"),
    detailsName: document.getElementById("details-name"),
    detailsGenre: document.querySelector(".details-harness"),
    detailsClose: document.querySelector(".details-close"),
    detailsBody: document.querySelector(".details-body"),
  };

  function createSectionState() {
    return {
      games: [],
      loaded: false,
      query: "",
      selectedGenres: new Set(),
      selectedTags: new Set(),
      sortKey: "added",
      sortDir: "desc",
    };
  }

  const state = {
    activeSection: CONFIG.defaultSection,
    sections: Object.fromEntries(SECTION_KEYS.map((key) => [key, createSectionState()])),
    activeGame: null,
    playFrame: null,
    lastFocused: null,
    juniorLocked: false,
    juniorExitAuthorized: false,
    juniorUserExitedFs: false,
  };

  const JUNIOR_HOLD_MS = 650;
  const JUNIOR_EDGE_PX = 44;
  const JUNIOR_PLAY_FRAME_NAME = "retro-arcade-junior-play";
  const ICON_ENTER_FS =
    '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />';
  const ICON_EXIT_FS =
    '<path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5" />';

  function getActiveState() {
    return state.sections[state.activeSection];
  }

  function getAllGames() {
    return SECTION_KEYS.flatMap((key) => state.sections[key].games);
  }

  // ---------------------------------------------------------------------------
  // Repo detection
  // ---------------------------------------------------------------------------
  function detectRepo() {
    const params = new URLSearchParams(location.search);
    const paramRepo = params.get("repo");
    if (paramRepo && paramRepo.includes("/")) {
      const [owner, repo] = paramRepo.split("/").map((s) => s.trim());
      if (owner && repo) return { owner, repo, branch: params.get("branch") || CONFIG.branch };
    }

    if (CONFIG.owner && CONFIG.repo) {
      return { owner: CONFIG.owner, repo: CONFIG.repo, branch: CONFIG.branch };
    }

    const host = location.hostname.toLowerCase();
    if (host.endsWith(".github.io")) {
      const owner = host.slice(0, -".github.io".length);
      const segments = location.pathname.split("/").filter(Boolean);
      const first = segments[0];
      const isUserSite = !first || first.includes(".");
      const repo = isUserSite ? `${owner}.github.io` : first;
      return { owner, repo, branch: CONFIG.branch };
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // LocalStorage cache helpers
  // ---------------------------------------------------------------------------
  function readCache(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeCache(key, value) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
    } catch {
      // Ignore storage quota or private-browsing errors
    }
  }

  function pruneMetaCache(validShas) {
    try {
      const metaPrefix = CACHE_PREFIX + "meta:";
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(metaPrefix)) {
          const sha = k.slice(metaPrefix.length);
          if (!validShas.has(sha)) localStorage.removeItem(k);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  // ---------------------------------------------------------------------------
  // GitHub API + HTML metadata loader
  // ---------------------------------------------------------------------------
  async function fetchDirectoryListing(repoInfo, dir) {
    const { owner, repo, branch } = repoInfo;
    const cacheKey = `dir:${owner}/${repo}/${dir}:${branch || "default"}`;
    const cached = readCache(cacheKey);
    const now = Date.now();

    if (cached && Array.isArray(cached.files) && now - cached.fetchedAt < CONFIG.dirCacheTtlMs) {
      return { files: cached.files, fromStaleCache: false };
    }

    const refQuery = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(dir)}${refQuery}`;

    const headers = { Accept: "application/vnd.github+json" };
    if (cached && cached.etag) {
      headers["If-None-Match"] = cached.etag;
    }

    try {
      const res = await fetch(apiUrl, { headers });

      if (res.status === 304 && cached) {
        writeCache(cacheKey, { ...cached, fetchedAt: now });
        return { files: cached.files, fromStaleCache: false };
      }

      if (res.status === 404) {
        writeCache(cacheKey, { etag: "", fetchedAt: now, files: [] });
        return { files: [], fromStaleCache: false };
      }

      if (!res.ok) {
        console.warn(`[Retro Arcade] Directory request failed (${res.status}) for ${apiUrl}`);
        if (cached && Array.isArray(cached.files)) {
          return { files: cached.files, fromStaleCache: true };
        }
        const msg =
          res.status === 403
            ? "The arcade is temporarily busy. Please try again in a few minutes."
            : "Couldn't load the game library right now. Please try again shortly.";
        throw new Error(msg);
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        console.warn(`[Retro Arcade] Expected directory array at ${apiUrl}`);
        throw new Error("Couldn't load the game library right now. Please try again shortly.");
      }

      const files = data
        .filter((item) => item.type === "file" && /\.html?$/i.test(item.name))
        .map((item) => ({
          name: item.name,
          sha: item.sha,
          downloadUrl: item.download_url || "",
        }));

      const etag = res.headers.get("ETag") || "";
      writeCache(cacheKey, { etag, fetchedAt: now, files });
      return { files, fromStaleCache: false };
    } catch (err) {
      if (cached && Array.isArray(cached.files)) {
        return { files: cached.files, fromStaleCache: true };
      }
      throw err;
    }
  }

  function prettifyFilename(filename) {
    return filename
      .replace(/\.html?$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
      .trim();
  }

  function parseGameHtml(html, file) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const getMeta = (name) => {
      const el = doc.querySelector(`meta[name="${name}" i]`);
      return el ? (el.getAttribute("content") || "").trim() : "";
    };

    const rawTitle = (doc.querySelector("title")?.textContent || "").trim();
    const title = rawTitle || prettifyFilename(file.name);
    const description = getMeta("description") || getMeta("game:description");
    const genre = getMeta("game:genre") || "Arcade";
    const rawTags = getMeta("game:tags");
    const tags = Array.from(
      new Set(
        rawTags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      )
    );
    const added = getMeta("game:added");
    const year = getMeta("game:year");
    const controls = getMeta("game:controls");
    const author = getMeta("game:author");
    const rawColor = getMeta("game:color");
    const color = /^#[0-9a-f]{3,8}$/i.test(rawColor) ? rawColor : "";

    return { title, description, genre, tags, added, year, controls, author, color };
  }

  async function fetchGameMeta(file, dir, sectionKey) {
    const cacheKey = `meta:${file.sha}`;
    const cached = readCache(cacheKey);
    if (cached && cached.title) {
      return buildGameRecord(file, cached, dir, sectionKey);
    }

    const relativeUrl = `./${dir}/${encodeURIComponent(file.name)}`;
    let html = "";

    // Fetch from same-origin CDN first (zero API quota), then fall back to raw URL
    try {
      const res = await fetch(relativeUrl);
      if (res.ok) html = await res.text();
    } catch {
      // Fall through
    }

    if (!html && file.downloadUrl) {
      try {
        const res = await fetch(file.downloadUrl);
        if (res.ok) html = await res.text();
      } catch {
        // Use filename fallback below
      }
    }

    const parsed = html
      ? parseGameHtml(html, file)
      : {
          title: prettifyFilename(file.name),
          description: "",
          genre: "Arcade",
          tags: [],
          added: "",
          year: "",
          controls: "",
          author: "",
          color: "",
        };

    if (html) writeCache(cacheKey, parsed);
    return buildGameRecord(file, parsed, dir, sectionKey);
  }

  function buildGameRecord(file, meta, dir, sectionKey) {
    const addedTs = meta.added && !Number.isNaN(Date.parse(meta.added)) ? Date.parse(meta.added) : 0;
    const accent = meta.color || GENRE_COLORS[meta.genre] || "var(--pac)";
    return {
      id: `${sectionKey}/${file.name}`,
      fileName: file.name,
      section: sectionKey,
      url: `./${dir}/${encodeURIComponent(file.name)}`,
      sha: file.sha,
      title: meta.title || prettifyFilename(file.name),
      description: meta.description || "",
      genre: meta.genre || "Arcade",
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      added: meta.added || "",
      addedTs,
      year: meta.year || "",
      controls: meta.controls || "",
      author: meta.author || "",
      accent,
    };
  }

  async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let cursor = 0;

    async function worker() {
      while (cursor < items.length) {
        const idx = cursor++;
        results[idx] = await fn(items[idx], idx);
      }
    }

    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
  }

  // ---------------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------------
  function formatDate(iso, { short = false } = {}) {
    if (!iso) return "—";
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(
      undefined,
      short ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" }
    );
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---------------------------------------------------------------------------
  // Section switching (Retro Arcade <-> Junior Arcade)
  // ---------------------------------------------------------------------------
  function setActiveSection(sectionKey, { updateHash = true, scrollTab = true } = {}) {
    if (!CONFIG.sections[sectionKey]) return;

    state.activeSection = sectionKey;
    document.body.dataset.section = sectionKey;
    document.title = CONFIG.sections[sectionKey].pageTitle;

    for (const key of SECTION_KEYS) {
      const isSelected = key === sectionKey;
      const tab = els.sectionTabs[key];
      const panel = els.sectionPanels[key];

      if (tab) {
        tab.setAttribute("aria-selected", String(isSelected));
        tab.toggleAttribute("focusgroupstart", isSelected);
        if (!SUPPORTS_FOCUSGROUP) {
          tab.tabIndex = isSelected ? 0 : -1;
        }
        if (isSelected && scrollTab) {
          try {
            tab.scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" });
          } catch {
            tab.scrollIntoView({ block: "nearest", inline: "nearest" });
          }
        }
      }

      if (panel) {
        if (isSelected) {
          panel.hidden = false;
        } else {
          panel.hidden = "until-found";
        }
      }
    }

    // Close filter dropdown when switching spaces
    if (!els.filterPanel.hidden) {
      els.filterPanel.hidden = true;
      els.filterToggle.setAttribute("aria-expanded", "false");
    }

    const activeState = getActiveState();
    els.search.value = activeState.query;
    els.search.placeholder =
      sectionKey === "junior" ? "junior game, tag, color…" : "game title, genre, tag…";
    els.countWord.textContent = CONFIG.sections[sectionKey].countWord;

    renderFilterPanel();
    updateSortChips();
    renderSectionGrid(sectionKey);
    observeActivePreviews();

    if (updateHash && !state.activeGame) {
      const targetHash = sectionKey === CONFIG.defaultSection ? "" : `#${sectionKey}`;
      if (location.hash !== targetHash) {
        history.replaceState({ section: sectionKey }, "", location.pathname + location.search + targetHash);
      }
    }
  }

  function updateSectionCountBadge(sectionKey) {
    const badge = els.sectionCounts[sectionKey];
    if (!badge) return;
    const secState = state.sections[sectionKey];
    badge.textContent = secState.loaded ? String(secState.games.length) : "--";
  }

  // ---------------------------------------------------------------------------
  // Filtering & sorting
  // ---------------------------------------------------------------------------
  function getVisibleGames(sectionKey = state.activeSection) {
    const secState = state.sections[sectionKey];
    const q = secState.query.trim().toLowerCase();

    const filtered = secState.games.filter((g) => {
      if (secState.selectedGenres.size > 0 && !secState.selectedGenres.has(g.genre)) {
        return false;
      }
      if (secState.selectedTags.size > 0) {
        for (const tag of secState.selectedTags) {
          if (!g.tags.includes(tag)) return false;
        }
      }
      if (q) {
        const haystack = [g.title, g.description, g.genre, g.author, g.year, ...g.tags].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const dir = secState.sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (secState.sortKey) {
        case "added":
          cmp = (a.addedTs || 0) - (b.addedTs || 0);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
          break;
        case "genre":
          cmp = a.genre.localeCompare(b.genre, undefined, { sensitivity: "base" });
          break;
        case "year":
          cmp = (parseInt(a.year, 10) || 0) - (parseInt(b.year, 10) || 0);
          break;
      }
      if (cmp !== 0) return cmp * dir;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });

    return filtered;
  }

  // ---------------------------------------------------------------------------
  // Filter dropdown rendering (Genres + Tags)
  // ---------------------------------------------------------------------------
  function renderFilterPanel() {
    const secState = getActiveState();
    const genreCounts = new Map();
    const tagCounts = new Map();

    for (const g of secState.games) {
      genreCounts.set(g.genre, (genreCounts.get(g.genre) || 0) + 1);
      for (const t of g.tags) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }

    const sortedGenres = Array.from(genreCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    const sections = [];

    if (sortedGenres.length) {
      sections.push(`
        <fieldset class="models-group">
          <legend class="models-company">Genres</legend>
          ${sortedGenres
            .map(
              ([genre, count]) => `
            <label class="models-option">
              <input type="checkbox" data-filter-type="genre" value="${escapeHtml(genre)}" ${secState.selectedGenres.has(genre) ? "checked" : ""} />
              <span class="models-name">${escapeHtml(genre)}</span>
              <span class="models-count">${count}</span>
            </label>`
            )
            .join("")}
        </fieldset>
      `);
    }

    if (sortedTags.length) {
      sections.push(`
        <fieldset class="models-group">
          <legend class="models-company">Tags</legend>
          ${sortedTags
            .map(
              ([tag, count]) => `
            <label class="models-option">
              <input type="checkbox" data-filter-type="tag" value="${escapeHtml(tag)}" ${secState.selectedTags.has(tag) ? "checked" : ""} />
              <span class="models-name">#${escapeHtml(tag)}</span>
              <span class="models-count">${count}</span>
            </label>`
            )
            .join("")}
        </fieldset>
      `);
    }

    els.filterList.innerHTML = sections.join("") || `<p class="models-hint" style="padding:10px">No filters available.</p>`;
    updateFilterSummary();
  }

  function updateFilterSummary() {
    const secState = getActiveState();
    const totalSelected = secState.selectedGenres.size + secState.selectedTags.size;
    els.filterClear.disabled = totalSelected === 0;
    els.filterToggle.classList.toggle("is-active", totalSelected > 0);

    if (totalSelected === 0) {
      els.filterValue.textContent = "All";
    } else if (totalSelected === 1) {
      const only = secState.selectedGenres.size
        ? [...secState.selectedGenres][0]
        : `#${[...secState.selectedTags][0]}`;
      els.filterValue.textContent = only;
    } else {
      els.filterValue.textContent = `${totalSelected} selected`;
    }
  }

  // ---------------------------------------------------------------------------
  // Cabinet grid + lazy iframe preview observer
  // ---------------------------------------------------------------------------
  const previewObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const screen = entry.target;
        screen.classList.toggle("is-onscreen", entry.isIntersecting);

        if (entry.isIntersecting && !screen.dataset.loaded) {
          screen.dataset.loaded = "1";
          const iframe = document.createElement("iframe");
          iframe.src = screen.dataset.src;
          iframe.title = `${screen.dataset.title} preview`;
          iframe.tabIndex = -1;
          iframe.loading = "lazy";
          iframe.setAttribute("aria-hidden", "true");
          iframe.setAttribute("sandbox", "allow-scripts");
          iframe.addEventListener("load", () => iframe.classList.add("is-live"), { once: true });
          screen.prepend(iframe);
        }
      }
    },
    { rootMargin: "150px 0px" }
  );

  function observeActivePreviews() {
    previewObserver.disconnect();
    const grid = els.sectionGrids[state.activeSection];
    if (!grid) return;
    grid.querySelectorAll(".cab-screen").forEach((screen) => previewObserver.observe(screen));
  }

  function buildDetailMarkup(game) {
    const rows = [["Genre", game.genre]];
    if (game.section === "junior") rows.push(["Section", "Junior Arcade"]);
    if (game.year) rows.push(["Year", game.year]);
    if (game.added) rows.push(["Added", formatDate(game.added)]);
    if (game.author) rows.push(["By", game.author]);

    return `
      <div class="cab-why">
        <p class="cab-panel-head">ABOUT</p>
        <p class="cab-check-note" style="margin:0 0 10px">${escapeHtml(game.description || "Classic retro browser game.")}</p>
        ${
          game.controls
            ? `<p class="cab-panel-head" style="margin-top:10px">HOW TO PLAY</p>
               <p class="cab-check-note" style="margin:0">${escapeHtml(game.controls)}</p>`
            : ""
        }
      </div>
      <div>
        <p class="cab-panel-head">GAME INFO</p>
        <dl class="cab-detail-list">
          ${rows
            .map(
              ([label, val]) => `
            <div class="cab-stat">
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(val)}</dd>
            </div>`
            )
            .join("")}
        </dl>
        <p style="margin:12px 0 0;font-size:0.75rem">
          <a href="${escapeHtml(game.url)}" target="_blank" rel="noopener">Open in new tab ↗</a>
        </p>
      </div>
    `;
  }

  function renderSectionGrid(sectionKey = state.activeSection) {
    const secConfig = CONFIG.sections[sectionKey];
    const secState = state.sections[sectionKey];
    const grid = els.sectionGrids[sectionKey];
    const emptyEl = els.sectionEmpty[sectionKey];
    const visible = getVisibleGames(sectionKey);

    if (sectionKey === state.activeSection) {
      els.count.textContent = secState.loaded ? `${visible.length} / ${secState.games.length}` : "--";
    }

    emptyEl.hidden = visible.length > 0 || secState.games.length === 0;

    if (visible.length === 0) {
      grid.innerHTML = "";
      return;
    }

    const headingTag = secConfig.cardHeadingTag;
    const frag = document.createDocumentFragment();

    visible.forEach((game, idx) => {
      const card = document.createElement("article");
      card.className = "cab";
      card.style.setProperty("--i", String(idx));
      card.style.setProperty("--c", game.accent);

      const tagsHtml = game.tags
        .map((tag) => {
          const active = secState.selectedTags.has(tag) ? " is-active" : "";
          return `<button type="button" class="cab-tag${active}" data-tag-pill="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`;
        })
        .join("");

      card.innerHTML = `
        <div class="cab-screen" data-src="${escapeHtml(game.url)}" data-title="${escapeHtml(game.title)}">
          <span class="cab-coin">${escapeHtml(secConfig.coinText)}</span>
          <span class="cab-start">${escapeHtml(secConfig.startText)}</span>
        </div>
        <div class="cab-body">
          <div class="cab-top">
            <span class="cab-harness">
              <svg aria-hidden="true"><use href="#ghost" /></svg>
              ${escapeHtml(game.genre)}
            </span>
            <span class="cab-score">${game.year ? `<b>${escapeHtml(game.year)}</b>` : ""}</span>
          </div>
          <${headingTag} class="cab-model">
            <a class="cab-link" href="${escapeHtml(game.url)}" data-play-id="${escapeHtml(game.id)}">
              ${escapeHtml(game.title)}
            </a>
          </${headingTag}>
          ${game.description ? `<p class="cab-asked">${escapeHtml(game.description)}</p>` : ""}
          ${tagsHtml ? `<div class="cab-tags">${tagsHtml}</div>` : ""}
          <dl class="cab-stats">
            <div class="cab-stat">
              <dt>ADDED</dt>
              <dd class="${game.added ? "" : "is-empty"}">${escapeHtml(formatDate(game.added, { short: true }))}</dd>
            </div>
            <div class="cab-stat">
              <dt>YEAR</dt>
              <dd class="${game.year ? "" : "is-empty"}">${escapeHtml(game.year || "—")}</dd>
            </div>
          </dl>
          <details class="cab-details">
            <summary class="cab-details-toggle">GAME INFO</summary>
            <div class="cab-detail-panel">
              ${buildDetailMarkup(game)}
            </div>
          </details>
        </div>
      `;

      frag.appendChild(card);
    });

    grid.innerHTML = "";
    grid.appendChild(frag);

    if (sectionKey === state.activeSection) {
      observeActivePreviews();
    }
  }

  // ---------------------------------------------------------------------------
  // In-page Arcade Overlay + Fullscreen Toggle + Junior Lock + Details Dialog
  // ---------------------------------------------------------------------------
  function isFullscreenSupported() {
    return Boolean(
      (document.fullscreenEnabled || document.webkitFullscreenEnabled) &&
        (typeof els.play.requestFullscreen === "function" ||
          typeof els.play.webkitRequestFullscreen === "function")
    );
  }

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  async function requestPlayFullscreen() {
    if (!isFullscreenSupported() || getFullscreenElement()) return;
    try {
      if (typeof els.play.requestFullscreen === "function") {
        try {
          await els.play.requestFullscreen({ navigationUI: "hide" });
        } catch {
          await els.play.requestFullscreen();
        }
      } else if (typeof els.play.webkitRequestFullscreen === "function") {
        els.play.webkitRequestFullscreen();
      }
      if (
        state.juniorLocked &&
        navigator.keyboard &&
        typeof navigator.keyboard.lock === "function"
      ) {
        navigator.keyboard.lock(["Escape"]).catch(() => {});
      }
    } catch {
      // Fullscreen may be blocked by browser policy
    }
  }

  async function exitPlayFullscreen() {
    try {
      if (navigator.keyboard && typeof navigator.keyboard.unlock === "function") {
        navigator.keyboard.unlock();
      }
      if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
      } else if (
        document.webkitFullscreenElement &&
        typeof document.webkitExitFullscreen === "function"
      ) {
        document.webkitExitFullscreen();
      }
    } catch {
      // Ignore fullscreen exit errors
    }
  }

  function openGame(game, { pushHash = true } = {}) {
    if (game.section !== state.activeSection) {
      setActiveSection(game.section, { updateHash: false, scrollTab: false });
    }

    const isJunior = game.section === "junior";

    state.activeGame = game;
    state.lastFocused = document.activeElement;
    state.juniorLocked = isJunior;
    state.juniorExitAuthorized = false;
    state.juniorUserExitedFs = false;

    els.play.dataset.section = game.section;
    if (els.playBar) els.playBar.hidden = isJunior;
    if (els.playAdultBar) els.playAdultBar.hidden = !isJunior;
    if (els.playAdultHint) {
      els.playAdultHint.textContent = "";
      els.playAdultHint.classList.remove("is-visible");
    }

    els.playBack.textContent = CONFIG.sections[game.section]?.backLabel || "← Arcade";
    els.playName.textContent = game.title;
    els.playStats.innerHTML = `
      <div class="cab-stat"><dt>GENRE</dt><dd data-field="score">${escapeHtml(game.genre)}</dd></div>
      ${game.year ? `<div class="cab-stat"><dt>YEAR</dt><dd>${escapeHtml(game.year)}</dd></div>` : ""}
    `;

    if (state.playFrame) {
      state.playFrame.remove();
      state.playFrame = null;
    }

    const iframe = document.createElement("iframe");
    iframe.className = "play-frame";
    if (isJunior) {
      iframe.name = JUNIOR_PLAY_FRAME_NAME;
    }
    iframe.src = game.url;
    iframe.title = game.title;
    iframe.setAttribute("allow", "fullscreen; gamepad");
    els.play.appendChild(iframe);
    state.playFrame = iframe;

    els.play.hidden = false;
    document.documentElement.classList.add("is-playing");
    document.documentElement.classList.toggle("is-playing-junior", isJunior);

    const targetHash = `#play=${encodeURIComponent(game.id)}`;
    if (isJunior) {
      // Always push a sentinel history entry so Back / edge-swipe stays locked inside the game
      history.pushState({ play: game.id, juniorLock: true }, "", targetHash);
      requestPlayFullscreen().finally(updateFullscreenButton);
    } else if (pushHash && location.hash !== targetHash) {
      history.pushState({ play: game.id }, "", targetHash);
    }

    updateFullscreenButton();

    iframe.addEventListener("load", () => {
      try {
        iframe.contentWindow?.focus();
      } catch {
        // Ignore cross-origin focus errors
      }
    });
  }

  function closeGame({ updateHash = true, force = false } = {}) {
    if (!state.activeGame) return;
    if (state.juniorLocked && !state.juniorExitAuthorized && !force) return;

    const wasJunior = state.activeGame.section === "junior";
    state.juniorLocked = false;
    state.juniorExitAuthorized = false;
    state.juniorUserExitedFs = false;

    if (getFullscreenElement()) {
      exitPlayFullscreen();
    } else if (navigator.keyboard && typeof navigator.keyboard.unlock === "function") {
      try {
        navigator.keyboard.unlock();
      } catch {
        // Ignore
      }
    }
    if (els.detailsDialog.open) {
      els.detailsDialog.close();
    }

    els.play.hidden = true;
    els.play.dataset.section = "";
    if (els.playBar) els.playBar.hidden = false;
    if (els.playAdultBar) els.playAdultBar.hidden = true;
    if (els.playAdultHint) {
      els.playAdultHint.textContent = "";
      els.playAdultHint.classList.remove("is-visible");
    }
    document.documentElement.classList.remove("is-playing", "is-playing-junior");

    if (state.playFrame) {
      state.playFrame.remove();
      state.playFrame = null;
    }

    state.activeGame = null;

    if (updateHash && location.hash.startsWith("#play=")) {
      const sectionHash = state.activeSection === CONFIG.defaultSection ? "" : `#${state.activeSection}`;
      const targetUrl = location.pathname + location.search + sectionHash;
      if (wasJunior) {
        history.replaceState({ section: state.activeSection }, "", targetUrl);
      } else {
        history.pushState({ section: state.activeSection }, "", targetUrl);
      }
    }

    if (state.lastFocused && typeof state.lastFocused.focus === "function") {
      state.lastFocused.focus();
    }
  }

  function authorizeJuniorExit() {
    state.juniorExitAuthorized = true;
    closeGame({ updateHash: true, force: true });
  }

  function openDetailsDialog(game) {
    els.detailsName.textContent = game.title;
    els.detailsGenre.textContent = game.genre;
    els.detailsBody.innerHTML = `<div class="details-content">${buildDetailMarkup(game)}</div>`;
    els.detailsDialog.showModal();
  }

  function updateFullscreenButton() {
    const isFs = Boolean(getFullscreenElement());
    els.playFullscreen.setAttribute("aria-pressed", String(isFs));
    els.playFullscreen.textContent = isFs ? "✕ EXIT FULL" : "⛶ FULLSCREEN";

    if (els.playAdultFullscreen) {
      if (!isFullscreenSupported()) {
        els.playAdultFullscreen.hidden = true;
      } else {
        els.playAdultFullscreen.hidden = false;
        if (els.playAdultFsLabel) {
          els.playAdultFsLabel.textContent = isFs ? "Exit fullscreen" : "Fullscreen";
        }
        if (els.playAdultFsIcon) {
          els.playAdultFsIcon.innerHTML = isFs ? ICON_EXIT_FS : ICON_ENTER_FS;
        }
      }
    }
  }

  async function toggleFullscreen() {
    if (!getFullscreenElement()) {
      await requestPlayFullscreen();
    } else {
      await exitPlayFullscreen();
    }
    updateFullscreenButton();
  }

  // ---------------------------------------------------------------------------
  // Sort chips & status helpers
  // ---------------------------------------------------------------------------
  function updateSortChips() {
    const secState = getActiveState();
    for (const btn of els.sortButtons) {
      const key = btn.dataset.sort;
      const label = btn.dataset.label;
      const isActive = key === secState.sortKey;
      btn.setAttribute("aria-pressed", String(isActive));
      btn.textContent = isActive ? `${label} ${secState.sortDir === "asc" ? "↑" : "↓"}` : label;
    }
  }

  function showStatus(sectionKey, text, { isError = false } = {}) {
    const statusEl = els.sectionStatus[sectionKey];
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", isError);
    statusEl.hidden = false;
  }

  function hideStatus(sectionKey) {
    const statusEl = els.sectionStatus[sectionKey];
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.textContent = "";
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------
  function wireEvents() {
    // Section tab clicks (selection by activation)
    SECTION_KEYS.forEach((key) => {
      const tab = els.sectionTabs[key];
      if (!tab) return;

      tab.addEventListener("click", () => {
        if (state.activeSection !== key) {
          setActiveSection(key);
        }
      });

      // Sync active section when browser Find-in-Page reveals a hidden="until-found" panel
      const panel = els.sectionPanels[key];
      if (panel) {
        panel.addEventListener("beforematch", () => {
          if (state.activeSection !== key) {
            setActiveSection(key, { scrollTab: false });
          }
        });
      }
    });

    // Roving arrow-key fallback for browsers without native focusgroup support
    if (els.tablist && !SUPPORTS_FOCUSGROUP) {
      els.tablist.addEventListener("keydown", (e) => {
        const currentTab = e.target.closest('[role="tab"]');
        if (!currentTab) return;

        const tabs = SECTION_KEYS.map((key) => els.sectionTabs[key]).filter(Boolean);
        const idx = tabs.indexOf(currentTab);
        if (idx === -1) return;

        let nextIdx = idx;
        if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
        else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") nextIdx = 0;
        else if (e.key === "End") nextIdx = tabs.length - 1;
        else return;

        e.preventDefault();
        tabs.forEach((t, i) => {
          t.tabIndex = i === nextIdx ? 0 : -1;
        });
        tabs[nextIdx].focus();
      });
    } else if (SUPPORTS_FOCUSGROUP) {
      // Remove manual tabindex=-1 when native focusgroup handles roving focus
      SECTION_KEYS.forEach((key) => {
        els.sectionTabs[key]?.removeAttribute("tabindex");
      });
    }

    els.search.addEventListener("input", (e) => {
      getActiveState().query = e.target.value;
      renderSectionGrid(state.activeSection);
    });

    document.addEventListener("keydown", (e) => {
      if (state.juniorLocked) {
        const key = e.key;
        if (
          key === "Escape" ||
          key === "BrowserBack" ||
          key === "GoBack" ||
          key === "BrowserForward" ||
          (e.altKey && (key === "ArrowLeft" || key === "ArrowRight")) ||
          (e.metaKey && (key === "[" || key === "]" || key === "ArrowLeft" || key === "ArrowRight")) ||
          key === "Backspace"
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (e.key === "/" && !state.activeGame && document.activeElement !== els.search) {
        e.preventDefault();
        els.search.focus();
        els.search.select();
      } else if (e.key === "Escape") {
        if (!els.filterPanel.hidden) {
          els.filterPanel.hidden = true;
          els.filterToggle.setAttribute("aria-expanded", "false");
        } else if (state.activeGame && !els.detailsDialog.open && !getFullscreenElement()) {
          closeGame();
        }
      }
    });

    els.filterToggle.addEventListener("click", () => {
      const opening = els.filterPanel.hidden;
      els.filterPanel.hidden = !opening;
      els.filterToggle.setAttribute("aria-expanded", String(opening));
    });

    document.addEventListener("click", (e) => {
      if (!els.filterPanel.hidden && !e.target.closest(".models")) {
        els.filterPanel.hidden = true;
        els.filterToggle.setAttribute("aria-expanded", "false");
      }
    });

    els.filterList.addEventListener("change", (e) => {
      const input = e.target;
      if (!input.matches("input[type='checkbox']")) return;
      const secState = getActiveState();
      const targetSet = input.dataset.filterType === "genre" ? secState.selectedGenres : secState.selectedTags;
      if (input.checked) targetSet.add(input.value);
      else targetSet.delete(input.value);
      updateFilterSummary();
      renderSectionGrid(state.activeSection);
    });

    els.filterClear.addEventListener("click", () => {
      const secState = getActiveState();
      secState.selectedGenres.clear();
      secState.selectedTags.clear();
      renderFilterPanel();
      renderSectionGrid(state.activeSection);
    });

    els.sortButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const secState = getActiveState();
        const key = btn.dataset.sort;
        if (secState.sortKey === key) {
          secState.sortDir = secState.sortDir === "asc" ? "desc" : "asc";
        } else {
          secState.sortKey = key;
          secState.sortDir = key === "title" || key === "genre" ? "asc" : "desc";
        }
        updateSortChips();
        renderSectionGrid(state.activeSection);
      });
    });

    SECTION_KEYS.forEach((sectionKey) => {
      const resetBtn = els.sectionEmptyReset[sectionKey];
      resetBtn?.addEventListener("click", () => {
        const secState = state.sections[sectionKey];
        secState.query = "";
        if (state.activeSection === sectionKey) els.search.value = "";
        secState.selectedGenres.clear();
        secState.selectedTags.clear();
        renderFilterPanel();
        renderSectionGrid(sectionKey);
      });

      const grid = els.sectionGrids[sectionKey];
      grid?.addEventListener("click", (e) => {
        const tagBtn = e.target.closest("[data-tag-pill]");
        if (tagBtn) {
          e.preventDefault();
          e.stopPropagation();
          const secState = state.sections[sectionKey];
          const tag = tagBtn.dataset.tagPill;
          if (secState.selectedTags.has(tag)) secState.selectedTags.delete(tag);
          else secState.selectedTags.add(tag);
          renderFilterPanel();
          renderSectionGrid(sectionKey);
          return;
        }

        const playLink = e.target.closest("[data-play-id]");
        if (playLink && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          const game = state.sections[sectionKey].games.find((g) => g.id === playLink.dataset.playId);
          if (game) openGame(game);
        }
      });
    });

    els.playBack.addEventListener("click", () => closeGame());
    els.playFullscreen.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenButton);
    document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

    // Junior Arcade adult controls: brief hold-to-exit Back button & Exit Fullscreen toggle
    if (els.playAdultBack) {
      let holdTimer = null;
      let hintTimer = null;
      let activePointerId = null;
      let holdCompleted = false;
      const reducedMotionQuery = window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : { matches: false };

      const showAdultHint = (msg) => {
        if (!els.playAdultHint) return;
        els.playAdultHint.textContent = msg;
        els.playAdultHint.classList.add("is-visible");
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => {
          els.playAdultHint.classList.remove("is-visible");
        }, 2200);
      };

      const cancelAdultHold = (releasedEarly) => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        if (activePointerId !== null) {
          try {
            els.playAdultBack.releasePointerCapture(activePointerId);
          } catch {
            // Ignore
          }
          activePointerId = null;
        }
        const wasHolding = els.playAdultBack.classList.contains("is-holding");
        els.playAdultBack.classList.remove("is-holding");
        if (releasedEarly && wasHolding && !holdCompleted) {
          showAdultHint("Hold Back to exit");
        }
      };

      els.playAdultBack.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        holdCompleted = false;
        activePointerId = e.pointerId;
        try {
          els.playAdultBack.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
        els.playAdultBack.classList.remove("is-holding");
        void els.playAdultBack.offsetWidth;
        els.playAdultBack.classList.add("is-holding");
        if (reducedMotionQuery.matches) {
          showAdultHint("Holding…");
        }
        holdTimer = setTimeout(() => {
          holdTimer = null;
          holdCompleted = true;
          els.playAdultBack.classList.remove("is-holding");
          authorizeJuniorExit();
        }, JUNIOR_HOLD_MS);
      });

      els.playAdultBack.addEventListener("pointerup", () => cancelAdultHold(true));
      els.playAdultBack.addEventListener("pointercancel", () => cancelAdultHold(false));
      els.playAdultBack.addEventListener("lostpointercapture", () => cancelAdultHold(false));

      // Keyboard activation (Enter / Space) exits cleanly without pointer hold
      els.playAdultBack.addEventListener("click", (e) => {
        if (e.detail === 0) {
          authorizeJuniorExit();
        }
      });
    }

    if (els.playAdultFullscreen) {
      els.playAdultFullscreen.addEventListener("click", async () => {
        if (getFullscreenElement()) {
          state.juniorUserExitedFs = true;
          await exitPlayFullscreen();
        } else {
          state.juniorUserExitedFs = false;
          await requestPlayFullscreen();
        }
        updateFullscreenButton();
      });
    }

    // Parent-level touch-gesture & history-back lock while a Junior game is active
    const isInteractiveEl = (target) =>
      Boolean(
        target &&
          typeof target.closest === "function" &&
          target.closest('button, a, input, select, textarea, [role="button"]')
      );

    document.addEventListener(
      "touchstart",
      (e) => {
        if (!state.juniorLocked || isInteractiveEl(e.target)) return;
        if (!e.touches || e.touches.length === 0) return;
        if (e.touches.length > 1) {
          e.preventDefault();
          return;
        }
        const t = e.touches[0];
        const w = window.innerWidth || document.documentElement.clientWidth || 0;
        if (
          t.clientX <= JUNIOR_EDGE_PX ||
          t.clientX >= w - JUNIOR_EDGE_PX ||
          t.clientY <= JUNIOR_EDGE_PX
        ) {
          e.preventDefault();
        }
      },
      { passive: false, capture: true }
    );

    document.addEventListener(
      "touchmove",
      (e) => {
        if (!state.juniorLocked || isInteractiveEl(e.target)) return;
        e.preventDefault();
      },
      { passive: false, capture: true }
    );

    for (const evtName of ["gesturestart", "gesturechange", "gestureend"]) {
      document.addEventListener(
        evtName,
        (e) => {
          if (state.juniorLocked) e.preventDefault();
        },
        { passive: false, capture: true }
      );
    }

    document.addEventListener(
      "contextmenu",
      (e) => {
        if (state.juniorLocked) e.preventDefault();
      },
      { capture: true }
    );

    window.addEventListener(
      "wheel",
      (e) => {
        if (state.juniorLocked && (Math.abs(e.deltaX) > 0 || e.ctrlKey)) {
          e.preventDefault();
        }
      },
      { passive: false, capture: true }
    );

    window.addEventListener("popstate", () => {
      if (state.juniorLocked && !state.juniorExitAuthorized && state.activeGame) {
        const lockedHash = `#play=${encodeURIComponent(state.activeGame.id)}`;
        history.pushState({ play: state.activeGame.id, juniorLock: true }, "", lockedHash);
      }
    });

    window.addEventListener("beforeunload", (e) => {
      if (state.juniorLocked && !state.juniorExitAuthorized) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    window.addEventListener("message", (e) => {
      if (!state.juniorLocked || !state.playFrame) return;
      if (e.source !== state.playFrame.contentWindow) return;
      if (location.origin !== "null" && e.origin !== location.origin) return;
      if (e.data && e.data.type === "junior:gesture") {
        if (!state.juniorUserExitedFs && !getFullscreenElement() && isFullscreenSupported()) {
          requestPlayFullscreen().finally(updateFullscreenButton);
        }
      }
    });

    const openCurrentDetails = () => {
      if (state.activeGame) openDetailsDialog(state.activeGame);
    };
    els.playDetailsBtn.addEventListener("click", openCurrentDetails);
    els.playStats.addEventListener("click", openCurrentDetails);

    els.detailsClose.addEventListener("click", () => els.detailsDialog.close());
    els.detailsDialog.addEventListener("click", (e) => {
      if (e.target === els.detailsDialog) els.detailsDialog.close();
    });

    window.addEventListener("hashchange", syncFromHash);
  }

  function findGameByPlayParam(rawId) {
    const allGames = getAllGames();
    // Exact section-qualified match first (e.g. "junior/bubble-pop.html")
    const exact = allGames.find((g) => g.id === rawId);
    if (exact) return exact;

    // Legacy filename-only fallback (e.g. "snack-man.html") — check active section first, then default
    const activeMatch = state.sections[state.activeSection].games.find((g) => g.fileName === rawId);
    if (activeMatch) return activeMatch;
    return allGames.find((g) => g.fileName === rawId) || null;
  }

  function detectInitialSection() {
    const hash = location.hash.toLowerCase();
    if (hash === "#junior" || hash === "#section=junior") return "junior";
    if (hash === "#arcade" || hash === "#section=arcade") return "arcade";

    const params = new URLSearchParams(location.search);
    const paramSection = (params.get("section") || "").toLowerCase();
    if (CONFIG.sections[paramSection]) return paramSection;

    return CONFIG.defaultSection;
  }

  function syncFromHash() {
    if (state.activeGame && state.juniorLocked && !state.juniorExitAuthorized) {
      const lockedHash = `#play=${encodeURIComponent(state.activeGame.id)}`;
      if (location.hash !== lockedHash) {
        history.pushState({ play: state.activeGame.id, juniorLock: true }, "", lockedHash);
      }
      return;
    }

    const playMatch = location.hash.match(/^#play=(.+)$/);
    if (playMatch) {
      const id = decodeURIComponent(playMatch[1]);
      const game = findGameByPlayParam(id);
      if (game && state.activeGame?.id !== game.id) {
        openGame(game, { pushHash: false });
      }
      return;
    }

    if (state.activeGame) {
      closeGame({ updateHash: false });
    }

    const hashSection = location.hash.replace(/^#(?:section=)?/, "").toLowerCase();
    if (CONFIG.sections[hashSection] && hashSection !== state.activeSection) {
      setActiveSection(hashSection, { updateHash: false });
    }
  }

  // ---------------------------------------------------------------------------
  // Main boot flow
  // ---------------------------------------------------------------------------
  async function loadSection(repoInfo, sectionKey) {
    const secConfig = CONFIG.sections[sectionKey];
    const secState = state.sections[sectionKey];
    hideStatus(sectionKey);
    els.sectionLoading[sectionKey].hidden = false;

    const listing = await fetchDirectoryListing(repoInfo, secConfig.dir);
    secState.games = await mapWithConcurrency(listing.files, CONFIG.metaFetchConcurrency, (file) =>
      fetchGameMeta(file, secConfig.dir, sectionKey)
    );
    secState.loaded = true;
    els.sectionLoading[sectionKey].hidden = true;
    updateSectionCountBadge(sectionKey);
    renderSectionGrid(sectionKey);

    if (secState.games.length === 0) {
      showStatus(sectionKey, secConfig.emptyText);
    }

    return listing.files.map((f) => f.sha);
  }

  async function loadGames() {
    const initialSection = detectInitialSection();
    setActiveSection(initialSection, { updateHash: false, scrollTab: false });

    const repoInfo = detectRepo();
    if (!repoInfo) {
      console.warn(
        "[Retro Arcade] Could not auto-detect repository. Set CONFIG.owner and CONFIG.repo in arcade.js or open with ?repo=owner/repo."
      );
      SECTION_KEYS.forEach((key) => {
        els.sectionLoading[key].hidden = true;
        state.sections[key].loaded = true;
        updateSectionCountBadge(key);
        showStatus(key, "The arcade is getting set up — check back soon!", { isError: false });
      });
      els.count.textContent = "0 / 0";
      return;
    }

    const results = await Promise.allSettled(SECTION_KEYS.map((key) => loadSection(repoInfo, key)));

    const allValidShas = new Set();
    let allSucceeded = true;

    results.forEach((res, idx) => {
      const key = SECTION_KEYS[idx];
      if (res.status === "fulfilled") {
        for (const sha of res.value) allValidShas.add(sha);
      } else {
        allSucceeded = false;
        els.sectionLoading[key].hidden = true;
        state.sections[key].loaded = true;
        updateSectionCountBadge(key);
        showStatus(
          key,
          res.reason?.message || "Couldn't load the game library right now. Please try again shortly.",
          { isError: true }
        );
      }
    });

    if (allSucceeded) {
      pruneMetaCache(allValidShas);
    }

    renderFilterPanel();
    updateSortChips();
    renderSectionGrid(state.activeSection);
    syncFromHash();
  }

  wireEvents();
  loadGames();
})();
