-- ===================================================================
-- Mindraft · 0001 foundation
-- Extensions, enums, shared helper functions and triggers.
-- ===================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
-- Optional, enabled on Supabase for the semantic-search roadmap item.
-- create extension if not exists "vector";

create schema if not exists app;
comment on schema app is 'Internal helper functions for Mindraft (not exposed via PostgREST).';

-- --------------------------------------------------------------- enums

do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_tier as enum ('free', 'personal', 'pro', 'team');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inbox_kind as enum ('text', 'url', 'image', 'file', 'audio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inbox_status as enum ('unprocessed', 'processed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.idea_status as enum (
    'inbox', 'to_explore', 'analyzing', 'promising', 'converted', 'paused', 'discarded', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.idea_maturity as enum ('spark', 'sketch', 'shaped', 'validated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum (
    'idea', 'exploration', 'validation', 'design', 'development', 'paused', 'completed', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_health as enum ('unknown', 'on_track', 'at_risk', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.decision_status as enum ('proposed', 'approved', 'superseded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.severity_level as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.milestone_status as enum ('planned', 'in_progress', 'done', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.entity_type as enum (
    'inbox_item', 'idea', 'project', 'document', 'goal', 'milestone',
    'task', 'decision', 'risk', 'resource', 'canvas_node', 'note'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.relation_type as enum (
    'derives_from', 'depends_on', 'supports', 'contradicts',
    'part_of', 'blocks', 'replaces', 'relates_to'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.canvas_node_type as enum (
    'idea', 'project', 'note', 'goal', 'feature', 'task',
    'decision', 'risk', 'resource', 'text', 'group'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_run_status as enum ('pending', 'running', 'succeeded', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_proposal_status as enum ('pending', 'applied', 'partially_applied', 'rejected', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_origin as enum ('user', 'ai', 'import');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------- functions

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function app.touch_updated_at is 'Keeps updated_at honest regardless of the client.';

-- Attaches the updated_at trigger to a table in the public schema.
create or replace function app.attach_touch_trigger(target regclass)
returns void
language plpgsql
as $$
declare
  trg_name text := 'trg_touch_' || replace(target::text, 'public.', '');
begin
  execute format(
    'drop trigger if exists %I on %s',
    trg_name, target::text
  );
  execute format(
    'create trigger %I before update on %s for each row execute function app.touch_updated_at()',
    trg_name, target::text
  );
end;
$$;

-- Role ranking used by the RLS policies.
create or replace function app.role_rank(r public.workspace_role)
returns int
language sql
immutable
as $$
  select case r
    when 'owner' then 4
    when 'admin' then 3
    when 'editor' then 2
    when 'viewer' then 1
    else 0
  end;
$$;
