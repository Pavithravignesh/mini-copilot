// Index every document in data/ into the active store (local JSON, or Supabase when configured).
// Run with: npm run ingest
import { indexDataFolder } from "../lib/ingest.js";
import { getStore } from "../lib/store.js";

const results = await indexDataFolder();
for (const r of results) console.log(`  ${r.name}: ${r.chunks} chunks`);
console.log(`Indexed ${results.length} files into the ${(await getStore()).mode} store`);
