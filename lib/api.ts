// The app's API, written once and used by both the local server (scripts/server.ts)
// and the Vercel serverless functions (api/*.js). Each handler returns { status, body }.
import fs from "node:fs";
import path from "node:path";
import { answerQuestion } from "./rag.js";
import { DATA_DIR, indexDocument } from "./ingest.js";
import { safeFileName } from "./extract.js";
import { getStore } from "./store.js";
import { DEFAULT_MODEL, MODELS, resolveModel } from "./models.js";

export type ApiResult = { status: number; body: unknown };

const MAX_DOCUMENTS = 50; // the app is public: cap how much anyone can upload

// How the browser should upload:
//   "supabase" -> ask for a signed URL, PUT the file to Supabase Storage, then call index
//   "local"    -> POST the file bytes to this server, which saves it in data/
//   "disabled" -> no persistent storage (Vercel without Supabase)
async function uploadMode() {
  const store = await getStore();
  if (store.mode === "supabase") return "supabase";
  return process.env.VERCEL ? "disabled" : "local";
}

const ok = (body: unknown): ApiResult => ({ status: 200, body });
const fail = (status: number, error: string): ApiResult => ({ status, body: { error } });

async function documentsBody(extra: object = {}) {
  const store = await getStore();
  return { documents: await store.listDocuments(), uploadMode: await uploadMode(), ...extra };
}

async function checkRoomFor(name: string) {
  const docs = await (await getStore()).listDocuments();
  if (!docs.includes(name) && docs.length >= MAX_DOCUMENTS) {
    throw Object.assign(new Error(`Limit of ${MAX_DOCUMENTS} documents reached. Remove one first.`), { status: 400 });
  }
}

export async function handle(fn: () => Promise<ApiResult>): Promise<ApiResult> {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    const status = (err as { status?: number }).status ?? 500;
    return fail(status, err instanceof Error ? err.message : "server error");
  }
}

export const api = {
  chat: (question: unknown, model?: unknown) =>
    handle(async () => {
      if (typeof question !== "string" || !question.trim()) return fail(400, "question is required");
      return ok(await answerQuestion(question.trim(), resolveModel(model)));
    }),

  models: () => handle(async () => ok({ models: MODELS, default: DEFAULT_MODEL })),

  listDocuments: () => handle(async () => ok(await documentsBody())),

  // Supabase mode, step 1: a one-time URL the browser uploads the file to
  uploadUrl: (rawName: unknown) =>
    handle(async () => {
      if ((await uploadMode()) !== "supabase") return fail(400, "Direct upload needs Supabase");
      const name = safeFileName(rawName);
      await checkRoomFor(name);
      const { createUploadUrl } = await import("./stores/supabase.js");
      return ok({ name, uploadUrl: await createUploadUrl(name) });
    }),

  // Supabase mode, step 2: the file is in Storage; read it and index it
  indexUploaded: (rawName: unknown) =>
    handle(async () => {
      const name = safeFileName(rawName);
      const store = await getStore();
      const result = await indexDocument(name, await store.readUploadedFile(name));
      return ok(await documentsBody({ indexed: result }));
    }),

  // Local mode: the file bytes come straight to this server
  uploadLocal: (rawName: unknown, bytes: Buffer) =>
    handle(async () => {
      if ((await uploadMode()) !== "local") return fail(400, "Uploads are not available here");
      const name = safeFileName(rawName);
      await checkRoomFor(name);
      const filePath = path.join(DATA_DIR, name);
      fs.writeFileSync(filePath, bytes);
      try {
        const result = await indexDocument(name, bytes);
        return ok(await documentsBody({ indexed: result }));
      } catch (err) {
        fs.rmSync(filePath, { force: true }); // unreadable file: don't keep it
        throw err;
      }
    }),

  deleteDocument: (rawName: unknown) =>
    handle(async () => {
      if ((await uploadMode()) === "disabled") return fail(400, "Deleting is not available here");
      const name = safeFileName(rawName);
      await (await getStore()).deleteDocument(name);
      return ok(await documentsBody({ deleted: name }));
    }),
};
