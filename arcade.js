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
  };

  const state = {
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
  async function fetchDirectoryListing(repoInfo) {
    const { owner, repo, branch } = repoInfo;
    const cacheKey = `dir:${owner}/${repo}/${CONFIG.gamesDir}:${branch || "default"}`;
    const cached = readCache(cacheKey);
    const now = Date.now();

    if (cached && Array.isArray(cached.files) && now - cached.fetchedAt < CONFIG.dirCacheTtlMs) {
      return { files: cached.files, fromStaleCache: false };
    }

    const refQuery = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(CONFIG.gamesDir)}${refQuery}`;

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

  async function fetchGameMeta(file) {
    const cacheKey = `meta:${file.sha}`;
    const cached = readCache(cacheKey);
    if (cached && cached.title) {
      return buildGameRecord(file, cached);
    }

    const relativeUrl = `./${CONFIG.gamesDir}/${encodeURIComponent(file.name)}`;
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
    return buildGameRecord(file, parsed);
  }

  function buildGameRecord(file, meta) {
    const addedTs = meta.added && !Number.isNaN(Date.parse(meta.added)) ? Date.parse(meta.added) : 0;
    const accent = meta.color || GENRE_COLORS[meta.genre] || "var(--pac)";
    return {
      id: file.name,
      url: `./${CONFIG.gamesDir}/${encodeURIComponent(file.name)}`,
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
        const haystack = [g.title, g.description, g.genre, g.author, g.year, ...g.tags].join(" ").toLowerCase();
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

    els.filterList.innerHTML = sections.join("") || `<p class="models-hint" style="padding:10px">No filters available.</p>`;
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
    const rows = [["Genre", game.genre]];
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
            <span class="cab-score">${game.year ? `<b>${escapeHtml(game.year)}</b>` : ""}</span>
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
      ${game.year ? `<div class="cab-stat"><dt>YEAR</dt><dd>${escapeHtml(game.year)}</dd></div>` : ""}
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

  function showStatus(text, { isError = false } = {}) {
    els.status.textContent = text;
    els.status.classList.toggle("is-error", isError);
    els.status.hidden = false;
  }

  function hideStatus() {
    els.status.hidden = true;
    els.status.textContent = "";
  }

  function wireEvents() {
    els.search.addEventListener("input", (e) => {
      state.query = e.target.value;
      renderGrid();
    });

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
      const targetSet = input.dataset.filterType === "genre" ? state.selectedGenres : state.selectedTags;
      if (input.checked) targetSet.add(input.value);
      else targetSet.delete(input.value);
      updateFilterSummary();
      renderGrid();
    });

    els.filterClear.addEventListener("click", () => {
      state.selectedGenres.clear();
      state.selectedTags.clear();
      renderFilterPanel();
      renderGrid();
    });

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

    els.gameOverReset.addEventListener("click", () => {
      state.query = "";
      els.search.value = "";
      state.selectedGenres.clear();
      state.selectedTags.clear();
      renderFilterPanel();
      renderGrid();
    });

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

    window.addEventListener("hashchange", syncFromHash);
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
  async function loadGames() {
    hideStatus();
    els.loading.hidden = false;

    const repoInfo = detectRepo();
    if (!repoInfo) {
      console.warn(
        "[Retro Arcade] Could not auto-detect repository. Set CONFIG.owner and CONFIG.repo in arcade.js or open with ?repo=owner/repo."
      );
      els.loading.hidden = true;
      els.count.textContent = "0 / 0";
      showStatus("The arcade is getting set up — check back soon!", { isError: false });
      return;
    }

    try {
      const listing = await fetchDirectoryListing(repoInfo);
      const validShas = new Set(listing.files.map((f) => f.sha));
      pruneMetaCache(validShas);

      state.games = await mapWithConcurrency(listing.files, CONFIG.metaFetchConcurrency, fetchGameMeta);

      els.loading.hidden = true;
      renderFilterPanel();
      updateSortChips();
      renderGrid();
      syncFromHash();

      if (state.games.length === 0) {
        showStatus("No games are on the arcade floor yet — check back soon!");
      }
    } catch (err) {
      els.loading.hidden = true;
      els.count.textContent = "0 / 0";
      showStatus(err.message || "Couldn't load the game library right now. Please try again shortly.", {
        isError: true,
      });
    }
  }

  wireEvents();
  loadGames();
})();
