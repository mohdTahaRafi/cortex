/**
 * Cortex — Type-Safe Messaging Utilities
 *
 * Wraps chrome.runtime.sendMessage and chrome.tabs.sendMessage with
 * the project's MessageAction type, eliminating raw string action names
 * at call sites and providing a single place to handle send failures.
 */

import type { MessageAction } from "./messages";
import { logger } from "./logger";

// ─── Core Send Helpers ──────────────────────────────────────────────────────

/**
 * Send a message to the background service worker.
 * Returns the response or `undefined` if the receiver is unavailable.
 */
export async function sendToBackground(
  action: MessageAction,
  payload?: unknown,
): Promise<any> {
  try {
    return await chrome.runtime.sendMessage({ action, payload });
  } catch {
    logger.debug(`sendToBackground(${action}) — receiver unavailable`);
    return undefined;
  }
}

/**
 * Send a message to a specific tab's content script.
 * Silently swallows errors when the content script isn't loaded.
 */
export async function sendToTab(
  tabId: number,
  action: MessageAction | string,
  payload?: unknown,
): Promise<any> {
  try {
    return await chrome.tabs.sendMessage(tabId, { action, payload });
  } catch {
    // Tab may not have a content script (chrome:// pages, etc.)
    return undefined;
  }
}

/**
 * Broadcast a message to ALL open tabs.
 * Used by the background worker to push streaming chunks / progress updates.
 */
export async function broadcastToAllTabs(
  action: MessageAction | string,
  payload: unknown,
): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        sendToTab(tab.id, action, payload);
      }
    }
  } catch {
    logger.debug(`broadcastToAllTabs(${action}) — failed to query tabs`);
  }
}
