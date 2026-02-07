-- Peptaide MVP - uncertainty tables
-- - distributions (shared primitives)
-- - base bioavailability specs + modifier specs
--
-- This migration also adds foreign keys + triggers for earlier tables that reference distributions.

create table public.distributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  value_type public.distribution_value_type_t not null,
  dist_type public.distribution_dist_type_t not null,
  p1 numeric,
  p2 numeric,
  p3 numeric,
  min_value numeric,
  max_value numeric,
  units text,
  quality_score int not null default 0,
  evidence_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.distributions
  add constraint distributions_name_not_blank check (length(trim(name)) > 0),
  add constraint distributions_quality_score_range check (quality_score between 0 and 5),
  add constraint distributions_parameterization check (
    (
      dist_type = 'point'
      and p1 is not null
      and p2 is null
      and p3 is null
      and min_value is null
      and max_value is null
    )
    or (
      dist_type = 'uniform'
      and min_value is not null
      and max_value is not null
      and p1 is null
      and p2 is null
      and p3 is null
      and min_value <= max_value
    )
    or (
      dist_type = 'triangular'
      and p1 is not null
      and p2 is not null
      and p3 is not null
      and min_value is null
      and max_value is null
      and p1 < p3
      and p1 <= p2
      and p2 <= p3
    )
    or (
      dist_type = 'beta_pert'
      and p1 is not null
      and p2 is not null
      and p3 is not null
      and min_value is null
      and max_value is null
      and p1 < p3
      and p1 <= p2
      and p2 <= p3
    )
    or (
      dist_type = 'lognormal'
      and p1 is not null
      and p2 is not null
      and p3 is null
      and p1 > 0
      and p2 >= 0
      and (min_value is null or min_value > 0)
      and (max_value is null or max_value > 0)
      and (min_value is null or max_value is null or min_value <= max_value)
    )
  ),
  add constraint distributions_value_type_fraction_bounds check (
    value_type <> 'fraction'
    or (
      dist_type <> 'lognormal'
      and (
        (dist_type = 'point' and p1 between 0 and 1)
        or (dist_type = 'uniform' and min_value >= 0 and max_value <= 1)
        or (dist_type in ('triangular', 'beta_pert') and p1 >= 0 and p3 <= 1)
      )
    )
  ),
  add constraint distributions_value_type_multiplier_bounds check (
    value_type <> 'multiplier'
    or (
      (dist_type = 'point' and p1 >= 0)
      or (dist_type = 'uniform' and min_value >= 0)
      or (dist_type in ('triangular', 'beta_pert') and p1 >= 0)
      or (dist_type = 'lognormal' and p1 > 0 and p2 >= 0)
    )
  ),
  add constraint distributions_value_type_volume_bounds check (
    value_type <> 'volume_ml_per_unit'
    or (
      (dist_type = 'point' and p1 > 0)
      or (dist_type = 'uniform' and min_value > 0)
      or (dist_type in ('triangular', 'beta_pert') and p1 > 0)
      or (dist_type = 'lognormal' and p1 > 0 and p2 >= 0)
    )
  );

create unique index distributions_user_id_id_key on public.distributions (user_id, id);
create index distributions_user_name_idx on public.distributions (user_id, name);

create trigger set_distributions_updated_at
before update on public.distributions
for each row execute function public.set_updated_at();

alter table public.distributions enable row level security;

create policy distributions_select_own
on public.distributions
for select
using (auth.uid() = user_id);

create policy distributions_insert_own
on public.distributions
for insert
with check (auth.uid() = user_id);

create policy distributions_update_own
on public.distributions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy distributions_delete_own
on public.distributions
for delete
using (auth.uid() = user_id);

-- Enforce that distribution foreign keys reference distributions with the expected `value_type`.
-- Postgres cannot express this as a cross-table CHECK constraint, so we enforce it with triggers.
create or replace function public.enforce_distribution_value_type()
returns trigger
language plpgsql
as $$
declare
  expected_value_type public.distribution_value_type_t;
  dist_id_col text;
  dist_id uuid;
  actual_value_type public.distribution_value_type_t;
begin
  expected_value_type := tg_argv[0]::public.distribution_value_type_t;
  dist_id_col := tg_argv[1];
  dist_id := (to_jsonb(new)->>dist_id_col)::uuid;

  if dist_id is null then
    return new;
  end if;

  select d.value_type
  into actual_value_type
  from public.distributions d
  where d.user_id = new.user_id and d.id = dist_id and d.deleted_at is null;

  if actual_value_type is null then
    raise exception 'distribution % not found for user %', dist_id, new.user_id;
  end if;

  if actual_value_type <> expected_value_type then
    raise exception 'expected distributions.value_type=% but got % for distribution %',
      expected_value_type, actual_value_type, dist_id;
  end if;

  return new;
end;
$$;

-- bioavailability_specs (base fraction per substance/route/compartment)
create table public.bioavailability_specs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  substance_id uuid not null,
  route_id uuid not null,
  compartment public.compartment_t not null,
  base_fraction_dist_id uuid not null,
  notes text,
  evidence_source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.bioavailability_specs
  add constraint bioavailability_specs_substance_fk foreign key (user_id, substance_id)
    references public.substances (user_id, id),
  add constraint bioavailability_specs_route_fk foreign key (user_id, route_id)
    references public.routes (user_id, id),
  add constraint bioavailability_specs_base_fraction_fk foreign key (user_id, base_fraction_dist_id)
    references public.distributions (user_id, id),
  add constraint bioavailability_specs_evidence_source_fk foreign key (user_id, evidence_source_id)
    references public.evidence_sources (user_id, id),
  add constraint bioavailability_specs_compartment_no_both check (compartment in ('systemic', 'cns'));

create unique index bioavailability_specs_user_substance_route_compartment_key
on public.bioavailability_specs (user_id, substance_id, route_id, compartment);

create unique index bioavailability_specs_user_id_id_key on public.bioavailability_specs (user_id, id);

create trigger set_bioavailability_specs_updated_at
before update on public.bioavailability_specs
for each row execute function public.set_updated_at();

alter table public.bioavailability_specs enable row level security;

create policy bioavailability_specs_select_own
on public.bioavailability_specs
for select
using (auth.uid() = user_id);

create policy bioavailability_specs_insert_own
on public.bioavailability_specs
for insert
with check (auth.uid() = user_id);

create policy bioavailability_specs_update_own
on public.bioavailability_specs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy bioavailability_specs_delete_own
on public.bioavailability_specs
for delete
using (auth.uid() = user_id);

create trigger enforce_bioavailability_specs_fraction_value_type
before insert or update on public.bioavailability_specs
for each row execute function public.enforce_distribution_value_type('fraction', 'base_fraction_dist_id');

-- formulation_modifier_specs (per formulation per compartment)
create table public.formulation_modifier_specs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  formulation_id uuid not null,
  compartment public.compartment_t not null,
  multiplier_dist_id uuid not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.formulation_modifier_specs
  add constraint formulation_modifier_specs_formulation_fk foreign key (user_id, formulation_id)
    references public.formulations (user_id, id) on delete cascade,
  add constraint formulation_modifier_specs_multiplier_fk foreign key (user_id, multiplier_dist_id)
    references public.distributions (user_id, id);

create unique index formulation_modifier_specs_user_formulation_compartment_key
on public.formulation_modifier_specs (user_id, formulation_id, compartment);

create unique index formulation_modifier_specs_user_id_id_key on public.formulation_modifier_specs (user_id, id);

create trigger set_formulation_modifier_specs_updated_at
before update on public.formulation_modifier_specs
for each row execute function public.set_updated_at();

alter table public.formulation_modifier_specs enable row level security;

create policy formulation_modifier_specs_select_own
on public.formulation_modifier_specs
for select
using (auth.uid() = user_id);

create policy formulation_modifier_specs_insert_own
on public.formulation_modifier_specs
for insert
with check (auth.uid() = user_id);

create policy formulation_modifier_specs_update_own
on public.formulation_modifier_specs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy formulation_modifier_specs_delete_own
on public.formulation_modifier_specs
for delete
using (auth.uid() = user_id);

create trigger enforce_formulation_modifier_specs_multiplier_value_type
before insert or update on public.formulation_modifier_specs
for each row execute function public.enforce_distribution_value_type('multiplier', 'multiplier_dist_id');

-- component_modifier_specs (per formulation component per compartment)
create table public.component_modifier_specs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  formulation_component_id uuid not null,
  compartment public.compartment_t not null,
  multiplier_dist_id uuid not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.component_modifier_specs
  add constraint component_modifier_specs_component_fk foreign key (user_id, formulation_component_id)
    references public.formulation_components (user_id, id) on delete cascade,
  add constraint component_modifier_specs_multiplier_fk foreign key (user_id, multiplier_dist_id)
    references public.distributions (user_id, id);

create unique index component_modifier_specs_user_component_compartment_key
on public.component_modifier_specs (user_id, formulation_component_id, compartment);

create unique index component_modifier_specs_user_id_id_key on public.component_modifier_specs (user_id, id);

create trigger set_component_modifier_specs_updated_at
before update on public.component_modifier_specs
for each row execute function public.set_updated_at();

alter table public.component_modifier_specs enable row level security;

create policy component_modifier_specs_select_own
on public.component_modifier_specs
for select
using (auth.uid() = user_id);

create policy component_modifier_specs_insert_own
on public.component_modifier_specs
for insert
with check (auth.uid() = user_id);

create policy component_modifier_specs_update_own
on public.component_modifier_specs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy component_modifier_specs_delete_own
on public.component_modifier_specs
for delete
using (auth.uid() = user_id);

create trigger enforce_component_modifier_specs_multiplier_value_type
before insert or update on public.component_modifier_specs
for each row execute function public.enforce_distribution_value_type('multiplier', 'multiplier_dist_id');

-- Wire up earlier tables that reference `distributions`.
alter table public.device_calibrations
  add constraint device_calibrations_volume_dist_fk foreign key (user_id, volume_ml_per_unit_dist_id)
    references public.distributions (user_id, id);

create trigger enforce_device_calibrations_volume_dist_value_type
before insert or update on public.device_calibrations
for each row execute function public.enforce_distribution_value_type('volume_ml_per_unit', 'volume_ml_per_unit_dist_id');

alter table public.formulation_components
  add constraint formulation_components_modifier_dist_fk foreign key (user_id, modifier_dist_id)
    references public.distributions (user_id, id);

create trigger enforce_formulation_components_modifier_dist_value_type
before insert or update on public.formulation_components
for each row execute function public.enforce_distribution_value_type('multiplier', 'modifier_dist_id');

alter table public.vials
  add constraint vials_volume_override_dist_fk foreign key (user_id, volume_ml_per_unit_override_dist_id)
    references public.distributions (user_id, id);

create trigger enforce_vials_volume_override_dist_value_type
before insert or update on public.vials
for each row execute function public.enforce_distribution_value_type('volume_ml_per_unit', 'volume_ml_per_unit_override_dist_id');
