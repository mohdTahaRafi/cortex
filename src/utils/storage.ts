/**
 * Cortex — Typed Storage Layer
 *
 * Wraps `chrome.storage.local` with a fully typed schema so every key
 * has a known type and default value. All reads/writes should go through
 * `getStorage` / `setStorage` rather than calling chrome APIs directly.
 */

import type { ColorProfile } from "./messages";
import { DEFAULT_COLOR_PROFILES } from "./messages";
import type { ReadModeTheme, RulerBackdropMode } from "@/constants";

// ─── Default System Prompt ──────────────────────────────────────────────────

export const DEFAULT_REWRITE_PROMPT = `You are a cognitive accessibility rewriting assistant.

Task: Rewrite the given paragraph in simpler, clearer language for neurodivergent readers, including people with ADHD, autism, and dyslexia.

Rules:
- Preserve the original meaning.
- Use short, direct sentences.
- Replace complex words with simpler words.
- Remove unnecessary jargon, fluff, and repetition.
- Keep the tone neutral and helpful.
- Do not add new information.
- Do not explain your changes.
- Output only the simplified paragraph, and nothing else.
- Just output the rewritten paragraph. Do not start with "Rewritten paragraph:" or any other preamble.
`;

// ─── Complete Storage Schema ────────────────────────────────────────────────

export interface StorageSchema {
  // Model management
  downloadedModels: string[];
  activeModel: string;

  // Visual overrides
  colorProfile: ColorProfile;
  activeFont: string;

  // Feature toggles
  rewriteEnabled: boolean;
  rewritePrompt: string;
  dictEnabled: boolean;

  // Read mode preferences
  rmTheme: ReadModeTheme;
  rmFontSize: number;

  // Ruler preferences
  rulerAutoSnap: boolean;
  rulerBackdropMode: RulerBackdropMode;

  // Internal navigation (ephemeral)
  _openTab: string;
}

export const STORAGE_DEFAULTS: StorageSchema = {
  downloadedModels: [],
  activeModel: "",
  colorProfile: DEFAULT_COLOR_PROFILES.none,
  activeFont: "default",
  rewriteEnabled: false,
  rewritePrompt: DEFAULT_REWRITE_PROMPT,
  dictEnabled: false,
  rmTheme: "dark",
  rmFontSize: 20,
  rulerAutoSnap: false,
  rulerBackdropMode: "dim",
  _openTab: "",
};

// ─── Typed Accessors ────────────────────────────────────────────────────────

/**
 * Read specific keys from chrome.storage.local with type safety and defaults.
 */
export async function getStorage<K extends keyof StorageSchema>(
  keys: K[],
): Promise<Pick<StorageSchema, K>> {
  const defaults = keys.reduce(
    (acc, k) => {
      (acc as Record<string, unknown>)[k] = STORAGE_DEFAULTS[k];
      return acc;
    },
    {} as Pick<StorageSchema, K>,
  );
  const result = await chrome.storage.local.get(
    defaults as Record<string, unknown>,
  );
  return result as Pick<StorageSchema, K>;
}

/**
 * Write a partial set of keys to chrome.storage.local.
 */
export async function setStorage(
  data: Partial<StorageSchema>,
): Promise<void> {
  await chrome.storage.local.set(data);
}

/**
 * Read the entire storage schema with all defaults applied.
 */
export async function getAll(): Promise<StorageSchema> {
  return getStorage(
    Object.keys(STORAGE_DEFAULTS) as (keyof StorageSchema)[],
  ) as Promise<StorageSchema>;
}
