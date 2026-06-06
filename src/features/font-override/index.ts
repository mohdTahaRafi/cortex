/**
 * Cortex — Font Override Feature
 *
 * Injects a global CSS rule that overrides the page's font-family,
 * while carefully excluding known icon-font classes to avoid breaking
 * icon libraries (FontAwesome, Material Icons, Bootstrap Icons, etc.).
 *
 * SOLID:
 * - Single Responsibility: Only handles font injection and removal.
 * - Dependency Inversion: Uses observeStorage() abstraction instead
 *   of directly coupling to chrome.storage APIs.
 */

import { DOM_IDS } from "@/constants";
import { observeStorage } from "@/utils/storage-observer";

let fontStyleEl: HTMLStyleElement | null = null;

/** Icon-font exclusion selector — prevents overriding glyph fonts. */
const ICON_EXCLUSIONS = [
  '[class*="icon"]', '[class*="fa-"]', '[class*="material-"]',
  '[class*="glyphicon"]', '[class*="bi-"]', '[class*="codicon"]',
  '[class*="nf-"]', '.fa', '.fas', '.far', '.fab', '.fal', '.fad',
  '.bi', '.material-icons',
].map((s) => `:not(${s})`).join("");

function ensureStyleElement(): HTMLStyleElement {
  if (!fontStyleEl) {
    fontStyleEl = document.createElement("style");
    fontStyleEl.id = DOM_IDS.fontStyle;
    document.head.appendChild(fontStyleEl);
  }
  return fontStyleEl;
}

/**
 * Apply a font-family override to all text elements on the page.
 * Pass "default" or empty string to clear the override.
 */
export function applyFontOverride(fontFamily: string): void {
  const el = ensureStyleElement();

  if (!fontFamily || fontFamily === "default") {
    el.textContent = "";
    return;
  }

  let fontStack = `"${fontFamily}", sans-serif`;
  if (fontFamily === "Comic Sans MS") {
    fontStack = `"Comic Sans MS", "Comic Sans", "Comic Neue", cursive`;
  }

  el.textContent = `*${ICON_EXCLUSIONS} { font-family: ${fontStack} !important; }`;
}

/**
 * Initialize the font override feature: load the saved preference
 * and inject Google Fonts stylesheets.
 *
 * Observer Pattern: Uses observeStorage() to react to font changes
 * from popup/options without duplicating chrome.storage boilerplate.
 */
export function initFontOverride(): void {
  // Inject font stylesheets
  const lexendLink = document.createElement("link");
  lexendLink.rel = "stylesheet";
  lexendLink.href =
    "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600&family=Comic+Neue:wght@400;700&display=swap";
  document.head.appendChild(lexendLink);

  const dyslexicLink = document.createElement("link");
  dyslexicLink.rel = "stylesheet";
  dyslexicLink.href = "https://fonts.cdnfonts.com/css/opendyslexic";
  document.head.appendChild(dyslexicLink);

  // Observer Pattern: subscribe to storage key with auto-init + live updates
  observeStorage("activeFont", (font) => {
    applyFontOverride(font);
  });
}
