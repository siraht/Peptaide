-- Peptaide MVP - cycles tables
-- - cycle_rules (per substance)
-- - cycle_instances

create table public.cycle_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  substance_id uuid not null,
  gap_days_to_suggest_new_cycle int not null default 7,
  auto_start_first_cycle boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.cycle_rules
  add constraint cycle_rules_substance_fk foreign key (user_id, substance_id)
    references public.substances (user_id, id) on delete cascade,
  add constraint cycle_rules_gap_days_nonnegative check (gap_days_to_suggest_new_cycle >= 0);

create unique index cycle_rules_user_substance_key on public.cycle_rules (user_id, substance_id);
create unique index cycle_rules_user_id_id_key on public.cycle_rules (user_id, id);

create trigger set_cycle_rules_updated_at
before update on public.cycle_rules
for each row execute function public.set_updated_at();

alter table public.cycle_rules enable row level security;

create policy cycle_rules_select_own
on public.cycle_rules
for select
using (auth.uid() = user_id);

create policy cycle_rules_insert_own
on public.cycle_rules
for insert
with check (auth.uid() = user_id);

create policy cycle_rules_update_own
on public.cycle_rules
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy cycle_rules_delete_own
on public.cycle_rules
for delete
using (auth.uid() = user_id);

create table public.cycle_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  substance_id uuid not null,
  cycle_number int not null,
  start_ts timestamptz not null,
  end_ts timestamptz,
  status public.cycle_status_t not null default 'active',
  goal text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.cycle_instances
  add constraint cycle_instances_substance_fk foreign key (user_id, substance_id)
    references public.substances (user_id, id),
  add constraint cycle_instances_cycle_number_positive check (cycle_number > 0),
  add constraint cycle_instances_end_after_start check (end_ts is null or end_ts >= start_ts);

create unique index cycle_instances_user_substance_cycle_number_key
on public.cycle_instances (user_id, substance_id, cycle_number);

create unique index cycle_instances_user_id_id_key on public.cycle_instances (user_id, id);

-- Enforce at most one active cycle per substance per user.
create unique index cycle_instances_one_active_per_substance_key
on public.cycle_instances (user_id, substance_id)
where status = 'active' and deleted_at is null;

create index cycle_instances_user_substance_start_ts_idx
on public.cycle_instances (user_id, substance_id, start_ts desc);

create trigger set_cycle_instances_updated_at
before update on public.cycle_instances
for each row execute function public.set_updated_at();

alter table public.cycle_instances enable row level security;

create policy cycle_instances_select_own
on public.cycle_instances
for select
using (auth.uid() = user_id);

create policy cycle_instances_insert_own
on public.cycle_instances
for insert
with check (auth.uid() = user_id);

create policy cycle_instances_update_own
on public.cycle_instances
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy cycle_instances_delete_own
on public.cycle_instances
for delete
using (auth.uid() = user_id);
