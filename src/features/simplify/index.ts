/**
 * Cortex — Simplify Feature
 *
 * Injects "✦ Simplify" buttons below qualifying paragraphs.
 * When clicked, sends the paragraph text to the background LLM engine
 * for rewriting and streams the result back in real-time.
 *
 * Design Patterns:
 * - State Machine: Button states (idle/loading/progress/done/stopping)
 *   are defined as a typed config map instead of a switch statement.
 * - Observer: Uses observeStorage() for reactive toggle state.
 * - Factory: Uses MessageFactory for message construction.
 *
 * SOLID:
 * - Open/Closed: New button states can be added to BUTTON_STATES
 *   without modifying applyButtonState().
 * - Dependency Inversion: Uses observeStorage() abstraction.
 */

import { MIN_PARAGRAPH_LENGTH, MIN_REWRITE_LENGTH, CSS_CLASSES } from "@/constants";
import { DEFAULT_REWRITE_PROMPT } from "@/utils/storage";
import { observeStorage } from "@/utils/storage-observer";
import { MessageFactory } from "@/utils/message-factory";

// ─── State ──────────────────────────────────────────────────────────────────

let rewriteEnabled = false;
const injectedParagraphs = new WeakSet<Element>();

const observer = new MutationObserver(() => {
  if (rewriteEnabled) injectButtonsIntoParagraphs();
});

// ─── Button State Machine (State Pattern) ───────────────────────────────────

type ButtonState = "idle" | "loading" | "progress" | "done" | "stopping";

interface ButtonStateConfig {
  html: string;
  color: string;
  borderColor: string;
  background: string;
}

/**
 * State Machine configuration — each state maps to its visual properties.
 * Adding a new state (e.g., "error") requires only adding an entry here.
 * Open/Closed Principle: no existing code needs to change.
 */
const BUTTON_STATES: Record<ButtonState, ButtonStateConfig> = {
  idle: {
    html: '<span style="font-size:11px">✦</span> Simplify',
    color: "#a78bfa",
    borderColor: "rgba(124,106,247,0.3)",
    background: "rgba(124,106,247,0.12)",
  },
  loading: {
    html: "⏹ Stop simplifying",
    color: "#f87171",
    borderColor: "rgba(248,113,113,0.3)",
    background: "rgba(248,113,113,0.08)",
  },
  progress: {
    html: "", // dynamic — set by caller
    color: "#fbbf24",
    borderColor: "rgba(251,191,36,0.3)",
    background: "rgba(251,191,36,0.08)",
  },
  done: {
    html: '<span style="font-size:11px">✦</span> Simplified ✓',
    color: "#34d399",
    borderColor: "rgba(52,211,153,0.3)",
    background: "rgba(52,211,153,0.08)",
  },
  stopping: {
    html: "⏹ Stopping...",
    color: "#f87171",
    borderColor: "rgba(248,113,113,0.3)",
    background: "rgba(248,113,113,0.08)",
  },
};

function applyButtonState(btn: HTMLElement, state: ButtonState): void {
  const config = BUTTON_STATES[state];
  if (config.html) btn.innerHTML = config.html;
  btn.style.opacity = "1";
  btn.style.color = config.color;
  btn.style.borderColor = config.borderColor;
  btn.style.background = config.background;
}

// ─── DOM Injection ──────────────────────────────────────────────────────────

function isEditableContext(para: HTMLElement): boolean {
  return (
    para.isContentEditable ||
    !!para.closest('[contenteditable="true"]') ||
    !!para.querySelector("input, textarea, select")
  );
}

function generateRequestId(): string {
  return `rw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function injectButtonsIntoParagraphs(): void {
  const paragraphs = document.querySelectorAll("p");
  paragraphs.forEach((para) => {
    if (injectedParagraphs.has(para)) return;
    if (isEditableContext(para)) return;

    const text = para.innerText?.trim() ?? "";
    if (text.length < MIN_PARAGRAPH_LENGTH) return;
    injectedParagraphs.add(para);

    // Create wrapper
    const wrapper = document.createElement("div");
    wrapper.className = CSS_CLASSES.simplifyWrapper;
    wrapper.style.cssText =
      'margin:6px 0 2px 0;font-family:"Lexend",system-ui,-apple-system,sans-serif;';

    // Create button
    const btn = document.createElement("button");
    btn.innerHTML = '<span style="font-size:11px">✦</span> Simplify';
    btn.style.cssText = [
      "all:unset", "display:inline-flex", "align-items:center", "gap:5px",
      "padding:3px 12px", "font-size:11px", "font-weight:600",
      "border-radius:20px", "background:rgba(124,106,247,0.12)",
      "color:#a78bfa", "border:1px solid rgba(124,106,247,0.3)",
      "cursor:pointer", "transition:all 0.15s ease", "letter-spacing:0.02em",
    ].join(";");

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(124,106,247,0.22)";
      btn.style.borderColor = "#7c6af7";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "rgba(124,106,247,0.12)";
      btn.style.borderColor = "rgba(124,106,247,0.3)";
    });

    // Create output area
    const outputDiv = document.createElement("div");
    outputDiv.className = CSS_CLASSES.simplifyOutput;
    outputDiv.style.cssText = [
      "display:none", "margin:6px 0 8px 0", "padding:12px 16px",
      "background:rgba(124,106,247,0.07)", "border:1px solid rgba(124,106,247,0.2)",
      "border-radius:10px", "font-size:14px", "line-height:1.7",
      'font-family:"Lexend",system-ui,-apple-system,sans-serif',
      "white-space:pre-wrap",
    ].join(";");

    // Click handler with streaming
    let isLoading = false;
    let currentRequestId: string | null = null;
    let wasInterrupted = false;

    btn.addEventListener("click", async () => {
      if (isLoading) {
        if (currentRequestId) {
          wasInterrupted = true;
          // Factory Pattern: use MessageFactory instead of raw object literal
          chrome.runtime.sendMessage(MessageFactory.stopGeneration()).catch(() => {});
          applyButtonState(btn, "stopping");
        }
        return;
      }

      const paraText = para.innerText.trim();
      if (!paraText || paraText.length < MIN_REWRITE_LENGTH) return;

      isLoading = true;
      wasInterrupted = false;
      applyButtonState(btn, "loading");
      outputDiv.style.display = "block";
      outputDiv.textContent = "";
      outputDiv.style.color = "";

      const storageResult = await chrome.storage.local.get({
        rewritePrompt: DEFAULT_REWRITE_PROMPT,
      });
      const rewritePrompt = storageResult.rewritePrompt as string;
      currentRequestId = generateRequestId();
      const localRequestId = currentRequestId;

      // Streaming chunk listener
      type ChunkMsg = {
        action: string;
        payload: {
          chunk?: string; done?: boolean; requestId?: string;
          progress?: number; text?: string; modelId?: string;
        };
      };

      const chunkListener = (msg: ChunkMsg) => {
        if (msg.action === "PROGRESS_UPDATE" && isLoading) {
          if (msg.payload.progress !== undefined && msg.payload.progress < 100) {
            btn.innerHTML = `⏳ Loading AI: ${msg.payload.progress}%`;
            applyButtonState(btn, "progress");
          } else if (msg.payload.progress === 100) {
            applyButtonState(btn, "loading");
          }
          return;
        }

        if (msg.action !== "REWRITE_CHUNK" || msg.payload.requestId !== localRequestId) return;

        if (msg.payload.done) {
          chrome.runtime.onMessage.removeListener(
            chunkListener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
          );
          isLoading = false;
          if (wasInterrupted) {
            applyButtonState(btn, "idle");
            outputDiv.appendChild(document.createTextNode("\n\n[Stopped]"));
          } else {
            applyButtonState(btn, "done");
          }
        } else {
          const span = document.createElement("span");
          span.textContent = msg.payload.chunk ?? "";
          span.style.animation = "cortex-fade-in 0.1s ease-out forwards";
          outputDiv.appendChild(span);
        }
      };

      chrome.runtime.onMessage.addListener(
        chunkListener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
      );

      // Factory Pattern: use MessageFactory for rewrite request
      const resp = await chrome.runtime
        .sendMessage(MessageFactory.rewriteText(paraText, rewritePrompt, localRequestId))
        .catch((e: Error) => ({ error: e.message }));

      if (resp?.error) {
        chrome.runtime.onMessage.removeListener(
          chunkListener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
        );
        isLoading = false;

        if (wasInterrupted || resp.error.includes("AbortError") || resp.error.includes("interrupted")) {
          outputDiv.appendChild(document.createTextNode("\n\n[Stopped]"));
        } else {
          outputDiv.textContent = `⚠️ ${resp.error}`;
          outputDiv.style.color = "#f87171";
        }
        applyButtonState(btn, "idle");
      }
    });

    wrapper.appendChild(btn);
    para.after(outputDiv);
    para.after(wrapper);
  });
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

function removeAllButtons(): void {
  document
    .querySelectorAll(`.${CSS_CLASSES.simplifyWrapper}, .${CSS_CLASSES.simplifyOutput}`)
    .forEach((el) => el.remove());
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Enable or disable the simplify buttons on the current page.
 */
export function toggleRewriteButtons(enabled: boolean): void {
  rewriteEnabled = enabled;
  if (enabled) {
    injectButtonsIntoParagraphs();
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    removeAllButtons();
    observer.disconnect();
  }
}

/**
 * Initialize: load saved preference, listen for storage changes,
 * and inject the fade-in animation keyframe.
 *
 * Observer Pattern: Uses observeStorage() for reactive toggle state.
 */
export function initSimplify(): void {
  // Inject animation keyframe (renamed from nf-fade-in to cortex-fade-in)
  const animStyle = document.createElement("style");
  animStyle.textContent = `
    @keyframes cortex-fade-in {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(animStyle);

  // Observer Pattern: subscribe to storage with auto-init + live updates
  observeStorage("rewriteEnabled", (enabled) => {
    toggleRewriteButtons(enabled);
  });
}
