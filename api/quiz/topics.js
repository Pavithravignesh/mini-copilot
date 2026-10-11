// Vercel serverless function: POST /api/quiz/topics { name, model? } -> { name, topics }
import { api } from "../../dist/lib/api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { status, body } = await api.quizTopics(req.body?.name, req.body?.model);
  res.status(status).json(body);
}
