/**
 * Cortex — TTS (Text-to-Speech) Engine
 *
 * Manages speech synthesis with word-level highlighting and auto-scroll.
 * A version counter prevents stale utterance callbacks after stop/restart.
 */

import { CSS_CLASSES } from "@/constants";

let ttsActive = false;
let ttsPaused = false;
let ttsWordSpans: HTMLElement[] = [];
let ttsActiveWordEl: HTMLElement | null = null;
let ttsActiveLineEl: HTMLElement | null = null;
let ttsUtterance: SpeechSynthesisUtterance | null = null;
let ttsRate = 1.0;
let ttsVoice: SpeechSynthesisVoice | null = null;
let ttsPlayBtn: HTMLButtonElement | null = null;
let ttsWordOffset = 0;
let ttsFullText = "";
let ttsVersion = 0;
let scrollContainer: HTMLElement | null = null;

export function setScrollContainer(el: HTMLElement | null): void { scrollContainer = el; }
export function setPlayButton(btn: HTMLButtonElement | null): void { ttsPlayBtn = btn; }
export function getState() { return { active: ttsActive, paused: ttsPaused, rate: ttsRate }; }

export function stopTts(): void {
  ttsVersion++;
  speechSynthesis.cancel();
  ttsActive = false;
  ttsPaused = false;
  clearHighlights();
  ttsWordOffset = 0;
  if (ttsPlayBtn) { ttsPlayBtn.innerHTML = "▶"; ttsPlayBtn.title = "Play"; }
}

export function setVoice(voice: SpeechSynthesisVoice | null): void {
  ttsVoice = voice;
  if (ttsActive && !ttsPaused) {
    const resumeOffset = ttsActiveWordEl ? parseInt(ttsActiveWordEl.dataset.start ?? "0", 10) : ttsWordOffset;
    speechSynthesis.cancel();
    requestAnimationFrame(() => {
      ttsWordOffset = resumeOffset;
      ttsUtterance = buildUtterance(ttsFullText.slice(resumeOffset));
      speechSynthesis.speak(ttsUtterance);
    });
  }
}

export function setRate(rate: number): void {
  ttsRate = rate;
  if (ttsActive && !ttsPaused) { speechSynthesis.pause(); speechSynthesis.resume(); }
}

export function play(contentWrap: HTMLElement): void {
  if (!ttsActive) {
    if (ttsWordSpans.length === 0) ttsFullText = spanifyWords(contentWrap);
    ttsWordOffset = 0;
    ttsUtterance = buildUtterance(ttsFullText);
    ttsActive = true; ttsPaused = false;
    speechSynthesis.speak(ttsUtterance);
    if (ttsPlayBtn) { ttsPlayBtn.innerHTML = "⏸"; ttsPlayBtn.title = "Pause"; }
  } else if (ttsPaused) {
    speechSynthesis.resume(); ttsPaused = false;
    if (ttsPlayBtn) { ttsPlayBtn.innerHTML = "⏸"; ttsPlayBtn.title = "Pause"; }
  } else {
    speechSynthesis.pause(); ttsPaused = true;
    if (ttsPlayBtn) { ttsPlayBtn.innerHTML = "▶"; ttsPlayBtn.title = "Resume"; }
  }
}

export function resetState(): void { ttsWordSpans = []; ttsPlayBtn = null; scrollContainer = null; }

function clearHighlights(): void {
  ttsActiveWordEl?.classList.remove(CSS_CLASSES.ttsWordActive);
  ttsActiveLineEl?.classList.remove(CSS_CLASSES.ttsLineActive);
  ttsActiveWordEl = null; ttsActiveLineEl = null;
}

function buildUtterance(text: string): SpeechSynthesisUtterance {
  const myVersion = ++ttsVersion;
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = ttsRate;
  if (ttsVoice) utt.voice = ttsVoice;

  utt.onboundary = (e) => {
    if (myVersion !== ttsVersion || e.name !== "word") return;
    clearHighlights();
    const charIdx = ttsWordOffset + e.charIndex;
    let best: HTMLElement | null = null;
    let bestDist = Infinity;
    for (const span of ttsWordSpans) {
      const start = parseInt(span.dataset.start ?? "0", 10);
      const end = parseInt(span.dataset.end ?? "0", 10);
      if (charIdx >= start && charIdx <= end) { best = span; break; }
      const dist = Math.min(Math.abs(charIdx - start), Math.abs(charIdx - end));
      if (dist < bestDist) { bestDist = dist; best = span; }
    }
    if (best) {
      ttsActiveWordEl = best;
      best.classList.add(CSS_CLASSES.ttsWordActive);
      const line = best.closest<HTMLElement>("p, h1, h2, h3, h4, h5, h6, li, blockquote, td");
      if (line && line !== ttsActiveLineEl) {
        ttsActiveLineEl?.classList.remove(CSS_CLASSES.ttsLineActive);
        ttsActiveLineEl = line;
        line.classList.add(CSS_CLASSES.ttsLineActive);
      }
      // Teleprompter auto-scroll
      const container = scrollContainer ?? document.documentElement;
      const containerH = scrollContainer ? scrollContainer.clientHeight : window.innerHeight;
      const wordRect = best.getBoundingClientRect();
      const containerTop = scrollContainer ? scrollContainer.getBoundingClientRect().top : 0;
      const relBottom = wordRect.bottom - containerTop;
      if (relBottom > containerH * 0.7 || wordRect.top < containerTop) {
        const currentScroll = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
        const wordTopInDoc = wordRect.top - containerTop + currentScroll;
        container.scrollTo({ top: wordTopInDoc - containerH * 0.45 + wordRect.height / 2, behavior: "smooth" });
      }
    }
  };

  utt.onend = () => {
    if (myVersion !== ttsVersion) return;
    ttsActive = false; ttsPaused = false; ttsWordOffset = 0; clearHighlights();
    if (ttsPlayBtn) { ttsPlayBtn.innerHTML = "▶"; ttsPlayBtn.title = "Play"; }
  };
  utt.onerror = () => {
    if (myVersion !== ttsVersion) return;
    ttsActive = false; ttsPaused = false; clearHighlights();
    if (ttsPlayBtn) { ttsPlayBtn.innerHTML = "▶"; ttsPlayBtn.title = "Play"; }
  };
  return utt;
}

/** Wrap every word in container with a <span data-start data-end> for TTS boundary matching. */
export function spanifyWords(container: HTMLElement): string {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  type Seg = { node: Text; text: string };
  const segments: Seg[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node as Text;
    if (!t.parentElement || t.parentElement.classList.contains(CSS_CLASSES.ttsWord)) continue;
    segments.push({ node: t, text: t.textContent ?? "" });
  }
  ttsWordSpans = [];
  let fullText = "";
  const wordRe = /\S+/g;
  for (const seg of segments) {
    const segStart = fullText.length;
    fullText += seg.text;
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    seg.text.replace(wordRe, (match, offset) => {
      if (offset > lastIdx) frag.appendChild(document.createTextNode(seg.text.slice(lastIdx, offset)));
      const span = document.createElement("span");
      span.className = CSS_CLASSES.ttsWord;
      span.textContent = match;
      span.dataset.start = String(segStart + offset);
      span.dataset.end = String(segStart + offset + match.length - 1);
      frag.appendChild(span);
      ttsWordSpans.push(span);
      lastIdx = offset + match.length;
      return match;
    });
    if (lastIdx < seg.text.length) frag.appendChild(document.createTextNode(seg.text.slice(lastIdx)));
    seg.node.replaceWith(frag);
  }
  return fullText;
}
