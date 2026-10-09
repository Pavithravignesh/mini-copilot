// Turns text into fixed-size vectors with the "hashing trick" - pure JavaScript, no API, no key.
//
// Each word is hashed to one of DIMENSIONS slots; the slot gets a weight that grows with how
// often the word appears (1 + log(count)). The vector is then scaled to length 1, so cosine
// similarity = how much two texts share the same words.
//
// Why hashing instead of a vocabulary (TF-IDF)? A vocabulary grows with every new document,
// which changes the vector size. A database column needs ONE fixed size: vector(1024).
//
// Like TF-IDF, this matches WORDS, not meaning: "expire" and "invalid" are unrelated to it.
// To upgrade later, replace embed() with an embeddings API (and change 1024 in schema.sql).

export const DIMENSIONS = 1024;

const STOP_WORDS = new Set(
  ("a an and are as at be by can do does for from has have how i if in is it its of on or " +
    "that the their them they this to was what when where which who will with you your").split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem);
}

// Tiny stemmer so word forms match: "returned", "returning", "returns" -> "return"
function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

// FNV-1a: a small, fast string hash. Same word -> same number, every time.
function hash(word: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function embedOne(text: string): number[] {
  const counts = new Map<number, number>();
  for (const word of tokenize(text)) {
    const h = hash(word);
    const slot = h % DIMENSIONS;
    const sign = h & 0x80000000 ? -1 : 1; // a random-looking sign stops colliding words from always adding up
    counts.set(slot, (counts.get(slot) ?? 0) + sign);
  }

  const vector = new Array<number>(DIMENSIONS).fill(0);
  for (const [slot, count] of counts) {
    vector[slot] = Math.sign(count) * (1 + Math.log(Math.abs(count) || 1));
  }
  const length = Math.hypot(...vector) || 1;
  return vector.map((v) => v / length);
}

export async function embed(texts: string[]): Promise<number[][]> {
  return texts.map(embedOne);
}
