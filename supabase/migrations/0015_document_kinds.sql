-- Separate the free-form project document from the agentic source document.
alter table public.documents
  add column if not exists kind text not null default 'document'
  check (kind in ('document', 'agentic'));

drop index if exists public.documents_project_unique;
create unique index if not exists documents_project_kind_unique
  on public.documents (project_id, kind)
  where project_id is not null and deleted_at is null;

insert into public.documents (
  workspace_id, created_by, project_id, title, kind, content, plain_text
)
select
  p.workspace_id,
  p.created_by,
  p.id,
  p.name || ' — documento agentico',
  'agentic',
  '{"type":"doc","content":[]}'::jsonb,
  ''
from public.projects p
where p.deleted_at is null
  and not exists (
    select 1 from public.documents d
    where d.project_id = p.id and d.kind = 'agentic' and d.deleted_at is null
  );
