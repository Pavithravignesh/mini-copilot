// Where chunks and vectors live. Two interchangeable stores:
//   - local:    storage/vectors.json + files in data/   (no setup, laptop only)
//   - supabase: Postgres + pgvector + Storage bucket     (works on Vercel / production)
// The app uses Supabase when SUPABASE_URL and SUPABASE_SECRET_KEY are set.
import "dotenv/config";
import type { RawChunk } from "./chunk.js";

export type StoredChunk = RawChunk & { embedding: number[] };
export type SearchResult = RawChunk & { score: number };

export interface Store {
  mode: "local" | "supabase";
  listDocuments(): Promise<string[]>;
  saveDocument(name: string, chunks: StoredChunk[]): Promise<void>; // replaces any document with the same name
  deleteDocument(name: string): Promise<void>;
  search(queryEmbedding: number[], topK: number): Promise<SearchResult[]>;
  readUploadedFile(name: string): Promise<Buffer>; // the original file, for (re)indexing
}

let store: Store | null = null;

export async function getStore(): Promise<Store> {
  if (!store) {
    store = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
      ? (await import("./stores/supabase.js")).supabaseStore
      : (await import("./stores/local.js")).localStore;
  }
  return store;
}
