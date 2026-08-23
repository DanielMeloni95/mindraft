-- ===================================================================
-- Mindraft · 0006 full-text search
-- 'simple' dictionary on purpose: captures are frequently a mix of
-- Italian and English and stemming one of them degrades the other.
-- The semantic layer (pgvector) is designed to sit next to this, not
-- to replace it.
-- ===================================================================

alter table public.ideas
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(original_content, '') || ' ' ||
      coalesce(problem, '') || ' ' ||
      coalesce(solution, '') || ' ' ||
      coalesce(audience, '') || ' ' ||
      coalesce(category, '')
    )
  ) stored;

alter table public.projects
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple',
      coalesce(name, '') || ' ' ||
      coalesce(short_description, '') || ' ' ||
      coalesce(vision, '') || ' ' ||
      coalesce(problem, '') || ' ' ||
      coalesce(solution, '') || ' ' ||
      coalesce(value_proposition, '')
    )
  ) stored;

alter table public.tasks
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored;

alter table public.decisions
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(context, '') || ' ' ||
      coalesce(rationale, '') || ' ' ||
      coalesce(consequences, '')
    )
  ) stored;

alter table public.documents
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(plain_text, ''))
  ) stored;

alter table public.inbox_items
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple', coalesce(content, '') || ' ' || coalesce(url_title, '') || ' ' || coalesce(url, ''))
  ) stored;

create index if not exists ideas_search_idx on public.ideas using gin (search_vector);
create index if not exists projects_search_idx on public.projects using gin (search_vector);
create index if not exists tasks_search_idx on public.tasks using gin (search_vector);
create index if not exists decisions_search_idx on public.decisions using gin (search_vector);
create index if not exists documents_search_idx on public.documents using gin (search_vector);
create index if not exists inbox_items_search_idx on public.inbox_items using gin (search_vector);

-- One place to query everything the user can see. security_invoker keeps
-- the underlying RLS policies in charge.
create or replace view public.search_index
with (security_invoker = on) as
  select
    'idea'::public.entity_type as entity_type,
    i.id as entity_id,
    i.workspace_id,
    i.title,
    coalesce(nullif(i.summary, ''), left(i.original_content, 280)) as excerpt,
    i.status::text as status,
    i.project_id,
    i.updated_at,
    i.search_vector
  from public.ideas i
  where i.deleted_at is null
  union all
  select
    'project'::public.entity_type,
    p.id,
    p.workspace_id,
    p.name,
    coalesce(nullif(p.short_description, ''), left(coalesce(p.vision, ''), 280)),
    p.status::text,
    p.id,
    p.updated_at,
    p.search_vector
  from public.projects p
  where p.deleted_at is null
  union all
  select
    'task'::public.entity_type,
    t.id,
    t.workspace_id,
    t.title,
    left(coalesce(t.description, ''), 280),
    t.status::text,
    t.project_id,
    t.updated_at,
    t.search_vector
  from public.tasks t
  where t.deleted_at is null
  union all
  select
    'decision'::public.entity_type,
    d.id,
    d.workspace_id,
    d.title,
    left(coalesce(d.rationale, d.context, ''), 280),
    d.status::text,
    d.project_id,
    d.updated_at,
    d.search_vector
  from public.decisions d
  where d.deleted_at is null
  union all
  select
    'document'::public.entity_type,
    doc.id,
    doc.workspace_id,
    doc.title,
    left(doc.plain_text, 280),
    null,
    doc.project_id,
    doc.updated_at,
    doc.search_vector
  from public.documents doc
  where doc.deleted_at is null
  union all
  select
    'inbox_item'::public.entity_type,
    ib.id,
    ib.workspace_id,
    coalesce(nullif(ib.url_title, ''), left(ib.content, 80), 'Elemento inbox'),
    left(coalesce(nullif(ib.content, ''), coalesce(ib.url, '')), 280),
    ib.status::text,
    ib.project_id,
    ib.updated_at,
    ib.search_vector
  from public.inbox_items ib
  where ib.deleted_at is null;

-- Ranked search with highlighted fragments.
create or replace function public.search_workspace(
  p_workspace_id uuid,
  p_query text,
  p_types public.entity_type[] default null,
  p_limit int default 40
)
returns table (
  entity_type public.entity_type,
  entity_id uuid,
  title text,
  excerpt text,
  status text,
  project_id uuid,
  updated_at timestamptz,
  rank real,
  headline text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select websearch_to_tsquery('simple', p_query) as tsq
  )
  select
    s.entity_type,
    s.entity_id,
    s.title,
    s.excerpt,
    s.status,
    s.project_id,
    s.updated_at,
    ts_rank(s.search_vector, q.tsq) as rank,
    ts_headline('simple', coalesce(s.excerpt, s.title), q.tsq,
      'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MaxWords=28,MinWords=10') as headline
  from public.search_index s, q
  where s.workspace_id = p_workspace_id
    and (p_types is null or s.entity_type = any (p_types))
    and (q.tsq is null or s.search_vector @@ q.tsq)
  order by rank desc, s.updated_at desc
  limit greatest(1, least(p_limit, 100));
$$;
