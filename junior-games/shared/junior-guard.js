(() => {
  "use strict";

  if (window.__juniorGuardInitialized) return;
  window.__juniorGuardInitialized = true;

  const HOLD_MS = 650;
  const EDGE_PX = 44;
  const PLAY_FRAME_NAME = "retro-arcade-junior-play";
  const BACK_URL = "../index.html#junior";

  const isTopLevel = (() => {
    try {
      return window.self === window.top;
    } catch {
      return false;
    }
  })();

  const isPlayEmbed = !isTopLevel && window.name === PLAY_FRAME_NAME;
  const isPreviewEmbed = !isTopLevel && !isPlayEmbed;

  // Keep compact gallery preview thumbnails completely untouched
  if (isPreviewEmbed) return;

  const reducedMotionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  function isFullscreenSupported() {
    const el = document.documentElement;
    return Boolean(
      (document.fullscreenEnabled || document.webkitFullscreenEnabled) &&
        (typeof el.requestFullscreen === "function" ||
          typeof el.webkitRequestFullscreen === "function")
    );
  }

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  async function enterFullscreenSafe(target = document.documentElement) {
    if (!target || getFullscreenElement()) return;
    try {
      if (typeof target.requestFullscreen === "function") {
        try {
          await target.requestFullscreen({ navigationUI: "hide" });
        } catch {
          await target.requestFullscreen();
        }
      } else if (typeof target.webkitRequestFullscreen === "function") {
        target.webkitRequestFullscreen();
      }
      if (navigator.keyboard && typeof navigator.keyboard.lock === "function") {
        navigator.keyboard.lock(["Escape"]).catch(() => {});
      }
    } catch {
      // Fullscreen may be unavailable or blocked by browser policy
    }
  }

  async function exitFullscreenSafe() {
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

  function isInteractiveControl(target) {
    return Boolean(
      target &&
        typeof target.closest === "function" &&
        target.closest('button, a, input, select, textarea, [role="button"]')
    );
  }

  // -------------------------------------------------------------------------
  // Touch, swipe, pinch, context-menu, trackpad & keyboard back blocker
  // -------------------------------------------------------------------------
  function installGestureBlockers() {
    const style = document.createElement("style");
    style.id = "junior-guard-base-style";
    style.textContent = `
      html,
      body {
        overscroll-behavior: none !important;
        touch-action: none;
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-tap-highlight-color: transparent;
      }

      button,
      [role="button"] {
        touch-action: manipulation;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    // Block edge-swipe back/forward, top-edge pull-down, and multi-touch pinch
    document.addEventListener(
      "touchstart",
      (e) => {
        if (isInteractiveControl(e.target)) return;
        if (!e.touches || e.touches.length === 0) return;
        if (e.touches.length > 1) {
          e.preventDefault();
          return;
        }
        const t = e.touches[0];
        const w = window.innerWidth || document.documentElement.clientWidth || 0;
        if (t.clientX <= EDGE_PX || t.clientX >= w - EDGE_PX || t.clientY <= EDGE_PX) {
          e.preventDefault();
        }
      },
      { passive: false, capture: true }
    );

    // Block pull-to-refresh, rubber-band bounce, and swipe navigation during touch moves
    document.addEventListener(
      "touchmove",
      (e) => {
        if (isInteractiveControl(e.target)) return;
        e.preventDefault();
      },
      { passive: false, capture: true }
    );

    // Block Safari pinch/rotate gesture events
    for (const evtName of ["gesturestart", "gesturechange", "gestureend"]) {
      document.addEventListener(
        evtName,
        (e) => {
          e.preventDefault();
        },
        { passive: false, capture: true }
      );
    }

    // Block long-press context menus, image drags, and accidental text selection
    for (const evtName of ["contextmenu", "dragstart", "selectstart"]) {
      document.addEventListener(
        evtName,
        (e) => {
          e.preventDefault();
        },
        { capture: true }
      );
    }

    // Block trackpad two-finger horizontal swipe-back and Ctrl+wheel zoom
    window.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaX) > 0 || e.ctrlKey) {
          e.preventDefault();
        }
      },
      { passive: false, capture: true }
    );

    // Block keyboard history-back shortcuts
    window.addEventListener(
      "keydown",
      (e) => {
        const key = e.key;
        const isEditable = Boolean(
          e.target &&
            typeof e.target.closest === "function" &&
            e.target.closest("input, textarea, [contenteditable]")
        );
        if (
          key === "BrowserBack" ||
          key === "GoBack" ||
          key === "BrowserForward" ||
          (e.altKey && (key === "ArrowLeft" || key === "ArrowRight")) ||
          (e.metaKey && (key === "[" || key === "]" || key === "ArrowLeft" || key === "ArrowRight")) ||
          (key === "Backspace" && !isEditable)
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      { capture: true }
    );
  }

  // -------------------------------------------------------------------------
  // Embedded in index.html (.play overlay): parent owns the slim adult bar
  // -------------------------------------------------------------------------
  if (isPlayEmbed) {
    installGestureBlockers();

    // Notify parent on first user tap so deep-linked junior games can enter fullscreen
    const notifyParentGesture = () => {
      try {
        if (window.location.origin && window.location.origin !== "null") {
          window.parent.postMessage({ type: "junior:gesture" }, window.location.origin);
        }
      } catch {
        // Ignore cross-origin errors
      }
    };
    window.addEventListener("pointerdown", notifyParentGesture, { capture: true, passive: true });
    return;
  }

  // -------------------------------------------------------------------------
  // Standalone mode (opened directly at junior-games/<slug>.html)
  // -------------------------------------------------------------------------
  let locked = true;
  let exitAuthorized = false;
  let userExitedFullscreen = false;

  installGestureBlockers();

  // History trap: prevent Android/browser Back gesture from leaving the game
  function installHistoryTrap() {
    try {
      const currentUrl = window.location.href;
      if (!history.state || !history.state.juniorGuardLock) {
        history.replaceState({ juniorGuardBase: true }, "", currentUrl);
        history.pushState({ juniorGuardLock: true }, "", currentUrl);
      }
    } catch {
      // Ignore History API restrictions (e.g. file://)
    }

    window.addEventListener("popstate", () => {
      if (!locked || exitAuthorized) return;
      try {
        history.pushState({ juniorGuardLock: true }, "", window.location.href);
      } catch {
        // Ignore History API errors
      }
    });

    window.addEventListener("beforeunload", (e) => {
      if (!locked || exitAuthorized) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  function performAuthorizedBack() {
    exitAuthorized = true;
    locked = false;
    exitFullscreenSafe().finally(() => {
      window.location.replace(BACK_URL);
    });
  }

  function mountStandaloneAdultBar() {
    const barStyle = document.createElement("style");
    barStyle.id = "junior-guard-bar-style";
    barStyle.textContent = `
      :root {
        --junior-adult-bar-h: 32px;
      }

      body.junior-guard-standalone {
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      body.junior-guard-standalone > main.stage,
      body.junior-guard-standalone > #game {
        flex: 1 1 auto !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
      }

      body.junior-guard-standalone .hud-bar {
        top: var(--junior-adult-bar-h, 32px) !important;
        padding-top: 8px !important;
      }

      .junior-adult-bar {
        flex: none;
        position: relative;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-block-size: var(--junior-adult-bar-h, 32px);
        padding-top: max(3px, env(safe-area-inset-top, 0px));
        padding-right: max(8px, env(safe-area-inset-right, 0px));
        padding-bottom: 3px;
        padding-left: max(8px, env(safe-area-inset-left, 0px));
        background: #06060d;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        touch-action: none;
      }

      .junior-adult-group {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-inline-size: 0;
      }

      .junior-adult-btn {
        position: relative;
        overflow: hidden;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-inline-size: 26px;
        min-block-size: 26px;
        padding: 3px 9px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
        color: rgba(236, 235, 247, 0.72);
        font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        letter-spacing: 0.02em;
        cursor: pointer;
        touch-action: manipulation;
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
        transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
      }

      .junior-adult-btn:hover,
      .junior-adult-btn:focus-visible {
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.48);
        background: rgba(255, 255, 255, 0.12);
      }

      .junior-adult-btn:focus-visible {
        outline: 2px solid #ffe14d;
        outline-offset: 2px;
      }

      .junior-adult-btn[hidden] {
        display: none !important;
      }

      .junior-adult-btn svg {
        width: 12px;
        height: 12px;
        flex: none;
        pointer-events: none;
      }

      .junior-adult-btn-label {
        position: relative;
        z-index: 1;
        white-space: nowrap;
      }

      .junior-adult-hold-fill {
        position: absolute;
        inset: 0;
        background: rgba(255, 214, 10, 0.3);
        transform: scaleX(0);
        transform-origin: left center;
        pointer-events: none;
      }

      .junior-adult-btn.is-holding .junior-adult-hold-fill {
        transform: scaleX(1);
        transition: transform ${HOLD_MS}ms linear;
      }

      .junior-adult-hint {
        font-size: 11px;
        line-height: 1;
        color: rgba(255, 225, 77, 0.88);
        white-space: nowrap;
        opacity: 0;
        transition: opacity 150ms ease;
        pointer-events: none;
      }

      .junior-adult-hint.is-visible {
        opacity: 1;
      }

      @media (prefers-reduced-motion: reduce) {
        .junior-adult-btn,
        .junior-adult-hint {
          transition: none;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(barStyle);

    const bar = document.createElement("header");
    bar.className = "junior-adult-bar";
    bar.setAttribute("aria-label", "Adult controls");
    bar.innerHTML = `
      <div class="junior-adult-group">
        <button type="button" class="junior-adult-btn junior-adult-back" aria-describedby="junior-adult-hint">
          <span class="junior-adult-hold-fill" aria-hidden="true"></span>
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 3.5L5.5 8 10 12.5" />
          </svg>
          <span class="junior-adult-btn-label">Back</span>
        </button>
        <span id="junior-adult-hint" class="junior-adult-hint" role="status" aria-live="polite"></span>
      </div>
      <div class="junior-adult-group">
        <button type="button" class="junior-adult-btn junior-adult-fs" hidden>
          <svg class="junior-adult-fs-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></svg>
          <span class="junior-adult-btn-label junior-adult-fs-label">Fullscreen</span>
        </button>
      </div>
    `;

    document.body.classList.add("junior-guard-standalone");
    document.body.prepend(bar);

    const backBtn = bar.querySelector(".junior-adult-back");
    const hintEl = bar.querySelector(".junior-adult-hint");
    const fsBtn = bar.querySelector(".junior-adult-fs");
    const fsIcon = bar.querySelector(".junior-adult-fs-icon");
    const fsLabel = bar.querySelector(".junior-adult-fs-label");

    // Sync CSS variable to exact rendered height (excluding safe-area-inset-top)
    const syncBarHeight = () => {
      const h = Math.round(bar.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty("--junior-adult-bar-h", `${h}px`);
      }
      window.dispatchEvent(new Event("resize"));
    };

    // Hold-to-exit parental gate for pointer input; instant for keyboard activation
    let holdTimer = null;
    let hintTimer = null;
    let activePointerId = null;
    let holdCompleted = false;

    const showHint = (msg) => {
      hintEl.textContent = msg;
      hintEl.classList.add("is-visible");
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => {
        hintEl.classList.remove("is-visible");
      }, 2200);
    };

    const cancelHold = (releasedEarly) => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (activePointerId !== null) {
        try {
          backBtn.releasePointerCapture(activePointerId);
        } catch {
          // Ignore
        }
        activePointerId = null;
      }
      const wasHolding = backBtn.classList.contains("is-holding");
      backBtn.classList.remove("is-holding");
      if (releasedEarly && wasHolding && !holdCompleted) {
        showHint("Hold Back to exit");
      }
    };

    backBtn.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      holdCompleted = false;
      activePointerId = e.pointerId;
      try {
        backBtn.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      // Restart animation cleanly
      backBtn.classList.remove("is-holding");
      void backBtn.offsetWidth;
      backBtn.classList.add("is-holding");
      if (reducedMotionQuery.matches) {
        showHint("Holding…");
      }
      holdTimer = setTimeout(() => {
        holdTimer = null;
        holdCompleted = true;
        backBtn.classList.remove("is-holding");
        performAuthorizedBack();
      }, HOLD_MS);
    });

    backBtn.addEventListener("pointerup", () => cancelHold(true));
    backBtn.addEventListener("pointercancel", () => cancelHold(false));
    backBtn.addEventListener("lostpointercapture", () => cancelHold(false));

    // Allow keyboard users (Enter / Space, where click detail === 0) to exit cleanly
    backBtn.addEventListener("click", (e) => {
      if (e.detail === 0) {
        performAuthorizedBack();
      }
    });

    // Fullscreen / Exit fullscreen button
    const ICON_ENTER_FS =
      '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />';
    const ICON_EXIT_FS =
      '<path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5" />';

    const updateFsButton = () => {
      if (!isFullscreenSupported()) {
        fsBtn.hidden = true;
        return;
      }
      fsBtn.hidden = false;
      const isFs = Boolean(getFullscreenElement());
      fsLabel.textContent = isFs ? "Exit fullscreen" : "Fullscreen";
      fsIcon.innerHTML = isFs ? ICON_EXIT_FS : ICON_ENTER_FS;
    };

    fsBtn.addEventListener("click", async () => {
      if (getFullscreenElement()) {
        userExitedFullscreen = true;
        await exitFullscreenSafe();
      } else {
        userExitedFullscreen = false;
        await enterFullscreenSafe(document.documentElement);
      }
      updateFsButton();
    });

    document.addEventListener("fullscreenchange", updateFsButton);
    document.addEventListener("webkitfullscreenchange", updateFsButton);
    updateFsButton();

    // Auto-enter fullscreen on first tap on the game stage (unless adult exited fullscreen)
    window.addEventListener(
      "pointerdown",
      (e) => {
        if (userExitedFullscreen || getFullscreenElement() || !isFullscreenSupported()) return;
        if (e.target && typeof e.target.closest === "function" && e.target.closest(".junior-adult-bar")) {
          return;
        }
        enterFullscreenSafe(document.documentElement).then(updateFsButton);
      },
      { capture: true, passive: true }
    );

    requestAnimationFrame(syncBarHeight);
    window.addEventListener("orientationchange", () => setTimeout(syncBarHeight, 120));
  }

  installHistoryTrap();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountStandaloneAdultBar, { once: true });
  } else {
    mountStandaloneAdultBar();
  }

  window.JuniorGuard = {
    enterFullscreen: () => enterFullscreenSafe(document.documentElement),
    exitFullscreen: exitFullscreenSafe,
    exitToArcade: performAuthorizedBack,
  };
})();
