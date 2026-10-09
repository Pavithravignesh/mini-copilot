-- Mini Copilot database setup. Paste this whole file into Supabase -> SQL Editor -> Run.
-- Safe to run more than once.

-- 1. pgvector: lets Postgres store vectors and find the nearest ones
create extension if not exists vector;

-- 2. One row per uploaded document
create table if not exists documents (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- 3. One row per chunk, with its 1024-number vector (see lib/embeddings.ts)
create table if not exists chunks (
  id          bigint generated always as identity primary key,
  document_id bigint not null references documents(id) on delete cascade,
  heading     text not null,
  content     text not null,
  embedding   vector(1024) not null
);

-- 4. An index so vector search stays fast as chunks grow
create index if not exists chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);

-- 5. Search function: the chunks closest to a query vector (cosine similarity, 1 = identical)
create or replace function match_chunks(query_embedding vector(1024), match_count int default 3)
returns table (source text, heading text, content text, score float)
language sql stable
as $$
  select d.name, c.heading, c.content, 1 - (c.embedding <=> query_embedding)
  from chunks c
  join documents d on d.id = c.document_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- 6. Lock the tables: with RLS on and no policies, only the server (secret key) can read or write
alter table documents enable row level security;
alter table chunks enable row level security;

-- 7. Private storage bucket for the uploaded files: max 10 MB, PDF / Word / text only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/markdown', 'application/octet-stream'
  ]
)
on conflict (id) do nothing;
