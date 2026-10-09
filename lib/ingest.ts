// Indexing pipeline: file -> text -> chunks -> vectors -> store.
import fs from "node:fs";
import path from "node:path";
import { chunkDocument } from "./chunk.js";
import { embed } from "./embeddings.js";
import { extractText, SUPPORTED_EXTENSIONS } from "./extract.js";
import { getStore } from "./store.js";

export const DATA_DIR = path.join(process.cwd(), "data");

export async function indexDocument(name: string, buffer: Buffer) {
  const text = await extractText(name, buffer);
  const chunks = chunkDocument(name, text);
  if (chunks.length === 0) throw new Error(`No text found in ${name} (scanned PDFs are images and have no text)`);

  // Embed heading + text together so the heading's words help search
  const embeddings = await embed(chunks.map((c) => `${c.heading}\n${c.text}`));
  const store = await getStore();
  await store.saveDocument(name, chunks.map((c, i) => ({ ...c, embedding: embeddings[i] })));
  return { name, chunks: chunks.length };
}

// Index every supported file in data/ (the samples, plus local uploads)
export async function indexDataFolder() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .sort();
  const results = [];
  for (const file of files) results.push(await indexDocument(file, fs.readFileSync(path.join(DATA_DIR, file))));
  return results;
}
