-- RAG: база знаний (pgvector). Выполните в Supabase SQL Editor после schema.sql
-- Эмбеддинги: Groq nomic-embed-text-v1_5 → vector(768)

create extension if not exists vector;

create table if not exists kb_documents (
  id text primary key,
  title text not null,
  version text not null,
  content_hash text not null,
  chunk_count int not null default 0,
  status text not null default 'active',
  indexed_at timestamptz not null default now()
);

create table if not exists kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id text not null references kb_documents (id) on delete cascade,
  content text not null,
  embedding vector(768),
  metadata jsonb not null default '{}',
  chunk_index int not null,
  created_at timestamptz not null default now()
);

create index if not exists kb_chunks_document_id_idx on kb_chunks (document_id);
create index if not exists kb_chunks_embedding_idx on kb_chunks using hnsw (embedding vector_cosine_ops);

-- Поиск по сходству (для бота / LangChain)
create or replace function match_kb_chunks (
  query_embedding vector(768),
  match_count int default 5,
  filter jsonb default '{}'
)
returns table (
  id uuid,
  document_id text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from kb_chunks c
  where c.embedding is not null
    and (
      filter = '{}'::jsonb
      or c.metadata @> filter
    )
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;
