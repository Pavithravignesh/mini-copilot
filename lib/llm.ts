// One client for any OpenAI-compatible provider (Groq, Gemini, Ollama, OpenAI).
// Switch providers by editing .env (or the host's environment variables) - no code changes.
// Which models may be used is decided in lib/models.ts.
import "dotenv/config";
import OpenAI from "openai";

const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
const LLM_API_KEY = process.env.LLM_API_KEY;

if (!LLM_API_KEY || LLM_API_KEY.startsWith("paste_")) {
  throw new Error("LLM_API_KEY is not set. Add it to .env locally, or to the host's environment variables.");
}

export const llm = new OpenAI({ baseURL: LLM_BASE_URL, apiKey: LLM_API_KEY });
