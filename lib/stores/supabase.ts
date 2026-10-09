// Production store: Supabase Postgres + pgvector for chunks, Supabase Storage for the files.
// Tables, search function and bucket are created by supabase/schema.sql.
// Uses the SECRET key, so this file must only ever run on the server.
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import type { Store } from "../store.js";

export const BUCKET = "documents";

export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
  realtime: { transport: ws as any }, // Node 20 has no built-in WebSocket; we don't use realtime, but the client needs one
});

function check<T>(result: { data: T | null; error: { message: string } | null }, action: string): T {
  if (result.error) throw new Error(`Supabase ${action} failed: ${result.error.message}`);
  if (result.data === null) throw new Error(`Supabase ${action} returned no data`);
  return result.data;
}

export const supabaseStore: Store = {
  mode: "supabase",

  async listDocuments() {
    const rows = check(await supabase.from("documents").select("name").order("name"), "list");
    return rows.map((r) => r.name);
  },

  async saveDocument(name, chunks) {
    // Replace: deleting the document also deletes its chunks (on delete cascade)
    const removed = await supabase.from("documents").delete().eq("name", name);
    if (removed.error) throw new Error(`Supabase delete old document failed: ${removed.error.message}`);
    const doc = check<{ id: number }>(await supabase.from("documents").insert({ name }).select("id").single(), "insert document");

    const rows = chunks.map((c) => ({ document_id: doc.id, heading: c.heading, content: c.text, embedding: c.embedding }));
    for (let i = 0; i < rows.length; i += 100) {
      const inserted = await supabase.from("chunks").insert(rows.slice(i, i + 100));
      if (inserted.error) throw new Error(`Supabase insert chunks failed: ${inserted.error.message}`);
    }
  },

  async deleteDocument(name) {
    const removed = await supabase.from("documents").delete().eq("name", name);
    if (removed.error) throw new Error(`Supabase delete document failed: ${removed.error.message}`);
    await supabase.storage.from(BUCKET).remove([name]); // sample docs have no stored file; that's fine
  },

  async search(queryEmbedding, topK) {
    const rows = check(
      await supabase.rpc("match_chunks", { query_embedding: queryEmbedding, match_count: topK }),
      "search",
    ) as { source: string; heading: string; content: string; score: number }[];
    return rows.map((r) => ({ source: r.source, heading: r.heading, text: r.content, score: r.score }));
  },

  async readUploadedFile(name) {
    const blob = check(await supabase.storage.from(BUCKET).download(name), "download file");
    return Buffer.from(await blob.arrayBuffer());
  },
};

// The browser uploads the file straight to Storage with this one-time URL, so big files
// never pass through Vercel (whose functions accept at most 4.5 MB per request).
export async function createUploadUrl(name: string): Promise<string> {
  const data = check(await supabase.storage.from(BUCKET).createSignedUploadUrl(name, { upsert: true }), "create upload URL");
  return data.signedUrl;
}
