-- Peptaide MVP - administration events (canonical dose + MC percentiles)
-- Includes optional audit trail via `event_revisions`.

create table public.administration_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  ts timestamptz not null,
  formulation_id uuid not null,
  vial_id uuid,
  cycle_instance_id uuid,

  input_text text not null,
  input_value numeric,
  input_unit text,
  input_kind public.input_kind_t not null default 'other',

  dose_volume_ml numeric,
  dose_mass_mg numeric,

  eff_systemic_p05_mg numeric,
  eff_systemic_p50_mg numeric,
  eff_systemic_p95_mg numeric,
  eff_cns_p05_mg numeric,
  eff_cns_p50_mg numeric,
  eff_cns_p95_mg numeric,
  mc_n int,
  mc_seed bigint,
  model_snapshot jsonb,

  cost_usd numeric,
  tags text[] not null default '{}'::text[],
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.administration_events
  add constraint administration_events_formulation_fk foreign key (user_id, formulation_id)
    references public.formulations (user_id, id),
  add constraint administration_events_vial_fk foreign key (user_id, vial_id)
    references public.vials (user_id, id),
  add constraint administration_events_cycle_fk foreign key (user_id, cycle_instance_id)
    references public.cycle_instances (user_id, id),
  add constraint administration_events_input_text_not_blank check (length(trim(input_text)) > 0),
  add constraint administration_events_input_value_nonnegative check (input_value is null or input_value >= 0),
  add constraint administration_events_dose_mass_nonnegative check (dose_mass_mg is null or dose_mass_mg >= 0),
  add constraint administration_events_dose_volume_nonnegative check (dose_volume_ml is null or dose_volume_ml >= 0),
  add constraint administration_events_cost_nonnegative check (cost_usd is null or cost_usd >= 0),
  add constraint administration_events_model_snapshot_type check (
    model_snapshot is null or jsonb_typeof(model_snapshot) = 'object'
  ),
  add constraint administration_events_systemic_percentiles_consistent check (
    (
      eff_systemic_p05_mg is null
      and eff_systemic_p50_mg is null
      and eff_systemic_p95_mg is null
    )
    or (
      eff_systemic_p05_mg is not null
      and eff_systemic_p50_mg is not null
      and eff_systemic_p95_mg is not null
      and eff_systemic_p05_mg >= 0
      and eff_systemic_p05_mg <= eff_systemic_p50_mg
      and eff_systemic_p50_mg <= eff_systemic_p95_mg
    )
  ),
  add constraint administration_events_cns_percentiles_consistent check (
    (
      eff_cns_p05_mg is null
      and eff_cns_p50_mg is null
      and eff_cns_p95_mg is null
    )
    or (
      eff_cns_p05_mg is not null
      and eff_cns_p50_mg is not null
      and eff_cns_p95_mg is not null
      and eff_cns_p05_mg >= 0
      and eff_cns_p05_mg <= eff_cns_p50_mg
      and eff_cns_p50_mg <= eff_cns_p95_mg
    )
  ),
  add constraint administration_events_mc_fields_when_percentiles_present check (
    (
      eff_systemic_p50_mg is null
      and eff_cns_p50_mg is null
    )
    or (
      mc_n is not null
      and mc_n > 0
      and mc_seed is not null
      and model_snapshot is not null
    )
  );

create unique index administration_events_user_id_id_key on public.administration_events (user_id, id);
create index administration_events_user_ts_idx on public.administration_events (user_id, ts desc);
create index administration_events_user_formulation_ts_idx on public.administration_events (user_id, formulation_id, ts desc);
create index administration_events_user_cycle_idx on public.administration_events (user_id, cycle_instance_id);

create trigger set_administration_events_updated_at
before update on public.administration_events
for each row execute function public.set_updated_at();

alter table public.administration_events enable row level security;

create policy administration_events_select_own
on public.administration_events
for select
using (auth.uid() = user_id);

create policy administration_events_insert_own
on public.administration_events
for insert
with check (auth.uid() = user_id);

create policy administration_events_update_own
on public.administration_events
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy administration_events_delete_own
on public.administration_events
for delete
using (auth.uid() = user_id);

-- Enforce that when `vial_id` is set, the vial matches the event formulation.
create or replace function public.enforce_event_vial_matches_formulation()
returns trigger
language plpgsql
as $$
declare
  expected_formulation uuid;
begin
  if new.vial_id is null then
    return new;
  end if;

  select v.formulation_id
  into expected_formulation
  from public.vials v
  where v.user_id = new.user_id and v.id = new.vial_id;

  if expected_formulation is null then
    raise exception 'vial % not found for user %', new.vial_id, new.user_id;
  end if;

  if expected_formulation <> new.formulation_id then
    raise exception 'administration_events.formulation_id (%) does not match vials.formulation_id (%) for vial %',
      new.formulation_id, expected_formulation, new.vial_id;
  end if;

  return new;
end;
$$;

create trigger enforce_event_vial_matches_formulation
before insert or update on public.administration_events
for each row execute function public.enforce_event_vial_matches_formulation();

-- Enforce that when `cycle_instance_id` is set, the cycle substance matches the event formulation substance.
create or replace function public.enforce_event_cycle_matches_formulation_substance()
returns trigger
language plpgsql
as $$
declare
  cycle_substance uuid;
  formulation_substance uuid;
begin
  if new.cycle_instance_id is null then
    return new;
  end if;

  select ci.substance_id
  into cycle_substance
  from public.cycle_instances ci
  where ci.user_id = new.user_id and ci.id = new.cycle_instance_id;

  if cycle_substance is null then
    raise exception 'cycle_instance % not found for user %', new.cycle_instance_id, new.user_id;
  end if;

  select f.substance_id
  into formulation_substance
  from public.formulations f
  where f.user_id = new.user_id and f.id = new.formulation_id;

  if formulation_substance is null then
    raise exception 'formulation % not found for user %', new.formulation_id, new.user_id;
  end if;

  if cycle_substance <> formulation_substance then
    raise exception 'cycle_instances.substance_id (%) does not match formulations.substance_id (%) for formulation %',
      cycle_substance, formulation_substance, new.formulation_id;
  end if;

  return new;
end;
$$;

create trigger enforce_event_cycle_matches_formulation_substance
before insert or update on public.administration_events
for each row execute function public.enforce_event_cycle_matches_formulation_substance();

-- Optional audit table for event edits.
create table public.event_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  event_id uuid not null,
  revised_at timestamptz not null default now(),
  old_values jsonb not null,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.event_revisions
  add constraint event_revisions_event_fk foreign key (user_id, event_id)
    references public.administration_events (user_id, id) on delete cascade,
  add constraint event_revisions_old_values_type check (jsonb_typeof(old_values) = 'object'),
  add constraint event_revisions_new_values_type check (new_values is null or jsonb_typeof(new_values) = 'object');

create unique index event_revisions_user_id_id_key on public.event_revisions (user_id, id);
create index event_revisions_user_event_revised_at_idx on public.event_revisions (user_id, event_id, revised_at desc);

alter table public.event_revisions enable row level security;

create policy event_revisions_select_own
on public.event_revisions
for select
using (auth.uid() = user_id);

create policy event_revisions_insert_own
on public.event_revisions
for insert
with check (auth.uid() = user_id);

create policy event_revisions_delete_own
on public.event_revisions
for delete
using (auth.uid() = user_id);

create or replace function public.log_administration_event_revision()
returns trigger
language plpgsql
as $$
begin
  insert into public.event_revisions (user_id, event_id, old_values, new_values)
  values (
    old.user_id,
    old.id,
    to_jsonb(old),
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  return null;
end;
$$;

create trigger log_administration_events_revision
after update or delete on public.administration_events
for each row execute function public.log_administration_event_revision();
