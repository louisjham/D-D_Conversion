import { LocalSourceProvenance } from "@grimoire3d/campaign-ir";

export function createLocalSourceProvenance(
  sourceId: string,
  documentHash: string,
  page: number,
  quoteText: string,
  method: "manual" | "text-parser" | "llm" = "text-parser"
): LocalSourceProvenance {
  // Simple hash for quote text
  let quoteHash = "hash-quote-0";
  try {
    let hash = 0;
    for (let i = 0; i < quoteText.length; i++) {
      hash = (hash << 5) - hash + quoteText.charCodeAt(i);
      hash |= 0;
    }
    quoteHash = `qhash-${Math.abs(hash)}`;
  } catch (e) {
    quoteHash = "qhash-fallback";
  }

  return {
    sourceId,
    documentHash,
    page,
    quoteHash,
    quotePreview: quoteText.slice(0, 100), // Stored locally only
    extractionMethod: method,
    confidence: 0.85,
    review: {
      status: "unreviewed",
    },
  };
}
