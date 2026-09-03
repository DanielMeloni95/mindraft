-- ===================================================================
-- Mindraft · RLS and schema behaviour test-suite
-- Run with: npm run db:verify
-- Any failed expectation aborts the script with a non-zero exit code.
-- ===================================================================

\set ON_ERROR_STOP on
\timing off

-- ------------------------------------------------------------ set-up
insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@mindraft.test', '{"full_name":"Alice"}'::jsonb),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@mindraft.test', '{"full_name":"Bob"}'::jsonb)
on conflict (id) do nothing;

select set_config('test.user_a', 'aaaaaaaa-0000-4000-8000-000000000001', false);
select set_config('test.user_b', 'bbbbbbbb-0000-4000-8000-000000000002', false);

select set_config('test.ws_a', (
  select id::text from public.workspaces where owner_id = current_setting('test.user_a')::uuid limit 1
), false);
select set_config('test.ws_b', (
  select id::text from public.workspaces where owner_id = current_setting('test.user_b')::uuid limit 1
), false);

do $$
begin
  if current_setting('test.ws_a', true) is null or current_setting('test.ws_a', true) = '' then
    raise exception 'FAIL: bootstrap did not create a personal workspace for Alice';
  end if;
  if not exists (
    select 1 from public.profiles where id = current_setting('test.user_a')::uuid
  ) then
    raise exception 'FAIL: bootstrap did not create a profile';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = current_setting('test.ws_a')::uuid
      and user_id = current_setting('test.user_a')::uuid
      and role = 'owner'
  ) then
    raise exception 'FAIL: owner membership missing';
  end if;
  if not exists (
    select 1 from public.subscriptions where workspace_id = current_setting('test.ws_a')::uuid and plan = 'free'
  ) then
    raise exception 'FAIL: free subscription row missing';
  end if;
  raise notice 'PASS  bootstrap creates profile, workspace, membership and subscription';
end $$;

-- ------------------------------------------- Alice writes in her space
set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), false);

insert into public.ideas (id, workspace_id, created_by, title, original_content, status)
values (
  'cccccccc-0000-4000-8000-000000000003',
  current_setting('test.ws_a')::uuid,
  current_setting('test.user_a')::uuid,
  'App per note vocali',
  'Registrare pensieri in auto e ritrovarli organizzati la sera.',
  'to_explore'
);

insert into public.projects (id, workspace_id, created_by, name, short_description)
values (
  'dddddddd-0000-4000-8000-000000000004',
  current_setting('test.ws_a')::uuid,
  current_setting('test.user_a')::uuid,
  'Mindraft MVP',
  'Primo rilascio funzionante.'
);

do $$
begin
  if (select count(*) from public.ideas) <> 1 then
    raise exception 'FAIL: Alice should see exactly her own idea, sees %', (select count(*) from public.ideas);
  end if;
  raise notice 'PASS  member can insert and read inside her workspace';
end $$;

-- ------------------------------------------- original content immutable
do $$
declare
  blocked boolean := false;
begin
  begin
    update public.ideas set original_content = 'riscritto dalla AI'
    where id = 'cccccccc-0000-4000-8000-000000000003';
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: original_content was overwritten';
  end if;
  raise notice 'PASS  original_content cannot be silently overwritten';
end $$;

-- Derived AI columns remain writable.
update public.ideas
set summary = 'Cattura vocale in mobilità, revisione la sera.', maturity = 'sketch'
where id = 'cccccccc-0000-4000-8000-000000000003';

do $$
begin
  if (select summary from public.ideas where id = 'cccccccc-0000-4000-8000-000000000003') is null then
    raise exception 'FAIL: derived columns should stay writable';
  end if;
  raise notice 'PASS  derived columns stay writable while the capture is frozen';
end $$;

-- ------------------------------------------------- Bob is locked out
select set_config('request.jwt.claim.sub', current_setting('test.user_b'), false);

do $$
begin
  if (select count(*) from public.ideas) <> 0 then
    raise exception 'FAIL: Bob can read % of Alice''s ideas', (select count(*) from public.ideas);
  end if;
  if (select count(*) from public.projects) <> 0 then
    raise exception 'FAIL: Bob can read Alice''s projects';
  end if;
  raise notice 'PASS  cross-workspace reads return nothing';
end $$;

do $$
declare
  blocked boolean := false;
begin
  begin
    insert into public.ideas (workspace_id, created_by, title, original_content)
    values (
      current_setting('test.ws_a')::uuid,
      current_setting('test.user_b')::uuid,
      'Intrusione', 'non dovrebbe esistere'
    );
  exception when insufficient_privilege or others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: Bob inserted a row into Alice''s workspace';
  end if;
  raise notice 'PASS  cross-workspace insert is rejected';
end $$;

do $$
declare
  affected int;
begin
  update public.ideas set title = 'hijacked'
  where id = 'cccccccc-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: Bob updated % rows in Alice''s workspace', affected;
  end if;

  delete from public.ideas where id = 'cccccccc-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: Bob deleted rows in Alice''s workspace';
  end if;
  raise notice 'PASS  cross-workspace update and delete affect zero rows';
end $$;

-- ------------------------------------------------------ viewer role
reset role;
insert into public.workspace_members (workspace_id, user_id, role)
values (current_setting('test.ws_a')::uuid, current_setting('test.user_b')::uuid, 'viewer')
on conflict (workspace_id, user_id) do update set role = 'viewer';

set role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_b'), false);

do $$
declare
  blocked boolean := false;
begin
  if (select count(*) from public.ideas) <> 1 then
    raise exception 'FAIL: viewer should read the workspace content';
  end if;
  begin
    insert into public.ideas (workspace_id, created_by, title, original_content)
    values (current_setting('test.ws_a')::uuid, current_setting('test.user_b')::uuid, 'Viewer', 'x');
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: viewer was allowed to write';
  end if;
  raise notice 'PASS  viewer can read but not write';
end $$;

-- --------------------------------------------------- search isolation
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), false);

do $$
declare
  hits int;
begin
  select count(*) into hits
  from public.search_workspace(current_setting('test.ws_a')::uuid, 'vocali');
  if hits < 1 then
    raise exception 'FAIL: full-text search found nothing for a matching term';
  end if;

  select count(*) into hits
  from public.search_workspace(current_setting('test.ws_b')::uuid, 'vocali');
  if hits <> 0 then
    raise exception 'FAIL: search leaked % rows across workspaces', hits;
  end if;
  raise notice 'PASS  search is ranked and workspace-scoped';
end $$;

-- ------------------------------------------------ document versioning
insert into public.documents (id, workspace_id, created_by, project_id, title, content, plain_text)
values (
  'eeeeeeee-0000-4000-8000-000000000005',
  current_setting('test.ws_a')::uuid,
  current_setting('test.user_a')::uuid,
  'dddddddd-0000-4000-8000-000000000004',
  'Documento di progetto',
  '{"type":"doc","content":[]}'::jsonb,
  ''
);

do $$
declare
  v1 uuid;
  v2 uuid;
  v3 uuid;
begin
  update public.documents set content = '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb, plain_text = 'primo'
  where id = 'eeeeeeee-0000-4000-8000-000000000005';
  v1 := public.snapshot_document('eeeeeeee-0000-4000-8000-000000000005', 'prima stesura');

  -- No content change: no new version.
  v2 := public.snapshot_document('eeeeeeee-0000-4000-8000-000000000005', 'ancora');

  update public.documents set content = '{"type":"doc","content":[{"type":"paragraph"},{"type":"paragraph"}]}'::jsonb
  where id = 'eeeeeeee-0000-4000-8000-000000000005';
  -- Content changed but no label and the previous snapshot is recent.
  v3 := public.snapshot_document('eeeeeeee-0000-4000-8000-000000000005', null, interval '10 minutes');

  if v1 is null then
    raise exception 'FAIL: explicit snapshot was not stored';
  end if;
  if v2 is not null then
    raise exception 'FAIL: identical content produced a second version';
  end if;
  if v3 is not null then
    raise exception 'FAIL: autosave within the debounce window created a version';
  end if;
  raise notice 'PASS  document versions are snapshots, not keystrokes';
end $$;

-- ----------------------------------------------- append-only ledgers
do $$
declare
  blocked boolean := false;
begin
  insert into public.usage_ledger (workspace_id, user_id, kind, amount)
  values (current_setting('test.ws_a')::uuid, current_setting('test.user_a')::uuid, 'ai_credits', 3);
  begin
    update public.usage_ledger set amount = 0
    where workspace_id = current_setting('test.ws_a')::uuid;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: usage ledger is not append-only';
  end if;
  raise notice 'PASS  usage ledger is append-only for end users';
end $$;

-- ------------------------------------------------------- demo seed
do $$
declare
  demo_ws uuid;
  again uuid;
begin
  demo_ws := public.seed_demo_workspace();
  if demo_ws is null then
    raise exception 'FAIL: demo seed returned nothing';
  end if;
  if (select count(*) from public.ideas where workspace_id = demo_ws) < 3 then
    raise exception 'FAIL: demo seed did not create ideas';
  end if;
  if (select count(*) from public.canvas_edges where workspace_id = demo_ws) < 4 then
    raise exception 'FAIL: demo seed did not wire the canvas';
  end if;
  if (select count(*) from public.document_versions dv
      join public.documents d on d.id = dv.document_id
      where d.workspace_id = demo_ws) < 1 then
    raise exception 'FAIL: demo document has no snapshot';
  end if;

  again := public.seed_demo_workspace();
  if again <> demo_ws then
    raise exception 'FAIL: demo seed is not idempotent';
  end if;

  perform public.remove_demo_workspace();
  if exists (select 1 from public.workspaces where id = demo_ws) then
    raise exception 'FAIL: demo workspace could not be removed';
  end if;
  raise notice 'PASS  demo workspace seeds, is idempotent and is removable';
end $$;

-- ------------------------------------------------------ AI credits
do $$
declare
  v_run_id uuid := '99999999-0000-4000-8000-000000000009';
  balance_once integer;
  balance_twice integer;
begin
  insert into public.ai_runs (id, workspace_id, user_id, feature, provider, status, idempotency_key)
  values (v_run_id, current_setting('test.ws_a')::uuid, current_setting('test.user_a')::uuid,
    'agentic-test', 'mock', 'pending', 'agentic-credit-test-001');
  balance_once := public.reserve_ai_credits(current_setting('test.ws_a')::uuid, v_run_id,
    'agentic-credit-test-001', 3, 'agentic-test', 100);
  balance_twice := public.reserve_ai_credits(current_setting('test.ws_a')::uuid, v_run_id,
    'agentic-credit-test-001', 3, 'agentic-test', 100);
  if balance_once <> balance_twice then raise exception 'FAIL: retry changed reserved balance'; end if;
  if (select count(*) from public.usage_ledger ul where ul.run_id=v_run_id and ul.state='reserved') <> 1 then
    raise exception 'FAIL: duplicate reservation event';
  end if;
  perform public.finalize_ai_credits(current_setting('test.ws_a')::uuid, v_run_id,
    'agentic-credit-test-001', 'refunded', 3, 'provider_error');
  if (select coalesce(sum(amount),0) from public.usage_ledger ul where ul.run_id=v_run_id) <> 0 then
    raise exception 'FAIL: refund did not compensate reservation';
  end if;
  raise notice 'PASS  AI credit reservation is idempotent and refundable';
end $$;

do $$
declare
  used integer;
  blocked boolean := false;
begin
  used := public.charge_ai_credits(current_setting('test.ws_a')::uuid, 2, 'idea_to_project', 100);
  if used < 2 then
    raise exception 'FAIL: credits were not accounted';
  end if;
  begin
    perform public.charge_ai_credits(current_setting('test.ws_a')::uuid, 5000, 'idea_to_project', 100);
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: the monthly AI limit was not enforced';
  end if;
  raise notice 'PASS  AI credits are metered and the plan limit is enforced';
end $$;

reset role;

select set_config('request.jwt.claim.sub', '', false);

\echo '--------------------------------------------------'
\echo 'All database expectations passed.'
\echo '--------------------------------------------------'
