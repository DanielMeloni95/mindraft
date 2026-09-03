-- Real collaboration: project comments, mentions and secure invitation acceptance.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, document_id uuid references public.documents(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade, parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists comments_project_idx on public.comments(project_id,created_at) where deleted_at is null;
create table if not exists public.comment_mentions (
  comment_id uuid not null references public.comments(id) on delete cascade, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), read_at timestamptz,
  primary key(comment_id,user_id)
);
select app.attach_touch_trigger('public.comments');
grant select,insert,update,delete on public.comments,public.comment_mentions to authenticated;
alter table public.comments enable row level security;
drop policy if exists comments_select on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_update on public.comments;
drop policy if exists comments_delete on public.comments;
create policy comments_select on public.comments for select using (app.is_member(workspace_id));
create policy comments_insert on public.comments for insert with check (app.can_write(workspace_id) and author_id=auth.uid());
create policy comments_update on public.comments for update using (author_id=auth.uid()) with check (author_id=auth.uid() and app.can_write(workspace_id));
create policy comments_delete on public.comments for delete using (author_id=auth.uid() or app.can_admin(workspace_id));
alter table public.comment_mentions enable row level security;
drop policy if exists comment_mentions_select on public.comment_mentions;
drop policy if exists comment_mentions_insert on public.comment_mentions;
drop policy if exists comment_mentions_update on public.comment_mentions;
create policy comment_mentions_select on public.comment_mentions for select using (app.is_member(workspace_id));
create policy comment_mentions_insert on public.comment_mentions for insert with check (app.can_write(workspace_id));
create policy comment_mentions_update on public.comment_mentions for update using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists notifications_mentions_insert on public.notifications;
create policy notifications_mentions_insert on public.notifications for insert with check (
  kind='mention' and app.can_write(workspace_id) and exists(
    select 1 from public.workspace_members m where m.workspace_id=notifications.workspace_id and m.user_id=notifications.user_id
  )
);

create or replace function public.accept_workspace_invitation(p_token text)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare invitation public.workspace_invitations%rowtype; uid uuid:=auth.uid(); user_email text;
begin
  if uid is null then raise exception 'not authenticated' using errcode='insufficient_privilege'; end if;
  select lower(email) into user_email from auth.users where id=uid;
  select * into invitation from public.workspace_invitations where token=p_token and accepted_at is null and expires_at>now() for update;
  if invitation.id is null or lower(invitation.email)<>user_email then raise exception 'invitation invalid or expired' using errcode='insufficient_privilege'; end if;
  insert into public.workspace_members(workspace_id,user_id,role,invited_by) values(invitation.workspace_id,uid,invitation.role,invitation.invited_by)
  on conflict(workspace_id,user_id) do update set role=excluded.role, invited_by=excluded.invited_by;
  update public.workspace_invitations set accepted_at=now() where id=invitation.id;
  return invitation.workspace_id;
end; $$;
revoke all on function public.accept_workspace_invitation(text) from public;
grant execute on function public.accept_workspace_invitation(text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; when undefined_object then null;
end $$;
