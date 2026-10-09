// A tiny vector database: chunks + embeddings saved in a JSON file,
// searched with cosine similarity. Real vector DBs (Chroma, pgvector)
// do the same thing, just faster and at larger scale.
import fs from "node:fs";
import path from "node:path";
import type { RawChunk } from "./chunk.js";

export type StoredChunk = RawChunk & { id: string; embedding: number[] };
export type SearchResult = StoredChunk & { score: number };

const STORE_PATH = path.join(process.cwd(), "storage", "vectors.json");

export function saveChunks(chunks: StoredChunk[]): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(chunks));
}

export function loadChunks(): StoredChunk[] {
  if (!fs.existsSync(STORE_PATH)) {
    throw new Error("No vector store found. Run `npm run ingest` first.");
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
}

// cosine similarity = dot(a, b) / (|a| * |b|), from -1 (opposite) to 1 (same meaning)
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function search(queryEmbedding: number[], topK = 3): SearchResult[] {
  return loadChunks()
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
