// Vercel serverless function: POST /api/web { question, model? } -> { answer, sources, provider, query, model, seconds, tokens }
// Called only after the user agrees to search the internet.
import { api } from "../dist/lib/api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { status, body } = await api.webAnswer(req.body?.question, req.body?.model);
  res.status(status).json(body);
}
