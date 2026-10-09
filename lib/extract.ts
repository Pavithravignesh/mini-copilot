// Gets plain text out of a file, based on its extension. All parsers are pure JavaScript.
import fs from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export const SUPPORTED_EXTENSIONS = [".md", ".txt", ".pdf", ".docx"];

export async function extractFileText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  switch (ext) {
    case ".md":
    case ".txt":
      return buffer.toString("utf8");
    case ".pdf": {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return text;
    }
    case ".docx": {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}
