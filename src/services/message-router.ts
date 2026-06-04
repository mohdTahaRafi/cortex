/**
 * Cortex — Message Router (Command Pattern)
 *
 * Registry-based message handler for the background service worker.
 * Each action is registered as an independent command handler, satisfying
 * the Open/Closed Principle — adding a new action never requires
 * modifying the router itself.
 *
 * Design Pattern: Command — each handler encapsulates a single action.
 * Registry — handlers are stored in a Map keyed by action string.
 *
 * SOLID:
 * - Open/Closed: New actions are added via registerHandler() without
 *   touching existing code.
 * - Single Responsibility: The router only dispatches; business logic
 *   lives in individual handlers.
 * - Interface Segregation: Each handler receives only the payload it needs
 *   (via the typed PayloadMap).
 */

import type { MessageAction } from "@/utils/messages";
import { logger } from "@/utils/logger";

/**
 * Typed payload map — eliminates `any` in handler signatures.
 * Each action maps to the shape of its expected payload.
 *
 * SOLID: Interface Segregation — handlers only see the payload
 * fields relevant to their action.
 */
export type PayloadMap = {
  DOWNLOAD_MODEL: { modelId: string };
  LOAD_MODEL: { modelId: string };
  DELETE_MODEL: { modelId: string };
  CHAT_SEND: {
    messages: Array<{ role: string; content: string }>;
    requestId: string;
  };
  REWRITE_TEXT: { text: string; prompt: string; requestId: string };
  DEFINE_WORD: { word: string; requestId: string };
  STOP_GENERATION: undefined;
  GET_STATE: undefined;
  SET_COLOR_PROFILE: {
    id: string;
    saturation: number;
    brightness: number;
    contrast: number;
    hueRotate: number;
  };
  PING: undefined;
  PROGRESS_UPDATE: { modelId: string; progress: number; text: string };
  ENGINE_READY: { modelId: string };
  ENGINE_ERROR: { error: string; modelId?: string };
  CHAT_CHUNK: { chunk: string; done: boolean; requestId: string };
  REWRITE_CHUNK: { chunk: string; done: boolean; requestId: string };
  DEFINE_CHUNK: { chunk: string; done: boolean; requestId: string };
  GET_ACCESSIBILITY_SCORE: undefined;
};

export type TypedMessageHandler<A extends keyof PayloadMap> = (
  payload: PayloadMap[A],
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | void | Promise<void>;

// Fallback for untyped/dynamic actions
export type MessageHandler = (
  payload: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | void | Promise<void>;

const handlers = new Map<string, MessageHandler>();

/**
 * Register a typed handler for a specific message action.
 * If a handler already exists for the action, it will be replaced.
 */
export function registerHandler<A extends keyof PayloadMap>(
  action: A,
  handler: TypedMessageHandler<A>,
): void;
export function registerHandler(
  action: MessageAction | string,
  handler: MessageHandler,
): void;
export function registerHandler(
  action: string,
  handler: MessageHandler,
): void {
  if (handlers.has(action)) {
    logger.warn(`Handler for "${action}" is being overwritten`);
  }
  handlers.set(action, handler);
}

/**
 * Install the global chrome.runtime.onMessage listener.
 * Call this once during background script initialization.
 * Returns `true` for async handlers (those that return a Promise),
 * keeping the message channel open for sendResponse.
 */
export function installMessageRouter(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action, payload } = message ?? {};
    const handler = handlers.get(action);

    if (!handler) {
      logger.debug(`No handler registered for action: ${action}`);
      return false;
    }

    const result = handler(payload, sender, sendResponse);

    // If the handler returns a Promise, we need to return `true`
    // to keep the message channel open for async sendResponse calls.
    if (result instanceof Promise) {
      result.catch((err) => {
        logger.error(`Handler for "${action}" threw:`, err);
        sendResponse({ error: String(err) });
      });
      return true;
    }

    // If the handler explicitly returns `true`, it's signaling async.
    return result === true;
  });
}
