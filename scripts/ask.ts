// Ask a question from the terminal.
// Run with: npm run ask -- "How long do I have to return a laptop?"
// Pick a model with MODEL=..., e.g. (PowerShell) $env:MODEL="openai/gpt-oss-20b"; npm run ask -- "..."
import { answerQuestion } from "../lib/rag.js";
import { resolveModel } from "../lib/models.js";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.log('Usage: npm run ask -- "your question"');
  process.exit(1);
}

const { answer, sources, model, seconds, tokens } = await answerQuestion(question, resolveModel(process.env.MODEL));

console.log("\nRetrieved chunks:");
for (const [i, s] of sources.entries()) {
  console.log(`  [${i + 1}] score ${s.score.toFixed(3)}  ${s.heading}`);
}
console.log(`\nAnswer (${model}, ${seconds.toFixed(1)}s, ${tokens ?? "?"} tokens):\n${answer}\n`);
