-- Fix: hard-deleting administration_events should not attempt to write an event_revisions row.
--
-- Background:
-- - The app uses soft deletes (`deleted_at`) for normal user flows, which are UPDATEs and are
--   still audited by `event_revisions`.
-- - We also support "danger zone" / replace-import workflows that hard-delete all user data.
-- - `event_revisions` has a foreign key to `administration_events`, so attempting to insert an
--   audit row in an AFTER DELETE trigger violates the FK (the referenced row is already gone).
--
-- Therefore, keep revision logging for UPDATEs only.

drop trigger if exists log_administration_events_revision on public.administration_events;

create trigger log_administration_events_revision
after update on public.administration_events
for each row execute function public.log_administration_event_revision();

