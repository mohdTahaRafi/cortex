/**
 * Cortex — Background Service Worker
 *
 * Thin orchestrator that wires the EngineManager and MessageRouter together.
 * Each message action is registered as an independent handler, satisfying
 * the Open/Closed Principle — adding a new action never requires modifying
 * existing handler code.
 *
 * Design Pattern: Command — each registerHandler call registers a single
 * command that the MessageRouter dispatches.
 *
 * SOLID:
 * - Single Responsibility: This file only wires things together; business
 *   logic lives in EngineManager, and dispatch lives in MessageRouter.
 * - Open/Closed: Add a new action = add a new registerHandler() call.
 * - Dependency Inversion: Depends on EngineManager's interface, not on
 *   WebLLM internals.
 */

import { defineBackground } from "#imports";
import { EngineManager } from "@/services/engine-manager";
import { registerHandler, installMessageRouter } from "@/services/message-router";
import { getStorage, setStorage } from "@/utils/storage";
import { broadcastToAllTabs } from "@/utils/messaging";
import { logger } from "@/utils/logger";
import { KEEP_ALIVE_INTERVAL_MS } from "@/constants";
import type { ColorProfile } from "@/utils/messages";

// ─── Singleton ──────────────────────────────────────────────────────────────

const engine = EngineManager.getInstance();

// ─── Streaming Helper (DRY) ─────────────────────────────────────────────────

/**
 * Generic handler for streaming AI responses.
 * Eliminates the 3× duplicated pattern for chat/rewrite/define.
 *
 * DRY Principle: Single implementation for all streaming actions.
 */
async function handleStream(
  generator: AsyncGenerator<string>,
  chunkAction: string,
  requestId: string,
  target: "runtime" | "tabs",
  senderTabId: number | undefined,
  sendResponse: (r: unknown) => void,
): Promise<void> {
  if (senderTabId) engine.trackTab(senderTabId);

  try {
    for await (const delta of generator) {
      const payload = { chunk: delta, done: false, requestId };
      if (target === "runtime") {
        try { await chrome.runtime.sendMessage({ action: chunkAction, payload }); } catch {}
      } else {
        await broadcastToAllTabs(chunkAction, payload);
      }
    }

    // Send done signal
    const donePayload = { chunk: "", done: true, requestId };
    if (target === "runtime") {
      try { await chrome.runtime.sendMessage({ action: chunkAction, payload: donePayload }); } catch {}
    } else {
      await broadcastToAllTabs(chunkAction, donePayload);
    }

    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    if (senderTabId) engine.untrackTab(senderTabId);
  }
}

// ─── Register Handlers (Command Pattern) ────────────────────────────────────

// Model lifecycle — DOWNLOAD_MODEL and LOAD_MODEL share the same implementation
// because downloading a model also loads it. Both exist for semantic clarity
// in the UI (download button vs load button for already-cached models).
registerHandler("DOWNLOAD_MODEL", (payload, _sender, sendResponse) => {
  engine.loadModel(payload.modelId).catch(logger.error);
  sendResponse({ ok: true });
});

registerHandler("LOAD_MODEL", (payload, _sender, sendResponse) => {
  engine.loadModel(payload.modelId).catch(logger.error);
  sendResponse({ ok: true });
});

registerHandler("DELETE_MODEL", async (payload, _sender, sendResponse) => {
  try {
    await engine.deleteModel(payload.modelId);
    sendResponse({ ok: true });
  } catch (e) {
    sendResponse({ error: String(e) });
  }
});

// AI streaming
registerHandler("CHAT_SEND", async (payload, sender, sendResponse) => {
  await handleStream(
    engine.chat(payload.messages),
    "CHAT_CHUNK", payload.requestId, "runtime",
    sender.tab?.id, sendResponse,
  );
});

registerHandler("REWRITE_TEXT", async (payload, sender, sendResponse) => {
  await handleStream(
    engine.rewrite(payload.text, payload.prompt),
    "REWRITE_CHUNK", payload.requestId, "tabs",
    sender.tab?.id, sendResponse,
  );
});

registerHandler("DEFINE_WORD", async (payload, sender, sendResponse) => {
  await handleStream(
    engine.define(payload.word),
    "DEFINE_CHUNK", payload.requestId, "tabs",
    sender.tab?.id, sendResponse,
  );
});

// Control
registerHandler("STOP_GENERATION", (_payload, _sender, sendResponse) => {
  engine.interruptGeneration();
  sendResponse({ ok: true });
});

registerHandler("GET_STATE", async (_payload, _sender, sendResponse) => {
  try {
    const state = await getStorage([
      "downloadedModels", "activeModel", "colorProfile",
      "rewriteEnabled", "rewritePrompt",
    ]);
    sendResponse({
      ok: true, state,
      engineLoaded: engine.isReady,
      currentModelId: engine.modelId,
    });
  } catch (e) {
    sendResponse({ error: String(e) });
  }
});

registerHandler("SET_COLOR_PROFILE", (payload, _sender, sendResponse) => {
  setStorage({ colorProfile: payload as ColorProfile }).catch(logger.error);
  sendResponse({ ok: true });
});

registerHandler("PING", (_payload, _sender, sendResponse) => {
  sendResponse({ pong: true });
});

registerHandler("OPEN_SIDE_PANEL", async (_payload, sender, sendResponse) => {
  try {
    const windowId = sender.tab?.windowId || (await chrome.windows.getCurrent()).id;
    if (windowId !== undefined) {
      await chrome.sidePanel.open({ windowId });
    }
    sendResponse({ ok: true });
  } catch (e) {
    sendResponse({ error: String(e) });
  }
});

// ─── Entry Point ────────────────────────────────────────────────────────────

export default defineBackground(() => {
  logger.info("Background service worker started");

  // Install the message router
  installMessageRouter();

  // Log persisted model on startup
  getStorage(["activeModel"]).then((res) => {
    logger.info("Stored active model:", res.activeModel);
  });

  // Keep service worker alive (MV3 kills idle workers after ~30s)
  setInterval(() => {
    chrome.runtime.getPlatformInfo?.();
  }, KEEP_ALIVE_INTERVAL_MS);

  // Interrupt generation if a tab is closed while streaming
  chrome.tabs.onRemoved.addListener((tabId) => {
    engine.onTabRemoved(tabId);
  });
});
