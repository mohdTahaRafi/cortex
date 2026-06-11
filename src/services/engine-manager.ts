/**
 * Cortex — Engine Manager (Singleton Pattern)
 *
 * Encapsulates all LLM engine state and operations behind a clean class
 * interface. Uses a strict Singleton pattern to ensure only one MLCEngine
 * exists in the service worker, preventing VRAM conflicts.
 *
 * Design Pattern: Singleton — enforced via private constructor + getInstance().
 * Template Method — streamCompletion() provides the shared algorithm that
 * chat(), rewrite(), and define() specialize via different parameters.
 *
 * SOLID:
 * - Single Responsibility: Only manages the LLM engine lifecycle and inference.
 * - Open/Closed: New inference modes (e.g., summarize) can be added without
 *   modifying streamCompletion().
 * - Dependency Inversion: Background script depends on EngineManager's public
 *   interface, not on WebLLM internals.
 */

import { getStorage, setStorage } from "@/utils/storage";
import { logger } from "@/utils/logger";
import { AI_PARAMS, DEFINE_SYSTEM_PROMPT } from "@/constants";
import { broadcastToAllTabs } from "@/utils/messaging";
import type { MLCEngine } from "@mlc-ai/web-llm";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: string;
  content: string;
}

interface StreamOptions {
  temperature: number;
  maxTokens: number;
}

interface ProgressReport {
  progress: number;
  text: string;
}

// ─── Engine Manager (Singleton) ─────────────────────────────────────────────

export class EngineManager {
  // ── Singleton enforcement ────────────────────────────────────────────────
  private static instance: EngineManager | null = null;

  /**
   * Get the singleton EngineManager instance.
   * Creates it on first call (lazy initialization).
   */
  static getInstance(): EngineManager {
    if (!EngineManager.instance) {
      EngineManager.instance = new EngineManager();
    }
    return EngineManager.instance;
  }

  /** Private constructor prevents external instantiation. */
  private constructor() {}

  // ── Private State ────────────────────────────────────────────────────────

  private engine: MLCEngine | null = null;
  private currentModelId = "";
  private loadPromise: Promise<void> | null = null;
  private activeTabIds = new Set<number>();
  private MLCEngineClass: typeof MLCEngine | null = null;

  // ── Public Getters ──────────────────────────────────────────────────────

  get isReady(): boolean {
    return !!this.engine && !!this.currentModelId;
  }

  get modelId(): string {
    return this.currentModelId;
  }

  get isLoading(): boolean {
    return this.loadPromise !== null;
  }

  // ── Lazy Import ─────────────────────────────────────────────────────────

  private async getEngineClass(): Promise<typeof MLCEngine> {
    if (!this.MLCEngineClass) {
      if (typeof self === "undefined") {
        throw new Error("Not in a runtime context");
      }
      const mod = await import("@mlc-ai/web-llm");
      this.MLCEngineClass = mod.MLCEngine;
    }
    return this.MLCEngineClass;
  }

  // ── Engine Lifecycle ────────────────────────────────────────────────────

  /**
   * Ensure the engine is loaded and ready. If a model was previously
   * active (persisted in storage), it will be restored lazily.
   */
  async ensureReady(): Promise<void> {
    if (this.isReady) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const { activeModel } = await getStorage(["activeModel"]);
      if (!activeModel) throw new Error("No model loaded");
      await this._doLoadModel(activeModel);
    })().finally(() => {
      this.loadPromise = null;
    });

    return this.loadPromise;
  }

  /**
   * Load (or reload) a model by ID. Broadcasts progress updates to all
   * tabs and the extension runtime.
   *
   * Uses promise deduplication to prevent race conditions when multiple
   * LOAD_MODEL messages arrive in rapid succession.
   */
  async loadModel(modelId: string): Promise<void> {
    // Promise deduplication — if already loading, return the existing promise
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._doLoadModel(modelId).finally(() => {
      this.loadPromise = null;
    });

    return this.loadPromise;
  }

  /**
   * Internal model loading implementation.
   * Separated from loadModel() to enable promise deduplication.
   */
  private async _doLoadModel(modelId: string): Promise<void> {
    try {
      logger.info("Loading model:", modelId);
      await this.broadcastProgress(modelId, 0, "Initializing engine…");

      if (!this.engine) {
        const EngineClass = await this.getEngineClass();
        const mod = await import("@mlc-ai/web-llm");
        const appConfig = {
          ...mod.prebuiltAppConfig,
          cacheBackend: "indexeddb" as const,
        };
        this.engine = new EngineClass({ appConfig });
      }

      this.engine.setInitProgressCallback((report: ProgressReport) => {
        void this.broadcastProgress(
          modelId,
          Math.round(report.progress * 100),
          report.text,
        );
      });

      await this.engine.reload(modelId);
      this.currentModelId = modelId;
      logger.info("Model loaded successfully:", modelId);

      // Persist download and active state
      const { downloadedModels } = await getStorage(["downloadedModels"]);
      if (!downloadedModels.includes(modelId)) {
        await setStorage({ downloadedModels: [...downloadedModels, modelId] });
      }
      await setStorage({ activeModel: modelId });

      await this.broadcastProgress(modelId, 100, "Model ready!");
      await this.broadcastRuntimeMessage("ENGINE_READY", { modelId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Engine error:", message);
      await this.broadcastRuntimeMessage("ENGINE_ERROR", { error: message, modelId });
      throw err;
    }
  }

  /**
   * Delete a model from cache and update storage.
   */
  async deleteModel(modelId: string): Promise<void> {
    const { downloadedModels } = await getStorage(["downloadedModels"]);
    const updated = downloadedModels.filter((id) => id !== modelId);
    await setStorage({ downloadedModels: updated });

    if (this.currentModelId === modelId) {
      this.engine = null;
      this.currentModelId = "";
      await setStorage({ activeModel: "" });
    }

    try {
      const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm");
      await deleteModelAllInfoInCache(modelId);
    } catch (err) {
      logger.warn("Could not clear model cache:", err);
    }

    await this.broadcastProgress(modelId, -1, "Deleted");
  }

  /**
   * Interrupt any active generation (e.g., when user clicks "Stop").
   */
  interruptGeneration(): void {
    if (this.engine) {
      this.engine.interruptGenerate();
    }
  }

  // ── Tab Tracking ────────────────────────────────────────────────────────

  trackTab(tabId: number): void {
    this.activeTabIds.add(tabId);
  }

  untrackTab(tabId: number): void {
    this.activeTabIds.delete(tabId);
  }

  isTabActive(tabId: number): boolean {
    return this.activeTabIds.has(tabId);
  }

  onTabRemoved(tabId: number): void {
    if (this.activeTabIds.has(tabId)) {
      this.interruptGeneration();
      this.activeTabIds.delete(tabId);
    }
  }

  // ── Streaming Inference (Template Method Pattern) ───────────────────────

  /**
   * Generic streaming inference. Yields text chunks from the model.
   * All three AI features (chat, rewrite, define) use this method —
   * this is the Template Method that provides the shared algorithm.
   */
  async *streamCompletion(
    messages: ChatMessage[],
    options: StreamOptions,
  ): AsyncGenerator<string> {
    if (!this.engine || !this.currentModelId) {
      await this.ensureReady();
    }
    if (!this.engine || !this.currentModelId) {
      throw new Error("No active model loaded. Please select a model in options.");
    }

    const stream = await this.engine.chat.completions.create({
      messages: messages as Parameters<
        typeof this.engine.chat.completions.create
      >[0]["messages"],
      stream: true,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });

    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content ?? "";
    }
  }

  /**
   * Chat completion with full message history.
   */
  async *chat(messages: ChatMessage[]): AsyncGenerator<string> {
    yield* this.streamCompletion(messages, {
      temperature: AI_PARAMS.chat.temperature,
      maxTokens: AI_PARAMS.chat.maxTokens,
    });
  }

  /**
   * Rewrite/simplify a paragraph using the given system prompt.
   */
  async *rewrite(text: string, prompt: string): AsyncGenerator<string> {
    yield* this.streamCompletion(
      [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ],
      {
        temperature: AI_PARAMS.rewrite.temperature,
        maxTokens: AI_PARAMS.rewrite.maxTokens,
      },
    );
  }

  /**
   * Generate a simple definition for a word.
   */
  async *define(word: string): AsyncGenerator<string> {
    yield* this.streamCompletion(
      [
        { role: "system", content: DEFINE_SYSTEM_PROMPT },
        { role: "user", content: word },
      ],
      {
        temperature: AI_PARAMS.define.temperature,
        maxTokens: AI_PARAMS.define.maxTokens,
      },
    );
  }

  // ── Private Broadcasting ────────────────────────────────────────────────

  private async broadcastProgress(
    modelId: string,
    progress: number,
    text: string,
  ): Promise<void> {
    const payload = { modelId, progress, text };
    try {
      await chrome.runtime.sendMessage({ action: "PROGRESS_UPDATE", payload });
    } catch {
      // Options page may not be open
    }
    await broadcastToAllTabs("PROGRESS_UPDATE", payload);
  }

  private async broadcastRuntimeMessage(
    action: string,
    payload: unknown,
  ): Promise<void> {
    try {
      await chrome.runtime.sendMessage({ action, payload });
    } catch {
      // No listeners available
    }
  }
}
