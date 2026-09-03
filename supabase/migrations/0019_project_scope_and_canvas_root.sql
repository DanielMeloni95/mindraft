-- Every project-like entity has an explicit life/work scope and owns its canvas root node.
alter table public.projects add column if not exists context_scope text
  check (context_scope is null or char_length(trim(context_scope)) between 1 and 80);

insert into public.canvas_nodes (
  workspace_id, canvas_id, type, label, position_x, position_y,
  entity_type, entity_id, data
)
select
  p.workspace_id, c.id, 'project', p.name, 0, 0,
  'project', p.id,
  jsonb_build_object(
    'icon', coalesce(p.emoji, '🧩'),
    'variant', case
      when exists (
        select 1 from public.canvas_nodes external_node
        where external_node.entity_type = 'project'
          and external_node.entity_id = p.id
          and external_node.data->>'variant' = 'tool'
      ) then 'tool'
      when p.parent_project_id is not null then 'subproject'
      else 'project'
    end,
    'root', true
  )
from public.canvases c
join public.projects p on p.id = c.project_id
where c.deleted_at is null
  and not exists (
    select 1 from public.canvas_nodes root_node
    where root_node.canvas_id = c.id
      and root_node.entity_type = 'project'
      and root_node.entity_id = p.id
  );

update public.canvas_nodes node
set data = coalesce(node.data, '{}'::jsonb) || jsonb_build_object('root', true)
from public.canvases canvas
where node.canvas_id = canvas.id
  and node.entity_type = 'project'
  and node.entity_id = canvas.project_id;
