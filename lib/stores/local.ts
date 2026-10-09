// A tiny vector database: chunks + embeddings saved in a JSON file, searched with cosine
// similarity in plain JavaScript. Supabase/pgvector does the same thing, in SQL, at scale.
import fs from "node:fs";
import path from "node:path";
import type { Store, StoredChunk, SearchResult } from "../store.js";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(process.cwd(), "storage", "vectors.json");

function load(): StoredChunk[] {
  return fs.existsSync(STORE_PATH) ? JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) : [];
}

function save(chunks: StoredChunk[]): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(chunks));
}

// cosine similarity = dot(a, b) / (|a| * |b|), from -1 (opposite) to 1 (same words)
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export const localStore: Store = {
  mode: "local",

  async listDocuments() {
    return [...new Set(load().map((c) => c.source))].sort();
  },

  async saveDocument(name, chunks) {
    save([...load().filter((c) => c.source !== name), ...chunks]);
  },

  async deleteDocument(name) {
    save(load().filter((c) => c.source !== name));
    fs.rmSync(path.join(DATA_DIR, name), { force: true });
  },

  async search(queryEmbedding, topK) {
    return load()
      .map(({ embedding, ...chunk }): SearchResult => ({ ...chunk, score: cosineSimilarity(queryEmbedding, embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  },

  async readUploadedFile(name) {
    return fs.readFileSync(path.join(DATA_DIR, name));
  },
};
