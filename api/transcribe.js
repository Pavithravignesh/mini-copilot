// Vercel serverless function: POST /api/transcribe (raw audio bytes, Content-Type: audio/webm etc.) -> { text, seconds }
import { api } from "../dist/lib/api.js";

// Read the raw request body (audio), whether or not Vercel already buffered it
async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const parts = [];
  for await (const chunk of req) parts.push(chunk);
  return Buffer.concat(parts);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { status, body } = await api.transcribe(await rawBody(req), req.headers["content-type"]);
  res.status(status).json(body);
}
