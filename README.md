# Mini Copilot

A small, beginner-friendly **RAG chatbot** in TypeScript. Upload your PDFs, Word files or notes, then ask questions in a chat UI and get answers **with citations** — built from scratch so you can see how every piece works.

**Live demo:** https://mini-copilot-iota.vercel.app

Built as a study project for three ideas:

| Idea | What it means | Status |
| --- | --- | --- |
| **RAG** (Retrieval-Augmented Generation) | Find the most relevant text in your documents, then let an LLM answer from it | Done |
| **Agentic workflow** | The LLM decides which tools to call (search docs, query data) in a loop | Planned |
| **Adaptive UI** | The answer chooses its own shape: text, table or chart | Planned |

Everything runs on **free tiers**: [Groq](https://console.groq.com) for the LLM, [Supabase](https://supabase.com) for storage and vector search, [Vercel](https://vercel.com) for hosting.

---

## Features

- Chat in the browser with answers that cite their sources
- **Upload PDF, Word (.docx), .txt and .md** files (up to 10 MB); they are indexed automatically
- **Model picker**: switch between GPT-OSS 120B, GPT-OSS 20B and Qwen 3.8 27B; each answer shows the model, time and tokens used
- "Show sources" reveals the exact chunks used and their similarity scores
- Refuses to guess: if the documents don't contain the answer, it says so
- Two interchangeable vector stores: a **local JSON file** (zero setup) or **Supabase pgvector** (production)
- No build tools and no native binaries: plain Node.js, `tsc`, and React from a CDN

## How it works

```
INDEXING (on upload or `npm run ingest`)
  file (PDF / DOCX / MD / TXT)
    -> extract text           lib/extract.ts
    -> split into chunks      lib/chunk.ts        (~200 words, 40-word overlap)
    -> turn into vectors      lib/embeddings.ts   (hashing trick, 1024 numbers)
    -> save                   lib/store.ts        (local JSON  or  Supabase pgvector)

ANSWERING (every question)
  question
    -> vector                 lib/embeddings.ts
    -> top 3 similar chunks   lib/store.ts        (cosine similarity)
    -> prompt with sources    lib/rag.ts
    -> LLM answer + [n]       lib/llm.ts          (any OpenAI-compatible API)
```

### Uploads in production

Vercel functions have a read-only disk and accept at most 4.5 MB per request, so uploads go around them:

```
browser --1. POST /api/upload-url------------> Vercel   (returns a one-time Supabase URL)
browser --2. PUT file------------------------> Supabase Storage (direct, up to 10 MB)
browser --3. POST /api/index-document--------> Vercel   (downloads file, chunks, embeds)
                                                  └----> Supabase Postgres (chunks + vectors)
```

## Quick start (local)

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

## Supabase setup (uploads in production)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste [`supabase/schema.sql`](supabase/schema.sql) → **Run**. This creates the `documents` and `chunks` tables, the `match_chunks` search function and a private `documents` storage bucket.
3. **Project Settings → API Keys**: copy the **Project URL** and the **secret key**.
4. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to `.env` (local) and to **Vercel → Settings → Environment Variables** (production), next to `LLM_API_KEY`.
5. Run `npm run ingest` to load the sample docs into Supabase, then redeploy on Vercel.

The secret key bypasses row-level security, so it is only used on the server. The tables have RLS on with no policies, so the public cannot read them directly.

## Try it

The `data/` folder holds sample documents for a fictional **Acme Store**. Try:

- "Do loyalty points expire?" → 12 months without a purchase
- "How much is express delivery?" → $14.99, 1–2 business days
- "Can I pay with bitcoin?" → "I could not find that in the documents."

Then upload your own PDF or Word file with the **Upload** button and ask about it.

## Project structure

```
mini-copilot/
├── api/                  # Vercel serverless functions (thin wrappers around lib/api.ts)
├── data/                 # sample documents (local uploads land here too, git-ignored)
├── lib/
│   ├── api.ts            # the API handlers, shared by the local server and Vercel
│   ├── extract.ts        # PDF / DOCX / text -> plain text
│   ├── chunk.ts          # text -> chunks
│   ├── embeddings.ts     # chunks -> vectors (hashing trick)
│   ├── store.ts          # picks the local or Supabase store
│   ├── stores/local.ts   # JSON file + cosine similarity in JavaScript
│   ├── stores/supabase.ts# Postgres + pgvector + Storage
│   ├── ingest.ts         # the full indexing pipeline
│   ├── llm.ts            # OpenAI-compatible client (Groq by default)
│   └── rag.ts            # retrieve -> augment -> generate
├── scripts/
│   ├── server.ts         # local web server (Node's built-in http)
│   ├── ingest.ts         # npm run ingest
│   └── ask.ts            # npm run ask
├── public/               # chat UI (React via CDN, no build step)
├── supabase/schema.sql   # database setup
├── tools/push.mjs        # push to GitHub via `gh api` when git.exe is unavailable
└── storage/              # local index (git-ignored)
```

## API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/api/chat` | `{ "question": "...", "model"?: "..." }` | `{ answer, sources[], model, seconds, tokens }` |
| `GET` | `/api/models` | — | `{ models[], default }` |
| `GET` | `/api/documents` | — | `{ documents[], uploadMode }` |
| `DELETE` | `/api/documents?name=file.pdf` | — | `{ documents[], deleted }` |
| `POST` | `/api/upload-url` | `{ "name": "file.pdf" }` | `{ name, uploadUrl }` (Supabase) |
| `POST` | `/api/index-document` | `{ "name": "file.pdf" }` | `{ documents[], indexed }` (Supabase) |
| `POST` | `/api/documents?name=file.pdf` | raw file bytes | `{ documents[], indexed }` (local only) |

`uploadMode` is `supabase`, `local` (laptop, no Supabase) or `disabled` (Vercel without Supabase).

## Switching LLM provider

`lib/llm.ts` uses the OpenAI-compatible API format, so changing provider is a `.env` edit:

| Provider | `LLM_BASE_URL` | Example `LLM_MODEL` |
| --- | --- | --- |
| Groq (default, free) | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` |
| Google Gemini (free tier) | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.5-flash` |
| Ollama (local) | `http://localhost:11434/v1` | `qwen2.5:7b` |

### Choosing which models the UI offers

The picker lists the models in [`lib/models.ts`](lib/models.ts). The server rejects any model not on that list, so visitors can't use your key for other models. To change the list without editing code, set `LLM_MODELS` (comma-separated ids) in `.env` or on Vercel; `LLM_MODEL` sets the default.

All three default models have a **131,072-token context window**; a typical question here uses about 300–400 tokens.

## About the search (hashing vectors)

Each word is hashed into one of 1,024 slots, weighted by how often it appears, and the vector is scaled to length 1. A fixed size is what a database column needs (`vector(1024)`); a TF-IDF vocabulary would grow with every upload.

The trade-off: this matches **words, not meaning** — "refund to my card" will not find "original payment method". To upgrade to semantic search, replace `embed()` in `lib/embeddings.ts` with an embeddings API and change `1024` in `schema.sql` to that model's size.

## Roadmap

- [x] Step 1 — RAG in the terminal
- [x] Step 2 — Chat UI in the browser
- [x] Document upload (PDF, Word, text), locally and in production (Supabase)
- [ ] Step 3 — Agent with tools (search docs, query a sales CSV)
- [ ] Step 4 — Adaptive UI (the agent returns tables and charts)
- [ ] Streaming answers, chat memory, sign-in for uploads

## Tech

TypeScript · Node.js `http` · React 18 (CDN) · [openai](https://www.npmjs.com/package/openai) SDK · [Supabase](https://supabase.com) (Postgres, pgvector, Storage) · [unpdf](https://www.npmjs.com/package/unpdf) · [mammoth](https://www.npmjs.com/package/mammoth) · Groq · Vercel
