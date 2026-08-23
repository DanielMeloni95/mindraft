-- ===================================================================
-- Mindraft · 0002 identity, workspaces, billing scaffolding
-- ===================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  locale text not null default 'it',
  primary_use text,
  focus_areas text[] not null default '{}',
  guidance_level text not null default 'balanced'
    check (guidance_level in ('minimal', 'balanced', 'guided')),
  onboarding_completed_at timestamptz,
  onboarding_step smallint not null default 0,
  dashboard_modules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  slug text not null unique,
  is_personal boolean not null default true,
  owner_id uuid not null references auth.users (id) on delete cascade,
  plan public.plan_tier not null default 'free',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists workspaces_owner_idx on public.workspaces (owner_id);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'editor',
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'editor',
  invited_by uuid not null references auth.users (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  plan public.plan_tier not null default 'free',
  status public.subscription_status not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only ledger: one row per billable action (AI credits, storage, …).
create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('ai_credits', 'storage_bytes', 'export', 'import')),
  amount integer not null,
  reference_type public.entity_type,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists usage_ledger_ws_time_idx
  on public.usage_ledger (workspace_id, occurred_at desc);
create index if not exists usage_ledger_ws_kind_idx
  on public.usage_ledger (workspace_id, kind, occurred_at desc);

-- Idempotency guard for Stripe webhooks.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.feature_flags (
  key text primary key,
  description text,
  enabled boolean not null default false,
  audience jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select app.attach_touch_trigger('public.profiles');
select app.attach_touch_trigger('public.workspaces');
select app.attach_touch_trigger('public.workspace_members');
select app.attach_touch_trigger('public.workspace_invitations');
select app.attach_touch_trigger('public.subscriptions');
select app.attach_touch_trigger('public.feature_flags');

-- ------------------------------------------------- membership helpers
-- security definer so that policies on workspace_members never recurse.

create or replace function app.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function app.member_role(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid();
$$;

create or replace function app.can_write(ws uuid)
returns boolean
language sql
stable
as $$
  select app.role_rank(app.member_role(ws)) >= app.role_rank('editor');
$$;

create or replace function app.can_admin(ws uuid)
returns boolean
language sql
stable
as $$
  select app.role_rank(app.member_role(ws)) >= app.role_rank('admin');
$$;

grant usage on schema app to authenticated, anon, service_role;
grant execute on all functions in schema app to authenticated, service_role;

-- ------------------------------------------------ new-user bootstrap
-- Every new account gets a profile and a personal workspace, so the app
-- never has to deal with a "user without workspace" state.

create or replace function app.bootstrap_user(p_user_id uuid, p_email text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ws_id uuid;
  base_slug text;
  final_slug text;
  suffix int := 0;
begin
  insert into public.profiles (id, full_name)
  values (p_user_id, coalesce(nullif(trim(p_full_name), ''), split_part(coalesce(p_email, 'utente'), '@', 1)))
  on conflict (id) do nothing;

  select w.id into ws_id
  from public.workspaces w
  where w.owner_id = p_user_id and w.is_personal and w.deleted_at is null
  limit 1;

  if ws_id is not null then
    return ws_id;
  end if;

  base_slug := coalesce(
    nullif(regexp_replace(lower(split_part(coalesce(p_email, ''), '@', 1)), '[^a-z0-9]+', '-', 'g'), ''),
    'workspace'
  );
  final_slug := base_slug;
  while exists (select 1 from public.workspaces w where w.slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.workspaces (name, slug, is_personal, owner_id)
  values ('Il mio spazio', final_slug, true, p_user_id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, p_user_id, 'owner')
  on conflict do nothing;

  insert into public.subscriptions (workspace_id, plan, status)
  values (ws_id, 'free', 'active')
  on conflict (workspace_id) do nothing;

  return ws_id;
end;
$$;

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform app.bootstrap_user(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
