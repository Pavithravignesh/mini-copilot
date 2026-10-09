// Vercel serverless function:
//   GET    /api/documents            -> { documents, uploadMode }
//   DELETE /api/documents?name=x.pdf -> remove a document
// Uploads on Vercel go through /api/upload-url + /api/index-document (Supabase).
import { api } from "../dist/lib/api.js";

export default async function handler(req, res) {
  const result =
    req.method === "GET" ? await api.listDocuments()
    : req.method === "DELETE" ? await api.deleteDocument(req.query.name)
    : { status: 405, body: { error: "Use GET or DELETE" } };
  res.status(result.status).json(result.body);
}
