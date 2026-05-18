-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_pgvector_knowledge.sql
-- RAG knowledge base: pgvector extension, knowledge_chunks table,
-- IVFFlat index, and cosine similarity search function.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgvector (no-op if already enabled)
create extension if not exists vector;

-- Knowledge chunks for RAG: PHT clinical content from textbooks
create table public.knowledge_chunks (
  id         uuid        primary key default gen_random_uuid(),
  content    text        not null,
  source     text        not null,   -- filename, e.g. 'exercises_phase1.txt'
  category   text,                   -- 'exercises' | 'clinical_principles' | 'progressions' | null
  embedding  vector(768) not null,   -- Gemini text-embedding-004 (768-dim)
  created_at timestamptz not null default now()
);

comment on table public.knowledge_chunks is
  'PHT clinical reference content indexed for RAG. Populated by scripts/ingest-knowledge.ts.';

-- IVFFlat index for approximate nearest-neighbour cosine search.
-- lists=100 is appropriate for hundreds to low-thousands of chunks.
-- Rebuild with higher lists if chunk count grows beyond ~50k.
create index idx_knowledge_chunks_embedding
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Cosine similarity search — called via supabase.rpc('search_knowledge', {...})
create or replace function public.search_knowledge(
  query_embedding vector(768),
  match_count     int  default 5,
  category_filter text default null
)
returns table (
  id         uuid,
  content    text,
  source     text,
  category   text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    kc.id,
    kc.content,
    kc.source,
    kc.category,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where
    category_filter is null
    or kc.category = category_filter
  order by kc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- RLS enabled; edge functions access via service role (bypasses RLS).
-- No client-side read policy needed — the mobile app never reads chunks directly.
alter table public.knowledge_chunks enable row level security;
