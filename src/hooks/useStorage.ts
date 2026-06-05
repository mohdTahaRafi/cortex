/**
 * Cortex — useStorage Hook
 *
 * Type-safe reactive hook for chrome.storage.local.
 * Returns [value, setter] similar to useState, but the value is automatically
 * synchronized with chrome.storage and updated when other contexts change it.
 */

import { useState, useEffect, useCallback } from "react";
import type { StorageSchema } from "@/utils/storage";
import { STORAGE_DEFAULTS, getStorage, setStorage } from "@/utils/storage";

/**
 * React hook that reads a single key from chrome.storage.local with
 * type safety and live updates from other extension contexts.
 *
 * @example
 * const [activeFont, setActiveFont] = useStorage("activeFont");
 */
export function useStorage<K extends keyof StorageSchema>(
  key: K,
): [StorageSchema[K], (value: StorageSchema[K]) => void] {
  const [value, setValue] = useState<StorageSchema[K]>(STORAGE_DEFAULTS[key]);

  // Load initial value
  useEffect(() => {
    getStorage([key]).then((res) => setValue(res[key]));
  }, [key]);

  // Listen for external changes (from other contexts)
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[key]) {
        setValue(changes[key].newValue as StorageSchema[K]);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [key]);

  // Setter that updates both local state and chrome.storage
  const set = useCallback(
    (newValue: StorageSchema[K]) => {
      setValue(newValue);
      setStorage({ [key]: newValue } as Partial<StorageSchema>);
    },
    [key],
  );

  return [value, set];
}
