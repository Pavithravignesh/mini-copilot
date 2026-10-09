// Vercel serverless function: POST /api/upload-url { name } -> { name, uploadUrl }
// The browser then PUTs the file directly to Supabase Storage with uploadUrl.
import { api } from "../dist/lib/api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { status, body } = await api.uploadUrl(req.body?.name);
  res.status(status).json(body);
}
