-- Peptaide MVP - additional SQL views for analytics and coverage
--
-- Important: Views must not bypass RLS. Use `security_invoker = true` so policies apply to the
-- querying user rather than the view owner.

create or replace view public.v_cycle_summary
with (security_invoker = true)
as
with recs as (
  select
    user_id,
    substance_id,
    min(min_value) filter (
      where category = 'cycle_length_days' and lower(unit) in ('day', 'days')
    ) as recommended_cycle_days_min,
    max(max_value) filter (
      where category = 'cycle_length_days' and lower(unit) in ('day', 'days')
    ) as recommended_cycle_days_max,
    min(min_value) filter (
      where category = 'break_length_days' and lower(unit) in ('day', 'days')
    ) as recommended_break_days_min,
    max(max_value) filter (
      where category = 'break_length_days' and lower(unit) in ('day', 'days')
    ) as recommended_break_days_max
  from public.substance_recommendations
  where deleted_at is null
  group by user_id, substance_id
),
next_cycle as (
  select
    ci.user_id,
    ci.id as cycle_instance_id,
    lead(ci.start_ts) over (
      partition by ci.user_id, ci.substance_id order by ci.cycle_number
    ) as next_cycle_start_ts
  from public.cycle_instances ci
  where ci.deleted_at is null
)
select
  ci.user_id,
  ci.id as cycle_instance_id,
  ci.substance_id,
  s.display_name as substance_name,
  ci.cycle_number,
  ci.start_ts,
  ci.end_ts,
  ci.status,
  ci.goal,
  ci.notes,

  count(e.event_id) as event_count,
  sum(e.dose_mass_mg) as administered_mg_total,

  sum(e.eff_systemic_p05_mg) as eff_systemic_p05_mg_total,
  sum(e.eff_systemic_p50_mg) as eff_systemic_p50_mg_total,
  sum(e.eff_systemic_p95_mg) as eff_systemic_p95_mg_total,

  sum(e.eff_cns_p05_mg) as eff_cns_p05_mg_total,
  sum(e.eff_cns_p50_mg) as eff_cns_p50_mg_total,
  sum(e.eff_cns_p95_mg) as eff_cns_p95_mg_total,

  extract(epoch from (coalesce(ci.end_ts, max(e.ts), now()) - ci.start_ts)) / 86400.0
    as cycle_length_days,

  case
    when ci.end_ts is null then null
    when nc.next_cycle_start_ts is null then null
    else extract(epoch from (nc.next_cycle_start_ts - ci.end_ts)) / 86400.0
  end as break_to_next_cycle_days,

  r.recommended_cycle_days_min,
  r.recommended_cycle_days_max,
  r.recommended_break_days_min,
  r.recommended_break_days_max
from public.cycle_instances ci
join public.substances s
  on s.user_id = ci.user_id and s.id = ci.substance_id
left join public.v_event_enriched e
  on e.user_id = ci.user_id and e.cycle_instance_id = ci.id and e.deleted_at is null
left join next_cycle nc
  on nc.user_id = ci.user_id and nc.cycle_instance_id = ci.id
left join recs r
  on r.user_id = ci.user_id and r.substance_id = ci.substance_id
where ci.deleted_at is null
group by
  ci.user_id,
  ci.id,
  ci.substance_id,
  s.display_name,
  ci.cycle_number,
  ci.start_ts,
  ci.end_ts,
  ci.status,
  ci.goal,
  ci.notes,
  nc.next_cycle_start_ts,
  r.recommended_cycle_days_min,
  r.recommended_cycle_days_max,
  r.recommended_break_days_min,
  r.recommended_break_days_max;

-- Inventory status: per-vial used/remaining estimates and simple runway estimate for active vials.
create or replace view public.v_inventory_status
with (security_invoker = true)
as
with vial_base as (
  select
    v.user_id,
    v.id as vial_id,
    v.formulation_id,
    f.name as formulation_name,
    f.substance_id,
    s.display_name as substance_name,
    f.route_id,
    r.name as route_name,
    v.status,
    v.received_at,
    v.opened_at,
    v.closed_at,
    v.content_mass_value,
    v.content_mass_unit,
    v.total_volume_value,
    v.total_volume_unit,
    v.concentration_mg_per_ml,
    v.cost_usd,
    v.notes
  from public.vials v
  join public.formulations f
    on f.user_id = v.user_id and f.id = v.formulation_id
  join public.substances s
    on s.user_id = v.user_id and s.id = f.substance_id
  join public.routes r
    on r.user_id = v.user_id and r.id = f.route_id
  where v.deleted_at is null
),
vial_converted as (
  select
    vb.*,
    case lower(vb.content_mass_unit)
      when 'mg' then vb.content_mass_value
      when 'mcg' then vb.content_mass_value / 1000.0
      when 'ug' then vb.content_mass_value / 1000.0
      when 'µg' then vb.content_mass_value / 1000.0
      when 'g' then vb.content_mass_value * 1000.0
      else null
    end as content_mass_mg,
    case lower(vb.total_volume_unit)
      when 'ml' then vb.total_volume_value
      when 'cc' then vb.total_volume_value
      when 'ul' then vb.total_volume_value / 1000.0
      when 'µl' then vb.total_volume_value / 1000.0
      else null
    end as total_volume_ml,
    case
      when vb.concentration_mg_per_ml is not null then vb.concentration_mg_per_ml
      when (
        vb.total_volume_value is not null
        and (
          case lower(vb.content_mass_unit)
            when 'mg' then vb.content_mass_value
            when 'mcg' then vb.content_mass_value / 1000.0
            when 'ug' then vb.content_mass_value / 1000.0
            when 'µg' then vb.content_mass_value / 1000.0
            when 'g' then vb.content_mass_value * 1000.0
            else null
          end
        ) is not null
        and (
          case lower(vb.total_volume_unit)
            when 'ml' then vb.total_volume_value
            when 'cc' then vb.total_volume_value
            when 'ul' then vb.total_volume_value / 1000.0
            when 'µl' then vb.total_volume_value / 1000.0
            else null
          end
        ) is not null
      )
      then (
        (
          case lower(vb.content_mass_unit)
            when 'mg' then vb.content_mass_value
            when 'mcg' then vb.content_mass_value / 1000.0
            when 'ug' then vb.content_mass_value / 1000.0
            when 'µg' then vb.content_mass_value / 1000.0
            when 'g' then vb.content_mass_value * 1000.0
            else null
          end
        )
        /
        (
          case lower(vb.total_volume_unit)
            when 'ml' then vb.total_volume_value
            when 'cc' then vb.total_volume_value
            when 'ul' then vb.total_volume_value / 1000.0
            when 'µl' then vb.total_volume_value / 1000.0
            else null
          end
        )
      )
      else null
    end as concentration_mg_per_ml_effective
  from vial_base vb
),
used as (
  select
    e.user_id,
    e.vial_id,
    sum(e.dose_mass_mg) as used_mass_mg,
    sum(e.dose_volume_ml) as used_volume_ml
  from public.administration_events e
  where e.deleted_at is null and e.vial_id is not null
  group by e.user_id, e.vial_id
),
daily_formulation as (
  select
    e.user_id,
    e.formulation_id,
    (e.ts at time zone p.timezone)::date as day_local,
    (now() at time zone p.timezone)::date as today_local,
    sum(e.dose_mass_mg) as administered_mg
  from public.administration_events e
  join public.profiles p
    on p.user_id = e.user_id
  where e.deleted_at is null and e.dose_mass_mg is not null
  group by e.user_id, e.formulation_id, day_local, today_local
),
avg_usage as (
  select
    user_id,
    formulation_id,
    avg(administered_mg) filter (where day_local >= today_local - 13) as avg_daily_administered_mg_14d
  from daily_formulation
  group by user_id, formulation_id
)
select
  vc.user_id,
  vc.vial_id,
  vc.formulation_id,
  vc.formulation_name,
  vc.substance_id,
  vc.substance_name,
  vc.route_id,
  vc.route_name,
  vc.status,
  vc.received_at,
  vc.opened_at,
  vc.closed_at,
  vc.content_mass_value,
  vc.content_mass_unit,
  vc.content_mass_mg,
  vc.total_volume_value,
  vc.total_volume_unit,
  vc.total_volume_ml,
  vc.concentration_mg_per_ml_effective,
  coalesce(u.used_mass_mg, 0) as used_mass_mg,
  coalesce(u.used_volume_ml, 0) as used_volume_ml,
  case when vc.content_mass_mg is null then null else vc.content_mass_mg - coalesce(u.used_mass_mg, 0) end
    as remaining_mass_mg,
  case when vc.total_volume_ml is null then null else vc.total_volume_ml - coalesce(u.used_volume_ml, 0) end
    as remaining_volume_ml,
  vc.cost_usd,
  au.avg_daily_administered_mg_14d,
  case
    when vc.status <> 'active' then null
    when vc.content_mass_mg is null then null
    when au.avg_daily_administered_mg_14d is null then null
    when au.avg_daily_administered_mg_14d <= 0 then null
    else (vc.content_mass_mg - coalesce(u.used_mass_mg, 0)) / au.avg_daily_administered_mg_14d
  end as runway_days_estimate_mg,
  vc.notes
from vial_converted vc
left join used u
  on u.user_id = vc.user_id and u.vial_id = vc.vial_id
left join avg_usage au
  on au.user_id = vc.user_id and au.formulation_id = vc.formulation_id;

-- Model coverage: show where MC/canonicalization may be blocked by missing base BA specs or missing device calibration.
create or replace view public.v_model_coverage
with (security_invoker = true)
as
select
  f.user_id,
  f.id as formulation_id,
  f.name as formulation_name,
  f.substance_id,
  s.display_name as substance_name,
  f.route_id,
  r.name as route_name,
  f.device_id,
  d.name as device_name,
  r.supports_device_calibration,

  not exists (
    select 1
    from public.bioavailability_specs bas
    where bas.user_id = f.user_id
      and bas.substance_id = f.substance_id
      and bas.route_id = f.route_id
      and bas.compartment = 'systemic'
      and bas.deleted_at is null
  ) as missing_base_systemic,

  not exists (
    select 1
    from public.bioavailability_specs bas
    where bas.user_id = f.user_id
      and bas.substance_id = f.substance_id
      and bas.route_id = f.route_id
      and bas.compartment = 'cns'
      and bas.deleted_at is null
  ) as missing_base_cns,

  case
    when f.device_id is null then false
    when r.supports_device_calibration is false then false
    else not exists (
      select 1
      from public.device_calibrations dc
      where dc.user_id = f.user_id
        and dc.device_id = f.device_id
        and dc.route_id = f.route_id
        and dc.deleted_at is null
    )
  end as missing_any_device_calibration,

  exists (
    select 1
    from public.formulation_modifier_specs fms
    where fms.user_id = f.user_id and fms.formulation_id = f.id and fms.deleted_at is null
  ) as has_formulation_modifiers,

  exists (
    select 1
    from public.formulation_components fc
    join public.component_modifier_specs cms
      on cms.user_id = fc.user_id and cms.formulation_component_id = fc.id and cms.deleted_at is null
    where fc.user_id = f.user_id and fc.formulation_id = f.id and fc.deleted_at is null
  ) as has_component_modifiers,

  exists (
    select 1
    from public.formulation_components fc
    where fc.user_id = f.user_id
      and fc.formulation_id = f.id
      and fc.modifier_dist_id is not null
      and fc.deleted_at is null
  ) as has_component_fallback_modifiers
from public.formulations f
join public.substances s
  on s.user_id = f.user_id and s.id = f.substance_id
join public.routes r
  on r.user_id = f.user_id and r.id = f.route_id
left join public.devices d
  on d.user_id = f.user_id and d.id = f.device_id
where f.deleted_at is null;
