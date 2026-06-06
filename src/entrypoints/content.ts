/**
 * Cortex — Content Script (Orchestrator)
 *
 * Injected into every webpage. This file is intentionally thin — it
 * delegates to feature modules for all functionality.
 *
 * Design Patterns:
 * - Registry: Feature modules are initialized in sequence; a formal
 *   Feature interface ensures consistent lifecycle management.
 * - Command: Incoming messages are dispatched via a switch statement
 *   with exhaustive action handling.
 *
 * SOLID:
 * - Single Responsibility: Only orchestrates — no business logic.
 * - Open/Closed: Adding a new feature = import + init() call.
 *
 * Features:
 * - Font Override: Global font-family injection
 * - Color Profile: CSS filter chain on <html>
 * - Simplify: AI rewrite buttons on paragraphs
 * - Ruler: Reading ruler / spotlight overlay
 * - Read Mode: Distraction-free reader with TTS
 * - Dictionary: Double-click word definitions
 */

import { defineContentScript } from "#imports";
import { KEEP_ALIVE_INTERVAL_MS } from "@/constants";
import { computeAccessibilityScore } from "@/utils/cognitiveScore";
import { MessageFactory } from "@/utils/message-factory";

// Feature modules
import { initFontOverride } from "@/features/font-override";
import { initColorProfile } from "@/features/color-profile";
import { initSimplify } from "@/features/simplify";
import { initRuler, setRulerEnabled, isRulerEnabled } from "@/features/ruler";
import { initReadMode, setReadModeEnabled, isReadModeEnabled } from "@/features/read-mode";
import { initDictionary } from "@/features/dictionary";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main() {
    // ── Initialize all feature modules ────────────────────────────────
    initFontOverride();
    initColorProfile();
    initSimplify();
    initRuler();
    initReadMode();
    initDictionary();

    // ── Message listener for popup/options communication ─────────────
    // Uses a switch statement for exhaustive action handling instead of
    // if-chain, and handles unknown actions gracefully.
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      switch (msg.action) {
        case "GET_TAB_STATE":
          sendResponse({
            rulerEnabled: isRulerEnabled(),
            readModeEnabled: isReadModeEnabled(),
          });
          break;

        case "SET_RULER_ENABLED":
          setRulerEnabled(msg.value as boolean);
          break;

        case "SET_READ_MODE_ENABLED":
          setReadModeEnabled(msg.value as boolean);
          break;

        case "GET_ACCESSIBILITY_SCORE":
          computeAccessibilityScore()
            .then((score) => sendResponse(score))
            .catch((err) => sendResponse({ error: String(err) }));
          return true; // Keep channel open for async response

        default:
          // Unknown actions are silently ignored — they may be intended
          // for other listeners (e.g., the streaming chunk handlers in
          // simplify and dictionary modules).
          break;
      }
    });

    // ── Keep service worker alive ────────────────────────────────────
    // Factory Pattern: use MessageFactory instead of raw object literal
    setInterval(() => {
      chrome.runtime.sendMessage(MessageFactory.ping()).catch(() => {});
    }, KEEP_ALIVE_INTERVAL_MS);
  },
});
