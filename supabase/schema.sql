-- ===================================================================
-- MINDRAFT — schema completo per Supabase
--
-- COME USARLO
--   1. Apri il tuo progetto Supabase → SQL Editor → New query
--   2. Incolla TUTTO questo file e premi Run
--   3. Attendi ~10 secondi. Al termine non devono comparire errori
--      (i NOTICE sono normali).
--
-- COSA CREA
--   · 20 tipi enum
--   · 36 tabelle (profili, workspace, idee, progetti, documenti,
--     canvas, roadmap, attività, decisioni, AI, billing, audit)
--   · indici, foreign key, check constraint e trigger updated_at
--   · ricerca full-text (colonne tsvector generate + indici GIN)
--   · Row Level Security su ogni tabella esposta, con policy basate
--     su membership e ruolo (owner / admin / editor / viewer)
--   · bucket storage privato "attachments" con le sue policy
--   · funzioni RPC: ensure_workspace, charge_ai_credits,
--     snapshot_document, search_workspace, seed_demo_workspace,
--     remove_demo_workspace
--   · trigger su auth.users che crea profilo + workspace personale
--     al primo accesso di ogni nuovo utente
--
-- SICUREZZA
--   Lo script è idempotente: puoi rieseguirlo senza perdere dati.
--   Non contiene DROP TABLE né DELETE: non cancella nulla di
--   esistente.
--
-- DOPO L'ESECUZIONE
--   Authentication → URL Configuration
--     Site URL:       http://localhost:3000
--     Redirect URLs:  http://localhost:3000/auth/callback
--   Per i test end-to-end: Authentication → Providers → Email →
--   disattiva "Confirm email".
--
-- Generato da: supabase/migrations/0001…0009
-- ===================================================================



-- ###################################################################
-- ## 0001_foundation.sql
-- ###################################################################

-- ===================================================================
-- Mindraft · 0001 foundation
-- Extensions, enums, shared helper functions and triggers.
-- ===================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
-- Optional, enabled on Supabase for the semantic-search roadmap item.
-- create extension if not exists "vector";

create schema if not exists app;
comment on schema app is 'Internal helper functions for Mindraft (not exposed via PostgREST).';

-- --------------------------------------------------------------- enums

do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_tier as enum ('free', 'personal', 'pro', 'team');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inbox_kind as enum ('text', 'url', 'image', 'file', 'audio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inbox_status as enum ('unprocessed', 'processed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.idea_status as enum (
    'inbox', 'to_explore', 'analyzing', 'promising', 'converted', 'paused', 'discarded', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.idea_maturity as enum ('spark', 'sketch', 'shaped', 'validated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum (
    'idea', 'exploration', 'validation', 'design', 'development', 'paused', 'completed', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_health as enum ('unknown', 'on_track', 'at_risk', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.decision_status as enum ('proposed', 'approved', 'superseded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.severity_level as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.milestone_status as enum ('planned', 'in_progress', 'done', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.entity_type as enum (
    'inbox_item', 'idea', 'project', 'document', 'goal', 'milestone',
    'task', 'decision', 'risk', 'resource', 'canvas_node', 'note'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.relation_type as enum (
    'derives_from', 'depends_on', 'supports', 'contradicts',
    'part_of', 'blocks', 'replaces', 'relates_to'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.canvas_node_type as enum (
    'idea', 'project', 'note', 'goal', 'feature', 'task',
    'decision', 'risk', 'resource', 'text', 'group'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_run_status as enum ('pending', 'running', 'succeeded', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_proposal_status as enum ('pending', 'applied', 'partially_applied', 'rejected', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_origin as enum ('user', 'ai', 'import');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------- functions

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function app.touch_updated_at is 'Keeps updated_at honest regardless of the client.';

-- Attaches the updated_at trigger to a table in the public schema.
create or replace function app.attach_touch_trigger(target regclass)
returns void
language plpgsql
as $$
declare
  trg_name text := 'trg_touch_' || replace(target::text, 'public.', '');
begin
  execute format(
    'drop trigger if exists %I on %s',
    trg_name, target::text
  );
  execute format(
    'create trigger %I before update on %s for each row execute function app.touch_updated_at()',
    trg_name, target::text
  );
end;
$$;

-- Role ranking used by the RLS policies.
create or replace function app.role_rank(r public.workspace_role)
returns int
language sql
immutable
as $$
  select case r
    when 'owner' then 4
    when 'admin' then 3
    when 'editor' then 2
    when 'viewer' then 1
    else 0
  end;
$$;


-- ###################################################################
-- ## 0002_workspaces.sql
-- ###################################################################

-- ===================================================================
-- Mindraft · 0002 identity, workspaces, billing scaffolding
-- ===================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  locale text not null default 'it',
  primary_use text,
  focus_areas text[] not null default '{}',
  guidance_level text not null default 'balanced'
    check (guidance_level in ('minimal', 'balanced', 'guided')),
  onboarding_completed_at timestamptz,
  onboarding_step smallint not null default 0,
  dashboard_modules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  slug text not null unique,
  is_personal boolean not null default true,
  owner_id uuid not null references auth.users (id) on delete cascade,
  plan public.plan_tier not null default 'free',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists workspaces_owner_idx on public.workspaces (owner_id);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'editor',
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'editor',
  invited_by uuid not null references auth.users (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  plan public.plan_tier not null default 'free',
  status public.subscription_status not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only ledger: one row per billable action (AI credits, storage, …).
create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('ai_credits', 'storage_bytes', 'export', 'import')),
  amount integer not null,
  reference_type public.entity_type,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists usage_ledger_ws_time_idx
  on public.usage_ledger (workspace_id, occurred_at desc);
create index if not exists usage_ledger_ws_kind_idx
  on public.usage_ledger (workspace_id, kind, occurred_at desc);

-- Idempotency guard for Stripe webhooks.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.feature_flags (
  key text primary key,
  description text,
  enabled boolean not null default false,
  audience jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select app.attach_touch_trigger('public.profiles');
select app.attach_touch_trigger('public.workspaces');
select app.attach_touch_trigger('public.workspace_members');
select app.attach_touch_trigger('public.workspace_invitations');
select app.attach_touch_trigger('public.subscriptions');
select app.attach_touch_trigger('public.feature_flags');

-- ------------------------------------------------- membership helpers
-- security definer so that policies on workspace_members never recurse.

create or replace function app.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function app.member_role(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid();
$$;

create or replace function app.can_write(ws uuid)
returns boolean
language sql
stable
as $$
  select app.role_rank(app.member_role(ws)) >= app.role_rank('editor');
$$;

create or replace function app.can_admin(ws uuid)
returns boolean
language sql
stable
as $$
  select app.role_rank(app.member_role(ws)) >= app.role_rank('admin');
$$;

grant usage on schema app to authenticated, anon, service_role;
grant execute on all functions in schema app to authenticated, service_role;

-- ------------------------------------------------ new-user bootstrap
-- Every new account gets a profile and a personal workspace, so the app
-- never has to deal with a "user without workspace" state.

create or replace function app.bootstrap_user(p_user_id uuid, p_email text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ws_id uuid;
  base_slug text;
  final_slug text;
  suffix int := 0;
begin
  insert into public.profiles (id, full_name)
  values (p_user_id, coalesce(nullif(trim(p_full_name), ''), split_part(coalesce(p_email, 'utente'), '@', 1)))
  on conflict (id) do nothing;

  select w.id into ws_id
  from public.workspaces w
  where w.owner_id = p_user_id and w.is_personal and w.deleted_at is null
  limit 1;

  if ws_id is not null then
    return ws_id;
  end if;

  base_slug := coalesce(
    nullif(regexp_replace(lower(split_part(coalesce(p_email, ''), '@', 1)), '[^a-z0-9]+', '-', 'g'), ''),
    'workspace'
  );
  final_slug := base_slug;
  while exists (select 1 from public.workspaces w where w.slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.workspaces (name, slug, is_personal, owner_id)
  values ('Il mio spazio', final_slug, true, p_user_id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, p_user_id, 'owner')
  on conflict do nothing;

  insert into public.subscriptions (workspace_id, plan, status)
  values (ws_id, 'free', 'active')
  on conflict (workspace_id) do nothing;

  return ws_id;
end;
$$;

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform app.bootstrap_user(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();


-- ###################################################################
-- ## 0003_content.sql
-- ###################################################################

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
  -- Short life/work area label ("Lavoro", "Sport"): groups projects on the global map.
  context_scope text check (context_scope is null or char_length(trim(context_scope)) between 1 and 80),
  tool_kind text check (tool_kind is null or tool_kind in ('tool','application','extension','markjs','api','library','service')),
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


-- ###################################################################
-- ## 0004_planning_and_canvas.sql
-- ###################################################################

-- ===================================================================
-- Mindraft · 0004 goals, roadmap, tasks, decisions, risks, canvas
-- ===================================================================

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  metric text,
  target_value text,
  current_value text,
  due_date date,
  is_achieved boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists goals_project_idx on public.goals (project_id, position);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  phase text,
  version_label text,
  status public.milestone_status not null default 'planned',
  starts_on date,
  ends_on date,
  progress smallint not null default 0 check (progress between 0 and 100),
  is_estimate boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint milestones_date_order check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create index if not exists milestones_project_idx
  on public.milestones (project_id, position) where deleted_at is null;
create index if not exists milestones_ws_dates_idx
  on public.milestones (workspace_id, starts_on, ends_on);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  assignee_id uuid references auth.users (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 300),
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date,
  estimate_minutes integer check (estimate_minutes is null or estimate_minutes >= 0),
  checklist jsonb not null default '[]'::jsonb,
  origin_type public.entity_type,
  origin_id uuid,
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists tasks_ws_status_idx
  on public.tasks (workspace_id, status, due_date) where deleted_at is null;
create index if not exists tasks_project_idx
  on public.tasks (project_id, status, position) where deleted_at is null;
create index if not exists tasks_due_idx
  on public.tasks (workspace_id, due_date) where deleted_at is null and status <> 'done';

create or replace function app.sync_task_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and coalesce(old.status, 'todo') <> 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_sync_completion on public.tasks;
create trigger tasks_sync_completion
  before insert or update on public.tasks
  for each row execute function app.sync_task_completion();

create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  constraint task_dependencies_no_self check (task_id <> depends_on_task_id)
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 300),
  context text,
  alternatives text,
  rationale text,
  consequences text,
  status public.decision_status not null default 'proposed',
  decided_on date,
  supersedes_id uuid references public.decisions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists decisions_project_idx
  on public.decisions (project_id, created_at desc) where deleted_at is null;
create index if not exists decisions_ws_status_idx
  on public.decisions (workspace_id, status, updated_at desc) where deleted_at is null;

create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 300),
  description text,
  likelihood public.severity_level not null default 'medium',
  impact public.severity_level not null default 'medium',
  mitigation text,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists risks_project_idx on public.risks (project_id) where deleted_at is null;

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  idea_id uuid references public.ideas (id) on delete cascade,
  title text not null,
  url text,
  kind text not null default 'link' check (kind in ('link', 'file', 'person', 'tool', 'budget', 'note')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists resources_project_idx on public.resources (project_id) where deleted_at is null;

-- ------------------------------------------------------------- canvas
create table if not exists public.canvases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  idea_id uuid references public.ideas (id) on delete cascade,
  title text not null default 'Mappa',
  is_global boolean not null default false,
  viewport jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists canvases_project_unique
  on public.canvases (project_id) where project_id is not null and deleted_at is null;

create table if not exists public.canvas_nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  type public.canvas_node_type not null default 'note',
  label text not null default '',
  body text,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  width double precision,
  height double precision,
  color text,
  parent_node_id uuid references public.canvas_nodes (id) on delete set null,
  -- A node may mirror a real entity. When it does, label edits propagate
  -- both ways (see the app's canvas sync layer).
  entity_type public.entity_type,
  entity_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canvas_nodes_canvas_idx on public.canvas_nodes (canvas_id);
create index if not exists canvas_nodes_entity_idx on public.canvas_nodes (entity_type, entity_id);

create table if not exists public.canvas_edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  source_node_id uuid not null references public.canvas_nodes (id) on delete cascade,
  target_node_id uuid not null references public.canvas_nodes (id) on delete cascade,
  relation public.relation_type not null default 'relates_to',
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canvas_edges_no_self check (source_node_id <> target_node_id),
  unique (canvas_id, source_node_id, target_node_id, relation)
);

create index if not exists canvas_edges_canvas_idx on public.canvas_edges (canvas_id);

select app.attach_touch_trigger('public.goals');
select app.attach_touch_trigger('public.milestones');
select app.attach_touch_trigger('public.tasks');
select app.attach_touch_trigger('public.decisions');
select app.attach_touch_trigger('public.risks');
select app.attach_touch_trigger('public.resources');
select app.attach_touch_trigger('public.canvases');
select app.attach_touch_trigger('public.canvas_nodes');
select app.attach_touch_trigger('public.canvas_edges');


-- ###################################################################
-- ## 0005_shared.sql
-- ###################################################################

-- ===================================================================
-- Mindraft · 0005 tags, relations, attachments, AI runs, activity
-- ===================================================================

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

-- Single polymorphic bridge table instead of one per entity: the set of
-- taggable entities keeps growing and the enum already constrains it.
create table if not exists public.entity_tags (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tag_id, entity_type, entity_id)
);

create index if not exists entity_tags_entity_idx on public.entity_tags (entity_type, entity_id);
create index if not exists entity_tags_ws_idx on public.entity_tags (workspace_id);

create table if not exists public.entity_relations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source_type public.entity_type not null,
  source_id uuid not null,
  target_type public.entity_type not null,
  target_id uuid not null,
  relation public.relation_type not null default 'relates_to',
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id, target_type, target_id, relation),
  constraint entity_relations_no_self check (not (source_type = target_type and source_id = target_id))
);

create index if not exists entity_relations_source_idx
  on public.entity_relations (source_type, source_id);
create index if not exists entity_relations_target_idx
  on public.entity_relations (target_type, target_id);
create index if not exists entity_relations_ws_idx on public.entity_relations (workspace_id);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists attachments_entity_idx on public.attachments (entity_type, entity_id);

-- ------------------------------------------------------------ AI layer
create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  provider text not null default 'mock',
  model text,
  status public.ai_run_status not null default 'pending',
  entity_type public.entity_type,
  entity_id uuid,
  -- Technical telemetry only. Prompts and completions are not persisted:
  -- see docs/architecture.md § "AI and privacy".
  input_tokens integer,
  output_tokens integer,
  credits_charged integer not null default 0,
  duration_ms integer,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_runs_ws_idx on public.ai_runs (workspace_id, created_at desc);
create index if not exists ai_runs_entity_idx on public.ai_runs (entity_type, entity_id, created_at desc);

create table if not exists public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  run_id uuid references public.ai_runs (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  status public.ai_proposal_status not null default 'pending',
  -- Array of { key, label, current, proposed, kind, confidence, rationale }
  sections jsonb not null default '[]'::jsonb,
  accepted_keys text[] not null default '{}',
  rejected_keys text[] not null default '{}',
  assumptions text[] not null default '{}',
  questions text[] not null default '{}',
  citations jsonb not null default '[]'::jsonb,
  applied_at timestamptz,
  -- Snapshot of the fields this proposal overwrote, so "annulla" is real.
  undo_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_proposals_entity_idx
  on public.ai_proposals (entity_type, entity_id, created_at desc);
create index if not exists ai_proposals_ws_status_idx
  on public.ai_proposals (workspace_id, status, created_at desc);

alter table public.ideas
  drop constraint if exists ideas_last_ai_run_id_fkey,
  add constraint ideas_last_ai_run_id_fkey
    foreign key (last_ai_run_id) references public.ai_runs (id) on delete set null;

-- --------------------------------------------------------- continuity
create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  summary text not null default '',
  focus_items jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, week_start)
);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('ideas', 'projects', 'tasks', 'search')),
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, scope, name)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  entity_type public.entity_type,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, read_at, created_at desc);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_ws_idx on public.activity_log (workspace_id, created_at desc);
create index if not exists activity_log_entity_idx
  on public.activity_log (entity_type, entity_id, created_at desc);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null default 'general' check (kind in ('general', 'bug', 'idea', 'ai_quality')),
  message text not null check (char_length(trim(message)) > 0),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

select app.attach_touch_trigger('public.tags');
select app.attach_touch_trigger('public.entity_relations');
select app.attach_touch_trigger('public.ai_runs');
select app.attach_touch_trigger('public.ai_proposals');
select app.attach_touch_trigger('public.weekly_reviews');
select app.attach_touch_trigger('public.saved_views');


-- ###################################################################
-- ## 0006_search.sql
-- ###################################################################

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


-- ###################################################################
-- ## 0007_rls.sql
-- ###################################################################

-- ===================================================================
-- Mindraft · 0007 Row Level Security
-- Every table reachable through PostgREST is protected. Authorisation
-- is derived from workspace membership and role, never from the client.
-- ===================================================================

-- Note: FORCE ROW LEVEL SECURITY is intentionally not used. The tables
-- are owned by the `postgres` role, which no application path connects
-- as; forcing it would also break the SECURITY DEFINER membership
-- helpers and the Supabase SQL editor.

-- ------------------------------------------- generic workspace tables
do $$
declare
  t text;
  workspace_tables text[] := array[
    'inbox_items', 'ideas', 'idea_scores', 'projects', 'project_sections',
    'documents', 'document_versions', 'goals', 'milestones', 'tasks',
    'task_dependencies', 'decisions', 'risks', 'resources',
    'canvases', 'canvas_nodes', 'canvas_edges',
    'tags', 'entity_tags', 'entity_relations', 'attachments',
    'ai_runs', 'ai_proposals', 'activity_log'
  ];
begin
  foreach t in array workspace_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select using (app.is_member(workspace_id))',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert with check (app.can_write(workspace_id))',
      t || '_insert', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update using (app.can_write(workspace_id)) with check (app.can_write(workspace_id))',
      t || '_update', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete using (app.can_write(workspace_id))',
      t || '_delete', t
    );
  end loop;
end $$;

-- activity_log and ai_runs are written by the app but must never be
-- rewritten afterwards.
drop policy if exists activity_log_update on public.activity_log;
drop policy if exists activity_log_delete on public.activity_log;

-- ---------------------------------------------------------- profiles
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members me
      join public.workspace_members other on other.workspace_id = me.workspace_id
      where me.user_id = auth.uid() and other.user_id = public.profiles.id
    )
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- -------------------------------------------------------- workspaces
alter table public.workspaces enable row level security;

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select using (app.is_member(id));

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update using (app.can_admin(id)) with check (app.can_admin(id));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete using (owner_id = auth.uid());

-- --------------------------------------------------- workspace members
alter table public.workspace_members enable row level security;

drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select using (user_id = auth.uid() or app.is_member(workspace_id));

drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members
  for insert with check (
    app.can_admin(workspace_id)
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members
  for update using (app.can_admin(workspace_id)) with check (app.can_admin(workspace_id));

drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members
  for delete using (app.can_admin(workspace_id) or user_id = auth.uid());

-- ----------------------------------------------------- invitations
alter table public.workspace_invitations enable row level security;

drop policy if exists workspace_invitations_select on public.workspace_invitations;
create policy workspace_invitations_select on public.workspace_invitations
  for select using (app.can_admin(workspace_id));

drop policy if exists workspace_invitations_write on public.workspace_invitations;
create policy workspace_invitations_write on public.workspace_invitations
  for all using (app.can_admin(workspace_id)) with check (app.can_admin(workspace_id));

-- -------------------------------------------- billing (read-only side)
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (app.is_member(workspace_id));
-- Writes happen exclusively through the Stripe webhook (service role).

alter table public.usage_ledger enable row level security;

drop policy if exists usage_ledger_select on public.usage_ledger;
create policy usage_ledger_select on public.usage_ledger
  for select using (app.is_member(workspace_id));

drop policy if exists usage_ledger_insert on public.usage_ledger;
create policy usage_ledger_insert on public.usage_ledger
  for insert with check (app.is_member(workspace_id) and user_id = auth.uid());

alter table public.stripe_events enable row level security;
-- No policy at all: service role only.

-- ------------------------------------------------------ user-scoped
do $$
declare
  t text;
begin
  foreach t in array array['saved_views', 'notifications', 'weekly_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all using (user_id = auth.uid() and app.is_member(workspace_id)) with check (user_id = auth.uid() and app.is_member(workspace_id))',
      t || '_own', t
    );
  end loop;
end $$;

-- Shared saved views are readable by the whole workspace.
drop policy if exists saved_views_shared_select on public.saved_views;
create policy saved_views_shared_select on public.saved_views
  for select using (is_shared and app.is_member(workspace_id));

-- ------------------------------------------------- flags and feedback
alter table public.feature_flags enable row level security;

drop policy if exists feature_flags_select on public.feature_flags;
create policy feature_flags_select on public.feature_flags
  for select to authenticated using (true);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert with check (user_id = auth.uid());

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select using (user_id = auth.uid());

-- --------------------------------------------------------- grants
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.search_index to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

-- The ledger and the log are append-only for end users.
revoke update, delete on public.usage_ledger from authenticated;
revoke update, delete on public.activity_log from authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
revoke all on public.stripe_events from authenticated, anon;


-- ###################################################################
-- ## 0008_storage.sql
-- ###################################################################

-- ===================================================================
-- Mindraft · 0008 private storage bucket for attachments
-- Path convention: {workspace_id}/{entity_type}/{uuid}-{filename}
-- The first path segment is the authorisation key.
-- Guarded so the migration set can also be applied to a plain Postgres
-- instance (used by the SQL test-suite in scripts/).
-- ===================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present, skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'attachments',
    'attachments',
    false,
    26214400, -- 25 MB
    array[
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
      'application/json', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  )
  on conflict (id) do update
    set file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types,
        public = false;

  execute 'drop policy if exists attachments_read on storage.objects';
  execute $pol$
    create policy attachments_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'attachments'
        and app.is_member(((storage.foldername(name))[1])::uuid)
      )
  $pol$;

  execute 'drop policy if exists attachments_insert on storage.objects';
  execute $pol$
    create policy attachments_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'attachments'
        and app.can_write(((storage.foldername(name))[1])::uuid)
      )
  $pol$;

  execute 'drop policy if exists attachments_update on storage.objects';
  execute $pol$
    create policy attachments_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'attachments'
        and app.can_write(((storage.foldername(name))[1])::uuid)
      )
  $pol$;

  execute 'drop policy if exists attachments_delete on storage.objects';
  execute $pol$
    create policy attachments_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'attachments'
        and app.can_write(((storage.foldername(name))[1])::uuid)
      )
  $pol$;
end $$;


-- ###################################################################
-- ## 0009_rpc_and_demo.sql
-- ###################################################################

-- ===================================================================
-- Mindraft · 0009 RPC helpers and the optional demo workspace
-- ===================================================================

-- Called by the app right after sign-in. Idempotent: it repairs accounts
-- created before the trigger existed and is a no-op afterwards.
create or replace function public.ensure_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  email text;
  meta_name text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select u.email, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
  into email, meta_name
  from auth.users u where u.id = uid;

  return app.bootstrap_user(uid, email, meta_name);
end;
$$;

-- AI credit accounting in one atomic statement: the ledger row and the
-- balance check cannot drift apart.
create or replace function public.charge_ai_credits(
  p_workspace_id uuid,
  p_amount integer,
  p_feature text,
  p_monthly_limit integer
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  used integer;
begin
  if not app.can_write(p_workspace_id) then
    raise exception 'not allowed to spend credits in this workspace' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(sum(amount), 0) into used
  from public.usage_ledger
  where workspace_id = p_workspace_id
    and kind = 'ai_credits'
    and occurred_at >= date_trunc('month', now());

  if p_monthly_limit >= 0 and used + p_amount > p_monthly_limit then
    raise exception 'AI credit limit reached (% / %)', used, p_monthly_limit
      using errcode = 'check_violation';
  end if;

  insert into public.usage_ledger (workspace_id, user_id, kind, amount, metadata)
  values (p_workspace_id, auth.uid(), 'ai_credits', p_amount, jsonb_build_object('feature', p_feature));

  return used + p_amount;
end;
$$;

-- --------------------------------------------------------- demo seed
-- Optional and clearly separated from real data: every row it creates
-- is tagged with metadata->>'demo' = 'true' or belongs to the demo
-- workspace, so it can be removed in one statement.

create or replace function public.seed_demo_workspace()
returns uuid
language plpgsql
-- SECURITY DEFINER: the function only ever writes into a workspace it
-- has just created for the authenticated caller, and it needs to insert
-- the subscription row that end users are not allowed to write.
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  ws uuid;
  idea_radar uuid;
  idea_voice uuid;
  idea_news uuid;
  proj uuid;
  doc uuid;
  cv uuid;
  ms_discovery uuid;
  ms_mvp uuid;
  n_problem uuid;
  n_solution uuid;
  n_mvp uuid;
  n_risk uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select w.id into ws
  from public.workspaces w
  where w.owner_id = uid and w.slug like 'demo-%' and w.deleted_at is null
  limit 1;

  if ws is not null then
    return ws;
  end if;

  insert into public.workspaces (name, slug, is_personal, owner_id, settings)
  values ('Spazio dimostrativo', 'demo-' || substr(replace(uid::text, '-', ''), 1, 12), false, uid,
          jsonb_build_object('demo', true))
  returning id into ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');
  insert into public.subscriptions (workspace_id, plan, status) values (ws, 'free', 'active');

  -- ----------------------------------------------------------- inbox
  insert into public.inbox_items (workspace_id, created_by, kind, content, status)
  values
    (ws, uid, 'text',
     'Continuo a perdere le idee che mi vengono mentre cammino. Serve qualcosa che le prenda in 3 secondi e poi le riordini da solo.',
     'unprocessed'),
    (ws, uid, 'text',
     'Domanda: la gente paga per uno strumento che "pensa con te" o vuole solo un posto dove scrivere? Chiedere a 5 freelance.',
     'unprocessed'),
    (ws, uid, 'url',
     'Da leggere: come strutturano i decision log i team di prodotto.',
     'unprocessed');

  update public.inbox_items set url = 'https://example.com/decision-records', url_title = 'Architecture decision records in pratica'
  where workspace_id = ws and kind = 'url';

  -- ----------------------------------------------------------- ideas
  insert into public.ideas (workspace_id, created_by, title, original_content, summary, problem, solution,
                            audience, expected_value, personal_motivation, category, status, maturity)
  values (
    ws, uid,
    'Radar: capire quali idee meritano tempo',
    'Ho 40 idee in tre app diverse. Ogni volta che ne apro una perdo mezz''ora a ricostruire perché mi interessava. Vorrei un radar che me le mostri per impatto e fattibilità e mi dica quale ha senso oggi.',
    'Un cruscotto che ordina le idee per impatto e fattibilità e propone quella su cui lavorare adesso.',
    'Le idee sono sparse e senza contesto: la selezione costa più della realizzazione.',
    'Punteggio trasparente su criteri configurabili, più una matrice impatto/fattibilità confrontabile.',
    'Freelance e founder che gestiscono più progetti in parallelo.',
    'Meno tempo speso a ricordare, più tempo speso a decidere.',
    'È il problema che ho ogni domenica sera.',
    'Prodotto', 'promising', 'shaped'
  ) returning id into idea_radar;

  insert into public.ideas (workspace_id, created_by, title, original_content, summary, status, maturity, category)
  values (
    ws, uid,
    'Cattura vocale mentre cammino',
    'Registrare 20 secondi di voce, trascrizione automatica, e la sera ritrovo tutto già diviso per progetto.',
    'Nota vocale con trascrizione e smistamento automatico per progetto.',
    'to_explore', 'sketch', 'Prodotto'
  ) returning id into idea_voice;

  insert into public.ideas (workspace_id, created_by, title, original_content, status, maturity, category)
  values (
    ws, uid,
    'Newsletter settimanale sul lavoro creativo',
    'Una mail il venerdì con una cosa che ho capito questa settimana. Forse è solo un modo per procrastinare sul prodotto.',
    'inbox', 'spark', 'Contenuti'
  ) returning id into idea_news;

  insert into public.idea_scores (workspace_id, idea_id, criterion, value, weight)
  values
    (ws, idea_radar, 'impact', 8, 1.5),
    (ws, idea_radar, 'feasibility', 6, 1.2),
    (ws, idea_radar, 'personal_interest', 9, 1.0),
    (ws, idea_radar, 'time_required', 4, 0.8),
    (ws, idea_radar, 'differentiation', 7, 1.0),
    (ws, idea_voice, 'impact', 6, 1.5),
    (ws, idea_voice, 'feasibility', 4, 1.2),
    (ws, idea_voice, 'personal_interest', 7, 1.0),
    (ws, idea_news, 'impact', 3, 1.5),
    (ws, idea_news, 'feasibility', 9, 1.2),
    (ws, idea_news, 'personal_interest', 5, 1.0);

  -- --------------------------------------------------------- project
  insert into public.projects (workspace_id, created_by, name, emoji, color, short_description, vision,
                               problem, solution, audience, value_proposition, scope_in, scope_out,
                               status, health, progress, source_idea_id, next_step, stack)
  values (
    ws, uid, 'Radar delle idee', '🧭', '#5B5CE2',
    'Cruscotto che ordina le idee per impatto e fattibilità.',
    'Ogni domenica so su cosa lavorare lunedì, senza rileggere quaranta note.',
    'Le idee vivono in posti diversi e perdono il contesto che le rendeva interessanti.',
    'Punteggio configurabile, matrice di confronto e un suggerimento motivato del prossimo passo.',
    'Chi porta avanti più progetti personali in parallelo.',
    'Dalla nota sparsa alla decisione in meno di cinque minuti.',
    'Punteggio, matrice, confronto fino a cinque idee, suggerimento del prossimo passo.',
    'Collaborazione in tempo reale, app mobile nativa, integrazioni esterne.',
    'development', 'on_track', 35, idea_radar,
    'Validare i pesi predefiniti con tre utenti reali.',
    array['Next.js', 'Supabase', 'TypeScript']
  ) returning id into proj;

  update public.ideas set project_id = proj, status = 'converted' where id = idea_radar;

  insert into public.project_sections (workspace_id, project_id, key, title, content, origin, position, approved_at)
  values
    (ws, proj, 'vision', 'Visione', 'Sapere ogni lunedì su cosa lavorare, senza rileggere quaranta note.', 'user', 0, now()),
    (ws, proj, 'problem', 'Problema', 'Selezionare costa più che eseguire: il contesto di ogni idea va ricostruito da zero.', 'ai', 1, now()),
    (ws, proj, 'solution', 'Soluzione', 'Punteggio trasparente su criteri configurabili più una matrice di confronto.', 'ai', 2, now()),
    (ws, proj, 'users', 'Utenti', 'Freelance, indie maker e product manager con più progetti aperti.', 'ai', 3, null),
    (ws, proj, 'mvp', 'MVP', 'Punteggio, matrice, confronto e suggerimento del prossimo passo. Nient''altro.', 'user', 4, now());

  insert into public.goals (workspace_id, project_id, title, metric, target_value, current_value, due_date, position)
  values
    (ws, proj, 'Ridurre il tempo di selezione', 'minuti per decisione', '5', '18', current_date + 45, 0),
    (ws, proj, 'Tre utenti che lo usano ogni settimana', 'utenti attivi settimanali', '3', '1', current_date + 60, 1);

  insert into public.milestones (workspace_id, project_id, title, description, phase, status, starts_on, ends_on, progress, is_estimate, position)
  values
    (ws, proj, 'Discovery', 'Interviste e definizione dei criteri di valutazione.', 'Fase 1', 'done',
     current_date - 21, current_date - 7, 100, false, 0)
  returning id into ms_discovery;

  insert into public.milestones (workspace_id, project_id, title, description, phase, version_label, status, starts_on, ends_on, progress, is_estimate, position)
  values
    (ws, proj, 'MVP interno', 'Punteggio e matrice utilizzabili sui dati reali.', 'Fase 2', 'v0.1', 'in_progress',
     current_date - 6, current_date + 14, 40, true, 1)
  returning id into ms_mvp;

  insert into public.tasks (workspace_id, created_by, project_id, milestone_id, title, description, status, priority, due_date, estimate_minutes, position, origin_type, origin_id)
  values
    (ws, uid, proj, ms_mvp, 'Definire i pesi predefiniti dei criteri', 'Partire da impatto 1.5 e fattibilità 1.2, poi verificare.', 'in_progress', 'high', current_date + 2, 90, 0, 'idea', idea_radar),
    (ws, uid, proj, ms_mvp, 'Matrice impatto/fattibilità cliccabile', null, 'todo', 'medium', current_date + 6, 180, 1, null, null),
    (ws, uid, proj, ms_mvp, 'Intervistare tre freelance', 'Domanda chiave: come scelgono su cosa lavorare la settimana dopo.', 'blocked', 'high', current_date - 1, 120, 2, null, null),
    (ws, uid, proj, ms_discovery, 'Elencare i criteri candidati', null, 'done', 'medium', current_date - 12, 60, 3, null, null);

  insert into public.decisions (workspace_id, created_by, project_id, title, context, alternatives, rationale, consequences, status, decided_on)
  values (
    ws, uid, proj,
    'Il punteggio resta modificabile a mano',
    'Un punteggio calcolato al 100% dalla AI sembrava più pulito, ma nasconde il ragionamento.',
    'A) punteggio automatico non modificabile · B) punteggio automatico con override · C) solo manuale',
    'Se non posso spostare un peso, smetto di fidarmi del numero. Meglio un calcolo trasparente e correggibile.',
    'Serve mostrare sempre la formula e conservare i pesi per idea.',
    'approved', current_date - 9
  );

  insert into public.risks (workspace_id, project_id, title, description, likelihood, impact, mitigation)
  values
    (ws, proj, 'Il punteggio diventa un rituale inutile', 'Se valutare costa più che decidere, nessuno lo compila.', 'medium', 'high',
     'Valori predefiniti sensati e valutazione parziale sempre ammessa.'),
    (ws, proj, 'Troppa AI toglie fiducia', 'Proposte non spiegate vengono ignorate.', 'medium', 'medium',
     'Ogni proposta mostra criteri, incertezze e fonti interne.');

  insert into public.resources (workspace_id, project_id, title, url, kind, notes)
  values
    (ws, proj, 'Note interviste discovery', null, 'note', 'Tre conversazioni, pattern ricorrente: "non so da dove ripartire".'),
    (ws, proj, 'Architecture decision records in pratica', 'https://example.com/decision-records', 'link', null);

  -- -------------------------------------------------------- document
  insert into public.documents (workspace_id, created_by, project_id, title, content, plain_text)
  values (
    ws, uid, proj, 'Radar delle idee — documento di progetto',
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 2),
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Visione'))),
        jsonb_build_object('type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text',
            'Ogni domenica so su cosa lavorare lunedì, senza rileggere quaranta note.'))),
        jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 2),
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Problema'))),
        jsonb_build_object('type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text',
            'Selezionare costa più che eseguire. Il contesto di ogni idea va ricostruito da zero ogni volta.'))),
        jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 2),
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'MVP'))),
        jsonb_build_object('type', 'bulletList', 'content', jsonb_build_array(
          jsonb_build_object('type', 'listItem', 'content', jsonb_build_array(
            jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', 'Punteggio configurabile e trasparente'))))),
          jsonb_build_object('type', 'listItem', 'content', jsonb_build_array(
            jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', 'Matrice impatto/fattibilità'))))),
          jsonb_build_object('type', 'listItem', 'content', jsonb_build_array(
            jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', 'Suggerimento motivato del prossimo passo')))))
        ))
      )
    ),
    'Visione. Ogni domenica so su cosa lavorare lunedì, senza rileggere quaranta note. Problema. Selezionare costa più che eseguire. MVP. Punteggio configurabile e trasparente, matrice impatto/fattibilità, suggerimento motivato del prossimo passo.'
  ) returning id into doc;

  perform public.snapshot_document(doc, 'Prima stesura');

  -- ---------------------------------------------------------- canvas
  insert into public.canvases (workspace_id, project_id, title)
  values (ws, proj, 'Mappa del progetto') returning id into cv;

  insert into public.canvas_nodes (workspace_id, canvas_id, type, label, body, position_x, position_y, entity_type, entity_id)
  values (ws, cv, 'project', 'Radar delle idee', 'Cruscotto di selezione', 0, 0, 'project', proj);

  insert into public.canvas_nodes (workspace_id, canvas_id, type, label, body, position_x, position_y)
  values (ws, cv, 'note', 'Problema', 'Selezionare costa più che eseguire.', -280, 160)
  returning id into n_problem;

  insert into public.canvas_nodes (workspace_id, canvas_id, type, label, body, position_x, position_y)
  values (ws, cv, 'note', 'Soluzione', 'Punteggio trasparente + matrice.', 280, 160)
  returning id into n_solution;

  insert into public.canvas_nodes (workspace_id, canvas_id, type, label, body, position_x, position_y)
  values (ws, cv, 'goal', 'MVP interno', '5 minuti per decidere.', 0, 320)
  returning id into n_mvp;

  insert into public.canvas_nodes (workspace_id, canvas_id, type, label, body, position_x, position_y)
  values (ws, cv, 'risk', 'Rituale inutile', 'Se valutare costa troppo, nessuno lo fa.', 320, 380)
  returning id into n_risk;

  insert into public.canvas_edges (workspace_id, canvas_id, source_node_id, target_node_id, relation, label)
  select ws, cv, p.id, n_solution, 'derives_from', 'genera'
  from public.canvas_nodes p where p.canvas_id = cv and p.type = 'project' limit 1;

  insert into public.canvas_edges (workspace_id, canvas_id, source_node_id, target_node_id, relation, label)
  values
    (ws, cv, n_problem, n_solution, 'supports', 'motiva'),
    (ws, cv, n_solution, n_mvp, 'part_of', 'confluisce in'),
    (ws, cv, n_risk, n_mvp, 'blocks', 'minaccia');

  -- ------------------------------------------------------ relations
  insert into public.entity_relations (workspace_id, source_type, source_id, target_type, target_id, relation, created_by)
  values
    (ws, 'idea', idea_voice, 'idea', idea_radar, 'supports', uid),
    (ws, 'project', proj, 'idea', idea_radar, 'derives_from', uid);

  -- ---------------------------------------------------------- tags
  insert into public.tags (workspace_id, name, color) values
    (ws, 'prodotto', '#5B5CE2'),
    (ws, 'da validare', '#2DD4BF'),
    (ws, 'contenuti', '#F59E0B')
  on conflict do nothing;

  insert into public.entity_tags (workspace_id, tag_id, entity_type, entity_id)
  select ws, t.id, 'idea', idea_radar from public.tags t where t.workspace_id = ws and t.name = 'prodotto';
  insert into public.entity_tags (workspace_id, tag_id, entity_type, entity_id)
  select ws, t.id, 'idea', idea_news from public.tags t where t.workspace_id = ws and t.name = 'contenuti';

  -- ------------------------------------------------- weekly review
  insert into public.weekly_reviews (workspace_id, user_id, week_start, summary, focus_items, stats, completed_at)
  values (
    ws, uid, date_trunc('week', now() - interval '7 days')::date,
    'Settimana di discovery. Tre interviste, un criterio in meno. La matrice resta il pezzo che convince di più.',
    jsonb_build_array(
      jsonb_build_object('title', 'Chiudere i pesi predefiniti', 'done', true),
      jsonb_build_object('title', 'Prototipo matrice', 'done', false),
      jsonb_build_object('title', 'Terza intervista', 'done', false)
    ),
    jsonb_build_object('ideas_captured', 3, 'tasks_completed', 1, 'decisions', 1),
    now() - interval '6 days'
  );

  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values
    (ws, uid, 'created', 'project', proj, 'Progetto creato da un''idea'),
    (ws, uid, 'decided', 'decision', proj, 'Il punteggio resta modificabile a mano');

  return ws;
end;
$$;

-- Removes the demo workspace and everything inside it.
create or replace function public.remove_demo_workspace()
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  delete from public.workspaces w
  where w.owner_id = auth.uid()
    and w.settings ->> 'demo' = 'true';
$$;


-- ===================================================================
-- FINE. Verifica rapida (facoltativa): esegui questa query. Devi
-- ottenere 36 righe, tutte con rowsecurity = true.
-- ===================================================================
-- select tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
-- order by tablename;
-- Agentic sync v1.1 is applied by migrations/0016_agentic_sync_v11.sql.
alter table public.goals add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.milestones add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.tasks add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.decisions add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.risks add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.resources add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.canvas_nodes add column if not exists revision integer not null default 1 check (revision > 0);
create or replace function app.increment_entity_revision() returns trigger language plpgsql as $$
begin
  if row(new.*) is distinct from row(old.*) then new.revision := old.revision + 1; end if;
  return new;
end;
$$;
do $$ declare table_name text;
begin
  foreach table_name in array array['goals','milestones','tasks','decisions','risks','resources','canvas_nodes'] loop
    execute format('drop trigger if exists %I_revision on public.%I', table_name, table_name);
    execute format('create trigger %I_revision before update on public.%I for each row execute function app.increment_entity_revision()', table_name, table_name);
  end loop;
end $$;
create table if not exists public.agentic_imports (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, document_id uuid not null references public.documents(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade, schema_version text not null, source_revision integer not null,
  content_hash text not null, idempotency_key text not null, status text not null check (status in ('proposed','applied','rejected','conflict','failed','rolled_back')),
  merge_plan jsonb not null default '{}'::jsonb, source_content text not null, accepted_keys text[] not null default '{}', undo_payload jsonb, error_message text,
  applied_at timestamptz, created_at timestamptz not null default now(), unique(workspace_id,idempotency_key), unique(document_id,content_hash)
);
create index if not exists agentic_imports_project_idx on public.agentic_imports(project_id,created_at desc);
alter table public.agentic_imports enable row level security;
grant select,insert,update on public.agentic_imports to authenticated;
drop policy if exists agentic_imports_select on public.agentic_imports;
create policy agentic_imports_select on public.agentic_imports for select using (app.is_member(workspace_id));
drop policy if exists agentic_imports_insert on public.agentic_imports;
create policy agentic_imports_insert on public.agentic_imports for insert with check (app.can_write(workspace_id) and created_by=auth.uid());
drop policy if exists agentic_imports_update on public.agentic_imports;
create policy agentic_imports_update on public.agentic_imports for update using (app.can_write(workspace_id)) with check (app.can_write(workspace_id));
revoke delete on public.agentic_imports from authenticated;
+-- AI credit lifecycle v1.1: append-only, transactional and idempotent.
alter table public.ai_runs add column if not exists prompt_template_version text not null default '1.0';
alter table public.ai_runs add column if not exists schema_version text not null default '1.0';
alter table public.ai_runs add column if not exists input_hash text;
alter table public.ai_runs add column if not exists output_hash text;
alter table public.ai_runs add column if not exists generation_config jsonb not null default '{}'::jsonb;
alter table public.ai_runs add column if not exists idempotency_key text;
create unique index if not exists ai_runs_idempotency_idx on public.ai_runs(workspace_id, idempotency_key) where idempotency_key is not null;
alter table public.usage_ledger add column if not exists state text;
alter table public.usage_ledger add column if not exists idempotency_key text;
alter table public.usage_ledger add column if not exists run_id uuid references public.ai_runs(id) on delete set null;
alter table public.usage_ledger drop constraint if exists usage_ledger_state_check;
alter table public.usage_ledger add constraint usage_ledger_state_check check (state is null or state in ('requested','reserved','consumed','refunded','failed'));
create unique index if not exists usage_ledger_idempotent_state_idx on public.usage_ledger(workspace_id,idempotency_key,state) where idempotency_key is not null and state is not null;
create or replace function public.reserve_ai_credits(
  p_workspace_id uuid, p_run_id uuid, p_idempotency_key text, p_amount integer, p_feature text, p_monthly_limit integer
) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare used integer;
begin
  if not app.can_write(p_workspace_id) then raise exception 'not allowed to spend credits in this workspace' using errcode='insufficient_privilege'; end if;
  if p_amount < 0 or length(trim(p_idempotency_key)) < 8 then raise exception 'invalid credit reservation'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':' || date_trunc('month',now())::text, 0));
  if exists(select 1 from public.usage_ledger where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key and state='reserved') then
    select coalesce(sum(amount),0) into used from public.usage_ledger where workspace_id=p_workspace_id and kind='ai_credits' and occurred_at>=date_trunc('month',now());
    return used;
  end if;
  select coalesce(sum(amount),0) into used from public.usage_ledger where workspace_id=p_workspace_id and kind='ai_credits' and occurred_at>=date_trunc('month',now());
  if p_monthly_limit >= 0 and used + p_amount > p_monthly_limit then raise exception 'AI credit limit reached (% / %)',used,p_monthly_limit using errcode='check_violation'; end if;
  insert into public.usage_ledger(workspace_id,user_id,kind,amount,reference_type,reference_id,metadata,state,idempotency_key,run_id)
  values(p_workspace_id,auth.uid(),'ai_credits',0,null,p_run_id,jsonb_build_object('feature',p_feature),'requested',p_idempotency_key,p_run_id)
  on conflict do nothing;
  insert into public.usage_ledger(workspace_id,user_id,kind,amount,reference_type,reference_id,metadata,state,idempotency_key,run_id)
  values(p_workspace_id,auth.uid(),'ai_credits',p_amount,null,p_run_id,jsonb_build_object('feature',p_feature),'reserved',p_idempotency_key,p_run_id);
  return used+p_amount;
end; $$;
create or replace function public.finalize_ai_credits(
  p_workspace_id uuid, p_run_id uuid, p_idempotency_key text, p_outcome text, p_amount integer, p_reason text default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare event_amount integer := 0;
begin
  if not app.can_write(p_workspace_id) then raise exception 'not allowed' using errcode='insufficient_privilege'; end if;
  if p_outcome not in ('consumed','refunded','failed') then raise exception 'invalid credit outcome'; end if;
  if not exists(select 1 from public.usage_ledger where workspace_id=p_workspace_id and run_id=p_run_id and idempotency_key=p_idempotency_key and state='reserved') then raise exception 'reservation not found'; end if;
  if p_outcome='refunded' then event_amount := -abs(p_amount); end if;
  insert into public.usage_ledger(workspace_id,user_id,kind,amount,reference_type,reference_id,metadata,state,idempotency_key,run_id)
  values(p_workspace_id,auth.uid(),'ai_credits',event_amount,null,p_run_id,jsonb_strip_nulls(jsonb_build_object('reason',p_reason)),p_outcome,p_idempotency_key,p_run_id)
  on conflict do nothing;
end; $$;
revoke insert, update, delete on public.usage_ledger from authenticated;
alter function public.charge_ai_credits(uuid,integer,text,integer) security definer;
revoke all on function public.reserve_ai_credits(uuid,uuid,text,integer,text,integer) from public;
revoke all on function public.finalize_ai_credits(uuid,uuid,text,text,integer,text) from public;
grant execute on function public.reserve_ai_credits(uuid,uuid,text,integer,text,integer) to authenticated;
grant execute on function public.finalize_ai_credits(uuid,uuid,text,text,integer,text) to authenticated;
-- Real collaboration: project comments, mentions and secure invitation acceptance.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, document_id uuid references public.documents(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade, parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists comments_project_idx on public.comments(project_id,created_at) where deleted_at is null;
create table if not exists public.comment_mentions (
  comment_id uuid not null references public.comments(id) on delete cascade, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), read_at timestamptz,
  primary key(comment_id,user_id)
);
select app.attach_touch_trigger('public.comments');
grant select,insert,update,delete on public.comments,public.comment_mentions to authenticated;
alter table public.comments enable row level security;
drop policy if exists comments_select on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_update on public.comments;
drop policy if exists comments_delete on public.comments;
create policy comments_select on public.comments for select using (app.is_member(workspace_id));
create policy comments_insert on public.comments for insert with check (app.can_write(workspace_id) and author_id=auth.uid());
create policy comments_update on public.comments for update using (author_id=auth.uid()) with check (author_id=auth.uid() and app.can_write(workspace_id));
create policy comments_delete on public.comments for delete using (author_id=auth.uid() or app.can_admin(workspace_id));
alter table public.comment_mentions enable row level security;
drop policy if exists comment_mentions_select on public.comment_mentions;
drop policy if exists comment_mentions_insert on public.comment_mentions;
drop policy if exists comment_mentions_update on public.comment_mentions;
create policy comment_mentions_select on public.comment_mentions for select using (app.is_member(workspace_id));
create policy comment_mentions_insert on public.comment_mentions for insert with check (app.can_write(workspace_id));
create policy comment_mentions_update on public.comment_mentions for update using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists notifications_mentions_insert on public.notifications;
create policy notifications_mentions_insert on public.notifications for insert with check (
  kind='mention' and app.can_write(workspace_id) and exists(
    select 1 from public.workspace_members m where m.workspace_id=notifications.workspace_id and m.user_id=notifications.user_id
  )
);
create or replace function public.accept_workspace_invitation(p_token text)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare invitation public.workspace_invitations%rowtype; uid uuid:=auth.uid(); user_email text;
begin
  if uid is null then raise exception 'not authenticated' using errcode='insufficient_privilege'; end if;
  select lower(email) into user_email from auth.users where id=uid;
  select * into invitation from public.workspace_invitations where token=p_token and accepted_at is null and expires_at>now() for update;
  if invitation.id is null or lower(invitation.email)<>user_email then raise exception 'invitation invalid or expired' using errcode='insufficient_privilege'; end if;
  insert into public.workspace_members(workspace_id,user_id,role,invited_by) values(invitation.workspace_id,uid,invitation.role,invitation.invited_by)
  on conflict(workspace_id,user_id) do update set role=excluded.role, invited_by=excluded.invited_by;
  update public.workspace_invitations set accepted_at=now() where id=invitation.id;
  return invitation.workspace_id;
end; $$;
revoke all on function public.accept_workspace_invitation(text) from public;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- Backfill the owner node for canvases created before project canvas roots were mandatory.
insert into public.canvas_nodes (
  workspace_id, canvas_id, type, label, position_x, position_y,
  entity_type, entity_id, data
)
select p.workspace_id, c.id, 'project', p.name, 0, 0, 'project', p.id,
  jsonb_build_object(
    'icon', coalesce(p.emoji, '🧩'),
    'variant', case
      when exists (select 1 from public.canvas_nodes n where n.entity_type='project' and n.entity_id=p.id and n.data->>'variant'='tool') then 'tool'
      when p.parent_project_id is not null then 'subproject'
      else 'project'
    end,
    'root', true
  )
from public.canvases c join public.projects p on p.id=c.project_id
where c.deleted_at is null and not exists (
  select 1 from public.canvas_nodes n where n.canvas_id=c.id and n.entity_type='project' and n.entity_id=p.id
);

update public.canvas_nodes node
set data=coalesce(node.data,'{}'::jsonb)||jsonb_build_object('root',true)
from public.canvases canvas
where node.canvas_id=canvas.id and node.entity_type='project' and node.entity_id=canvas.project_id;
