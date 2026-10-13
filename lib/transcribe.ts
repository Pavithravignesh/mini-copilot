// Speech -> text with Whisper, through the same OpenAI-compatible client (Groq hosts Whisper for free).
import { toFile } from "openai";

const STT_MODEL = process.env.STT_MODEL || "whisper-large-v3-turbo";
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // ~4 MB keeps us under Vercel's 4.5 MB request limit (minutes of speech)

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/aac": "m4a",
};

export async function transcribe(audio: Buffer, mimeType: string): Promise<{ text: string; seconds: number }> {
  if (audio.length < 1000) throw Object.assign(new Error("The recording was empty. Hold the mic a bit longer."), { status: 400 });
  const type = mimeType.split(";")[0].trim().toLowerCase();
  const ext = EXTENSIONS[type];
  if (!ext) throw Object.assign(new Error(`Unsupported audio format: ${type || "unknown"}`), { status: 400 });

  const { llm } = await import("./llm.js");
  const started = Date.now();
  const result = await llm.audio.transcriptions.create({
    file: await toFile(audio, `speech.${ext}`, { type }),
    model: STT_MODEL,
    response_format: "json",
    temperature: 0,
  });
  return { text: (result.text ?? "").trim(), seconds: (Date.now() - started) / 1000 };
}
