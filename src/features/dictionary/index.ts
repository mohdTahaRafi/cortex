/**
 * Cortex — Dictionary Mode Feature
 *
 * Double-click a word to see:
 * 1. A quick definition from dictionaryapi.dev
 * 2. An AI-simplified explanation from the local LLM
 *
 * Both results are shown in a positioned popup that auto-closes on click outside.
 *
 * Design Patterns:
 * - Observer: Uses observeStorage() for reactive enable/disable.
 * - Factory: Uses MessageFactory for message construction.
 *
 * SOLID:
 * - Single Responsibility: Only handles dictionary popup rendering.
 * - Dependency Inversion: Uses storage abstraction, not raw chrome APIs.
 */

import { DOM_IDS } from "@/constants";
import { observeStorage } from "@/utils/storage-observer";
import { MessageFactory } from "@/utils/message-factory";

let dictEnabled = false;
let activeDictPopup: HTMLElement | null = null;
let currentDictRequestId = "";

export function isDictEnabled(): boolean { return dictEnabled; }
export function setDictEnabled(v: boolean): void { dictEnabled = v; }

function removeDictPopup(): void {
  if (activeDictPopup) {
    activeDictPopup.remove();
    activeDictPopup = null;
    chrome.runtime.sendMessage(MessageFactory.stopGeneration()).catch(() => {});
  }
}

export function initDictionary(): void {
  // Observer Pattern: subscribe to storage with auto-init + live updates
  observeStorage("dictEnabled", (enabled) => {
    dictEnabled = enabled;
  });

  // Double-click handler
  document.addEventListener("dblclick", async (e) => {
    if (!dictEnabled) return;
    const sel = window.getSelection();
    const word = sel?.toString().trim();
    if (!word || word.includes(" ") || word.length > 40) return;

    removeDictPopup();

    const popup = document.createElement("div");
    popup.style.cssText = [
      "position:absolute", "z-index:2147483647",
      `top:${e.pageY + 16}px`, `left:${e.pageX}px`,
      "min-width:240px", "max-width:360px",
      "background:#1e1e28", "color:#e0e0e0",
      'font-family:"Lexend",system-ui,sans-serif',
      "font-size:14px", "line-height:1.6",
      "border:1px solid #2e2e48", "border-radius:12px",
      "padding:14px 16px",
      "box-shadow:0 8px 32px rgba(0,0,0,0.4)",
      "animation:cortex-fade-in 0.15s ease-out",
    ].join(";");

    popup.innerHTML = `
      <div style="font-weight:700;font-size:16px;margin-bottom:8px;color:#c9b3ff;">${word}</div>
      <div id="${DOM_IDS.dictApiContent}" style="font-size:13.5px;margin-bottom:8px;display:none;"></div>
      <div id="${DOM_IDS.dictContent}" style="opacity:0.8;font-size:13px;">Loading definition...</div>
    `;

    document.body.appendChild(popup);
    activeDictPopup = popup;

    // 1. Dictionary API lookup
    try {
      const apiRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
      if (apiRes.ok) {
        const data = await apiRes.json();
        const firstMeaning = data[0]?.meanings[0];
        if (firstMeaning) {
          const apiDiv = popup.querySelector(`#${DOM_IDS.dictApiContent}`) as HTMLElement;
          if (apiDiv) {
            apiDiv.innerHTML = `<span style="font-style:italic;opacity:0.7;font-size:12px;">${firstMeaning.partOfSpeech}</span><br/>${firstMeaning.definitions[0]?.definition}`;
            apiDiv.style.display = "block";
            const aiDiv = popup.querySelector(`#${DOM_IDS.dictContent}`) as HTMLElement;
            if (aiDiv) { aiDiv.style.borderTop = "1px solid #363636"; aiDiv.style.paddingTop = "8px"; }
          }
        }
      }
    } catch { /* Ignore API errors */ }

    // 2. AI-simplified definition — Factory Pattern
    currentDictRequestId = "define-" + Date.now();
    try {
      const res = await chrome.runtime.sendMessage(
        MessageFactory.defineWord(word, currentDictRequestId),
      );
      if (res?.error) {
        const el = popup.querySelector(`#${DOM_IDS.dictContent}`) as HTMLElement;
        if (el) el.innerText = res.error;
      }
    } catch {
      const el = popup.querySelector(`#${DOM_IDS.dictContent}`) as HTMLElement;
      if (el) el.innerText = "Error: Could not connect to WebLLM engine.";
    }
  });

  // Close on click outside
  document.addEventListener("pointerdown", (e) => {
    if (!activeDictPopup) return;
    if (!activeDictPopup.contains(e.target as Node)) removeDictPopup();
  });

  // Listen for streaming chunks
  chrome.runtime.onMessage.addListener((msg) => {
    if (!activeDictPopup) return;

    if (msg.action === "PROGRESS_UPDATE") {
      const el = activeDictPopup.querySelector(`#${DOM_IDS.dictContent}`) as HTMLElement;
      if (el && currentDictRequestId && msg.payload?.text && msg.payload?.progress !== -1) {
        el.innerText = `Loading Engine: ${msg.payload.text} (${msg.payload.progress}%)`;
        el.style.opacity = "0.6";
      }
    }

    if (msg.action === "DEFINE_CHUNK") {
      if (msg.payload.requestId !== currentDictRequestId) return;
      const el = activeDictPopup.querySelector(`#${DOM_IDS.dictContent}`) as HTMLElement;
      if (el) {
        if (el.innerText === "Loading definition..." || el.innerText.startsWith("Loading Engine:")) el.innerText = "";
        el.innerText += msg.payload.chunk;
        el.style.opacity = "1";
      }
    }
  });
}
