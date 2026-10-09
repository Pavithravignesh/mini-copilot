// One client for any OpenAI-compatible provider (Groq, Gemini, Ollama, OpenAI).
// Switch providers by editing .env - no code changes.
import "dotenv/config";
import OpenAI from "openai";

const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } = process.env;

if (!LLM_BASE_URL || !LLM_API_KEY || !LLM_MODEL || LLM_API_KEY.startsWith("paste_")) {
  throw new Error("Missing settings. Open .env and paste your API key into LLM_API_KEY.");
}

export const llm = new OpenAI({ baseURL: LLM_BASE_URL, apiKey: LLM_API_KEY });
export const MODEL = LLM_MODEL;
