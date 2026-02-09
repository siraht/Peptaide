-- Ensure `v_events_today` stays fast by forcing the timezone/bounds CTEs to materialize.
--
-- Without `MATERIALIZED`, Postgres may inline the CTEs and end up re-evaluating
-- `safe_timezone(p.timezone)` for each candidate event row, which is extremely slow because
-- `safe_timezone` consults `pg_timezone_names`.
--
-- Materializing produces a single-row bounds relation (per query) that can be joined to
-- `v_event_enriched`, keeping the "today" bounds constant and index-friendly.

create or replace view public.v_events_today
with (security_invoker = true)
as
with me as (
  select auth.uid() as user_id
),
tz as materialized (
  select
    me.user_id,
    public.safe_timezone(p.timezone) as tz
  from me
  left join public.profiles p
    on p.user_id = me.user_id
),
bounds as materialized (
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

