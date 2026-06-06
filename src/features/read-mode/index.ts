/**
 * Cortex — Read Mode Feature
 *
 * Full-page distraction-free reader using Mozilla Readability + DOMPurify.
 * Includes sidebar controls, 4 themes, font sizing, and TTS integration.
 */

import { DOM_IDS, CSS_CLASSES, WORDS_PER_MINUTE } from "@/constants";
import { syncRulerPosition, isRulerEnabled, setReadModeElement } from "@/features/ruler";
import * as tts from "./tts";

let readModeEnabled = false;
let readModeEl: HTMLDivElement | null = null;

export function isReadModeEnabled(): boolean { return readModeEnabled; }
export function setReadModeEnabled(v: boolean): void { readModeEnabled = v; applyReadMode(); }
export function getReadModeEl(): HTMLDivElement | null { return readModeEl; }

async function applyReadMode(): Promise<void> {
  if (readModeEnabled) {
    if (readModeEl) return;
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const { Readability } = await import("@mozilla/readability");
    const DOMPurify = (await import("dompurify")).default;

    const documentClone = document.cloneNode(true) as Document;
    const article = new Readability(documentClone).parse();
    if (!article) {
      readModeEnabled = false;
      alert("Cortex: Could not find readable article content on this page.");
      return;
    }

    const cleanHtml = DOMPurify.sanitize(article.content ?? "", {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["style", "script", "iframe", "form", "input", "textarea", "button"],
      RETURN_TRUSTED_TYPE: false,
    }) as string;

    const wordCount = (article.textContent || "").split(/\s+/).filter(Boolean).length;
    const readMins = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

    chrome.storage.local.get({ activeFont: "default", rmTheme: "dark", rmFontSize: 20 }, ({ activeFont, rmTheme, rmFontSize }) => {
      const fontFamily = (activeFont as string) === "default"
        ? "'Lexend', sans-serif, system-ui"
        : `"${activeFont}", sans-serif, system-ui`;

      readModeEl = document.createElement("div");
      readModeEl.id = DOM_IDS.readMode;
      readModeEl.dataset.theme = rmTheme as string;
      readModeEl.style.cssText = "position:fixed;inset:0;z-index:2147483640;background:var(--rm-bg);overflow-y:auto;box-sizing:border-box;animation:cortex-fade-in 0.2s ease-out;transition:background 0.3s ease;";

      readModeEl.addEventListener("scroll", () => {
        if (isRulerEnabled()) syncRulerPosition();
      }, { passive: true });

      // Inject themes & TTS highlight styles
      const style = document.createElement("style");
      style.textContent = getThemeCss() + getTtsHighlightCss() + getScopedContentCss();
      readModeEl.appendChild(style);

      // Sidebar
      const sidebar = buildSidebar(readModeEl, rmFontSize as number);
      // Panel
      const panel = document.createElement("div");
      panel.style.cssText = `max-width:680px;margin:0 auto;padding:72px 24px 120px;font-family:${fontFamily};font-size:${rmFontSize}px;line-height:1.6;color:var(--rm-text);position:relative;transition:font-size 0.2s;`;

      // Meta
      const meta = document.createElement("div");
      meta.style.cssText = "margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid var(--rm-border);";
      meta.innerHTML = `${article.title ? `<h1 style="margin:0 0 16px 0;font-size:36px;font-weight:700;color:var(--rm-heading);line-height:1.2;">${article.title}</h1>` : ""}
        <div style="font-size:15px;color:var(--rm-meta);display:flex;flex-wrap:wrap;align-items:center;gap:12px;">
          ${article.byline ? `<span>By ${article.byline}</span>` : ""}<span>·</span><span>~${readMins} min read</span>
        </div>`;

      const contentWrap = document.createElement("div");
      contentWrap.className = CSS_CLASSES.readModeBody;
      contentWrap.innerHTML = cleanHtml;

      panel.appendChild(meta);
      panel.appendChild(contentWrap);

      // TTS controls in sidebar
      appendTtsControls(sidebar, readModeEl, contentWrap);

      readModeEl.appendChild(sidebar);
      readModeEl.appendChild(panel);
      document.body.appendChild(readModeEl);
      readModeEl.dataset.origOverflow = originalBodyOverflow;
      setReadModeElement(readModeEl);
      tts.setScrollContainer(readModeEl);

      // Deferred spanify
      requestAnimationFrame(() => {
        tts.spanifyWords(contentWrap);
      });

      // Wire font size buttons to the panel
  (sidebar as unknown as Record<string, HTMLElement>).__panel = panel;
    });
  } else {
    tts.stopTts();
    tts.resetState();
    setReadModeElement(null);
    if (readModeEl) {
      document.body.style.overflow = readModeEl.dataset.origOverflow || "";
      readModeEl.remove();
      readModeEl = null;
    }
  }
}

function buildSidebar(rmEl: HTMLDivElement, initFontSize: number): HTMLDivElement {
  const sidebar = document.createElement("div");
  sidebar.style.cssText = "position:fixed;top:60px;left:20px;width:48px;display:flex;flex-direction:column;gap:12px;background:var(--rm-panel-bg);border:1px solid var(--rm-border);border-radius:24px;padding:12px 0;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,0.1);z-index:10;";

  const mkBtn = (icon: string, onClick: () => void, tooltip: string) => {
    const btn = document.createElement("button");
    btn.innerHTML = icon; btn.title = tooltip;
    btn.style.cssText = "all:unset;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;color:var(--rm-text);font-size:16px;transition:background 0.15s;";
    btn.addEventListener("mouseenter", () => (btn.style.background = "var(--rm-accent)"));
    btn.addEventListener("mouseleave", () => (btn.style.background = "transparent"));
    btn.addEventListener("click", onClick);
    return btn;
  };
  const mkSep = () => { const s = document.createElement("div"); s.style.cssText = "width:24px;height:1px;background:var(--rm-border);margin:4px 0;"; return s; };

  sidebar.appendChild(mkBtn("✕", () => { readModeEnabled = false; applyReadMode(); }, "Exit Read Mode"));
  sidebar.appendChild(mkSep());

  let fontSize = initFontSize;
  sidebar.appendChild(mkBtn("A+", () => {
    fontSize = Math.min(32, fontSize + 2);
    const p = (sidebar as unknown as Record<string, HTMLElement>).__panel;
    if (p) p.style.fontSize = `${fontSize}px`;
    chrome.storage.local.set({ rmFontSize: fontSize });
  }, "Increase Font Size"));
  sidebar.appendChild(mkBtn("A-", () => {
    fontSize = Math.max(14, fontSize - 2);
    const p = (sidebar as unknown as Record<string, HTMLElement>).__panel;
    if (p) p.style.fontSize = `${fontSize}px`;
    chrome.storage.local.set({ rmFontSize: fontSize });
  }, "Decrease Font Size"));
  sidebar.appendChild(mkSep());

  const themes: [string, string, string][] = [["dark", "#111116", "#333"], ["light", "#f8f9fa", "#ccc"], ["sepia", "#f4ecd8", "#d6caaf"], ["warm", "#2a221f", "#4a3c36"]];
  for (const [name, bg, border] of themes) {
    const dot = document.createElement("button");
    dot.title = `${name} theme`;
    dot.style.cssText = `all:unset;width:20px;height:20px;border-radius:50%;background:${bg};border:2px solid ${border};cursor:pointer;box-sizing:border-box;transition:transform 0.1s;`;
    dot.addEventListener("mouseenter", () => (dot.style.transform = "scale(1.15)"));
    dot.addEventListener("mouseleave", () => (dot.style.transform = "scale(1)"));
    dot.addEventListener("click", () => { if (rmEl) rmEl.dataset.theme = name; chrome.storage.local.set({ rmTheme: name }); });
    sidebar.appendChild(dot);
  }
  sidebar.appendChild(mkSep());
  return sidebar;
}

function appendTtsControls(sidebar: HTMLDivElement, rmEl: HTMLDivElement, contentWrap: HTMLDivElement): void {
  let panel: HTMLDivElement | null = null;
  const speakerBtn = document.createElement("button");
  speakerBtn.innerHTML = "🔊"; speakerBtn.title = "Read Aloud";
  speakerBtn.style.cssText = "all:unset;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;color:var(--rm-text);font-size:16px;transition:background 0.15s;";
  speakerBtn.addEventListener("mouseenter", () => (speakerBtn.style.background = "var(--rm-accent)"));
  speakerBtn.addEventListener("mouseleave", () => (speakerBtn.style.background = "transparent"));

  speakerBtn.addEventListener("click", () => {
    if (panel) { panel.style.display = panel.style.display === "none" ? "flex" : "none"; return; }
    panel = document.createElement("div");
    panel.style.cssText = "position:fixed;top:60px;left:80px;background:var(--rm-panel-bg);border:1px solid var(--rm-border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;z-index:20;min-width:240px;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:'Lexend',system-ui,sans-serif;font-size:13px;color:var(--rm-text);";

    // Voice selector
    const mkLabel = (t: string) => { const l = document.createElement("div"); l.textContent = t; l.style.cssText = "font-size:11px;font-weight:600;opacity:0.6;text-transform:uppercase;letter-spacing:0.06em;"; return l; };
    panel.appendChild(mkLabel("Voice"));
    const voiceSel = document.createElement("select");
    voiceSel.style.cssText = "all:unset;display:block;width:100%;background:var(--rm-code-bg);border:1px solid var(--rm-border);border-radius:8px;padding:6px 10px;font-size:13px;font-family:inherit;color:var(--rm-text);cursor:pointer;box-sizing:border-box;";
    const populateVoices = () => {
      const voices = speechSynthesis.getVoices().filter(v => !v.name.includes('Google'));
      voiceSel.innerHTML = "";
      voices.forEach((v, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = `${v.name} (${v.lang})`; voiceSel.appendChild(o); });
    };
    populateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = populateVoices;
    voiceSel.addEventListener("change", () => { tts.setVoice(speechSynthesis.getVoices().filter(v => !v.name.includes('Google'))[parseInt(voiceSel.value, 10)] ?? null); });
    panel.appendChild(voiceSel);

    // Speed
    const state = tts.getState();
    panel.appendChild(mkLabel(`Speed — ${state.rate.toFixed(1)}×`));
    const speedRow = document.createElement("div"); speedRow.style.cssText = "display:flex;align-items:center;gap:8px;";
    const speedLabel = document.createElement("span"); speedLabel.style.cssText = "font-size:12px;min-width:30px;text-align:right;opacity:0.7;"; speedLabel.textContent = `${state.rate.toFixed(1)}×`;
    const speedSlider = document.createElement("input"); speedSlider.type = "range"; speedSlider.min = "0.5"; speedSlider.max = "2"; speedSlider.step = "0.1"; speedSlider.value = String(state.rate); speedSlider.style.cssText = "flex:1;accent-color:#7c6af7;cursor:pointer;";
    speedSlider.addEventListener("input", () => { const r = parseFloat(speedSlider.value); tts.setRate(r); speedLabel.textContent = `${r.toFixed(1)}×`; });
    speedRow.appendChild(speedSlider); speedRow.appendChild(speedLabel); panel.appendChild(speedRow);

    // Play/Stop buttons
    const btnRow = document.createElement("div"); btnRow.style.cssText = "display:flex;gap:8px;align-items:center;justify-content:center;margin-top:4px;";
    const mkCtrl = (label: string, title: string, onClick: () => void) => {
      const b = document.createElement("button"); b.innerHTML = label; b.title = title;
      b.style.cssText = "all:unset;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;font-size:18px;background:var(--rm-accent);color:var(--rm-text);transition:opacity 0.15s;";
      b.addEventListener("mouseenter", () => (b.style.opacity = "0.75"));
      b.addEventListener("mouseleave", () => (b.style.opacity = "1"));
      b.addEventListener("click", onClick);
      return b;
    };
    const playBtn = mkCtrl("▶", "Play", () => tts.play(contentWrap)) as HTMLButtonElement;
    tts.setPlayButton(playBtn);
    const stopBtn = mkCtrl("⏹", "Stop", () => tts.stopTts()); stopBtn.style.fontSize = "15px";
    btnRow.appendChild(playBtn); btnRow.appendChild(stopBtn); panel.appendChild(btnRow);
    rmEl.appendChild(panel);

    rmEl.addEventListener("pointerdown", (ev) => {
      if (!panel || panel.style.display === "none") return;
      if (!panel.contains(ev.target as Node) && !speakerBtn.contains(ev.target as Node)) panel.style.display = "none";
    }, { capture: true });
  });
  sidebar.appendChild(speakerBtn);
}

function getThemeCss(): string {
  return `
    #${DOM_IDS.readMode}[data-theme="dark"] { --rm-bg:#111116;--rm-text:#d1d1d6;--rm-heading:#e8e8e8;--rm-meta:#a0a0a0;--rm-link:#00ddff;--rm-border:#333333;--rm-panel-bg:#1a1a1a;--rm-code-bg:#222222;--rm-accent:rgba(124,106,247,0.2); }
    #${DOM_IDS.readMode}[data-theme="light"] { --rm-bg:#f8f9fa;--rm-text:#333333;--rm-heading:#111111;--rm-meta:#666666;--rm-link:#0066cc;--rm-border:#e2e8f0;--rm-panel-bg:#ffffff;--rm-code-bg:#f1f5f9;--rm-accent:rgba(0,102,204,0.1); }
    #${DOM_IDS.readMode}[data-theme="sepia"] { --rm-bg:#f4ecd8;--rm-text:#5b4636;--rm-heading:#433422;--rm-meta:#826c59;--rm-link:#b26818;--rm-border:#e3d3b7;--rm-panel-bg:#faeedf;--rm-code-bg:#eaddc5;--rm-accent:rgba(178,104,24,0.1); }
    #${DOM_IDS.readMode}[data-theme="warm"] { --rm-bg:#2a221f;--rm-text:#e0d0c1;--rm-heading:#f0e6d2;--rm-meta:#b09c8d;--rm-link:#ff9966;--rm-border:#4a3c36;--rm-panel-bg:#362c28;--rm-code-bg:#231c19;--rm-accent:rgba(255,153,102,0.15); }
  `;
}

function getTtsHighlightCss(): string {
  return `
    .${CSS_CLASSES.ttsWordActive} { text-decoration:underline;text-decoration-color:#888;text-decoration-thickness:3px;text-underline-offset:3px;border-radius:2px; }
    .${CSS_CLASSES.ttsLineActive} { background:rgba(136,136,136,0.15);border-radius:6px;transition:background 0.15s; }
  `;
}

function getScopedContentCss(): string {
  const b = `.${CSS_CLASSES.readModeBody}`;
  return `
    ${b},${b} p,${b} div,${b} li,${b} span,${b} td,${b} th,${b} blockquote { color:var(--rm-text)!important;font-size:1em!important;font-family:inherit!important; }
    ${b} h1,${b} h2,${b} h3,${b} h4,${b} h5,${b} h6 { color:var(--rm-heading)!important;margin-top:1.8em;margin-bottom:0.6em;line-height:1.35;font-weight:600; }
    ${b} h1{font-size:1.8em}${b} h2{font-size:1.5em}${b} h3{font-size:1.25em;border-bottom:1px solid var(--rm-border);padding-bottom:0.3em}${b} h4{font-size:1.1em}
    ${b} p{margin:0 0 1.2em 0}${b} p:last-child{margin-bottom:0}
    ${b} a{color:var(--rm-link)!important;text-decoration:none;border-bottom:1px solid var(--rm-link)}${b} a:hover{opacity:0.8}${b} a:has(img){border-bottom:none;display:block;width:fit-content;margin:24px auto}
    ${b} img,${b} video,${b} picture{max-width:100%;height:auto;border-radius:4px;display:block;margin:0 auto;background:var(--rm-code-bg)}
    ${b} figure{margin:24px 0}${b} figcaption{font-size:14px;color:var(--rm-meta);text-align:center;margin-top:8px;font-style:italic}
    ${b} blockquote{border-left:4px solid var(--rm-meta);margin:1.6em 0;padding:4px 0 4px 24px;color:var(--rm-meta);font-style:italic}
    ${b} code{background:var(--rm-code-bg);border-radius:4px;padding:2px 6px;font-size:0.9em;font-family:ui-monospace,'Cascadia Code',monospace;color:var(--rm-text)}
    ${b} pre{background:var(--rm-panel-bg);border-radius:6px;padding:16px;border:1px solid var(--rm-border);overflow-x:auto;margin:1.4em 0}
    ${b} pre code{background:transparent;padding:0;font-size:0.85em;border:none}
    ${b} ul,${b} ol{padding-left:2em;margin-bottom:1.2em}${b} li{margin-bottom:0.5em}
    ${b} hr{border:none;border-top:1px solid var(--rm-border);margin:3em 0}
    ${b} table{width:100%;margin:1.5em 0;border-collapse:collapse;font-size:0.9em}${b} th,${b} td{border:1px solid var(--rm-border);padding:10px 14px;text-align:left}${b} th{background:var(--rm-panel-bg);font-weight:600;color:var(--rm-heading)}
  `;
}

export function initReadMode(): void {
  // Escape key exits read mode
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && readModeEnabled && readModeEl) {
      readModeEnabled = false;
      applyReadMode();
    }
  }, { capture: true });
}
