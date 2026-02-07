-- "Today" events in the user's configured timezone (fallback UTC).
--
-- Rationale:
-- - The `/today` UI should be day-scoped without requiring JS timezone math.
-- - We derive "today" per-user from `profiles.timezone`, falling back to UTC if the profile row is missing.

create or replace view public.v_events_today
with (security_invoker = true)
as
select
  e.*
from public.v_event_enriched e
left join public.profiles p
  on p.user_id = e.user_id
where
  (e.ts at time zone coalesce(p.timezone, 'UTC'))::date
    = (now() at time zone coalesce(p.timezone, 'UTC'))::date;

