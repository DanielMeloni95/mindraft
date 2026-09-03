-- Explicit classification for project-backed tools.
alter table public.projects add column if not exists tool_kind text
  check (tool_kind is null or tool_kind in ('tool','extension','markjs'));

update public.projects project
set tool_kind = 'tool'
where tool_kind is null and exists (
  select 1 from public.canvas_nodes node
  where node.entity_type = 'project'
    and node.entity_id = project.id
    and node.data->>'variant' = 'tool'
);
