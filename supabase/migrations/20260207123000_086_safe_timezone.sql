-- Make all "local day" analytics resilient to invalid `profiles.timezone` values by using a
-- safe resolver that falls back to UTC.
--
-- Rationale:
-- - `AT TIME ZONE <text>` throws if the timezone name is not recognized.
-- - The app UI asks for an IANA timezone name, but we still want the database views to be
--   robust if a bad value is stored (manual edits, older bugs, etc).

create or replace function public.safe_timezone(tz text)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select name
      from pg_timezone_names
      where lower(name) = lower(btrim(tz))
      limit 1
    ),
    'UTC'
  );
$$;

-- Daily totals: administered dose
create or replace view public.v_daily_totals_admin
with (security_invoker = true)
as
select
  e.user_id,
  (e.ts at time zone public.safe_timezone(p.timezone))::date as day_local,
  f.substance_id,
  s.display_name as substance_name,
  sum(e.dose_mass_mg) as administered_mg,
  count(*) as event_count
from public.administration_events e
left join public.profiles p
  on p.user_id = e.user_id
join public.formulations f
  on f.user_id = e.user_id and f.id = e.formulation_id
join public.substances s
  on s.user_id = e.user_id and s.id = f.substance_id
where e.deleted_at is null and e.dose_mass_mg is not null
group by e.user_id, day_local, f.substance_id, s.display_name;

-- Daily totals: effective systemic (summed percentiles are an approximate band)
create or replace view public.v_daily_totals_effective_systemic
with (security_invoker = true)
as
select
  e.user_id,
  (e.ts at time zone public.safe_timezone(p.timezone))::date as day_local,
  f.substance_id,
  s.display_name as substance_name,
  sum(e.eff_systemic_p05_mg) as eff_systemic_p05_mg,
  sum(e.eff_systemic_p50_mg) as eff_systemic_p50_mg,
  sum(e.eff_systemic_p95_mg) as eff_systemic_p95_mg,
  count(*) as event_count
from public.administration_events e
left join public.profiles p
  on p.user_id = e.user_id
join public.formulations f
  on f.user_id = e.user_id and f.id = e.formulation_id
join public.substances s
  on s.user_id = e.user_id and s.id = f.substance_id
where e.deleted_at is null and e.eff_systemic_p50_mg is not null
group by e.user_id, day_local, f.substance_id, s.display_name;

-- Daily totals: effective CNS (summed percentiles are an approximate band)
create or replace view public.v_daily_totals_effective_cns
with (security_invoker = true)
as
select
  e.user_id,
  (e.ts at time zone public.safe_timezone(p.timezone))::date as day_local,
  f.substance_id,
  s.display_name as substance_name,
  sum(e.eff_cns_p05_mg) as eff_cns_p05_mg,
  sum(e.eff_cns_p50_mg) as eff_cns_p50_mg,
  sum(e.eff_cns_p95_mg) as eff_cns_p95_mg,
  count(*) as event_count
from public.administration_events e
left join public.profiles p
  on p.user_id = e.user_id
join public.formulations f
  on f.user_id = e.user_id and f.id = e.formulation_id
join public.substances s
  on s.user_id = e.user_id and s.id = f.substance_id
where e.deleted_at is null and e.eff_cns_p50_mg is not null
group by e.user_id, day_local, f.substance_id, s.display_name;

-- Spend rollups (event-attributed costs)
create or replace view public.v_spend_daily_weekly_monthly
with (security_invoker = true)
as
with base as (
  select
    e.user_id,
    (e.ts at time zone public.safe_timezone(p.timezone)) as ts_local,
    e.cost_usd
  from public.administration_events e
  left join public.profiles p
    on p.user_id = e.user_id
  where e.deleted_at is null and e.cost_usd is not null
)
select
  user_id,
  'day'::text as period_kind,
  (ts_local::date) as period_start_date,
  sum(cost_usd) as spend_usd
from base
group by user_id, period_start_date

union all
select
  user_id,
  'week'::text as period_kind,
  (date_trunc('week', ts_local)::date) as period_start_date,
  sum(cost_usd) as spend_usd
from base
group by user_id, period_start_date

union all
select
  user_id,
  'month'::text as period_kind,
  (date_trunc('month', ts_local)::date) as period_start_date,
  sum(cost_usd) as spend_usd
from base
group by user_id, period_start_date;

-- Inventory status view: depends on 14d avg usage (local-day grouping)
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
    (e.ts at time zone public.safe_timezone(p.timezone))::date as day_local,
    (now() at time zone public.safe_timezone(p.timezone))::date as today_local,
    sum(e.dose_mass_mg) as administered_mg
  from public.administration_events e
  left join public.profiles p
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

-- "Today" events in the user's configured timezone (fallback UTC).
create or replace view public.v_events_today
with (security_invoker = true)
as
select
  e.*
from public.v_event_enriched e
left join public.profiles p
  on p.user_id = e.user_id
where
  (e.ts at time zone public.safe_timezone(p.timezone))::date
    = (now() at time zone public.safe_timezone(p.timezone))::date;

