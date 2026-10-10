// The models users can pick in the UI. The server only accepts models on this list,
// so visitors to the public site can't call any model they like with your API key.
// Override with LLM_MODELS="id1,id2" in .env / Vercel (labels then default to the id).
import "dotenv/config";

export type ModelOption = { id: string; label: string; note: string };

const DEFAULT_MODELS: ModelOption[] = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", note: "OpenAI open-weight · best quality" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", note: "OpenAI open-weight · faster" },
  { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B", note: "Alibaba Qwen" },
];

export const MODELS: ModelOption[] = process.env.LLM_MODELS
  ? process.env.LLM_MODELS.split(",").map((id) => id.trim()).filter(Boolean).map(
      (id) => DEFAULT_MODELS.find((m) => m.id === id) ?? { id, label: id, note: "" },
    )
  : DEFAULT_MODELS;

export const DEFAULT_MODEL = MODELS.some((m) => m.id === process.env.LLM_MODEL)
  ? process.env.LLM_MODEL!
  : MODELS[0].id;

// Returns an allowed model id, or the default when none was asked for
export function resolveModel(requested: unknown): string {
  if (requested === undefined || requested === null || requested === "") return DEFAULT_MODEL;
  if (typeof requested === "string" && MODELS.some((m) => m.id === requested)) return requested;
  throw Object.assign(new Error(`Model not allowed: ${String(requested)}`), { status: 400 });
}
