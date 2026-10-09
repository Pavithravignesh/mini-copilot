// Splits a document into small chunks for embedding.
// Strategy: for markdown, split by "## " headings first (each section is one idea);
// for plain text (PDF, Word, .txt) treat the whole file as one section.
// Then split long sections by word count with a small overlap.

export type RawChunk = {
  source: string; // file name, e.g. "returns-policy.md"
  heading: string; // e.g. "Acme Store Returns Policy > Refunds"
  text: string;
};

const MAX_WORDS = 200;
const OVERLAP_WORDS = 40;

export function chunkDocument(source: string, content: string): RawChunk[] {
  const title = content.match(/^# (.+)$/m)?.[1]?.trim() ?? source;
  const hasSections = /^## /m.test(content);

  const sections = hasSections
    ? content.split(/^## /m).slice(1).map((section) => {
        const [firstLine, ...rest] = section.split("\n");
        return { heading: `${title} > ${firstLine.trim()}`, body: rest.join(" ") };
      })
    : [{ heading: title, body: content }];

  const chunks: RawChunk[] = [];
  for (const { heading, body } of sections) {
    const words = body.split(/\s+/).filter(Boolean);
    for (let start = 0; start < words.length; start += MAX_WORDS - OVERLAP_WORDS) {
      const part = words.slice(start, start + MAX_WORDS);
      // label parts of long plain-text documents so citations stay readable
      const label = !hasSections && words.length > MAX_WORDS ? `${heading} (part ${chunks.length + 1})` : heading;
      chunks.push({ source, heading: label, text: part.join(" ") });
      if (start + MAX_WORDS >= words.length) break;
    }
  }
  return chunks;
}
