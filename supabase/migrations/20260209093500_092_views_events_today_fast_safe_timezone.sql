-- Further optimize `v_events_today` by ensuring `safe_timezone(...)` is evaluated once per query,
-- not once per event row.
--
-- On this project, `public.safe_timezone(...)` consults `pg_timezone_names` to validate a
-- timezone string. That is intentionally robust, but it is expensive when called per-row.
-- We restructure the view to:
-- - derive the invoker's user id via `auth.uid()`
-- - compute a single "effective timezone" via `safe_timezone(profiles.timezone)`
-- - compute UTC bounds for "today" in that timezone once
-- - filter events by an index-friendly `ts` range

create or replace view public.v_events_today
with (security_invoker = true)
as
with me as (
  select auth.uid() as user_id
),
tz as (
  select
    me.user_id,
    public.safe_timezone(p.timezone) as tz
  from me
  left join public.profiles p
    on p.user_id = me.user_id
),
bounds as (
  select
    tz.user_id,
    (date_trunc('day', now() at time zone tz.tz) at time zone tz.tz) as day_start_utc,
    ((date_trunc('day', now() at time zone tz.tz) + interval '1 day') at time zone tz.tz) as day_end_utc
  from tz
)
select
  e.*
from public.v_event_enriched e
join bounds b
  on b.user_id = e.user_id
where
  e.ts >= b.day_start_utc
  and e.ts < b.day_end_utc;

