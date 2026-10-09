// A tiny web server using only Node's built-in http module (no Express, no native binaries).
// Routes (same as the Vercel functions in api/):
//   POST   /api/chat                    { question }  -> { answer, sources }
//   GET    /api/documents                              -> { documents, uploadMode }
//   POST   /api/documents?name=x.pdf     raw bytes     -> local mode upload
//   DELETE /api/documents?name=x.pdf                   -> remove a document
//   POST   /api/upload-url              { name }      -> Supabase mode: signed upload URL
//   POST   /api/index-document          { name }      -> Supabase mode: index the uploaded file
// Run with: npm start   then open http://localhost:3000
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { api, type ApiResult } from "../lib/api.js";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = path.join(process.cwd(), "public");
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB, same as the Supabase bucket limit
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

async function readBytes(req: http.IncomingMessage): Promise<Buffer> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 10 MB");
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}

const readJson = async (req: http.IncomingMessage) => JSON.parse((await readBytes(req)).toString() || "{}");

function send(res: http.ServerResponse, { status, body }: ApiResult) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function route(req: http.IncomingMessage, url: URL): Promise<ApiResult | null> {
  const name = url.searchParams.get("name");
  switch (`${req.method} ${url.pathname}`) {
    case "POST /api/chat":
      return api.chat((await readJson(req)).question);
    case "GET /api/documents":
      return api.listDocuments();
    case "POST /api/documents":
      return api.uploadLocal(name, await readBytes(req));
    case "DELETE /api/documents":
      return api.deleteDocument(name);
    case "POST /api/upload-url":
      return api.uploadUrl((await readJson(req)).name);
    case "POST /api/index-document":
      return api.indexUploaded((await readJson(req)).name);
    default:
      return null;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const result = await route(req, url);
    if (result) return send(res, result);

    if (req.method === "GET") {
      const filePath = path.join(PUBLIC_DIR, path.normalize(url.pathname === "/" ? "/index.html" : url.pathname));
      if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { "Content-Type": CONTENT_TYPES[path.extname(filePath)] ?? "text/plain" });
        return fs.createReadStream(filePath).pipe(res);
      }
    }
    send(res, { status: 404, body: { error: "not found" } });
  } catch (err) {
    console.error(err);
    send(res, { status: 500, body: { error: err instanceof Error ? err.message : "server error" } });
  }
});

server.listen(PORT, async () => {
  const { getStore } = await import("../lib/store.js");
  console.log(`Mini Copilot running at http://localhost:${PORT} (store: ${(await getStore()).mode})`);
});
