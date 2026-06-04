/**
 * Cortex — Feature Interface (Template Method Pattern)
 *
 * Defines a uniform contract for all content-script feature modules.
 * Every feature that runs on a web page should implement this interface
 * so the content script can manage lifecycle (init/destroy) uniformly.
 *
 * Design Pattern: Template Method — the content script calls init() on
 * every registered Feature without knowing the concrete implementation.
 */

/**
 * Base interface for any Cortex feature module.
 * Provides lifecycle hooks for initialization and teardown.
 */
export interface Feature {
  /** Unique human-readable name for logging and registry lookup. */
  readonly name: string;

  /**
   * Initialize the feature: load saved state, inject DOM elements,
   * register event listeners, and subscribe to storage changes.
   */
  init(): void;

  /**
   * Tear down the feature: remove DOM elements, unregister listeners,
   * and unsubscribe from storage. Optional — not all features need cleanup.
   */
  destroy?(): void;
}

/**
 * Extended interface for features that can be toggled on/off at runtime.
 * Used by Ruler, Read Mode, Simplify, and Dictionary.
 *
 * Satisfies Liskov Substitution: any ToggleableFeature can be used
 * wherever a Feature is expected.
 */
export interface ToggleableFeature extends Feature {
  /** Whether the feature is currently active. */
  isEnabled(): boolean;

  /** Enable or disable the feature at runtime. */
  setEnabled(enabled: boolean): void;
}
