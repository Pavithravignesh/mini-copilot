// Indexing from the terminal: npm run ingest
import { ingestAll } from "../lib/ingest.js";

const { files, chunks, dimensions } = await ingestAll();
console.log(`Indexed ${files} files -> ${chunks} chunks (${dimensions} dimensions each)`);
