/**
 * Runs in content-script context. Analyzes the current page and returns
 * structured readability + visual-clutter scores.
 * Uses Flesch Reading Ease as base readability metric, with penalties for long sentences,
 * passive voice, and jargon. Visual clutter is based on DOM complexity, sticky elements,
 * popups, ads, and layering.
 */

export interface AccessibilityScoreDetails {
  // Readability
  fleschReadingEase: number;
  fkGradeLevel: number;
  longSentenceCount: number;
  passiveVoiceCount: number;
  jargonCount: number;
  totalSentences: number;
  totalWords: number;
  // Visual Clutter
  domElementCount: number;
  stickyBannerCount: number;
  popupCount: number;
  adCount: number;
  overlayViewportPercent: number;
  stackedLayerRatio: number;
  zIndexLayerCount: number;
}

export interface AccessibilityScore {
  overall: number; // 0–100
  readability: number; // 0–100
  visualClutter: number; // 0–100
  details: AccessibilityScoreDetails;
  findings: string[];
}

// Syllable counter (rule-based, good enough for English readability)
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/e$/, ""); // silent e
  const vowelGroups = word.match(/[aeiouy]+/g);
  return Math.max(1, vowelGroups ? vowelGroups.length : 1);
}

// Tree-walker fallback — used when Readability can't parse the page
function extractPageTextFallback(): string {
  const ignored = new Set([
    "script",
    "style",
    "noscript",
    "head",
    "meta",
    "link",
    "svg",
    "iframe",
    "nav",
    "footer",
    "header",
  ]);
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (ignored.has(parent.tagName.toLowerCase()))
          return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden")
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );
  const chunks: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = (node.textContent ?? "").trim();
    if (t.length > 1) chunks.push(t);
  }
  return chunks.join(" ");
}

// Readability analysis — pure text processing, no DOM access
function analyzeReadability(text: string): {
  readabilityScore: number;
  details: Pick<
    AccessibilityScoreDetails,
    | "fleschReadingEase"
    | "fkGradeLevel"
    | "longSentenceCount"
    | "passiveVoiceCount"
    | "jargonCount"
    | "totalSentences"
    | "totalWords"
  >;
} {
  const rawSentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const totalSentences = Math.max(1, rawSentences.length);
  const words = text.match(/\b[a-zA-Z']+\b/g) ?? [];
  const totalWords = Math.max(1, words.length);
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  // Flesch Reading Ease
  // Credits: https://readable.com/readability/flesch-reading-ease-flesch-kincaid-grade-level/
  const avgWordsPerSentence = totalWords / totalSentences;
  const avgSyllablesPerWord = totalSyllables / totalWords;
  const fleschReadingEase = Math.max(
    0,
    Math.min(
      100,
      206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord,
    ),
  );

  // Flesch-Kincaid Grade Level
  const fkGradeLevel = Math.max(
    0,
    0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59,
  );

  // Long sentences (> 25 words)
  const longSentenceCount = rawSentences.filter(
    (s) => (s.match(/\b[a-zA-Z']+\b/g) ?? []).length > 25,
  ).length;

  // Passive voice
  const passiveRegex = /\b(was|were|is|are|been|being|be)\s+\w+(?:ed|en)\b/gi;
  const passiveVoiceCount = (text.match(passiveRegex) ?? []).length;

  // Jargon / rare words (≥ 4 syllables, not proper nouns)
  const jargonCount = words.filter(
    (w) =>
      w.length >= 6 && w[0] === w[0].toLowerCase() && countSyllables(w) >= 4,
  ).length;

  // Map to 0–100 (FRE is already 0–100: higher = easier = better)
  const longSentPenalty = Math.min(12, longSentenceCount * 0.7);
  const passivePenalty = Math.min(
    10,
    (passiveVoiceCount / totalWords) * 100 * 2,
  );
  const jargonPenalty = Math.min(10, (jargonCount / totalWords) * 100 * 1.5);

  const readabilityScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        fleschReadingEase - longSentPenalty - passivePenalty - jargonPenalty,
      ),
    ),
  );

  return {
    readabilityScore,
    details: {
      fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
      fkGradeLevel: Math.round(fkGradeLevel * 10) / 10,
      longSentenceCount,
      passiveVoiceCount,
      jargonCount,
      totalSentences,
      totalWords,
    },
  };
}

/* --------------- Visual clutter analysis -------------- */
function analyzeVisualClutter(): {
  clutterScore: number;
  details: Pick<
    AccessibilityScoreDetails,
    | "domElementCount"
    | "stickyBannerCount"
    | "popupCount"
    | "adCount"
    | "overlayViewportPercent"
    | "stackedLayerRatio"
    | "zIndexLayerCount"
  >;
} {
  const allElements = document.querySelectorAll("*");
  const domElementCount = allElements.length;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const viewportArea = vw * vh;
  const uniqueZIndex = new Set<number>();
  let stickyBannerCount = 0;
  let overlayArea = 0;

  allElements.forEach((el) => {
    const style = window.getComputedStyle(el as HTMLElement);
    const pos = style.position;
    const zRaw = parseInt(style.zIndex, 10);
    if (!isNaN(zRaw) && zRaw > 0) uniqueZIndex.add(zRaw);

    if (pos === "fixed" || pos === "sticky") {
      stickyBannerCount++;
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < vh &&
        rect.bottom > 0 &&
        rect.left < vw &&
        rect.right > 0
      ) {
        overlayArea +=
          (Math.min(rect.right, vw) - Math.max(rect.left, 0)) *
          (Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
      }
    }
  });

  const zIndexLayerCount = uniqueZIndex.size;

  // Popups / modals / dialogs
  const popupSelectors = [
    "[role=dialog]",
    "[role=alertdialog]",
    "[aria-modal=true]",
    ".modal",
    ".popup",
    ".overlay",
    ".lightbox",
    '[class*="modal"]',
    '[class*="popup"]',
    '[class*="overlay"]',
    '[class*="dialog"]',
    '[class*="lightbox"]',
    '[class*="cookie"]',
    '[class*="consent"]',
    '[class*="gdpr"]',
    '[class*="banner"]',
  ].join(",");

  let popupCount = 0;
  document.querySelectorAll(popupSelectors).forEach((el) => {
    const style = window.getComputedStyle(el as HTMLElement);
    if (style.display !== "none" && style.visibility !== "hidden") popupCount++;
  });

  // Ads
  const adSelectors = [
    "iframe",
    '[class*="advert"]',
    '[class*="ad-"]',
    '[class*="-ad"]',
    '[id*="google_ads"]',
    '[id*="doubleclick"]',
    '[class*="sponsored"]',
  ].join(",");
  const adCount = document.querySelectorAll(adSelectors).length;

  // Stacked layer sampling (8×8 grid)
  const GRID = 8;
  let stackedPoints = 0;
  let sampledPoints = 0;
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      const x = (vw / GRID) * (gx + 0.5);
      const y = (vh / GRID) * (gy + 0.5);
      try {
        const elems = document.elementsFromPoint(x, y);
        if (!elems || elems.length === 0) continue;
        sampledPoints++;
        const visible = elems.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (visible.length > 5) stackedPoints++;
      } catch {
        /* ignore */
      }
    }
  }
  const stackedLayerRatio =
    sampledPoints > 0 ? stackedPoints / sampledPoints : 0;
  const overlayViewportPercent = Math.min(
    100,
    (overlayArea / viewportArea) * 100,
  );

  // Compute clutter score (100 = pristine)
  const domPenalty = Math.min(25, (domElementCount / 3000) * 25);
  const stickyPenalty = Math.min(20, stickyBannerCount * 4);
  const popupPenalty = Math.min(20, popupCount * 10);
  const adPenalty = Math.min(15, adCount * 3);
  const stackPenalty = Math.min(20, stackedLayerRatio * 30);

  const clutterScore = Math.round(
    Math.max(
      0,
      100 -
        domPenalty -
        stickyPenalty -
        popupPenalty -
        adPenalty -
        stackPenalty,
    ),
  );

  return {
    clutterScore,
    details: {
      domElementCount,
      stickyBannerCount,
      popupCount,
      adCount,
      overlayViewportPercent: Math.round(overlayViewportPercent * 10) / 10,
      stackedLayerRatio: Math.round(stackedLayerRatio * 100) / 100,
      zIndexLayerCount,
    },
  };
}

/* --------- Build human-readable findings list --------- */
function buildFindings(
  details: AccessibilityScoreDetails,
  readability: number,
  visualClutter: number,
): string[] {
  const findings: string[] = [];

  if (details.fleschReadingEase < 30) {
    findings.push(
      `Very difficult to read (Flesch score: ${details.fleschReadingEase})`,
    );
  } else if (details.fleschReadingEase < 50) {
    findings.push(
      `Difficult text (Flesch score: ${details.fleschReadingEase})`,
    );
  }

  if (details.fkGradeLevel > 12) {
    findings.push(
      `College-level reading required (Grade ${Math.round(details.fkGradeLevel)})`,
    );
  } else if (details.fkGradeLevel > 9) {
    findings.push(
      `High school reading level (Grade ${Math.round(details.fkGradeLevel)})`,
    );
  }

  if (details.longSentenceCount > 5) {
    findings.push(
      `${details.longSentenceCount} long sentences detected (>25 words)`,
    );
  }

  if (details.passiveVoiceCount > 10) {
    findings.push(
      `Heavy passive voice usage (${details.passiveVoiceCount} instances)`,
    );
  }

  if (details.jargonCount > 15) {
    findings.push(`${details.jargonCount} complex/jargon words found`);
  }

  if (details.popupCount > 0) {
    findings.push(
      `${details.popupCount} popup${details.popupCount > 1 ? "s" : ""} or modal${details.popupCount > 1 ? "s" : ""} detected`,
    );
  }

  if (details.stickyBannerCount > 3) {
    findings.push(
      `${details.stickyBannerCount} sticky/fixed elements on screen`,
    );
  }

  if (details.adCount > 3) {
    findings.push(`${details.adCount} likely ad elements detected`);
  }

  if (details.domElementCount > 2000) {
    findings.push(`High DOM complexity (${details.domElementCount} elements)`);
  }

  if (details.stackedLayerRatio > 0.3) {
    findings.push(
      `${Math.round(details.stackedLayerRatio * 100)}% of viewport has layered elements`,
    );
  }

  if (findings.length === 0) {
    if (readability >= 70)
      findings.push("Great readability — easy to understand");
    if (visualClutter >= 70) findings.push("Clean visual layout — low clutter");
  }

  return findings.slice(0, 5);
}

/* ------------------------------------------------------ */
/*                      Main export                       */
/* ------------------------------------------------------ */
export async function computeAccessibilityScore(): Promise<AccessibilityScore> {
  // Try Mozilla Readability first — extracts only article body text,
  // stripping nav, sidebars, ads, footers etc. for more accurate Flesch scores.
  let text = "";
  try {
    const { Readability } = await import("@mozilla/readability");
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (article?.textContent && article.textContent.trim().length > 200) {
      text = article.textContent.trim();
    }
  } catch {
    // Readability unavailable or failed — fall through to tree-walker
  }

  // Fallback: tree-walker (works on non-article pages, e.g. dashboards, SPAs)
  if (!text) {
    text = extractPageTextFallback();
  }

  const { readabilityScore, details: rDetails } = analyzeReadability(text);
  const { clutterScore, details: cDetails } = analyzeVisualClutter();

  const overall = Math.round(0.5 * readabilityScore + 0.5 * clutterScore);
  const details: AccessibilityScoreDetails = { ...rDetails, ...cDetails };
  const findings = buildFindings(details, readabilityScore, clutterScore);

  return {
    overall,
    readability: readabilityScore,
    visualClutter: clutterScore,
    details,
    findings,
  };
}
