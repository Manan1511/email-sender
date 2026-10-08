-- Trigger helpers should not be exposed as callable API functions.
-- Runs as the database role performing the insert; the worker uses service_role,
-- which already has the required table privileges.
alter function public.refresh_batch_counts() security invoker;
revoke all on function public.refresh_batch_counts() from public, anon, authenticated;
grant execute on function public.refresh_batch_counts() to service_role;

-- Supabase creates this SECURITY DEFINER event-trigger helper when automatic
-- RLS is enabled. Keep the DDL trigger intact while removing Data API access.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

-- Cover foreign-key lookups used by owner checks, history views, and cleanup.
create index if not exists attachments_user_id_idx on public.attachments(user_id);
create index if not exists send_attempts_batch_id_idx on public.send_attempts(batch_id);
create index if not exists send_attempts_recipient_id_idx on public.send_attempts(recipient_id);
