-- Mindraft · 0014 real nested projects
alter table public.projects
  add column if not exists parent_project_id uuid references public.projects (id) on delete set null;

create index if not exists projects_parent_idx on public.projects (parent_project_id) where deleted_at is null;

alter table public.projects
  drop constraint if exists projects_not_own_parent,
  add constraint projects_not_own_parent check (parent_project_id is null or parent_project_id <> id);
