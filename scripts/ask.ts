// Ask a question from the terminal.
// Run with: npm run ask -- "How long do I have to return a laptop?"
import { answerQuestion } from "../lib/rag.js";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.log('Usage: npm run ask -- "your question"');
  process.exit(1);
}

const { answer, sources } = await answerQuestion(question);

console.log("\nRetrieved chunks:");
for (const [i, s] of sources.entries()) {
  console.log(`  [${i + 1}] score ${s.score.toFixed(3)}  ${s.heading}`);
}
console.log(`\nAnswer:\n${answer}\n`);
