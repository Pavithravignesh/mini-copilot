// Gets plain text out of a file, based on its extension. All parsers are pure JavaScript.
import path from "node:path";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export const SUPPORTED_EXTENSIONS = [".md", ".txt", ".pdf", ".docx"];

// Keep only a safe file name (no folders, no odd characters) with a supported extension
export function safeFileName(name: unknown): string {
  const base = path.basename(String(name ?? "")).replace(/[^\w.\- ]/g, "_");
  if (!base || !SUPPORTED_EXTENSIONS.includes(path.extname(base).toLowerCase())) {
    throw new Error(`Only ${SUPPORTED_EXTENSIONS.join(", ")} files are supported`);
  }
  return base;
}

export async function extractText(fileName: string, buffer: Buffer): Promise<string> {
  switch (path.extname(fileName).toLowerCase()) {
    case ".md":
    case ".txt":
      return buffer.toString("utf8");
    case ".pdf": {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractPdfText(pdf, { mergePages: true });
      return text;
    }
    case ".docx": {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }
    default:
      throw new Error(`Unsupported file type: ${fileName}`);
  }
}
