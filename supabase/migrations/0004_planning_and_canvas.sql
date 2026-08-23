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
