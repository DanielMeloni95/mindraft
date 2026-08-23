-- ===================================================================
-- Mindraft · 0007 Row Level Security
-- Every table reachable through PostgREST is protected. Authorisation
-- is derived from workspace membership and role, never from the client.
-- ===================================================================

-- Note: FORCE ROW LEVEL SECURITY is intentionally not used. The tables
-- are owned by the `postgres` role, which no application path connects
-- as; forcing it would also break the SECURITY DEFINER membership
-- helpers and the Supabase SQL editor.

-- ------------------------------------------- generic workspace tables
do $$
declare
  t text;
  workspace_tables text[] := array[
    'inbox_items', 'ideas', 'idea_scores', 'projects', 'project_sections',
    'documents', 'document_versions', 'goals', 'milestones', 'tasks',
    'task_dependencies', 'decisions', 'risks', 'resources',
    'canvases', 'canvas_nodes', 'canvas_edges',
    'tags', 'entity_tags', 'entity_relations', 'attachments',
    'ai_runs', 'ai_proposals', 'activity_log'
  ];
begin
  foreach t in array workspace_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select using (app.is_member(workspace_id))',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert with check (app.can_write(workspace_id))',
      t || '_insert', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update using (app.can_write(workspace_id)) with check (app.can_write(workspace_id))',
      t || '_update', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete using (app.can_write(workspace_id))',
      t || '_delete', t
    );
  end loop;
end $$;

-- activity_log and ai_runs are written by the app but must never be
-- rewritten afterwards.
drop policy if exists activity_log_update on public.activity_log;
drop policy if exists activity_log_delete on public.activity_log;

-- ---------------------------------------------------------- profiles
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members me
      join public.workspace_members other on other.workspace_id = me.workspace_id
      where me.user_id = auth.uid() and other.user_id = public.profiles.id
    )
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- -------------------------------------------------------- workspaces
alter table public.workspaces enable row level security;

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select using (app.is_member(id));

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update using (app.can_admin(id)) with check (app.can_admin(id));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete using (owner_id = auth.uid());

-- --------------------------------------------------- workspace members
alter table public.workspace_members enable row level security;

drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select using (user_id = auth.uid() or app.is_member(workspace_id));

drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members
  for insert with check (
    app.can_admin(workspace_id)
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members
  for update using (app.can_admin(workspace_id)) with check (app.can_admin(workspace_id));

drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members
  for delete using (app.can_admin(workspace_id) or user_id = auth.uid());

-- ----------------------------------------------------- invitations
alter table public.workspace_invitations enable row level security;

drop policy if exists workspace_invitations_select on public.workspace_invitations;
create policy workspace_invitations_select on public.workspace_invitations
  for select using (app.can_admin(workspace_id));

drop policy if exists workspace_invitations_write on public.workspace_invitations;
create policy workspace_invitations_write on public.workspace_invitations
  for all using (app.can_admin(workspace_id)) with check (app.can_admin(workspace_id));

-- -------------------------------------------- billing (read-only side)
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (app.is_member(workspace_id));
-- Writes happen exclusively through the Stripe webhook (service role).

alter table public.usage_ledger enable row level security;

drop policy if exists usage_ledger_select on public.usage_ledger;
create policy usage_ledger_select on public.usage_ledger
  for select using (app.is_member(workspace_id));

drop policy if exists usage_ledger_insert on public.usage_ledger;
create policy usage_ledger_insert on public.usage_ledger
  for insert with check (app.is_member(workspace_id) and user_id = auth.uid());

alter table public.stripe_events enable row level security;
-- No policy at all: service role only.

-- ------------------------------------------------------ user-scoped
do $$
declare
  t text;
begin
  foreach t in array array['saved_views', 'notifications', 'weekly_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all using (user_id = auth.uid() and app.is_member(workspace_id)) with check (user_id = auth.uid() and app.is_member(workspace_id))',
      t || '_own', t
    );
  end loop;
end $$;

-- Shared saved views are readable by the whole workspace.
drop policy if exists saved_views_shared_select on public.saved_views;
create policy saved_views_shared_select on public.saved_views
  for select using (is_shared and app.is_member(workspace_id));

-- ------------------------------------------------- flags and feedback
alter table public.feature_flags enable row level security;

drop policy if exists feature_flags_select on public.feature_flags;
create policy feature_flags_select on public.feature_flags
  for select to authenticated using (true);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert with check (user_id = auth.uid());

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select using (user_id = auth.uid());

-- --------------------------------------------------------- grants
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.search_index to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

-- The ledger and the log are append-only for end users.
revoke update, delete on public.usage_ledger from authenticated;
revoke update, delete on public.activity_log from authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
revoke all on public.stripe_events from authenticated, anon;
