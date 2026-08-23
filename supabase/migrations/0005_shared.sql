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
