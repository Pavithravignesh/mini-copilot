// Turns text into vectors using TF-IDF - pure JavaScript, no API, no key.
//
// TF  (term frequency):          how often a word appears in this text
// IDF (inverse doc frequency):   rare words across all chunks count more ("expire" > "the")
// vector[i] = TF(word i) * IDF(word i), then scaled to length 1
//
// Unlike neural embeddings, TF-IDF matches WORDS, not meaning: "expire" and
// "invalid" are unrelated to it. To upgrade later, replace this file with an
// embeddings API call - nothing else needs to change.
import fs from "node:fs";
import path from "node:path";

type TfidfModel = { vocabulary: string[]; idf: number[] };

const MODEL_PATH = path.join(process.cwd(), "storage", "tfidf-model.json");

let model: TfidfModel | null = null;

const STOP_WORDS = new Set(
  ("a an and are as at be by can do does for from has have how i if in is it its of on or " +
    "that the their them they this to was what when where which who will with you your").split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)); // tiny stemmer: "points" -> "point"
}

// Learn the vocabulary and IDF weights from all chunks (run once, at ingest time).
export function fitModel(texts: string[]): void {
  const docFreq = new Map<string, number>();
  for (const text of texts) {
    for (const word of new Set(tokenize(text))) {
      docFreq.set(word, (docFreq.get(word) ?? 0) + 1);
    }
  }
  const vocabulary = [...docFreq.keys()].sort();
  const idf = vocabulary.map((w) => Math.log((1 + texts.length) / (1 + docFreq.get(w)!)) + 1);

  model = { vocabulary, idf }; // replace the in-memory copy so a running server uses the new vocabulary
  fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  fs.writeFileSync(MODEL_PATH, JSON.stringify(model));
}

export async function embed(texts: string[]): Promise<number[][]> {
  model ??= JSON.parse(fs.readFileSync(MODEL_PATH, "utf8")) as TfidfModel;
  const index = new Map(model.vocabulary.map((w, i) => [w, i]));

  return texts.map((text) => {
    const vector = new Array<number>(model!.vocabulary.length).fill(0);
    for (const word of tokenize(text)) {
      const i = index.get(word);
      if (i !== undefined) vector[i] += model!.idf[i]; // words not in the vocabulary are ignored
    }
    const length = Math.hypot(...vector) || 1;
    return vector.map((v) => v / length);
  });
}
