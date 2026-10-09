// Vercel serverless function: POST /api/index-document { name }
// Reads the uploaded file from Supabase Storage, chunks + embeds it, saves the chunks to pgvector.
import { api } from "../dist/lib/api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { status, body } = await api.indexUploaded(req.body?.name);
  res.status(status).json(body);
}
