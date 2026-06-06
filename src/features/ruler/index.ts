/**
 * Cortex — Reading Ruler / Spotlight Feature
 *
 * Provides a horizontal focus ruler that follows the cursor and can snap
 * to specific DOM elements. Uses SVG mask-image for rounded cutouts in
 * snapped mode and box-shadow for the free-form overlay.
 *
 * Modes:
 * - Free-form: Full-width ruler follows click position
 * - Snapped (Ctrl+Click): Wraps around a specific element with padding
 *
 * Design Patterns:
 * - Strategy: Backdrop modes (dim/blur/hide) are defined as a config map
 *   instead of an if/else chain — adding a new mode requires only adding
 *   an entry to BACKDROP_STRATEGIES.
 * - Observer: Uses observeMultiple() for reactive settings.
 * - Adapter: Uses setVendorStyle() for vendor-prefixed CSS.
 *
 * SOLID:
 * - Open/Closed: New backdrop modes can be added without modifying
 *   existing code in syncBackdrop().
 * - Dependency Inversion: Uses storage abstraction and DOM utilities.
 */

import { DOM_IDS, DEFAULT_RULER_HEIGHT, RULER_SNAP_PADDING } from "@/constants";
import type { RulerBackdropMode } from "@/constants";
import { observeMultiple } from "@/utils/storage-observer";
import { setVendorStyle } from "@/utils/dom-utils";

// ─── Strategy Pattern: Backdrop Modes ───────────────────────────────────────

interface BackdropStrategy {
  background: string | (() => string);
  backdropFilter: string;
}

/**
 * Strategy map for backdrop visual modes.
 * Open/Closed Principle: add a new mode (e.g., "tint", "pixelate")
 * by adding an entry here — no existing code needs to change.
 */
const BACKDROP_STRATEGIES: Record<RulerBackdropMode, BackdropStrategy> = {
  dim: {
    background: "rgba(0,0,0,0.5)",
    backdropFilter: "none",
  },
  blur: {
    background: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
  },
  hide: {
    background: () => getMatchedBg(),
    backdropFilter: "none",
  },
};

// ─── State ──────────────────────────────────────────────────────────────────

let rulerEnabled = false;
let rulerAutoSnap = false;
let rulerEl: HTMLDivElement | null = null;
let rulerBackdropEl: HTMLDivElement | null = null;
let rulerToolbarEl: HTMLDivElement | null = null;
let currentRulerY = 200;
let rulerHeight = DEFAULT_RULER_HEIGHT;
let isSnapped = false;
let documentRulerY = 0;
let documentRulerX = 0;
let rulerBackdropMode: RulerBackdropMode = "dim";

/**
 * External reference to the read mode element for scroll synchronization.
 * Set via `setReadModeElement()` from the read-mode feature module.
 */
let readModeEl: HTMLDivElement | null = null;

// ─── Public API ─────────────────────────────────────────────────────────────

export function setRulerEnabled(enabled: boolean): void {
  rulerEnabled = enabled;
  applyRuler();
}

export function isRulerEnabled(): boolean {
  return rulerEnabled;
}

export function setReadModeElement(el: HTMLDivElement | null): void {
  readModeEl = el;
}

export function syncRulerPosition(): void {
  if (rulerEnabled && isSnapped && rulerEl) {
    const scrollY = readModeEl ? readModeEl.scrollTop : window.scrollY;
    const scrollX = readModeEl ? 0 : window.scrollX;
    currentRulerY = documentRulerY - scrollY;
    rulerEl.style.top = `${currentRulerY}px`;
    rulerEl.style.left = `${documentRulerX - scrollX}px`;
    syncBackdrop();
  }
}

// ─── Private Helpers ────────────────────────────────────────────────────────

function getMatchedBg(): string {
  const isTransparent = (c: string) =>
    c === "rgba(0, 0, 0, 0)" || c === "transparent";
  for (const el of [document.body, document.documentElement]) {
    const bg = window.getComputedStyle(el).backgroundColor;
    if (!isTransparent(bg)) return bg;
  }
  return "#ffffff";
}

function guessLineHeight(): number {
  const el = document.querySelector("p") || document.body;
  if (!el) return DEFAULT_RULER_HEIGHT;
  const style = window.getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight);
  if (!isNaN(lineHeight)) return Math.max(20, lineHeight);
  const fontSize = parseFloat(style.fontSize);
  if (!isNaN(fontSize)) return Math.max(20, fontSize * 1.5);
  return DEFAULT_RULER_HEIGHT;
}

/**
 * Apply the current backdrop strategy to the backdrop element.
 * Strategy Pattern: looks up the config from BACKDROP_STRATEGIES
 * instead of using if/else branching.
 */
function applyBackdropStrategy(el: HTMLElement): void {
  const strategy = BACKDROP_STRATEGIES[rulerBackdropMode];
  const bg = typeof strategy.background === "function"
    ? strategy.background()
    : strategy.background;

  el.style.background = bg;
  el.style.backdropFilter = strategy.backdropFilter;
  // Adapter Pattern: use setVendorStyle() to eliminate 'as any' casts
  setVendorStyle(el, "backdropFilter", strategy.backdropFilter);
}

function syncBackdrop(): void {
  if (!rulerEnabled) return;

  // Ensure toolbar element exists
  if (!rulerToolbarEl) {
    rulerToolbarEl = document.createElement("div");
    rulerToolbarEl.id = DOM_IDS.rulerToolbar;
    document.body.appendChild(rulerToolbarEl);
    rulerToolbarEl.addEventListener("mousedown", (e) => e.stopPropagation());
    rulerToolbarEl.addEventListener("click", (e) => e.stopPropagation());
  }

  if (isSnapped && rulerEl) {
    // Snapped mode: SVG mask for rounded cutout
    if (!rulerBackdropEl) {
      rulerBackdropEl = document.createElement("div");
      rulerBackdropEl.id = DOM_IDS.rulerBackdrop;
      rulerBackdropEl.style.cssText =
        "position: fixed; inset: 0; pointer-events: none; z-index: 2147483645; transition: background 0.15s, backdrop-filter 0.15s;";
      document.body.appendChild(rulerBackdropEl);
    }

    const scrollY = readModeEl ? readModeEl.scrollTop : window.scrollY;
    const scrollX = readModeEl ? 0 : window.scrollX;
    const vx = documentRulerX - scrollX;
    const vy = documentRulerY - scrollY;
    const vw = parseFloat(rulerEl.style.width || "0");
    const vh = rulerHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><mask id="m"><rect width="${W}" height="${H}" fill="white"/><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="6" ry="6" fill="black"/></mask></defs><rect width="${W}" height="${H}" fill="white" mask="url(#m)"/></svg>`;
    const encoded = `data:image/svg+xml;base64,${btoa(svg)}`;

    // Adapter Pattern: use setVendorStyle() instead of 'as any' casts
    setVendorStyle(rulerBackdropEl, "maskImage", `url("${encoded}")`);
    rulerBackdropEl.style.maskSize = "auto";
    rulerBackdropEl.style.maskPosition = "0 0";

    rulerEl.style.boxShadow = "none";

    // Position toolbar
    const toolbarTop = Math.max(0, vy - 44);
    const toolbarLeft = Math.max(0, vx + vw - 146);
    rulerToolbarEl.style.cssText = `position: fixed; top: ${toolbarTop}px; left: ${toolbarLeft}px; z-index: 2147483647; pointer-events: auto; display: flex; gap: 4px; padding: 6px; background: #1a1a24; border: 1px solid #2e2e48; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: system-ui, sans-serif;`;
    rulerToolbarEl.innerHTML = (["dim", "blur", "hide"] as RulerBackdropMode[])
      .map(
        (mode) =>
          `<button data-mode="${mode}" style="all:unset; cursor:pointer; padding: 4px 8px; font-size: 11px; font-weight: 600; border-radius: 4px; background: ${rulerBackdropMode === mode ? "#7c6af7" : "transparent"}; color: ${rulerBackdropMode === mode ? "white" : "#8888a8"}; transition: all 0.2s;">${mode.charAt(0).toUpperCase() + mode.slice(1)}</button>`,
      )
      .join("");

    rulerToolbarEl.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        rulerBackdropMode = b.dataset.mode as RulerBackdropMode;
        chrome.storage.local.set({ rulerBackdropMode });
        syncBackdrop();
      };
    });
  } else {
    // Free-form mode: box-shadow overlay
    if (rulerBackdropEl) {
      rulerBackdropEl.remove();
      rulerBackdropEl = null;
    }
    rulerToolbarEl.style.display = "none";

    if (rulerEl) {
      rulerEl.style.boxShadow = "0 0 0 9999px rgba(0,0,0,0.5)";
      // Adapter Pattern: clear vendor-prefixed mask
      setVendorStyle(rulerEl, "maskImage", "none");
    }
    return;
  }

  // Strategy Pattern: apply the current backdrop mode
  applyBackdropStrategy(rulerBackdropEl);
}

function applyRuler(): void {
  if (rulerEnabled) {
    if (!rulerEl) {
      rulerEl = document.createElement("div");
      rulerEl.id = DOM_IDS.ruler;
      rulerEl.style.cssText = `
        position: fixed; left: 0; right: 0; height: ${rulerHeight}px;
        background: transparent; border-top: 2px solid #7c6af7;
        border-bottom: 2px solid #7c6af7; pointer-events: none;
        z-index: 2147483647;
        transition: top 0.1s ease-out, height 0.1s ease-out, left 0.1s ease-out, width 0.1s ease-out;
        box-sizing: border-box;
      `;
      document.body.appendChild(rulerEl);
      currentRulerY = Math.max(window.innerHeight / 2 - rulerHeight / 2, 0);
      rulerEl.style.top = `${currentRulerY}px`;
    }
    syncBackdrop();
  } else {
    isSnapped = false;
    rulerEl?.remove();
    rulerEl = null;
    rulerBackdropEl?.remove();
    rulerBackdropEl = null;
    rulerToolbarEl?.remove();
    rulerToolbarEl = null;
  }
}

function resetToFreeform(): void {
  if (!rulerEl) return;
  isSnapped = false;
  rulerEl.style.transition =
    "top 0.1s ease-out, height 0.1s ease-out, left 0.1s ease-out, width 0.1s ease-out";
  rulerEl.style.left = "0";
  rulerEl.style.right = "0";
  rulerEl.style.width = "auto";
  rulerEl.style.top = `${currentRulerY}px`;
  rulerEl.style.borderLeft = "none";
  rulerEl.style.borderRight = "none";
  rulerEl.style.borderRadius = "0";
  syncBackdrop();
}

function snapToElement(target: HTMLElement): void {
  if (!rulerEl) return;
  isSnapped = true;
  rulerEl.style.transition = "none";
  const rect = target.getBoundingClientRect();
  const p = RULER_SNAP_PADDING;
  currentRulerY = rect.top - p;
  const scrollY = readModeEl ? readModeEl.scrollTop : window.scrollY;
  const scrollX = readModeEl ? 0 : window.scrollX;
  documentRulerY = currentRulerY + scrollY;
  documentRulerX = rect.left - p + scrollX;
  rulerHeight = rect.height + p * 2;
  rulerEl.style.left = `${rect.left - p}px`;
  rulerEl.style.right = "auto";
  rulerEl.style.width = `${rect.width + p * 2}px`;
  rulerEl.style.height = `${rulerHeight}px`;
  rulerEl.style.top = `${currentRulerY}px`;
  rulerEl.style.borderLeft = "2px solid #7c6af7";
  rulerEl.style.borderRight = "2px solid #7c6af7";
  rulerEl.style.borderRadius = "6px";
  syncBackdrop();
}

// ─── Event Listeners ────────────────────────────────────────────────────────

function handleKeyDown(e: KeyboardEvent): void {
  if (e.altKey && e.code === "KeyR") {
    e.preventDefault();
    rulerEnabled = !rulerEnabled;
    applyRuler();
    return;
  }

  if (!rulerEnabled) return;

  if (e.key === "Escape" && isSnapped && rulerEl) {
    e.preventDefault();
    resetToFreeform();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const step = e.ctrlKey ? 5 : guessLineHeight();
    currentRulerY -= step;
    if (isSnapped) documentRulerY -= step;
    if (currentRulerY < window.innerHeight * 0.15) {
      const scrollTarget = readModeEl || window;
      scrollTarget.scrollBy({ top: -step * 2, behavior: "instant" as ScrollBehavior });
      currentRulerY += step * 2;
    }
    if (rulerEl) rulerEl.style.top = `${currentRulerY}px`;
    syncBackdrop();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    const step = e.ctrlKey ? 5 : guessLineHeight();
    currentRulerY += step;
    if (isSnapped) documentRulerY += step;
    if (currentRulerY > window.innerHeight * 0.85 - rulerHeight) {
      const scrollTarget = readModeEl || window;
      scrollTarget.scrollBy({ top: step * 2, behavior: "instant" as ScrollBehavior });
      currentRulerY -= step * 2;
    }
    if (rulerEl) rulerEl.style.top = `${currentRulerY}px`;
    syncBackdrop();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    rulerHeight = Math.max(10, rulerHeight - 4);
    if (rulerEl) rulerEl.style.height = `${rulerHeight}px`;
    syncBackdrop();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    rulerHeight = Math.min(window.innerHeight * 0.8, rulerHeight + 4);
    if (rulerEl) rulerEl.style.height = `${rulerHeight}px`;
    syncBackdrop();
  }
}

function handleMouseDown(e: MouseEvent): void {
  if (rulerToolbarEl?.contains(e.target as Node)) return;
  if (!rulerEnabled || e.button !== 0) return;

  if (e.ctrlKey || rulerAutoSnap) {
    const target = e.target as HTMLElement;
    if (target && rulerEl) snapToElement(target);
  } else {
    isSnapped = false;
    currentRulerY = e.clientY - rulerHeight / 2;
    if (rulerEl) {
      rulerEl.style.transition =
        "top 0.1s ease-out, height 0.1s ease-out, left 0.1s ease-out, width 0.1s ease-out";
      rulerEl.style.left = "0";
      rulerEl.style.right = "0";
      rulerEl.style.width = "auto";
      rulerEl.style.height = `${rulerHeight}px`;
      rulerEl.style.top = `${currentRulerY}px`;
      rulerEl.style.borderLeft = "none";
      rulerEl.style.borderRight = "none";
      rulerEl.style.borderRadius = "0";
    }
  }
  syncBackdrop();
}

// ─── Initialization ─────────────────────────────────────────────────────────

export function initRuler(): void {
  // Observer Pattern: subscribe to multiple settings with observeMultiple()
  observeMultiple({
    rulerAutoSnap: (v) => {
      rulerAutoSnap = v;
    },
    rulerBackdropMode: (v) => {
      rulerBackdropMode = v;
      syncBackdrop();
    },
  });

  // Register event listeners
  window.addEventListener("scroll", syncRulerPosition, { passive: true });
  window.addEventListener("keydown", handleKeyDown, { capture: true });
  window.addEventListener("mousedown", handleMouseDown, { capture: true, passive: true });
}
