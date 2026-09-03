-- Mindraft agentic-sync v1.1: persistent revisions and auditable imports.
alter table public.goals add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.milestones add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.tasks add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.decisions add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.risks add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.resources add column if not exists revision integer not null default 1 check (revision > 0);
alter table public.canvas_nodes add column if not exists revision integer not null default 1 check (revision > 0);

create or replace function app.increment_entity_revision()
returns trigger language plpgsql as $$
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
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  schema_version text not null,
  source_revision integer not null,
  content_hash text not null,
  idempotency_key text not null,
  status text not null check (status in ('proposed','applied','rejected','conflict','failed','rolled_back')),
  merge_plan jsonb not null default '{}'::jsonb,
  source_content text not null,
  accepted_keys text[] not null default '{}',
  undo_payload jsonb,
  error_message text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  unique (document_id, content_hash)
);
create index if not exists agentic_imports_project_idx on public.agentic_imports(project_id, created_at desc);
alter table public.agentic_imports enable row level security;
grant select,insert,update on public.agentic_imports to authenticated;
create policy agentic_imports_select on public.agentic_imports for select using (app.is_workspace_member(workspace_id));
create policy agentic_imports_insert on public.agentic_imports for insert with check (app.can_write_workspace(workspace_id) and created_by = auth.uid());
create policy agentic_imports_update on public.agentic_imports for update using (app.can_write_workspace(workspace_id)) with check (app.can_write_workspace(workspace_id));
revoke delete on public.agentic_imports from authenticated;
