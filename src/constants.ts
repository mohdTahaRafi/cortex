/**
 * Cortex — Global Constants
 *
 * Centralizes all magic numbers, AI inference parameters, DOM identifiers,
 * and CSS class names used across the extension. Keeping them here makes
 * the codebase self-documenting and easy to tune without hunting through
 * feature modules.
 */

// ─── AI Inference Parameters ────────────────────────────────────────────────

export const AI_PARAMS = {
  chat: { temperature: 0.7, maxTokens: 512 },
  rewrite: { temperature: 0.5, maxTokens: 512 },
  define: { temperature: 0.3, maxTokens: 150 },
} as const;

export const DEFINE_SYSTEM_PROMPT =
  "You are a helpful dictionary for neurodivergent individuals. Define the following word in extremely simple, easy to understand English (1-2 short sentences maximum).";

// ─── Content Script Thresholds ──────────────────────────────────────────────

/** Minimum character count for a paragraph to receive a "Simplify" button. */
export const MIN_PARAGRAPH_LENGTH = 80;

/** Minimum character count to allow a rewrite request. */
export const MIN_REWRITE_LENGTH = 20;

/** Default height (px) of the reading ruler overlay. */
export const DEFAULT_RULER_HEIGHT = 44;

/** Padding (px) added around an element when the ruler snaps to it. */
export const RULER_SNAP_PADDING = 6;

/** Average words-per-minute for read-time estimates. */
export const WORDS_PER_MINUTE = 200;

// ─── Cognitive Score Thresholds ─────────────────────────────────────────────

/** Grid dimension for the viewport stacked-layer sampling. */
export const CLUTTER_GRID_SIZE = 8;

/** DOM element count above which a penalty is applied. */
export const DOM_COMPLEXITY_THRESHOLD = 3000;

/** Words with this many syllables or more are flagged as jargon. */
export const JARGON_SYLLABLE_THRESHOLD = 4;

/** Sentences with more than this many words are considered "long". */
export const LONG_SENTENCE_WORD_THRESHOLD = 25;

// ─── DOM Identifiers ────────────────────────────────────────────────────────

export const DOM_IDS = {
  fontStyle: "__cortex_font__",
  colorStyle: "__cortex_colors__",
  ruler: "__cortex_ruler__",
  rulerBackdrop: "__cortex_ruler_bg__",
  rulerToolbar: "__cortex_ruler_tb__",
  readMode: "__cortex_readmode__",
  dictApiContent: "cortex-dict-api-content",
  dictContent: "cortex-dict-content",
} as const;

// ─── CSS Class Names ────────────────────────────────────────────────────────

export const CSS_CLASSES = {
  simplifyWrapper: "__cortex_simplify_wrapper__",
  simplifyOutput: "__cortex_output__",
  readModeBody: "__cortex_rm_body__",
  ttsWord: "__cortex_rm_word__",
  ttsWordActive: "__cortex_rm_word_active__",
  ttsLineActive: "__cortex_rm_line_active__",
} as const;

// ─── Keep-Alive ─────────────────────────────────────────────────────────────

/** Interval (ms) for the service-worker keep-alive ping. */
export const KEEP_ALIVE_INTERVAL_MS = 20_000;

// ─── Read Mode Themes ───────────────────────────────────────────────────────

export type ReadModeTheme = "dark" | "light" | "sepia" | "warm";

export const READ_MODE_THEMES: ReadModeTheme[] = ["dark", "light", "sepia", "warm"];

// ─── Ruler Backdrop Modes ───────────────────────────────────────────────────

export type RulerBackdropMode = "dim" | "blur" | "hide";
