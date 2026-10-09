// A tiny web server using only Node's built-in http module (no Express, no native binaries).
//   GET    /                        -> public/index.html (the chat page)
//   POST   /api/chat                -> { question } in, { answer, sources } out
//   GET    /api/documents           -> list of files in data/
//   POST   /api/documents?name=x.pdf -> raw file bytes in; saved to data/ and re-indexed
//   DELETE /api/documents?name=x.pdf -> removes the file and re-indexes
// Run with: npm start   then open http://localhost:3000
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { answerQuestion } from "../lib/rag.js";
import { DATA_DIR, ingestAll, listDocuments } from "../lib/ingest.js";
import { SUPPORTED_EXTENSIONS } from "../lib/extract.js";

const PORT = Number(process.env.PORT ?? 3000);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
const PUBLIC_DIR = path.join(process.cwd(), "public");
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage): Promise<any> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}

async function readBytes(req: http.IncomingMessage): Promise<Buffer> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 20 MB");
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}

// Keep only a safe file name (no folders, no odd characters) with a supported extension
function safeFileName(name: string | null): string {
  const base = path.basename(name ?? "").replace(/[^\w.\- ]/g, "_");
  if (!base || !SUPPORTED_EXTENSIONS.includes(path.extname(base).toLowerCase())) {
    throw new Error(`Only ${SUPPORTED_EXTENSIONS.join(", ")} files are supported`);
  }
  return base;
}

function documentsResponse(res: http.ServerResponse, extra: object = {}) {
  sendJson(res, 200, { documents: listDocuments(), ...extra });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (url.pathname === "/api/documents") {
      if (req.method === "GET") return documentsResponse(res);

      if (req.method === "POST") {
        const name = safeFileName(url.searchParams.get("name"));
        fs.writeFileSync(path.join(DATA_DIR, name), await readBytes(req));
        try {
          const stats = await ingestAll();
          return documentsResponse(res, { uploaded: name, stats });
        } catch (err) {
          fs.rmSync(path.join(DATA_DIR, name)); // unreadable file: remove it so indexing keeps working
          throw new Error(`Could not read ${name}: ${err instanceof Error ? err.message : err}`);
        }
      }

      if (req.method === "DELETE") {
        const name = safeFileName(url.searchParams.get("name"));
        fs.rmSync(path.join(DATA_DIR, name), { force: true });
        const stats = await ingestAll();
        return documentsResponse(res, { deleted: name, stats });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const { question } = await readJson(req);
      if (typeof question !== "string" || !question.trim()) {
        return sendJson(res, 400, { error: "question is required" });
      }
      const { answer, sources } = await answerQuestion(question.trim());
      // Send only what the UI needs - not the embedding vectors
      return sendJson(res, 200, {
        answer,
        sources: sources.map((s) => ({ heading: s.heading, source: s.source, score: s.score, text: s.text })),
      });
    }

    if (req.method === "GET") {
      const urlPath = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
      if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath)) {
        res.writeHead(200, { "Content-Type": CONTENT_TYPES[path.extname(filePath)] ?? "text/plain" });
        return fs.createReadStream(filePath).pipe(res);
      }
    }

    sendJson(res, 404, { error: "not found" });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err instanceof Error ? err.message : "server error" });
  }
});

server.listen(PORT, () => console.log(`Mini Copilot running at http://localhost:${PORT}`));
