export interface TextExtractResult {
  text: string;
  sourceName: string;
  lineCount: number;
}

export class PdfTextExtractor {
  /**
   * Reads a user uploaded text file or pdf file content.
   */
  public static async extractFromFile(file: File): Promise<TextExtractResult> {
    const filename = file.name;
    const text = await file.text();
    const lines = text.split("\n").length;

    return {
      text,
      sourceName: filename,
      lineCount: lines,
    };
  }

  /**
   * Truncates or formats raw text into clean chunk sections for AI prompt processing.
   */
  public static chunkModuleText(fullText: string, maxChars: number = 8000): string[] {
    const chunks: string[] = [];
    let currentPos = 0;

    while (currentPos < fullText.length) {
      const endPos = Math.min(currentPos + maxChars, fullText.length);
      chunks.push(fullText.slice(currentPos, endPos));
      currentPos = endPos;
    }

    return chunks;
  }
}
