-- Peptaide MVP - reference data tables
-- - substances, routes, devices
-- - formulations and components
-- - device calibrations and substance aliases

-- Note: Several columns in these tables reference `distributions.id` (for example calibration and
-- modifier distributions). The `distributions` table is introduced in a later migration, so those
-- columns are created as UUIDs here and have their foreign keys added later.

-- substances
create table public.substances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  canonical_name text not null,
  display_name text not null,
  family text,
  target_compartment_default public.compartment_t not null default 'systemic',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.substances
  add constraint substances_canonical_name_not_blank check (length(trim(canonical_name)) > 0),
  add constraint substances_display_name_not_blank check (length(trim(display_name)) > 0);

create unique index substances_user_canonical_name_key on public.substances (user_id, canonical_name);
create unique index substances_user_id_id_key on public.substances (user_id, id);

create trigger set_substances_updated_at
before update on public.substances
for each row execute function public.set_updated_at();

alter table public.substances enable row level security;

create policy substances_select_own
on public.substances
for select
using (auth.uid() = user_id);

create policy substances_insert_own
on public.substances
for insert
with check (auth.uid() = user_id);

create policy substances_update_own
on public.substances
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy substances_delete_own
on public.substances
for delete
using (auth.uid() = user_id);

-- substance_aliases
create table public.substance_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  substance_id uuid not null,
  alias text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.substance_aliases
  add constraint substance_aliases_alias_not_blank check (length(trim(alias)) > 0),
  add constraint substance_aliases_substance_fk foreign key (user_id, substance_id)
    references public.substances (user_id, id) on delete cascade;

create unique index substance_aliases_user_alias_key on public.substance_aliases (user_id, alias);
create index substance_aliases_user_substance_idx on public.substance_aliases (user_id, substance_id);
create unique index substance_aliases_user_id_id_key on public.substance_aliases (user_id, id);

create trigger set_substance_aliases_updated_at
before update on public.substance_aliases
for each row execute function public.set_updated_at();

alter table public.substance_aliases enable row level security;

create policy substance_aliases_select_own
on public.substance_aliases
for select
using (auth.uid() = user_id);

create policy substance_aliases_insert_own
on public.substance_aliases
for insert
with check (auth.uid() = user_id);

create policy substance_aliases_update_own
on public.substance_aliases
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy substance_aliases_delete_own
on public.substance_aliases
for delete
using (auth.uid() = user_id);

-- routes
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  default_input_kind public.route_input_kind_t not null,
  default_input_unit text not null,
  supports_device_calibration boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.routes
  add constraint routes_name_not_blank check (length(trim(name)) > 0),
  add constraint routes_default_input_unit_not_blank check (length(trim(default_input_unit)) > 0);

create unique index routes_user_name_key on public.routes (user_id, name);
create unique index routes_user_id_id_key on public.routes (user_id, id);

create trigger set_routes_updated_at
before update on public.routes
for each row execute function public.set_updated_at();

alter table public.routes enable row level security;

create policy routes_select_own
on public.routes
for select
using (auth.uid() = user_id);

create policy routes_insert_own
on public.routes
for insert
with check (auth.uid() = user_id);

create policy routes_update_own
on public.routes
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy routes_delete_own
on public.routes
for delete
using (auth.uid() = user_id);

-- devices
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  device_kind public.device_kind_t not null default 'other',
  default_unit text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.devices
  add constraint devices_name_not_blank check (length(trim(name)) > 0),
  add constraint devices_default_unit_not_blank check (length(trim(default_unit)) > 0);

create unique index devices_user_name_key on public.devices (user_id, name);
create unique index devices_user_id_id_key on public.devices (user_id, id);

create trigger set_devices_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

alter table public.devices enable row level security;

create policy devices_select_own
on public.devices
for select
using (auth.uid() = user_id);

create policy devices_insert_own
on public.devices
for insert
with check (auth.uid() = user_id);

create policy devices_update_own
on public.devices
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy devices_delete_own
on public.devices
for delete
using (auth.uid() = user_id);

-- device_calibrations
create table public.device_calibrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  device_id uuid not null,
  route_id uuid not null,
  unit_label text not null,
  volume_ml_per_unit_dist_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.device_calibrations
  add constraint device_calibrations_unit_label_not_blank check (length(trim(unit_label)) > 0),
  add constraint device_calibrations_device_fk foreign key (user_id, device_id)
    references public.devices (user_id, id) on delete cascade,
  add constraint device_calibrations_route_fk foreign key (user_id, route_id)
    references public.routes (user_id, id) on delete cascade;

create unique index device_calibrations_user_device_route_label_key
on public.device_calibrations (user_id, device_id, route_id, unit_label);

create unique index device_calibrations_user_id_id_key on public.device_calibrations (user_id, id);

create trigger set_device_calibrations_updated_at
before update on public.device_calibrations
for each row execute function public.set_updated_at();

alter table public.device_calibrations enable row level security;

create policy device_calibrations_select_own
on public.device_calibrations
for select
using (auth.uid() = user_id);

create policy device_calibrations_insert_own
on public.device_calibrations
for insert
with check (auth.uid() = user_id);

create policy device_calibrations_update_own
on public.device_calibrations
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy device_calibrations_delete_own
on public.device_calibrations
for delete
using (auth.uid() = user_id);

-- formulations
create table public.formulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  substance_id uuid not null,
  route_id uuid not null,
  device_id uuid,
  name text not null,
  is_default_for_route boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.formulations
  add constraint formulations_name_not_blank check (length(trim(name)) > 0),
  add constraint formulations_substance_fk foreign key (user_id, substance_id)
    references public.substances (user_id, id),
  add constraint formulations_route_fk foreign key (user_id, route_id)
    references public.routes (user_id, id),
  add constraint formulations_device_fk foreign key (user_id, device_id)
    references public.devices (user_id, id);

create unique index formulations_user_substance_route_name_key
on public.formulations (user_id, substance_id, route_id, name);

create unique index formulations_user_id_id_key on public.formulations (user_id, id);

create unique index formulations_one_default_per_route_key
on public.formulations (user_id, substance_id, route_id)
where is_default_for_route and deleted_at is null;

create trigger set_formulations_updated_at
before update on public.formulations
for each row execute function public.set_updated_at();

alter table public.formulations enable row level security;

create policy formulations_select_own
on public.formulations
for select
using (auth.uid() = user_id);

create policy formulations_insert_own
on public.formulations
for insert
with check (auth.uid() = user_id);

create policy formulations_update_own
on public.formulations
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy formulations_delete_own
on public.formulations
for delete
using (auth.uid() = user_id);

-- formulation_components
create table public.formulation_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  formulation_id uuid not null,
  component_name text not null,
  role text,
  modifier_dist_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.formulation_components
  add constraint formulation_components_component_name_not_blank check (length(trim(component_name)) > 0),
  add constraint formulation_components_formulation_fk foreign key (user_id, formulation_id)
    references public.formulations (user_id, id) on delete cascade;

create unique index formulation_components_user_formulation_component_key
on public.formulation_components (user_id, formulation_id, component_name);

create index formulation_components_user_formulation_idx on public.formulation_components (user_id, formulation_id);
create unique index formulation_components_user_id_id_key on public.formulation_components (user_id, id);

create trigger set_formulation_components_updated_at
before update on public.formulation_components
for each row execute function public.set_updated_at();

alter table public.formulation_components enable row level security;

create policy formulation_components_select_own
on public.formulation_components
for select
using (auth.uid() = user_id);

create policy formulation_components_insert_own
on public.formulation_components
for insert
with check (auth.uid() = user_id);

create policy formulation_components_update_own
on public.formulation_components
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy formulation_components_delete_own
on public.formulation_components
for delete
using (auth.uid() = user_id);
