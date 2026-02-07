-- Transactional cycle correction: split a cycle at a specific event.
--
-- Rationale:
-- - The MVP "Split cycle here" tool previously performed 3 separate writes from the app:
--   1) complete the old cycle
--   2) create a new cycle
--   3) reassign events at/after the split time
-- - Without a database transaction, a partial failure can leave cycles and events inconsistent.
-- - This function performs the whole operation atomically (all-or-nothing) while still respecting
--   Row Level Security (RLS) because it runs as SECURITY INVOKER (default) and only operates on
--   rows owned by `auth.uid()`.

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
  safe_split_ts timestamptz;
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

  -- Defensive: never allow the split time to precede the cycle start.
  safe_split_ts := greatest(evt.ts, cyc.start_ts);

  -- 1) Complete the existing cycle first so we can create a new active cycle without violating
  --    the unique "one active cycle per substance" index.
  update public.cycle_instances
  set
    status = 'completed',
    end_ts = safe_split_ts
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
    safe_split_ts,
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
    and ae.ts >= safe_split_ts;

  return new_cycle_id;
end;
$$;
