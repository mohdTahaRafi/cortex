/**
 * Cortex — Color Profile Feature
 *
 * Applies a CSS filter chain (saturation, brightness, contrast, hue-rotate)
 * to the root `<html>` element. Profiles can be switched from the popup or
 * options page and are persisted in storage.
 *
 * SOLID:
 * - Single Responsibility: Only handles CSS filter application.
 * - Dependency Inversion: Uses observeStorage() instead of raw chrome APIs.
 */

import { DOM_IDS } from "@/constants";
import type { ColorProfile } from "@/utils/messages";
import { observeStorage } from "@/utils/storage-observer";

let colorStyleEl: HTMLStyleElement | null = null;

function ensureStyleElement(): HTMLStyleElement {
  if (!colorStyleEl) {
    colorStyleEl = document.createElement("style");
    colorStyleEl.id = DOM_IDS.colorStyle;
    document.head.appendChild(colorStyleEl);
  }
  return colorStyleEl;
}

/**
 * Apply a color profile by setting CSS filters on `<html>`.
 * Passing the "none" profile clears all filters.
 */
export function applyColorProfile(profile: ColorProfile): void {
  const el = ensureStyleElement();

  if (profile.id === "none") {
    el.textContent = "";
    return;
  }

  el.textContent = [
    `html { filter:`,
    `saturate(${profile.saturation}%)`,
    `brightness(${profile.brightness}%)`,
    `contrast(${profile.contrast}%)`,
    `hue-rotate(${profile.hueRotate}deg)`,
    `!important; }`,
  ].join(" ");
}

/**
 * Initialize the color profile feature: load saved profile
 * and listen for changes from popup/options.
 *
 * Observer Pattern: Uses observeStorage() for reactive updates.
 */
export function initColorProfile(): void {
  observeStorage("colorProfile", (profile) => {
    applyColorProfile(profile);
  });
}
