-- Speed up analytics "daily totals" and spend views by:
-- - avoiding per-row calls to public.safe_timezone(...)
-- - pushing an index-friendly ts range filter down onto administration_events
--
-- Motivation: After importing real-world datasets (hundreds+ events) the original daily totals
-- views could hit Supabase PostgREST statement_timeout because filters were applied on
-- computed "day_local" values instead of on the indexed `administration_events.ts`.

-- Daily totals: administered dose
create or replace view public.v_daily_totals_admin
with (security_invoker = true)
as
with
  tz_map as materialized (
    select
      p.user_id,
      public.safe_timezone(p.timezone) as tz
    from public.profiles p
  ),
  bounds as materialized (
    select
      t.user_id,
      t.tz,
      (now() at time zone t.tz)::date as today_local,
      -- Keep enough history for the UI (last 180 days), with buffer.
      (((now() at time zone t.tz)::date - 365)::timestamp at time zone t.tz) as start_ts_utc,
      (((now() at time zone t.tz)::date + 1)::timestamp at time zone t.tz) as end_ts_utc
    from tz_map t
  )
select
  e.user_id,
  (e.ts at time zone b.tz)::date as day_local,
  f.substance_id,
  s.display_name as substance_name,
  sum(e.dose_mass_mg) as administered_mg,
  count(*) as event_count
from public.administration_events e
join bounds b
  on b.user_id = e.user_id
join public.formulations f
  on f.user_id = e.user_id and f.id = e.formulation_id
join public.substances s
  on s.user_id = e.user_id and s.id = f.substance_id
where e.deleted_at is null
  and e.dose_mass_mg is not null
  and e.ts >= b.start_ts_utc
  and e.ts < b.end_ts_utc
group by e.user_id, day_local, f.substance_id, s.display_name;

-- Daily totals: effective systemic (summed percentiles are an approximate band)
create or replace view public.v_daily_totals_effective_systemic
with (security_invoker = true)
as
with
  tz_map as materialized (
    select
      p.user_id,
      public.safe_timezone(p.timezone) as tz
    from public.profiles p
  ),
  bounds as materialized (
    select
      t.user_id,
      t.tz,
      (((now() at time zone t.tz)::date - 365)::timestamp at time zone t.tz) as start_ts_utc,
      (((now() at time zone t.tz)::date + 1)::timestamp at time zone t.tz) as end_ts_utc
    from tz_map t
  )
select
  e.user_id,
  (e.ts at time zone b.tz)::date as day_local,
  f.substance_id,
  s.display_name as substance_name,
  sum(e.eff_systemic_p05_mg) as eff_systemic_p05_mg,
  sum(e.eff_systemic_p50_mg) as eff_systemic_p50_mg,
  sum(e.eff_systemic_p95_mg) as eff_systemic_p95_mg,
  count(*) as event_count
from public.administration_events e
join bounds b
  on b.user_id = e.user_id
join public.formulations f
  on f.user_id = e.user_id and f.id = e.formulation_id
join public.substances s
  on s.user_id = e.user_id and s.id = f.substance_id
where e.deleted_at is null
  and e.eff_systemic_p50_mg is not null
  and e.ts >= b.start_ts_utc
  and e.ts < b.end_ts_utc
group by e.user_id, day_local, f.substance_id, s.display_name;

-- Daily totals: effective CNS (summed percentiles are an approximate band)
create or replace view public.v_daily_totals_effective_cns
with (security_invoker = true)
as
with
  tz_map as materialized (
    select
      p.user_id,
      public.safe_timezone(p.timezone) as tz
    from public.profiles p
  ),
  bounds as materialized (
    select
      t.user_id,
      t.tz,
      (((now() at time zone t.tz)::date - 365)::timestamp at time zone t.tz) as start_ts_utc,
      (((now() at time zone t.tz)::date + 1)::timestamp at time zone t.tz) as end_ts_utc
    from tz_map t
  )
select
  e.user_id,
  (e.ts at time zone b.tz)::date as day_local,
  f.substance_id,
  s.display_name as substance_name,
  sum(e.eff_cns_p05_mg) as eff_cns_p05_mg,
  sum(e.eff_cns_p50_mg) as eff_cns_p50_mg,
  sum(e.eff_cns_p95_mg) as eff_cns_p95_mg,
  count(*) as event_count
from public.administration_events e
join bounds b
  on b.user_id = e.user_id
join public.formulations f
  on f.user_id = e.user_id and f.id = e.formulation_id
join public.substances s
  on s.user_id = e.user_id and s.id = f.substance_id
where e.deleted_at is null
  and e.eff_cns_p50_mg is not null
  and e.ts >= b.start_ts_utc
  and e.ts < b.end_ts_utc
group by e.user_id, day_local, f.substance_id, s.display_name;

-- Spend rollups (event-attributed costs)
create or replace view public.v_spend_daily_weekly_monthly
with (security_invoker = true)
as
with
  tz_map as materialized (
    select
      p.user_id,
      public.safe_timezone(p.timezone) as tz
    from public.profiles p
  ),
  bounds as materialized (
    select
      t.user_id,
      t.tz,
      (((now() at time zone t.tz)::date - 365)::timestamp at time zone t.tz) as start_ts_utc,
      (((now() at time zone t.tz)::date + 1)::timestamp at time zone t.tz) as end_ts_utc
    from tz_map t
  ),
  base as (
    select
      e.user_id,
      (e.ts at time zone b.tz) as ts_local,
      e.cost_usd
    from public.administration_events e
    join bounds b
      on b.user_id = e.user_id
    where e.deleted_at is null
      and e.cost_usd is not null
      and e.ts >= b.start_ts_utc
      and e.ts < b.end_ts_utc
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

