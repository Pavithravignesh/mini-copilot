// Vercel serverless function: POST /api/quiz/generate { name, topic, count, model? } -> { topic, questions, sources }
import { api } from "../../dist/lib/api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const b = req.body ?? {};
  const { status, body } = await api.quizGenerate(b.name, b.topic, b.count, b.model);
  res.status(status).json(body);
}
