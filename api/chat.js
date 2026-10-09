// Vercel serverless function: POST /api/chat  { question } -> { answer, sources }
// Locally, scripts/server.ts serves the same route. Vercel runs `npm run vercel-build` first,
// which compiles lib/ to dist/ and builds the search index into storage/.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question) return res.status(400).json({ error: "question is required" });

    // Imported inside try so a missing API key comes back as a readable JSON error
    const { answerQuestion } = await import("../dist/lib/rag.js");
    const { answer, sources } = await answerQuestion(question);
    res.status(200).json({
      answer,
      sources: sources.map((s) => ({ heading: s.heading, source: s.source, score: s.score, text: s.text })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : "server error" });
  }
}
