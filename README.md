# Mini Copilot

A small, beginner-friendly **RAG chatbot** in TypeScript. Upload your PDFs, Word files or notes, then ask questions in a chat UI and get answers **with citations** — built from scratch so you can see how every piece works.

Built as a study project for three ideas:

| Idea | What it means | Status |
| --- | --- | --- |
| **RAG** (Retrieval-Augmented Generation) | Find the most relevant text in your documents, then let an LLM answer from it | Done |
| **Agentic workflow** | The LLM decides which tools to call (search docs, query data) in a loop | Planned |
| **Adaptive UI** | The answer chooses its own shape: text, table or chart | Planned |

Everything is **free**: the LLM runs on [Groq](https://console.groq.com)'s free tier, and the search is pure JavaScript.

---

## Features

- Chat in the browser with answers that cite their sources
- **Upload PDF, Word (.docx), .txt and .md** files; they are indexed automatically
- "Show sources" reveals the exact chunks used and their similarity scores
- Refuses to guess: if the documents don't contain the answer, it says so
- A hand-written vector store (JSON + cosine similarity) — no database to install
- No build tools and no native binaries: plain Node.js, `tsc`, and React from a CDN

## How it works

```
INDEXING (on upload or `npm run ingest`)
  file (PDF / DOCX / MD / TXT)
    -> extract text           lib/extract.ts
    -> split into chunks      lib/chunk.ts        (~200 words, 40-word overlap)
    -> turn into vectors      lib/embeddings.ts   (TF-IDF)
    -> save                   lib/vectorStore.ts  (storage/vectors.json)

ANSWERING (every question)
  question
    -> vector                 lib/embeddings.ts
    -> top 3 similar chunks   lib/vectorStore.ts  (cosine similarity)
    -> prompt with sources    lib/rag.ts
    -> LLM answer + [n]       lib/llm.ts          (any OpenAI-compatible API)
```

## Quick start

**Requirements:** Node.js 20+ and a free Groq API key.

```bash
git clone https://github.com/Pavithravignesh/mini-copilot.git
cd mini-copilot
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Open `.env` and paste your key from [console.groq.com/keys](https://console.groq.com/keys) into `LLM_API_KEY`.

```bash
npm run ingest              # index the sample documents in data/
npm start                   # open http://localhost:3000
```

Or ask from the terminal:

```bash
npm run ask -- "What are the Platinum benefits?"
```

## Try it

The `data/` folder holds sample documents for a fictional **Acme Store**. Try:

- "How long can I return headphones?" → 15 days (electronics)
- "Do loyalty points expire?" → 12 months without a purchase
- "Can I pay with bitcoin?" → "I could not find that in the documents."

Then upload your own PDF or Word file with the **Upload** button and ask about it.

## Project structure

```
mini-copilot/
├── data/                 # documents to search (samples + your uploads)
├── lib/
│   ├── extract.ts        # PDF / DOCX / text -> plain text
│   ├── chunk.ts          # text -> chunks
│   ├── embeddings.ts     # chunks -> TF-IDF vectors
│   ├── vectorStore.ts    # save, load and search vectors
│   ├── ingest.ts         # the full indexing pipeline
│   ├── llm.ts            # OpenAI-compatible client (Groq by default)
│   └── rag.ts            # retrieve -> augment -> generate
├── scripts/
│   ├── server.ts         # web server + API (Node's built-in http)
│   ├── ingest.ts         # npm run ingest
│   └── ask.ts            # npm run ask
├── public/               # chat UI (React via CDN, no build step)
├── tools/push.mjs        # push to GitHub via `gh api` when git.exe is unavailable
└── storage/              # generated index (git-ignored)
```

## API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/api/chat` | `{ "question": "..." }` | `{ answer, sources[] }` |
| `GET` | `/api/documents` | — | `{ documents[] }` |
| `POST` | `/api/documents?name=file.pdf` | raw file bytes (max 20 MB) | `{ documents[], stats }` |
| `DELETE` | `/api/documents?name=file.pdf` | — | `{ documents[], stats }` |

## Switching LLM provider

`lib/llm.ts` uses the OpenAI-compatible API format, so changing provider is a `.env` edit:

| Provider | `LLM_BASE_URL` | Example `LLM_MODEL` |
| --- | --- | --- |
| Groq (default, free) | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` |
| Google Gemini (free tier) | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.5-flash` |
| Ollama (local) | `http://localhost:11434/v1` | `qwen2.5:7b` |

## About the search (TF-IDF)

Embeddings here are **TF-IDF** vectors: each dimension is a word, weighted by how rare it is across all chunks. They are easy to understand and need no API, but they match **words, not meaning** — "invalid" will not find "expire". To upgrade to semantic search, replace `embed()` in `lib/embeddings.ts` with a call to an embeddings API; nothing else needs to change.

## Roadmap

- [x] Step 1 — RAG in the terminal
- [x] Step 2 — Chat UI in the browser
- [x] Document upload (PDF, Word, text)
- [ ] Step 3 — Agent with tools (search docs, query a sales CSV)
- [ ] Step 4 — Adaptive UI (the agent returns tables and charts)
- [ ] Streaming answers and chat memory

## Tech

TypeScript · Node.js `http` · React 18 (CDN) · [openai](https://www.npmjs.com/package/openai) SDK · [unpdf](https://www.npmjs.com/package/unpdf) · [mammoth](https://www.npmjs.com/package/mammoth) · Groq
