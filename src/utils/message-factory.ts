/**
 * Cortex — Message Factory (Factory Pattern)
 *
 * Centralizes construction of all chrome.runtime messages with
 * compile-time type safety. Prevents silent typo bugs in action
 * strings and ensures payloads match their expected shapes.
 *
 * Design Pattern: Factory — a single creation point for all message
 * objects, replacing scattered raw object literals across 10+ files.
 *
 * SOLID: Single Responsibility — message construction logic lives
 * in one place instead of being duplicated across every caller.
 */

import type { ColorProfile } from "./messages";

export const MessageFactory = {
  // ── Model Lifecycle ──────────────────────────────────────────────────

  downloadModel(modelId: string) {
    return { action: "DOWNLOAD_MODEL" as const, payload: { modelId } };
  },

  loadModel(modelId: string) {
    return { action: "LOAD_MODEL" as const, payload: { modelId } };
  },

  deleteModel(modelId: string) {
    return { action: "DELETE_MODEL" as const, payload: { modelId } };
  },

  // ── AI Streaming ─────────────────────────────────────────────────────

  chatSend(
    messages: Array<{ role: string; content: string }>,
    requestId: string,
  ) {
    return {
      action: "CHAT_SEND" as const,
      payload: { messages, requestId },
    };
  },

  rewriteText(text: string, prompt: string, requestId: string) {
    return {
      action: "REWRITE_TEXT" as const,
      payload: { text, prompt, requestId },
    };
  },

  defineWord(word: string, requestId: string) {
    return {
      action: "DEFINE_WORD" as const,
      payload: { word, requestId },
    };
  },

  // ── Control ──────────────────────────────────────────────────────────

  stopGeneration() {
    return { action: "STOP_GENERATION" as const };
  },

  getState() {
    return { action: "GET_STATE" as const };
  },

  setColorProfile(profile: ColorProfile) {
    return { action: "SET_COLOR_PROFILE" as const, payload: profile };
  },

  ping() {
    return { action: "PING" as const };
  },

  // ── Content Script Messages ──────────────────────────────────────────

  getTabState() {
    return { action: "GET_TAB_STATE" as const };
  },

  setRulerEnabled(value: boolean) {
    return { action: "SET_RULER_ENABLED" as const, value };
  },

  setReadModeEnabled(value: boolean) {
    return { action: "SET_READ_MODE_ENABLED" as const, value };
  },

  toggleRewrite(enabled: boolean) {
    return {
      action: "TOGGLE_REWRITE" as const,
      payload: { enabled },
    };
  },

  getAccessibilityScore() {
    return { action: "GET_ACCESSIBILITY_SCORE" as const };
  },
} as const;
