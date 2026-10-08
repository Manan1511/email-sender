create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  subject text not null check (length(subject) between 1 and 200),
  body_html text not null check (length(body_html) between 1 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  token_ciphertext text not null,
  token_iv text not null,
  token_tag text not null,
  reauth_required boolean not null default false,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 180),
  mime_type text not null check (length(mime_type) between 1 and 120),
  size bigint not null check (size between 1 and 10485760),
  storage_path text not null unique,
  uploaded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  status text not null default 'queued' check (status in ('queued', 'sending', 'paused', 'completed', 'completed_with_errors')),
  subject_template text not null,
  body_template_html text not null,
  sender_name text not null,
  sender_email text not null,
  sender_phone text not null default '',
  attachment_ids uuid[] not null default '{}',
  total_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  needs_review_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  worker_lease_id uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(user_id, idempotency_key)
);

create index if not exists batches_user_created_idx on public.batches(user_id, created_at desc);
create index if not exists batches_recovery_idx on public.batches(status, lease_expires_at);
create unique index if not exists batches_one_active_per_user on public.batches(user_id) where status in ('queued', 'sending', 'paused');

create table if not exists public.batch_recipients (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null default '',
  poc_name text not null default '',
  email text not null default '',
  designation text not null default '',
  source_row integer not null,
  fields jsonb not null default '{}',
  subject text not null default '',
  body_html text not null default '',
  body_text text not null default '',
  status text not null check (status in ('queued', 'sending', 'sent', 'failed', 'needs_review', 'skipped')),
  reason text,
  attempt_count integer not null default 0,
  gmail_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists batch_recipients_batch_row_idx on public.batch_recipients(batch_id, source_row);
create index if not exists batch_recipients_user_batch_idx on public.batch_recipients(user_id, batch_id);

create table if not exists public.send_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  recipient_id uuid references public.batch_recipients(id) on delete set null,
  kind text not null check (kind in ('batch', 'retry', 'test')),
  state text not null default 'reserved' check (state in ('reserved', 'accepted', 'rejected', 'needs_review')),
  gmail_message_id text,
  http_status integer,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists send_attempts_user_created_idx on public.send_attempts(user_id, created_at desc);
create index if not exists send_attempts_app_created_idx on public.send_attempts(created_at desc);

create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  primary key(user_id, bucket)
);

alter table public.profiles enable row level security;
alter table public.templates enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.attachments enable row level security;
alter table public.batches enable row level security;
alter table public.batch_recipients enable row level security;
alter table public.send_attempts enable row level security;
alter table public.api_rate_limits enable row level security;

drop policy if exists profiles_owner_access on public.profiles;
create policy profiles_owner_access on public.profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists templates_owner_access on public.templates;
create policy templates_owner_access on public.templates for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists attachments_owner_read on public.attachments;
create policy attachments_owner_read on public.attachments for select to authenticated using (user_id = (select auth.uid()) and uploaded_at is not null);
drop policy if exists batches_owner_read on public.batches;
create policy batches_owner_read on public.batches for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists recipients_owner_read on public.batch_recipients;
create policy recipients_owner_read on public.batch_recipients for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists attempts_owner_read on public.send_attempts;
create policy attempts_owner_read on public.send_attempts for select to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.profiles, public.templates to authenticated;
grant select on public.attachments, public.batches, public.batch_recipients, public.send_attempts to authenticated;
revoke all on public.gmail_connections, public.api_rate_limits from anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists attachment_storage_owner_read on storage.objects;
create policy attachment_storage_owner_read on storage.objects for select to authenticated using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists attachment_storage_owner_insert on storage.objects;
create policy attachment_storage_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists attachment_storage_owner_update on storage.objects;
create policy attachment_storage_owner_update on storage.objects for update to authenticated using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists attachment_storage_owner_delete on storage.objects;
create policy attachment_storage_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.refresh_batch_counts()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare target_batch uuid := coalesce(new.batch_id, old.batch_id);
begin
  update public.batches b set
    total_count = (select count(*) from public.batch_recipients r where r.batch_id = target_batch),
    success_count = (select count(*) from public.batch_recipients r where r.batch_id = target_batch and r.status = 'sent'),
    failed_count = (select count(*) from public.batch_recipients r where r.batch_id = target_batch and r.status = 'failed'),
    needs_review_count = (select count(*) from public.batch_recipients r where r.batch_id = target_batch and r.status = 'needs_review'),
    skipped_count = (select count(*) from public.batch_recipients r where r.batch_id = target_batch and r.status = 'skipped'),
    updated_at = now()
  where b.id = target_batch;
  return coalesce(new, old);
end $$;

drop trigger if exists batch_recipients_refresh_counts on public.batch_recipients;
create trigger batch_recipients_refresh_counts after insert or update or delete on public.batch_recipients for each row execute function public.refresh_batch_counts();

create or replace function public.consume_user_rate_limit(p_user_id uuid, p_bucket text default 'general', p_limit integer default 120, p_window_seconds integer default 60)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare current_row public.api_rate_limits%rowtype;
begin
  insert into public.api_rate_limits(user_id, bucket, window_started_at, request_count)
  values (p_user_id, p_bucket, now(), 1)
  on conflict (user_id, bucket) do nothing;
  select * into current_row from public.api_rate_limits where user_id = p_user_id and bucket = p_bucket for update;
  if current_row.window_started_at + make_interval(secs => p_window_seconds) <= now() then
    update public.api_rate_limits set window_started_at = now(), request_count = 1 where user_id = p_user_id and bucket = p_bucket;
    return true;
  end if;
  if current_row.request_count >= p_limit then return false; end if;
  update public.api_rate_limits set request_count = request_count + 1 where user_id = p_user_id and bucket = p_bucket;
  return true;
end $$;

create or replace function public.reserve_attachment(p_user_id uuid, p_name text, p_mime_type text, p_size bigint, p_storage_path text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare app_total bigint; user_total bigint; inserted public.attachments%rowtype;
begin
  if p_size < 1 or p_size > 10485760 or p_storage_path not like p_user_id::text || '/%' then
    return jsonb_build_object('allowed', false, 'reason', 'File is invalid or exceeds 10 MB.');
  end if;
  perform pg_advisory_xact_lock(7302101, 1);
  select coalesce(sum(size), 0) into app_total from public.attachments where created_at >= now() - interval '30 days';
  select coalesce(sum(size), 0) into user_total from public.attachments where user_id = p_user_id and created_at >= now() - interval '30 days';
  if app_total + p_size > 500 * 1024 * 1024 then return jsonb_build_object('allowed', false, 'reason', 'Shared attachment storage is full. Remove old files or try again later.'); end if;
  if user_total + p_size > 50 * 1024 * 1024 then return jsonb_build_object('allowed', false, 'reason', 'Your saved attachments total 50 MB. Remove an old file first.'); end if;
  insert into public.attachments(user_id, name, mime_type, size, storage_path) values (p_user_id, p_name, p_mime_type, p_size, p_storage_path) returning * into inserted;
  return jsonb_build_object('allowed', true, 'id', inserted.id);
end $$;

create or replace function public.complete_attachment_upload(p_user_id uuid, p_attachment_id uuid, p_actual_size bigint)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare app_total bigint; user_total bigint; attachment_row public.attachments%rowtype;
begin
  if p_actual_size < 1 or p_actual_size > 10485760 then return jsonb_build_object('allowed', false, 'reason', 'Uploaded file exceeds 10 MB.'); end if;
  perform pg_advisory_xact_lock(7302101, 1);
  select * into attachment_row from public.attachments where id = p_attachment_id and user_id = p_user_id for update;
  if not found then return jsonb_build_object('allowed', false, 'reason', 'Attachment reservation expired. Upload the file again.'); end if;
  select coalesce(sum(size), 0) into app_total from public.attachments where created_at >= now() - interval '30 days' and id <> p_attachment_id;
  select coalesce(sum(size), 0) into user_total from public.attachments where user_id = p_user_id and created_at >= now() - interval '30 days' and id <> p_attachment_id;
  if app_total + p_actual_size > 500 * 1024 * 1024 then return jsonb_build_object('allowed', false, 'reason', 'Shared attachment storage is full. Remove old files or try again later.'); end if;
  if user_total + p_actual_size > 50 * 1024 * 1024 then return jsonb_build_object('allowed', false, 'reason', 'Your saved attachments total 50 MB. Remove an old file first.'); end if;
  update public.attachments set size = p_actual_size, uploaded_at = now() where id = p_attachment_id;
  return jsonb_build_object('allowed', true);
end $$;

create or replace function public.create_email_batch(
  p_user_id uuid, p_idempotency_key uuid, p_subject_template text, p_body_template_html text,
  p_sender_name text, p_sender_email text, p_sender_phone text, p_attachment_ids uuid[], p_recipients jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare existing public.batches%rowtype; new_batch public.batches%rowtype; recipient jsonb; count_valid integer; count_skipped integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into existing from public.batches where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('batch_id', existing.id, 'existing', true, 'valid_count', existing.total_count - existing.skipped_count, 'skipped_count', existing.skipped_count); end if;
  if exists(select 1 from public.batches where user_id = p_user_id and status in ('queued', 'sending', 'paused')) then raise exception 'You already have an active batch.'; end if;
  if jsonb_typeof(p_recipients) <> 'array' or jsonb_array_length(p_recipients) > 100 then raise exception 'A batch can include up to 100 contacts.'; end if;
  select count(*) filter(where item->>'status' = 'ready'), count(*) filter(where item->>'status' <> 'ready') into count_valid, count_skipped from jsonb_array_elements(p_recipients) as rows(item);
  if coalesce(count_valid, 0) < 1 then raise exception 'No valid contacts are ready to send.'; end if;
  insert into public.batches(user_id, idempotency_key, status, subject_template, body_template_html, sender_name, sender_email, sender_phone, attachment_ids)
  values (p_user_id, p_idempotency_key, 'queued', p_subject_template, p_body_template_html, p_sender_name, p_sender_email, p_sender_phone, coalesce(p_attachment_ids, '{}')) returning * into new_batch;
  for recipient in select value from jsonb_array_elements(p_recipients) loop
    insert into public.batch_recipients(batch_id, user_id, company_name, poc_name, email, designation, source_row, fields, subject, body_html, body_text, status, reason)
    values (
      new_batch.id, p_user_id, coalesce(recipient->>'companyName', ''), coalesce(recipient->>'pocName', ''), coalesce(recipient->>'email', ''),
      coalesce(recipient->>'designation', ''), (recipient->>'rowNumber')::integer, coalesce(recipient->'fields', '{}'::jsonb),
      coalesce(recipient->>'subject', ''), coalesce(recipient->>'bodyHtml', ''), coalesce(recipient->>'bodyText', ''),
      case when recipient->>'status' = 'ready' then 'queued' else 'skipped' end, recipient->>'reason'
    );
  end loop;
  return jsonb_build_object('batch_id', new_batch.id, 'existing', false, 'valid_count', count_valid, 'skipped_count', count_skipped);
end $$;

create or replace function public.claim_email_batch(p_batch_id uuid, p_worker_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare batch_row public.batches%rowtype;
begin
  select * into batch_row from public.batches where id = p_batch_id for update;
  if not found then return jsonb_build_object('claimed', false); end if;
  if batch_row.status = 'sending' and batch_row.lease_expires_at <= now() then
    update public.batch_recipients set status = 'needs_review', reason = 'Worker stopped during dispatch. Check Gmail Sent before resending.', updated_at = now()
    where batch_id = p_batch_id and status = 'sending';
  elsif batch_row.status <> 'queued' then
    return jsonb_build_object('claimed', false);
  end if;
  update public.batches set status = 'sending', worker_lease_id = p_worker_id, lease_expires_at = now() + interval '3 minutes', error_message = null, updated_at = now() where id = p_batch_id;
  return jsonb_build_object('claimed', true, 'user_id', batch_row.user_id);
end $$;

create or replace function public.claim_next_batch_recipient(p_batch_id uuid, p_worker_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare batch_row public.batches%rowtype; recipient public.batch_recipients%rowtype;
begin
  select * into batch_row from public.batches where id = p_batch_id and status = 'sending' and worker_lease_id = p_worker_id and lease_expires_at > now() for update;
  if not found then return null; end if;
  select * into recipient from public.batch_recipients where batch_id = p_batch_id and status = 'queued' order by source_row limit 1 for update skip locked;
  if not found then return null; end if;
  update public.batches set lease_expires_at = now() + interval '3 minutes', updated_at = now() where id = p_batch_id;
  update public.batch_recipients set status = 'sending', reason = null, updated_at = now() where id = recipient.id returning * into recipient;
  return to_jsonb(recipient) || jsonb_build_object('sender_name', batch_row.sender_name, 'sender_email', batch_row.sender_email, 'attachment_ids', batch_row.attachment_ids);
end $$;

create or replace function public.reserve_send_attempt(p_user_id uuid, p_batch_id uuid, p_recipient_id uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare user_count integer; app_count integer; inserted public.send_attempts%rowtype;
begin
  perform pg_advisory_xact_lock(7302102, 1);
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));
  select count(*) into user_count from public.send_attempts where user_id = p_user_id and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if user_count >= 100 then return jsonb_build_object('allowed', false, 'reason', 'Your 100-send daily limit has been reached. Try again after the daily reset.'); end if;
  select count(*) into app_count from public.send_attempts where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  if app_count >= 2000 then return jsonb_build_object('allowed', false, 'reason', 'The app has reached its 2,000-send monthly capacity. Try again next month.'); end if;
  insert into public.send_attempts(user_id, batch_id, recipient_id, kind, state) values (p_user_id, p_batch_id, p_recipient_id, p_kind, 'reserved') returning * into inserted;
  if p_recipient_id is not null then update public.batch_recipients set attempt_count = attempt_count + 1, updated_at = now() where id = p_recipient_id and user_id = p_user_id; end if;
  return jsonb_build_object('allowed', true, 'attempt_id', inserted.id);
end $$;

create or replace function public.finish_email_batch(p_batch_id uuid, p_worker_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare remaining integer;
begin
  select count(*) into remaining from public.batch_recipients where batch_id = p_batch_id and status in ('queued', 'sending');
  if remaining > 0 then
    update public.batches set status = 'paused', error_message = 'Some recipients remain queued. Resume the batch to continue.', worker_lease_id = null, lease_expires_at = null, updated_at = now() where id = p_batch_id and worker_lease_id = p_worker_id;
  else
    update public.batches set status = case when failed_count > 0 or needs_review_count > 0 or skipped_count > 0 then 'completed_with_errors' else 'completed' end,
      completed_at = now(), worker_lease_id = null, lease_expires_at = null, updated_at = now()
    where id = p_batch_id and worker_lease_id = p_worker_id;
  end if;
end $$;

create or replace function public.retry_email_recipients(p_user_id uuid, p_batch_id uuid, p_recipient_ids uuid[], p_acknowledge_duplicate_risk boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare changed integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if not exists(select 1 from public.batches where id = p_batch_id and user_id = p_user_id and status in ('completed', 'completed_with_errors', 'paused')) then
    return jsonb_build_object('queued_count', 0, 'error_message', 'This batch cannot be retried right now.');
  end if;
  if exists(select 1 from public.batches where user_id = p_user_id and id <> p_batch_id and status in ('queued', 'sending', 'paused')) then
    return jsonb_build_object('queued_count', 0, 'error_message', 'Finish your other active batch before retrying these recipients.');
  end if;
  update public.batch_recipients set status = 'queued', reason = null, updated_at = now()
  where batch_id = p_batch_id and user_id = p_user_id and id = any(p_recipient_ids)
    and (status = 'failed' or (status = 'needs_review' and p_acknowledge_duplicate_risk));
  get diagnostics changed = row_count;
  if changed = 0 then return jsonb_build_object('queued_count', 0, 'error_message', 'There are no selected confirmed failures to retry.'); end if;
  update public.batches set status = 'queued', error_message = null, completed_at = null, updated_at = now() where id = p_batch_id and user_id = p_user_id;
  return jsonb_build_object('queued_count', changed);
end $$;

revoke all on function public.consume_user_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.reserve_attachment(uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.complete_attachment_upload(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.create_email_batch(uuid, uuid, text, text, text, text, text, uuid[], jsonb) from public, anon, authenticated;
revoke all on function public.claim_email_batch(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_next_batch_recipient(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reserve_send_attempt(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finish_email_batch(uuid, uuid) from public, anon, authenticated;
revoke all on function public.retry_email_recipients(uuid, uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.consume_user_rate_limit(uuid, text, integer, integer) to service_role;
grant execute on function public.reserve_attachment(uuid, text, text, bigint, text) to service_role;
grant execute on function public.complete_attachment_upload(uuid, uuid, bigint) to service_role;
grant execute on function public.create_email_batch(uuid, uuid, text, text, text, text, text, uuid[], jsonb) to service_role;
grant execute on function public.claim_email_batch(uuid, uuid) to service_role;
grant execute on function public.claim_next_batch_recipient(uuid, uuid) to service_role;
grant execute on function public.reserve_send_attempt(uuid, uuid, uuid, text) to service_role;
grant execute on function public.finish_email_batch(uuid, uuid) to service_role;
grant execute on function public.retry_email_recipients(uuid, uuid, uuid[], boolean) to service_role;
