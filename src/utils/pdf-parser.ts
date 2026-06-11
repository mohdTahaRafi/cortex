import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

// In Manifest V3, we must load the worker from a local file, 
// which we've copied to the public/ directory.
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.mjs");

export async function parsePdf(fileData: Uint8Array | ArrayBuffer | string): Promise<string> {
  try {
    const loadingTask = typeof fileData === "string" 
      ? pdfjsLib.getDocument({ url: fileData }) 
      : pdfjsLib.getDocument({ data: fileData as Uint8Array | ArrayBuffer });
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    let fullText = "";

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items, adding spaces or newlines based on positioning
      let pageText = "";
      let lastY: number | null = null;
      
      for (const item of textContent.items) {
        if ("str" in item) {
          const textItem = item as TextItem;
          // transform is usually [scaleX, skewY, skewX, scaleY, translateX, translateY]
          const currentY = textItem.transform[5];
          
          if (lastY !== null && Math.abs(lastY - currentY) > 5) {
            // Significant vertical jump means a new line
            pageText += "\n";
          } else if (pageText.length > 0 && !pageText.endsWith(" ") && !pageText.endsWith("\n")) {
            // Same line, add a space between items
            pageText += " ";
          }
          
          pageText += textItem.str;
          lastY = currentY;
        }
      }
      
      fullText += pageText + "\n\n";
    }

    return fullText.trim();
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to parse PDF document.");
  }
}
