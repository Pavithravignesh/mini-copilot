// Vercel serverless function: POST /api/chat { question, model? } -> { answer, sources, model, seconds, tokens }
// All logic lives in lib/api.ts (compiled to dist/ by `npm run vercel-build`).
import { api } from "../dist/lib/api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { status, body } = await api.chat(req.body?.question, req.body?.model);
  res.status(status).json(body);
}
