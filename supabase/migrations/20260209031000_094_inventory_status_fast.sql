-- Speed up v_inventory_status by:
-- - avoiding per-row calls to public.safe_timezone(...)
-- - restricting the 14d "avg usage" scan to only inventory formulations and a tight ts range
-- - indexing administration_events by (user_id, vial_id) for fast per-vial usage aggregation
--
-- Motivation: The app renders /inventory via public.v_inventory_status. With realistic vial counts
-- and a growing event log, the previous view could hit Supabase PostgREST statement_timeout.

create index if not exists administration_events_user_vial_idx
on public.administration_events (user_id, vial_id)
where deleted_at is null and vial_id is not null;

create or replace view public.v_inventory_status
with (security_invoker = true)
as
with
  vial_base as (
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
  formulations_in_inventory as materialized (
    select distinct
      vb.user_id,
      vb.formulation_id
    from vial_base vb
  ),
  tz_map as materialized (
    select
      vb.user_id,
      public.safe_timezone(p.timezone) as tz
    from vial_base vb
    left join public.profiles p
      on p.user_id = vb.user_id
    group by vb.user_id, p.timezone
  ),
  bounds as materialized (
    select
      t.user_id,
      t.tz,
      (now() at time zone t.tz)::date as today_local,
      (((now() at time zone t.tz)::date - 13)::timestamp at time zone t.tz) as start_ts_utc,
      (((now() at time zone t.tz)::date + 1)::timestamp at time zone t.tz) as end_ts_utc
    from tz_map t
  ),
  vial_converted as (
    select
      x.*,
      case
        when x.concentration_mg_per_ml is not null then x.concentration_mg_per_ml
        when x.content_mass_mg is not null and x.total_volume_ml is not null
          then x.content_mass_mg / x.total_volume_ml
        else null
      end as concentration_mg_per_ml_effective
    from (
      select
        vb.*,
        case translate(lower(vb.content_mass_unit), 'µμ', 'uu')
          when 'mg' then vb.content_mass_value
          when 'mcg' then vb.content_mass_value / 1000.0
          when 'ug' then vb.content_mass_value / 1000.0
          when 'g' then vb.content_mass_value * 1000.0
          else null
        end as content_mass_mg,
        case translate(lower(vb.total_volume_unit), 'µμ', 'uu')
          when 'ml' then vb.total_volume_value
          when 'cc' then vb.total_volume_value
          when 'ul' then vb.total_volume_value / 1000.0
          else null
        end as total_volume_ml
      from vial_base vb
    ) x
  ),
  used as (
    select
      e.user_id,
      e.vial_id,
      sum(e.dose_mass_mg) as used_mass_mg,
      sum(e.dose_volume_ml) as used_volume_ml
    from public.administration_events e
    join vial_base vb
      on vb.user_id = e.user_id and vb.vial_id = e.vial_id
    where e.deleted_at is null and e.vial_id is not null
    group by e.user_id, e.vial_id
  ),
  daily_formulation as (
    select
      e.user_id,
      e.formulation_id,
      (e.ts at time zone b.tz)::date as day_local,
      b.today_local,
      sum(e.dose_mass_mg) as administered_mg
    from public.administration_events e
    join formulations_in_inventory fi
      on fi.user_id = e.user_id and fi.formulation_id = e.formulation_id
    join bounds b
      on b.user_id = e.user_id
    where e.deleted_at is null
      and e.dose_mass_mg is not null
      and e.ts >= b.start_ts_utc
      and e.ts < b.end_ts_utc
    group by e.user_id, e.formulation_id, day_local, b.today_local
  ),
  avg_usage as (
    select
      user_id,
      formulation_id,
      avg(administered_mg) as avg_daily_administered_mg_14d
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

