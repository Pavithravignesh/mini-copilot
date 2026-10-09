// Indexing pipeline: every supported file in data/ -> text -> chunks -> vectors -> storage/.
// Used by `npm run ingest` and by the upload API.
import fs from "node:fs";
import path from "node:path";
import { chunkDocument, type RawChunk } from "./chunk.js";
import { embed, fitModel } from "./embeddings.js";
import { extractFileText, SUPPORTED_EXTENSIONS } from "./extract.js";
import { saveChunks } from "./vectorStore.js";

export const DATA_DIR = path.join(process.cwd(), "data");

export function listDocuments(): string[] {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .sort();
}

export async function ingestAll() {
  const files = listDocuments();
  const rawChunks: RawChunk[] = [];
  for (const file of files) {
    const text = await extractFileText(path.join(DATA_DIR, file));
    rawChunks.push(...chunkDocument(file, text));
  }

  // Embed heading + text together so the heading's words help search.
  // TF-IDF learns its vocabulary from ALL chunks, so we re-index everything each time.
  const texts = rawChunks.map((c) => `${c.heading}\n${c.text}`);
  fitModel(texts);
  const embeddings = await embed(texts);

  saveChunks(rawChunks.map((c, i) => ({ ...c, id: `chunk-${i}`, embedding: embeddings[i] })));
  return { files: files.length, chunks: rawChunks.length, dimensions: embeddings[0]?.length ?? 0 };
}
