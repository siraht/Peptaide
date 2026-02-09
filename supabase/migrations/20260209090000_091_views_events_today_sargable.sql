-- Fix /today performance by making `v_events_today` index-friendly (sargable).
--
-- Problem:
-- The previous view filtered by `(e.ts AT TIME ZONE tz)::date = (now() AT TIME ZONE tz)::date`,
-- which prevents using the `administration_events(user_id, ts)` index and can force scanning
-- many rows through `v_event_enriched`, hitting PostgREST statement_timeouts in real SSR usage.
--
-- Solution:
-- Compute the current local-day start/end boundaries for the user's timezone, convert those
-- boundaries to UTC, and filter by `e.ts >= start_utc AND e.ts < end_utc`.
-- This is sargable on `administration_events_user_ts_idx`.

create or replace view public.v_events_today
with (security_invoker = true)
as
select
  e.*
from public.v_event_enriched e
left join public.profiles p
  on p.user_id = e.user_id
cross join lateral (
  select public.safe_timezone(p.timezone) as tz
) t
where
  e.ts >= (
    date_trunc('day', now() at time zone t.tz)
    at time zone t.tz
  )
  and e.ts < (
    (
      date_trunc('day', now() at time zone t.tz)
      + interval '1 day'
    )
    at time zone t.tz
  );

