// Vercel serverless function: POST /api/quiz/grade { question, answer, userAnswer, source, model? } -> { verdict, feedback }
import { api } from "../../dist/lib/api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const { status, body } = await api.quizGrade(req.body, req.body?.model);
  res.status(status).json(body);
}
