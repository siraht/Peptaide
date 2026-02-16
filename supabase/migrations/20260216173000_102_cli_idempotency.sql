-- Persist API mutation responses so CLI retries with the same idempotency key are replay-safe.

create table if not exists public.cli_idempotency_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  status_code int not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cli_idempotency_records
  add constraint cli_idempotency_records_operation_not_blank check (length(trim(operation)) > 0),
  add constraint cli_idempotency_records_key_not_blank check (length(trim(idempotency_key)) > 0),
  add constraint cli_idempotency_records_hash_not_blank check (length(trim(request_hash)) > 0),
  add constraint cli_idempotency_records_status_code_valid check (status_code between 100 and 599),
  add constraint cli_idempotency_records_response_object check (jsonb_typeof(response_json) = 'object');

create unique index if not exists cli_idempotency_records_user_operation_key
on public.cli_idempotency_records (user_id, operation, idempotency_key);

create index if not exists cli_idempotency_records_user_created_at_idx
on public.cli_idempotency_records (user_id, created_at desc);

create trigger set_cli_idempotency_records_updated_at
before update on public.cli_idempotency_records
for each row execute function public.set_updated_at();

alter table public.cli_idempotency_records enable row level security;

create policy cli_idempotency_records_select_own
on public.cli_idempotency_records
for select
using (auth.uid() = user_id);

create policy cli_idempotency_records_insert_own
on public.cli_idempotency_records
for insert
with check (auth.uid() = user_id);

create policy cli_idempotency_records_update_own
on public.cli_idempotency_records
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy cli_idempotency_records_delete_own
on public.cli_idempotency_records
for delete
using (auth.uid() = user_id);
