-- Inventory UX: total stock rollups
--
-- Purpose:
-- - `/today` Control Center should reflect total on-hand stock per formulation (planned + active + closed),
--   not only the currently active vial.
-- - Keep unit conversion/clamping consistent with `public.v_inventory_status`.
--
-- Notes:
-- - This view excludes `discarded` vials and soft-deleted vials.
-- - It aggregates by (user_id, formulation_id).
-- - It also joins active-vial details (if present) so the UI can optionally show both
--   "total stock" and "current vial" bars.

create or replace view public.v_inventory_summary
with (security_invoker = true)
as
with
  vial_base as (
    select
      v.user_id,
      v.id as vial_id,
      v.lot,
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
      and v.status in ('planned', 'active', 'closed')
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
  per_vial as (
    select
      vc.user_id,
      vc.vial_id,
      vc.lot,
      vc.formulation_id,
      vc.formulation_name,
      vc.substance_id,
      vc.substance_name,
      vc.route_id,
      vc.route_name,
      vc.status,
      vc.opened_at,
      vc.content_mass_mg,
      coalesce(u.used_mass_mg, 0) as used_mass_mg,
      case
        when vc.content_mass_mg is null then null
        else greatest(0, vc.content_mass_mg - coalesce(u.used_mass_mg, 0))
      end as remaining_mass_mg,
      vc.cost_usd
    from vial_converted vc
    left join used u
      on u.user_id = vc.user_id and u.vial_id = vc.vial_id
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
  ),
  rollup as (
    select
      pv.user_id,
      pv.formulation_id,
      count(*) as vial_count_total,
      count(pv.cost_usd) as vial_count_cost_known,
      sum(pv.cost_usd) as total_cost_usd_known,
      sum(pv.content_mass_mg) as total_content_mass_mg,
      sum(pv.used_mass_mg) as total_used_mass_mg,
      sum(pv.remaining_mass_mg) as total_remaining_mass_mg
    from per_vial pv
    group by pv.user_id, pv.formulation_id
  ),
  active_vial as (
    select distinct on (pv.user_id, pv.formulation_id)
      pv.user_id,
      pv.formulation_id,
      pv.vial_id as active_vial_id,
      pv.lot as active_lot,
      pv.content_mass_mg as active_content_mass_mg,
      pv.used_mass_mg as active_used_mass_mg,
      pv.remaining_mass_mg as active_remaining_mass_mg
    from per_vial pv
    where pv.status = 'active'
    order by pv.user_id, pv.formulation_id, pv.opened_at desc nulls last, pv.vial_id
  )
select
  r.user_id,
  r.formulation_id,
  f.name as formulation_name,
  f.substance_id,
  s.display_name as substance_name,
  f.route_id,
  ro.name as route_name,
  r.vial_count_total,
  r.vial_count_cost_known,
  r.total_cost_usd_known,
  r.total_content_mass_mg,
  r.total_used_mass_mg,
  r.total_remaining_mass_mg,
  au.avg_daily_administered_mg_14d,
  case
    when r.total_remaining_mass_mg is null then null
    when au.avg_daily_administered_mg_14d is null then null
    when au.avg_daily_administered_mg_14d <= 0 then null
    else r.total_remaining_mass_mg / au.avg_daily_administered_mg_14d
  end as runway_days_estimate_total_mg,
  av.active_vial_id,
  av.active_lot,
  av.active_content_mass_mg,
  av.active_used_mass_mg,
  av.active_remaining_mass_mg,
  case
    when av.active_remaining_mass_mg is null then null
    when au.avg_daily_administered_mg_14d is null then null
    when au.avg_daily_administered_mg_14d <= 0 then null
    else av.active_remaining_mass_mg / au.avg_daily_administered_mg_14d
  end as runway_days_estimate_active_mg
from rollup r
join public.formulations f
  on f.user_id = r.user_id and f.id = r.formulation_id
join public.substances s
  on s.user_id = r.user_id and s.id = f.substance_id
join public.routes ro
  on ro.user_id = r.user_id and ro.id = f.route_id
left join avg_usage au
  on au.user_id = r.user_id and au.formulation_id = r.formulation_id
left join active_vial av
  on av.user_id = r.user_id and av.formulation_id = r.formulation_id;
