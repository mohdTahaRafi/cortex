# Cortex

**AI-powered browser extension for a cleaner, focused, and more readable web.**

Cortex is a Google Chrome Browser Extension designed specifically for neurodivergent individuals, students, and anyone who finds the modern web overwhelming. It leverages local Large Language Models (LLMs), advanced layout parsing, and accessibility-first design to reduce distractions, simplify complex information, and ease visual focus.

---

## Features

### Local AI Processing
- Cortex uses [WebLLM](https://github.com/mlc-ai/web-llm), a system that lets you run LLMs directly inside the browser, without any need of a server.
- This however has a few **requirements**:
  - Latest Version of [Google Chrome](https://www.google.com/chrome/) (the extension isn't tested on other browsers).
  - Browser must support [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).
  - Integrated GPU, works better with a Dedicated GPU.
  - 1.5 GB to 8 GB of VRAM (usually 4GB of VRAM is enough) depending on the LLM.

### AI Powered Simplification
- **Contextual Rewrites**: Simplify long or complex paragraphs with a single click.
- **Local Processing**: All AI operations run on your device via WebGPU/WebAssembly, no data ever leaves your computer.
- **Customizable Prompts**: The Default prompt can be replaced by a customized prompt tailored to the user's needs.

### AI Powered Dictionary
- **Local Dictionary**: Double-click a word for an instant definition from `dictionaryapi.dev` paired with a **Local AI-simplified** explanation.

### Read Mode
- **Distraction-Free Reading**: Extracts the core content using [Mozilla's Readability engine](https://www.npmjs.com/package/@mozilla/readability).
- **Read Aloud (TTS)**: Built-in text-to-speech with word-level highlighting and auto-scrolling synchronization.
- **Customizable Themes**: Choose from Dark, Light, Sepia, or Warm themes with adjustable fonts and font sizes.
- **Typography Overrides**: Switch to dyslexia-friendly fonts like **[OpenDyslexic](https://opendyslexic.org/)** or focus-centric fonts like **[Lexend](https://www.lexend.com/)**.

### Reading Ruler / Spotlight
- **Visual Focus Modes**: Use a horizontal ruler or a full-page spotlight to focus on one thing at a time.
- **Smart Snapping**: Ctrl+Click any element to snap the ruler perfectly to the text block.
- **Backdrop Customization**: Dim, Blur, or Hide the rest of the page to eliminate visual noise.
- **Keyboard Friendly**: Navigation and resizing via arrow keys or by a mouse click for seamless use.

### Cognitive Analysis
- **Accessibility Scoring**: Get a real-time score of any webpage based on readability ([Flesch Ease & Flesch Grading Level Formulas](https://readable.com/readability/flesch-reading-ease-flesch-kincaid-grade-level/)) and visual clutter (sticky banners, popups, complex DOM).
  - Readability processing is done by first taking out all the readable content in a webpage using [Mozilla's Readability engine](https://www.npmjs.com/package/@mozilla/readability) with some fallback processing in place, then using Flesch Formulas to calculate the scores.
- **Actionable Insights**: See exactly why a page is difficult to read.

### Visual & Layout Overrides
- **Color Profiles**: Real-time adjustment of saturation, contrast, and brightness via CSS filters.
- **Font Injection**: Force high-legibility fonts across all websites, including icon-font protection.

---

## Installation

### Setup
1. **Clone the Repository**
    ```bash
    git clone https://github.com/yourusername/cortex.git
    cd cortex
    ```

2. **Install Dependencies**
    ```bash
    npm install
    ```

3. **Run in Development Mode**
    ```bash
    npm run dev
    ```
    This will start the [WXT](https://wxt.dev/) development server and automatically open a browser instance with the extension loaded.

4. **Build for Production**
    ```bash
    npm run build
    ```
    The output will be generated in the `.output` directory.

 5. **Load the Built Extension**
    - Go to `Manage Extensions` in Google Chrome and turn on `Developer mode`. This will allow us to load unpacked extensions.
    - Click `Load unpacked` and select the `chrome-mv3` folder under `cortex > .output > chrome-mv3`.
    - The extension should now appear in Google Chrome.

---

## Implementation Details

### Local LLM Architecture
- **Service Worker Lifecycle**: The LLM engine is managed in `background.ts`, ensuring it persists across tabs and remains responsive. 
- **Streaming Responses**: Messages are communicated via `chrome.runtime.sendMessage`, with real-time streaming chunks forwarded to the UI for a zero-latency feel.
- Since Manifest V3 terminates background service workers after ~30 seconds of inactivity, the service worker and content script periodically ping each other to keep the worker alive. This prevents the LLM model from being reloaded every other minute.
- **Hardware Acceleration**: Utilizes WebGPU for near-native performance on supported hardware.

### Content Extraction & Security
- **[Mozilla Readability](https://www.npmjs.com/package/@mozilla/readability)**: Used in the content script to parse and clone the DOM, extracting the main article without affecting the live page.
- **[DOMPurify](https://www.npmjs.com/package/dompurify)**: All extracted HTML is sanitized before being rendered in the "Read Mode" shadow UI, preventing XSS and maintaining security.

### Overlays
- **SVG Masking**: Specifically for the "Reading Ruler", we use dynamic SVG path masks (`mask-image`) to create rounded cutouts that follow the cursor or snap to elements without inducing page re-layouts.
- **CSS Filters**: Visual profiles are applied via a single `filter` string on the `html` element for proper color grading.

### Accessibility Engine
The accessibility score in `cognitiveScore.ts` uses two main metrics:
- **Textual Analysis**: Calculates [Flesch-Kincaid](https://readable.com/readability/flesch-reading-ease-flesch-kincaid-grade-level/) grade levels and syllable counts while penalizing passive voice and jargon. Mozilla's Readability Package is used to first parse readable content from the webpage so that other content on webpage doesn't influence the calculation of readability score.
- **DOM Complexity**: Samples the viewport for "sticky" elements, overlay percentages, and z-index sprawl to quantify visual clutter.

## Tech Stack
- **Framework**: [WXT](https://wxt.dev/)
- **UI**: React 19 + Tailwind CSS v4 + ShadCN
- **AI**: [MLC WebLLM](https://github.com/mlc-ai/web-llm) + `gemma 2 2b it (q4f16_1)` (preferred)
- **Text Analysis**: [Mozilla Readability](https://github.com/mozilla/readability), [DOMPurify](https://github.com/cure53/DOMPurify)
- **Icons**: Lucide React
