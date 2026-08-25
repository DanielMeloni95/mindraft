-- Mindraft · 0010 realtime canvas collaboration
-- Full old rows make filtered DELETE events reliable for all clients.
alter table public.canvas_nodes replica identity full;
alter table public.canvas_edges replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'canvas_nodes'
  ) then
    alter publication supabase_realtime add table public.canvas_nodes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'canvas_edges'
  ) then
    alter publication supabase_realtime add table public.canvas_edges;
  end if;
end
$$;
