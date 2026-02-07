-- Make `v_events_today` resilient to invalid `profiles.timezone` values by using `public.safe_timezone(...)`.
--
-- Rationale:
-- - `AT TIME ZONE <text>` throws if <text> is not recognized by Postgres.
-- - We validate/canonicalize timezones on write in the app, but we still want the view to be robust
--   for older rows, manual edits, or future regressions.

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

