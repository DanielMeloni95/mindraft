-- AI credit lifecycle v1.1: append-only, transactional and idempotent.
alter table public.ai_runs add column if not exists prompt_template_version text not null default '1.0';
alter table public.ai_runs add column if not exists schema_version text not null default '1.0';
alter table public.ai_runs add column if not exists input_hash text;
alter table public.ai_runs add column if not exists output_hash text;
alter table public.ai_runs add column if not exists generation_config jsonb not null default '{}'::jsonb;
alter table public.ai_runs add column if not exists idempotency_key text;
create unique index if not exists ai_runs_idempotency_idx on public.ai_runs(workspace_id, idempotency_key) where idempotency_key is not null;

alter table public.usage_ledger add column if not exists state text;
alter table public.usage_ledger add column if not exists idempotency_key text;
alter table public.usage_ledger add column if not exists run_id uuid references public.ai_runs(id) on delete set null;
alter table public.usage_ledger drop constraint if exists usage_ledger_state_check;
alter table public.usage_ledger add constraint usage_ledger_state_check check (state is null or state in ('requested','reserved','consumed','refunded','failed'));
create unique index if not exists usage_ledger_idempotent_state_idx on public.usage_ledger(workspace_id,idempotency_key,state) where idempotency_key is not null and state is not null;

create or replace function public.reserve_ai_credits(
  p_workspace_id uuid, p_run_id uuid, p_idempotency_key text, p_amount integer, p_feature text, p_monthly_limit integer
) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare used integer;
begin
  if not app.can_write(p_workspace_id) then raise exception 'not allowed to spend credits in this workspace' using errcode='insufficient_privilege'; end if;
  if p_amount < 0 or length(trim(p_idempotency_key)) < 8 then raise exception 'invalid credit reservation'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':' || date_trunc('month',now())::text, 0));
  if exists(select 1 from public.usage_ledger where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key and state='reserved') then
    select coalesce(sum(amount),0) into used from public.usage_ledger where workspace_id=p_workspace_id and kind='ai_credits' and occurred_at>=date_trunc('month',now());
    return used;
  end if;
  select coalesce(sum(amount),0) into used from public.usage_ledger where workspace_id=p_workspace_id and kind='ai_credits' and occurred_at>=date_trunc('month',now());
  if p_monthly_limit >= 0 and used + p_amount > p_monthly_limit then raise exception 'AI credit limit reached (% / %)',used,p_monthly_limit using errcode='check_violation'; end if;
  insert into public.usage_ledger(workspace_id,user_id,kind,amount,reference_type,reference_id,metadata,state,idempotency_key,run_id)
  values(p_workspace_id,auth.uid(),'ai_credits',0,null,p_run_id,jsonb_build_object('feature',p_feature),'requested',p_idempotency_key,p_run_id)
  on conflict do nothing;
  insert into public.usage_ledger(workspace_id,user_id,kind,amount,reference_type,reference_id,metadata,state,idempotency_key,run_id)
  values(p_workspace_id,auth.uid(),'ai_credits',p_amount,null,p_run_id,jsonb_build_object('feature',p_feature),'reserved',p_idempotency_key,p_run_id);
  return used+p_amount;
end; $$;

create or replace function public.finalize_ai_credits(
  p_workspace_id uuid, p_run_id uuid, p_idempotency_key text, p_outcome text, p_amount integer, p_reason text default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare event_amount integer := 0;
begin
  if not app.can_write(p_workspace_id) then raise exception 'not allowed' using errcode='insufficient_privilege'; end if;
  if p_outcome not in ('consumed','refunded','failed') then raise exception 'invalid credit outcome'; end if;
  if not exists(select 1 from public.usage_ledger where workspace_id=p_workspace_id and run_id=p_run_id and idempotency_key=p_idempotency_key and state='reserved') then raise exception 'reservation not found'; end if;
  if p_outcome='refunded' then event_amount := -abs(p_amount); end if;
  insert into public.usage_ledger(workspace_id,user_id,kind,amount,reference_type,reference_id,metadata,state,idempotency_key,run_id)
  values(p_workspace_id,auth.uid(),'ai_credits',event_amount,null,p_run_id,jsonb_strip_nulls(jsonb_build_object('reason',p_reason)),p_outcome,p_idempotency_key,p_run_id)
  on conflict do nothing;
end; $$;

-- Ledger rows can only be emitted by the guarded RPCs, never forged by clients.
revoke insert, update, delete on public.usage_ledger from authenticated;
alter function public.charge_ai_credits(uuid,integer,text,integer) security definer;
revoke all on function public.reserve_ai_credits(uuid,uuid,text,integer,text,integer) from public;
revoke all on function public.finalize_ai_credits(uuid,uuid,text,text,integer,text) from public;
grant execute on function public.reserve_ai_credits(uuid,uuid,text,integer,text,integer) to authenticated;
grant execute on function public.finalize_ai_credits(uuid,uuid,text,text,integer,text) to authenticated;
