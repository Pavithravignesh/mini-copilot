// Vercel serverless function: POST /api/chat { question, model?, document? } -> { answer, sources, model, document, seconds, tokens }
// All logic lives in lib/api.ts (compiled to dist/ by `npm run vercel-build`).
import { api } from "../dist/lib/api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { status, body } = await api.chat(req.body?.question, req.body?.model, req.body?.document, req.body?.style);
  res.status(status).json(body);
}
