// Vercel serverless function: POST /api/chat { question } -> { answer, sources }
// All logic lives in lib/api.ts (compiled to dist/ by `npm run vercel-build`).
import { api } from "../dist/lib/api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { status, body } = await api.chat(req.body?.question);
  res.status(status).json(body);
}
