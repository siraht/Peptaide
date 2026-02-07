-- Hardening: prevent splitting a cycle at an event timestamp that precedes the cycle start.
--
-- Rationale:
-- - `public.split_cycle_at_event(...)` is intended to create a new cycle starting at the selected event,
--   and move that event + later events into the new cycle.
-- - If an event's `ts` is earlier than the cycle's `start_ts`, then "split at this event" cannot be
--   represented without creating an invalid cycle (end before start) or a new cycle whose `start_ts`
--   is later than its first event.
-- - In this edge-case, the safest behavior is to refuse the operation with a clear error so the user
--   can correct the underlying inconsistency.

create or replace function public.split_cycle_at_event(
  cycle_instance_id uuid,
  event_id uuid
)
returns uuid
language plpgsql
as $$
declare
  cyc public.cycle_instances%rowtype;
  evt public.administration_events%rowtype;
  new_cycle_id uuid;
  split_ts timestamptz;
begin
  -- Fetch cycle (must exist, be active, and belong to the caller).
  select *
  into cyc
  from public.cycle_instances
  where
    id = cycle_instance_id
    and deleted_at is null
    and user_id = auth.uid();

  if not found then
    raise exception 'cycle_not_found';
  end if;

  if cyc.status <> 'active' then
    raise exception 'cycle_not_active';
  end if;

  -- Fetch event (must exist, not be soft-deleted, and belong to the caller).
  select *
  into evt
  from public.administration_events
  where
    id = event_id
    and deleted_at is null
    and user_id = auth.uid();

  if not found then
    raise exception 'event_not_found_or_deleted';
  end if;

  if evt.cycle_instance_id is distinct from cyc.id then
    raise exception 'event_not_in_cycle';
  end if;

  -- Guard against data inconsistencies that make "split at this event" ill-defined.
  if evt.ts < cyc.start_ts then
    raise exception 'event_before_cycle_start';
  end if;

  -- MVP constraint: only split the most recent cycle for the substance.
  perform 1
  from public.cycle_instances ci
  where
    ci.user_id = auth.uid()
    and ci.substance_id = cyc.substance_id
    and ci.deleted_at is null
    and ci.cycle_number > cyc.cycle_number
  limit 1;

  if found then
    raise exception 'cycle_not_most_recent';
  end if;

  split_ts := evt.ts;

  -- 1) Complete the existing cycle first so we can create a new active cycle without violating
  --    the unique "one active cycle per substance" index.
  update public.cycle_instances
  set
    status = 'completed',
    end_ts = split_ts
  where
    id = cyc.id
    and user_id = auth.uid()
    and deleted_at is null
    and status = 'active';

  if not found then
    raise exception 'failed_to_complete_cycle';
  end if;

  -- 2) Create the new active cycle.
  insert into public.cycle_instances (
    user_id,
    substance_id,
    cycle_number,
    start_ts,
    status,
    goal,
    notes
  )
  values (
    auth.uid(),
    cyc.substance_id,
    cyc.cycle_number + 1,
    split_ts,
    'active',
    null,
    null
  )
  returning id into new_cycle_id;

  -- 3) Reassign the split event and all later events into the new cycle. Include soft-deleted
  --    events so restore semantics remain consistent.
  update public.administration_events ae
  set cycle_instance_id = new_cycle_id
  where
    ae.user_id = auth.uid()
    and ae.cycle_instance_id = cyc.id
    and ae.ts >= split_ts;

  return new_cycle_id;
end;
$$;

