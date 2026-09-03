-- Expand the useful taxonomy while keeping one controlled field.
alter table public.projects drop constraint if exists projects_tool_kind_check;
alter table public.projects add constraint projects_tool_kind_check
  check (tool_kind is null or tool_kind in ('tool','application','extension','markjs','api','library','service'));
