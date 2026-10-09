// Vercel serverless function: GET /api/documents -> the documents baked in at deploy time.
// Uploads are disabled on Vercel: its filesystem is read-only, so a saved file would vanish.
// Run the app locally (npm start) to upload documents.
import { listDocuments } from "../dist/lib/ingest.js";

export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ documents: listDocuments(), uploadsEnabled: false });
  }
  res.status(501).json({
    error: "Uploads are not available on the hosted demo (read-only storage). Run the app locally to upload files.",
  });
}
