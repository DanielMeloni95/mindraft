-- Mindraft · 0013 draggable arrow waypoint
alter table public.canvas_edges
  add column if not exists waypoint_x double precision,
  add column if not exists waypoint_y double precision;
