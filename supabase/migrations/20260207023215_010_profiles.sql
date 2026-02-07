-- Peptaide MVP - profiles (identity + defaults)

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null,
  default_mass_unit text not null,
  default_volume_unit text not null,
  default_simulation_n int not null,
  cycle_gap_default_days int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_default_simulation_n_positive check (default_simulation_n > 0),
  add constraint profiles_cycle_gap_default_days_nonnegative check (cycle_gap_default_days >= 0);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = user_id);

create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = user_id);

create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy profiles_delete_own
on public.profiles
for delete
using (auth.uid() = user_id);

-- Defaults: keep the DB defaults conservative; the app may overwrite these on first-run based on
-- user preference.
alter table public.profiles
  alter column timezone set default 'UTC',
  alter column default_mass_unit set default 'mg',
  alter column default_volume_unit set default 'mL',
  alter column default_simulation_n set default 2048,
  alter column cycle_gap_default_days set default 7;
