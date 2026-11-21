(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Configuration
  // Leave owner/repo blank to auto-detect on *.github.io.
  // For local testing, either fill these in or open ?repo=owner/repo.
  // ---------------------------------------------------------------------------
  const CONFIG = {
    owner: "",
    repo: "",
    branch: "", // Leave blank to use the repository's default branch
    gamesDir: "games",
    dirCacheTtlMs: 10 * 60 * 1000, // 10 minutes before revalidating via ETag
    metaFetchConcurrency: 6,
  };

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

  // DOM references
  const els = {
    search: document.getElementById("search"),
    filterToggle: document.querySelector(".models-toggle"),
    filterValue: document.querySelector("[data-models-value]"),
    filterPanel: document.getElementById("models-panel"),
    filterList: document.querySelector(".models-list"),
    filterClear: document.querySelector(".models-clear"),
    sortButtons: Array.from(document.querySelectorAll(".sort-keys .chip")),
    count: document.querySelector("[data-count]"),
    status: document.querySelector("[data-status]"),
    loading: document.querySelector("[data-loading]"),
    grid: document.querySelector(".grid"),
    gameOver: document.querySelector(".game-over"),
    gameOverReset: document.querySelector(".game-over-reset"),
    play: document.querySelector(".play"),
    playBack: document.querySelector(".play-back"),
    playName: document.getElementById("play-name"),
    playStats: document.querySelector(".play-stats"),
    playFullscreen: document.querySelector(".play-fullscreen"),
    playDetailsBtn: document.querySelector(".play-details-toggle"),
    detailsDialog: document.querySelector("dialog.details"),
    detailsName: document.getElementById("details-name"),
    detailsGenre: document.querySelector(".details-harness"),
    detailsClose: document.querySelector(".details-close"),
    detailsBody: document.querySelector(".details-body"),
    cacheInfo: document.querySelector("[data-cache-info]"),
    refreshBtn: document.querySelector("[data-refresh]"),
    repoLink: document.querySelector("[data-repo-link]"),
  };

  const state = {
    repoInfo: null,
    games: [],
    query: "",
    selectedGenres: new Set(),
    selectedTags: new Set(),
    sortKey: "added",
    sortDir: "desc",
    activeGame: null,
    playFrame: null,
    lastFocused: null,
  };

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
      // Ignore quota or private-browsing storage errors
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
  async function fetchDirectoryListing(repoInfo, { forceRefresh = false } = {}) {
    const { owner, repo, branch } = repoInfo;
    const cacheKey = `dir:${owner}/${repo}/${CONFIG.gamesDir}:${branch || "default"}`;
    const cached = readCache(cacheKey);
    const now = Date.now();

    if (!forceRefresh && cached && Array.isArray(cached.files) && now - cached.fetchedAt < CONFIG.dirCacheTtlMs) {
      return { files: cached.files, source: "cache", fetchedAt: cached.fetchedAt };
    }

    const refQuery = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(CONFIG.gamesDir)}${refQuery}`;

    const headers = { Accept: "application/vnd.github+json" };
    if (!forceRefresh && cached && cached.etag) {
      headers["If-None-Match"] = cached.etag;
    }

    try {
      const res = await fetch(apiUrl, { headers });

      if (res.status === 304 && cached) {
        const updated = { ...cached, fetchedAt: now };
        writeCache(cacheKey, updated);
        return { files: cached.files, source: "revalidated", fetchedAt: now };
      }

      if (res.status === 404) {
        throw new Error(`Folder "${CONFIG.gamesDir}/" was not found in ${owner}/${repo}.`);
      }

      if (res.status === 403) {
        if (cached && Array.isArray(cached.files)) {
          return { files: cached.files, source: "stale-rate-limit", fetchedAt: cached.fetchedAt };
        }
        throw new Error("GitHub API rate limit reached (60 req/hr). Please wait a bit and refresh.");
      }

      if (!res.ok) {
        throw new Error(`GitHub API error (${res.status}).`);
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error(`"${CONFIG.gamesDir}" is not a directory in ${owner}/${repo}.`);
      }

      const files = data
        .filter((item) => item.type === "file" && /\.html?$/i.test(item.name))
        .map((item) => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
          size: item.size || 0,
          downloadUrl: item.download_url || "",
        }));

      const etag = res.headers.get("ETag") || "";
      writeCache(cacheKey, { etag, fetchedAt: now, files });
      return { files, source: "network", fetchedAt: now };
    } catch (err) {
      if (cached && Array.isArray(cached.files)) {
        return { files: cached.files, source: "stale-offline", fetchedAt: cached.fetchedAt };
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

  async function fetchGameMeta(file) {
    const cacheKey = `meta:${file.sha}`;
    const cached = readCache(cacheKey);
    if (cached && cached.title) {
      return buildGameRecord(file, cached);
    }

    const relativeUrl = `./${CONFIG.gamesDir}/${encodeURIComponent(file.name)}`;
    let html = "";

    // Try same-origin GitHub Pages file first (fast CDN, zero GitHub API quota)
    try {
      const res = await fetch(relativeUrl);
      if (res.ok) html = await res.text();
    } catch {
      // Fall through to raw.githubusercontent.com
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
    return buildGameRecord(file, parsed);
  }

  function buildGameRecord(file, meta) {
    const addedTs = meta.added && !Number.isNaN(Date.parse(meta.added)) ? Date.parse(meta.added) : 0;
    const accent = meta.color || GENRE_COLORS[meta.genre] || "var(--pac)";
    return {
      id: file.name,
      filename: file.name,
      url: `./${CONFIG.gamesDir}/${encodeURIComponent(file.name)}`,
      sha: file.sha,
      size: file.size,
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
  function formatSize(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
  // Filtering & sorting
  // ---------------------------------------------------------------------------
  function getVisibleGames() {
    const q = state.query.trim().toLowerCase();

    const filtered = state.games.filter((g) => {
      if (state.selectedGenres.size > 0 && !state.selectedGenres.has(g.genre)) {
        return false;
      }
      if (state.selectedTags.size > 0) {
        for (const tag of state.selectedTags) {
          if (!g.tags.includes(tag)) return false;
        }
      }
      if (q) {
        const haystack = [g.title, g.description, g.genre, g.author, g.year, g.filename, ...g.tags]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const dir = state.sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (state.sortKey) {
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
        case "size":
          cmp = (a.size || 0) - (b.size || 0);
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
    const genreCounts = new Map();
    const tagCounts = new Map();

    for (const g of state.games) {
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
              <input type="checkbox" data-filter-type="genre" value="${escapeHtml(genre)}" ${state.selectedGenres.has(genre) ? "checked" : ""} />
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
              <input type="checkbox" data-filter-type="tag" value="${escapeHtml(tag)}" ${state.selectedTags.has(tag) ? "checked" : ""} />
              <span class="models-name">#${escapeHtml(tag)}</span>
              <span class="models-count">${count}</span>
            </label>`
            )
            .join("")}
        </fieldset>
      `);
    }

    els.filterList.innerHTML = sections.join("") || `<p class="models-hint" style="padding:10px">No filters yet.</p>`;
    updateFilterSummary();
  }

  function updateFilterSummary() {
    const totalSelected = state.selectedGenres.size + state.selectedTags.size;
    els.filterClear.disabled = totalSelected === 0;
    els.filterToggle.classList.toggle("is-active", totalSelected > 0);

    if (totalSelected === 0) {
      els.filterValue.textContent = "All";
    } else if (totalSelected === 1) {
      const only = state.selectedGenres.size ? [...state.selectedGenres][0] : `#${[...state.selectedTags][0]}`;
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

  function buildDetailMarkup(game) {
    const rows = [
      ["Genre", game.genre],
      ["Added", formatDate(game.added)],
      ["Year", game.year || "—"],
      ["Size", formatSize(game.size)],
      ["Author", game.author || "—"],
      ["File", game.filename],
    ];

    return `
      <div class="cab-why">
        <p class="cab-panel-head">ABOUT</p>
        <p class="cab-check-note" style="margin:0 0 10px">${escapeHtml(game.description || "Single-file HTML retro game.")}</p>
        ${
          game.controls
            ? `<p class="cab-panel-head" style="margin-top:10px">CONTROLS</p>
               <p class="cab-check-note" style="margin:0">${escapeHtml(game.controls)}</p>`
            : ""
        }
      </div>
      <div>
        <p class="cab-panel-head">CABINET DATA</p>
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
          <a href="${escapeHtml(game.url)}" target="_blank" rel="noopener">Open standalone ↗</a>
        </p>
      </div>
    `;
  }

  function renderGrid() {
    previewObserver.disconnect();
    const visible = getVisibleGames();

    els.count.textContent = `${visible.length} / ${state.games.length}`;
    els.gameOver.hidden = visible.length > 0 || state.games.length === 0;

    if (visible.length === 0) {
      els.grid.innerHTML = "";
      return;
    }

    const frag = document.createDocumentFragment();

    visible.forEach((game, idx) => {
      const card = document.createElement("article");
      card.className = "cab";
      card.style.setProperty("--i", String(idx));
      card.style.setProperty("--c", game.accent);

      const tagsHtml = game.tags
        .map((tag) => {
          const active = state.selectedTags.has(tag) ? " is-active" : "";
          return `<button type="button" class="cab-tag${active}" data-tag-pill="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`;
        })
        .join("");

      card.innerHTML = `
        <div class="cab-screen" data-src="${escapeHtml(game.url)}" data-title="${escapeHtml(game.title)}">
          <span class="cab-coin">INSERT COIN</span>
          <span class="cab-start">▶ PRESS START</span>
        </div>
        <div class="cab-body">
          <div class="cab-top">
            <span class="cab-harness">
              <svg aria-hidden="true"><use href="#ghost" /></svg>
              ${escapeHtml(game.genre)}
            </span>
            <span class="cab-score">${game.year ? `<b>${escapeHtml(game.year)}</b>` : escapeHtml(formatSize(game.size))}</span>
          </div>
          <h2 class="cab-model">
            <a class="cab-link" href="${escapeHtml(game.url)}" data-play-id="${escapeHtml(game.id)}">
              ${escapeHtml(game.title)}
            </a>
          </h2>
          ${game.description ? `<p class="cab-asked">${escapeHtml(game.description)}</p>` : ""}
          ${tagsHtml ? `<div class="cab-tags">${tagsHtml}</div>` : ""}
          <dl class="cab-stats">
            <div class="cab-stat">
              <dt>ADDED</dt>
              <dd class="${game.added ? "" : "is-empty"}">${escapeHtml(game.added || "—")}</dd>
            </div>
            <div class="cab-stat">
              <dt>SIZE</dt>
              <dd>${escapeHtml(formatSize(game.size))}</dd>
            </div>
            <div class="cab-stat">
              <dt>TAGS</dt>
              <dd class="${game.tags.length ? "" : "is-empty"}">${game.tags.length || "—"}</dd>
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

    els.grid.innerHTML = "";
    els.grid.appendChild(frag);

    els.grid.querySelectorAll(".cab-screen").forEach((screen) => previewObserver.observe(screen));
  }

  // ---------------------------------------------------------------------------
  // In-page Arcade Overlay + Fullscreen Toggle + Details Dialog
  // ---------------------------------------------------------------------------
  function openGame(game, { pushHash = true } = {}) {
    state.activeGame = game;
    state.lastFocused = document.activeElement;

    els.playName.textContent = game.title;
    els.playStats.innerHTML = `
      <div class="cab-stat"><dt>GENRE</dt><dd data-field="score">${escapeHtml(game.genre)}</dd></div>
      <div class="cab-stat"><dt>ADDED</dt><dd>${escapeHtml(game.added || "—")}</dd></div>
      <div class="cab-stat"><dt>SIZE</dt><dd>${escapeHtml(formatSize(game.size))}</dd></div>
    `;

    if (state.playFrame) {
      state.playFrame.remove();
      state.playFrame = null;
    }

    const iframe = document.createElement("iframe");
    iframe.className = "play-frame";
    iframe.src = game.url;
    iframe.title = game.title;
    iframe.setAttribute("allow", "fullscreen; gamepad");
    els.play.appendChild(iframe);
    state.playFrame = iframe;

    els.play.hidden = false;
    document.documentElement.classList.add("is-playing");

    if (pushHash) {
      const targetHash = `#play=${encodeURIComponent(game.id)}`;
      if (location.hash !== targetHash) history.pushState({ play: game.id }, "", targetHash);
    }

    iframe.addEventListener("load", () => {
      try {
        iframe.contentWindow?.focus();
      } catch {
        // Ignore cross-origin focus errors
      }
    });
  }

  function closeGame({ updateHash = true } = {}) {
    if (!state.activeGame) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (els.detailsDialog.open) {
      els.detailsDialog.close();
    }

    els.play.hidden = true;
    document.documentElement.classList.remove("is-playing");

    if (state.playFrame) {
      state.playFrame.remove();
      state.playFrame = null;
    }

    state.activeGame = null;

    if (updateHash && location.hash.startsWith("#play=")) {
      history.pushState(null, "", location.pathname + location.search);
    }

    if (state.lastFocused && typeof state.lastFocused.focus === "function") {
      state.lastFocused.focus();
    }
  }

  function openDetailsDialog(game) {
    els.detailsName.textContent = game.title;
    els.detailsGenre.textContent = game.genre;
    els.detailsBody.innerHTML = `<div class="details-content">${buildDetailMarkup(game)}</div>`;
    els.detailsDialog.showModal();
  }

  function updateFullscreenButton() {
    const isFs = Boolean(document.fullscreenElement);
    els.playFullscreen.setAttribute("aria-pressed", String(isFs));
    els.playFullscreen.textContent = isFs ? "✕ EXIT FULL" : "⛶ FULLSCREEN";
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await els.play.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by browser policy
    }
  }

  // ---------------------------------------------------------------------------
  // Sort chips & UI wiring
  // ---------------------------------------------------------------------------
  function updateSortChips() {
    for (const btn of els.sortButtons) {
      const key = btn.dataset.sort;
      const label = btn.dataset.label;
      const isActive = key === state.sortKey;
      btn.setAttribute("aria-pressed", String(isActive));
      btn.textContent = isActive ? `${label} ${state.sortDir === "asc" ? "↑" : "↓"}` : label;
    }
  }

  function showStatus(html, { isError = false } = {}) {
    els.status.innerHTML = html;
    els.status.classList.toggle("is-error", isError);
    els.status.hidden = false;
  }

  function hideStatus() {
    els.status.hidden = true;
    els.status.innerHTML = "";
  }

  function wireEvents() {
    // Search input
    els.search.addEventListener("input", (e) => {
      state.query = e.target.value;
      renderGrid();
    });

    // '/' shortcut focuses search, Escape closes filter panel or overlay
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !state.activeGame && document.activeElement !== els.search) {
        e.preventDefault();
        els.search.focus();
        els.search.select();
      } else if (e.key === "Escape") {
        if (!els.filterPanel.hidden) {
          els.filterPanel.hidden = true;
          els.filterToggle.setAttribute("aria-expanded", "false");
        } else if (state.activeGame && !els.detailsDialog.open && !document.fullscreenElement) {
          closeGame();
        }
      }
    });

    // Filter dropdown toggle
    els.filterToggle.addEventListener("click", () => {
      const opening = els.filterPanel.hidden;
      els.filterPanel.hidden = !opening;
      els.filterToggle.setAttribute("aria-expanded", String(opening));
    });

    // Close filter dropdown on outside click
    document.addEventListener("click", (e) => {
      if (!els.filterPanel.hidden && !e.target.closest(".models")) {
        els.filterPanel.hidden = true;
        els.filterToggle.setAttribute("aria-expanded", "false");
      }
    });

    // Filter checkboxes
    els.filterList.addEventListener("change", (e) => {
      const input = e.target;
      if (!input.matches("input[type='checkbox']")) return;
      const targetSet = input.dataset.filterType === "genre" ? state.selectedGenres : state.selectedTags;
      if (input.checked) targetSet.add(input.value);
      else targetSet.delete(input.value);
      updateFilterSummary();
      renderGrid();
    });

    // Clear filters
    els.filterClear.addEventListener("click", () => {
      state.selectedGenres.clear();
      state.selectedTags.clear();
      renderFilterPanel();
      renderGrid();
    });

    // Sort chips
    els.sortButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = key === "title" || key === "genre" ? "asc" : "desc";
        }
        updateSortChips();
        renderGrid();
      });
    });

    // Reset button in empty state
    els.gameOverReset.addEventListener("click", () => {
      state.query = "";
      els.search.value = "";
      state.selectedGenres.clear();
      state.selectedTags.clear();
      renderFilterPanel();
      renderGrid();
    });

    // Card clicks: launch game or toggle tag pill
    els.grid.addEventListener("click", (e) => {
      const tagBtn = e.target.closest("[data-tag-pill]");
      if (tagBtn) {
        e.preventDefault();
        e.stopPropagation();
        const tag = tagBtn.dataset.tagPill;
        if (state.selectedTags.has(tag)) state.selectedTags.delete(tag);
        else state.selectedTags.add(tag);
        renderFilterPanel();
        renderGrid();
        return;
      }

      const playLink = e.target.closest("[data-play-id]");
      if (playLink && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const game = state.games.find((g) => g.id === playLink.dataset.playId);
        if (game) openGame(game);
      }
    });

    // Overlay controls
    els.playBack.addEventListener("click", () => closeGame());
    els.playFullscreen.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenButton);

    const openCurrentDetails = () => {
      if (state.activeGame) openDetailsDialog(state.activeGame);
    };
    els.playDetailsBtn.addEventListener("click", openCurrentDetails);
    els.playStats.addEventListener("click", openCurrentDetails);

    els.detailsClose.addEventListener("click", () => els.detailsDialog.close());
    els.detailsDialog.addEventListener("click", (e) => {
      if (e.target === els.detailsDialog) els.detailsDialog.close();
    });

    // Browser back/forward hash navigation
    window.addEventListener("hashchange", syncFromHash);

    // Manual cache refresh button
    els.refreshBtn.addEventListener("click", () => loadGames({ forceRefresh: true }));
  }

  function syncFromHash() {
    const match = location.hash.match(/^#play=(.+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const game = state.games.find((g) => g.id === id);
      if (game && state.activeGame?.id !== game.id) {
        openGame(game, { pushHash: false });
      }
    } else if (state.activeGame) {
      closeGame({ updateHash: false });
    }
  }

  // ---------------------------------------------------------------------------
  // Main boot flow
  // ---------------------------------------------------------------------------
  async function loadGames({ forceRefresh = false } = {}) {
    hideStatus();
    els.loading.hidden = false;

    const repoInfo = detectRepo();
    state.repoInfo = repoInfo;

    if (!repoInfo) {
      els.loading.hidden = true;
      els.count.textContent = "0 / 0";
      showStatus(
        `<span>Running outside <code>*.github.io</code>. Set <code>CONFIG.owner</code> and <code>CONFIG.repo</code> in <code>arcade.js</code> or open with <code>?repo=owner/repo</code>.</span>`,
        { isError: true }
      );
      return;
    }

    els.repoLink.href = `https://github.com/${repoInfo.owner}/${repoInfo.repo}`;
    els.repoLink.textContent = `github.com/${repoInfo.owner}/${repoInfo.repo}`;
    els.repoLink.hidden = false;

    try {
      const listing = await fetchDirectoryListing(repoInfo, { forceRefresh });

      if (listing.source === "stale-rate-limit") {
        showStatus("GitHub API rate limit reached; showing cached game list.");
      } else if (listing.source === "stale-offline") {
        showStatus("Could not reach GitHub API; showing cached game list.");
      }

      const validShas = new Set(listing.files.map((f) => f.sha));
      pruneMetaCache(validShas);

      state.games = await mapWithConcurrency(listing.files, CONFIG.metaFetchConcurrency, fetchGameMeta);

      els.loading.hidden = true;
      renderFilterPanel();
      updateSortChips();
      renderGrid();
      syncFromHash();

      const timeStr = new Date(listing.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      els.cacheInfo.textContent = `${state.games.length} cabinets · ${listing.source} (${timeStr})`;

      if (state.games.length === 0) {
        showStatus(`No <code>.html</code> files found in <code>${escapeHtml(CONFIG.gamesDir)}/</code> yet.`);
      }
    } catch (err) {
      els.loading.hidden = true;
      els.count.textContent = "0 / 0";
      showStatus(`<span>${escapeHtml(err.message || "Failed to load games.")}</span>`, { isError: true });
    }
  }

  wireEvents();
  loadGames();
})();
