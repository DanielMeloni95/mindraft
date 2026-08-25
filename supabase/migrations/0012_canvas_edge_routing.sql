-- Mindraft · 0012 editable arrow routing
alter table public.canvas_edges
  add column if not exists source_handle text not null default 'right',
  add column if not exists target_handle text not null default 'left',
  add column if not exists route_style text not null default 'smoothstep';

alter table public.canvas_edges
  drop constraint if exists canvas_edges_source_handle_check,
  add constraint canvas_edges_source_handle_check check (source_handle in ('top', 'right', 'bottom', 'left')),
  drop constraint if exists canvas_edges_target_handle_check,
  add constraint canvas_edges_target_handle_check check (target_handle in ('top', 'right', 'bottom', 'left')),
  drop constraint if exists canvas_edges_route_style_check,
  add constraint canvas_edges_route_style_check check (route_style in ('smoothstep', 'bezier', 'straight'));
