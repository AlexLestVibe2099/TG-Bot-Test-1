-- Миграция embedding → vector(768) для Groq / локальных эмбеддингов.
-- Supabase → SQL Editor → вставьте и выполните (Run).

drop index if exists kb_chunks_embedding_idx;

truncate table kb_chunks;

alter table kb_chunks
  alter column embedding type vector(768);

create index if not exists kb_chunks_embedding_idx on kb_chunks using hnsw (embedding vector_cosine_ops);

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
