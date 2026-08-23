-- ===================================================================
-- Mindraft · 0003 capture → ideas → projects → documents
-- ===================================================================

-- ------------------------------------------------------- inbox items
create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  kind public.inbox_kind not null default 'text',
  content text not null default '',
  url text,
  url_title text,
  url_metadata jsonb not null default '{}'::jsonb,
  status public.inbox_status not null default 'unprocessed',
  project_id uuid,
  idea_id uuid,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint inbox_items_has_payload check (
    char_length(trim(content)) > 0 or url is not null or kind in ('image', 'file', 'audio')
  )
);

create index if not exists inbox_items_ws_status_idx
  on public.inbox_items (workspace_id, status, created_at desc)
  where deleted_at is null;

-- -------------------------------------------------------------- ideas
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  -- The capture, verbatim. Nothing in the app may overwrite this column
  -- with AI output: see the ideas_original_content_immutable trigger.
  original_content text not null default '',
  summary text,
  problem text,
  solution text,
  audience text,
  expected_value text,
  personal_motivation text,
  category text,
  status public.idea_status not null default 'inbox',
  maturity public.idea_maturity not null default 'spark',
  project_id uuid,
  source_inbox_item_id uuid references public.inbox_items (id) on delete set null,
  is_favorite boolean not null default false,
  last_ai_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ideas_ws_status_idx
  on public.ideas (workspace_id, status, updated_at desc) where deleted_at is null;
create index if not exists ideas_ws_created_idx
  on public.ideas (workspace_id, created_at desc) where deleted_at is null;
create index if not exists ideas_project_idx on public.ideas (project_id);
create index if not exists ideas_title_trgm_idx on public.ideas using gin (title gin_trgm_ops);

-- The original capture is append-only: it may be corrected by its author
-- while the idea is still fresh, but never silently by a machine.
create or replace function app.protect_original_content()
returns trigger
language plpgsql
as $$
begin
  if new.original_content is distinct from old.original_content
     and coalesce(current_setting('mindraft.allow_original_edit', true), 'off') <> 'on' then
    raise exception 'original_content is immutable (idea %). Store AI output in the derived columns.', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists ideas_original_content_immutable on public.ideas;
create trigger ideas_original_content_immutable
  before update on public.ideas
  for each row execute function app.protect_original_content();

-- ------------------------------------------------------- idea scores
create table if not exists public.idea_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  idea_id uuid not null references public.ideas (id) on delete cascade,
  criterion text not null,
  value smallint not null check (value between 0 and 10),
  weight numeric(4, 2) not null default 1 check (weight >= 0 and weight <= 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idea_id, criterion)
);

create index if not exists idea_scores_idea_idx on public.idea_scores (idea_id);

-- ----------------------------------------------------------- projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  emoji text,
  color text,
  short_description text,
  vision text,
  problem text,
  solution text,
  audience text,
  value_proposition text,
  scope_in text,
  scope_out text,
  status public.project_status not null default 'idea',
  health public.project_health not null default 'unknown',
  progress smallint not null default 0 check (progress between 0 and 100),
  cost_estimate numeric(12, 2),
  cost_currency text not null default 'EUR',
  stack text[] not null default '{}',
  source_idea_id uuid references public.ideas (id) on delete set null,
  next_step text,
  is_favorite boolean not null default false,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists projects_ws_status_idx
  on public.projects (workspace_id, status, last_activity_at desc) where deleted_at is null;
create index if not exists projects_name_trgm_idx on public.projects using gin (name gin_trgm_ops);

alter table public.ideas
  drop constraint if exists ideas_project_id_fkey,
  add constraint ideas_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

alter table public.inbox_items
  drop constraint if exists inbox_items_project_id_fkey,
  add constraint inbox_items_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

alter table public.inbox_items
  drop constraint if exists inbox_items_idea_id_fkey,
  add constraint inbox_items_idea_id_fkey
    foreign key (idea_id) references public.ideas (id) on delete set null;

-- -------------------------------------------------- project sections
-- Structured, individually approvable slices of the project brief.
create table if not exists public.project_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null,
  title text not null,
  content text not null default '',
  origin public.content_origin not null default 'user',
  position smallint not null default 0,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);

create index if not exists project_sections_project_idx
  on public.project_sections (project_id, position);

-- ---------------------------------------------------------- documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  idea_id uuid references public.ideas (id) on delete cascade,
  title text not null default 'Documento',
  -- TipTap JSON document.
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  -- Flattened text kept in sync by the app; powers full-text search.
  plain_text text not null default '',
  revision integer not null default 1,
  last_version_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists documents_project_unique
  on public.documents (project_id) where project_id is not null and deleted_at is null;
create unique index if not exists documents_idea_unique
  on public.documents (idea_id) where idea_id is not null and deleted_at is null;
create index if not exists documents_ws_idx on public.documents (workspace_id, updated_at desc);

-- Versions are snapshots, not keystrokes: see app.snapshot_document.
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  revision integer not null,
  content jsonb not null,
  plain_text text not null default '',
  content_hash text not null,
  label text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, revision)
);

create index if not exists document_versions_doc_idx
  on public.document_versions (document_id, created_at desc);

-- Snapshot policy: keep a version when the content actually changed AND
-- either the caller asked explicitly (label) or the previous snapshot is
-- older than p_min_interval. Autosave therefore costs one UPDATE, not a
-- new row per keystroke.
create or replace function public.snapshot_document(
  p_document_id uuid,
  p_label text default null,
  p_min_interval interval default interval '10 minutes'
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  doc public.documents%rowtype;
  new_hash text;
  last_hash text;
  last_at timestamptz;
  version_id uuid;
begin
  select * into doc from public.documents d where d.id = p_document_id;
  if not found then
    raise exception 'document % not found', p_document_id using errcode = 'no_data_found';
  end if;

  new_hash := encode(digest(doc.content::text, 'sha256'), 'hex');

  select v.content_hash, v.created_at into last_hash, last_at
  from public.document_versions v
  where v.document_id = p_document_id
  order by v.revision desc
  limit 1;

  if last_hash = new_hash then
    return null;
  end if;

  if p_label is null and last_at is not null and last_at > now() - p_min_interval then
    return null;
  end if;

  insert into public.document_versions (
    workspace_id, document_id, revision, content, plain_text, content_hash, label, created_by
  )
  values (
    doc.workspace_id, doc.id, doc.revision, doc.content, doc.plain_text, new_hash, p_label, auth.uid()
  )
  returning id into version_id;

  update public.documents
  set revision = revision + 1, last_version_at = now()
  where id = p_document_id;

  return version_id;
end;
$$;

select app.attach_touch_trigger('public.inbox_items');
select app.attach_touch_trigger('public.ideas');
select app.attach_touch_trigger('public.idea_scores');
select app.attach_touch_trigger('public.projects');
select app.attach_touch_trigger('public.project_sections');
select app.attach_touch_trigger('public.documents');
