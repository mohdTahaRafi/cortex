/**
 * Cortex — Storage Observer (Observer Pattern)
 *
 * Provides a clean abstraction over chrome.storage.onChanged, eliminating
 * the duplicated boilerplate that was repeated across 7+ feature modules.
 *
 * Design Pattern: Observer — callers subscribe to specific storage keys
 * and receive callbacks when values change, with proper unsubscribe support.
 *
 * SOLID: Dependency Inversion — feature modules depend on this abstraction
 * instead of directly coupling to chrome.storage APIs.
 */

import type { StorageSchema } from "./storage";
import { getStorage } from "./storage";

type StorageCallback<K extends keyof StorageSchema> = (
  value: StorageSchema[K],
) => void;

/**
 * Observe a single storage key: loads the initial value immediately,
 * then fires the callback whenever the value changes from any context
 * (popup, options page, other tabs, etc.).
 *
 * @returns An unsubscribe function that removes the listener.
 *
 * @example
 * const unsub = observeStorage("activeFont", (font) => {
 *   applyFontOverride(font);
 * });
 * // Later: unsub();
 */
export function observeStorage<K extends keyof StorageSchema>(
  key: K,
  callback: StorageCallback<K>,
): () => void {
  // Load initial value
  getStorage([key]).then((res) => callback(res[key]));

  // Listen for external changes
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
  ) => {
    if (changes[key] !== undefined) {
      callback(changes[key].newValue as StorageSchema[K]);
    }
  };
  chrome.storage.onChanged.addListener(listener);

  // Return unsubscribe function for cleanup
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Observe multiple storage keys at once. Each key gets its own callback.
 * Returns a single unsubscribe function that removes all listeners.
 *
 * @example
 * const unsub = observeMultiple({
 *   rulerAutoSnap: (v) => { autoSnap = v; },
 *   rulerBackdropMode: (v) => { backdropMode = v; syncBackdrop(); },
 * });
 */
export function observeMultiple<K extends keyof StorageSchema>(
  observers: { [P in K]?: StorageCallback<P> },
): () => void {
  const keys = Object.keys(observers) as K[];
  const unsubs = keys.map((key) =>
    observeStorage(key, observers[key] as StorageCallback<typeof key>),
  );
  return () => unsubs.forEach((u) => u());
}
