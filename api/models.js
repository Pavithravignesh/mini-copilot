// Vercel serverless function: GET /api/models -> { models, default } (the allowlist in lib/models.ts)
import { api } from "../dist/lib/api.js";

export default async function handler(req, res) {
  const { status, body } = await api.models();
  res.status(status).json(body);
}
