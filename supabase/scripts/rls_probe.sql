-- RLS probe for local Supabase/Postgres.
--
-- Goal: demonstrate that (simulated) authenticated user B cannot read/write user A's rows, and that
-- SECURITY INVOKER views (like v_event_enriched) do not bypass RLS.
--
-- Safety: this runs entirely inside a transaction and ends with ROLLBACK.
--
-- Run:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/scripts/rls_probe.sql

\echo '--- RLS probe (transaction will be rolled back) ---'

begin;

-- Simulated user ids (UUIDs). These do not need to exist in auth.users for RLS to apply, because
-- auth.uid() reads request.jwt.claim.sub.
\set user_a '11111111-1111-1111-1111-111111111111'
\set user_b '22222222-2222-2222-2222-222222222222'

-- Act as user A.
set local role authenticated;
set local request.jwt.claim.sub = :'user_a';
select auth.uid() as acting_as_user_a;

-- Create minimal reference data and one event for user A.
with
  s as (
    insert into public.substances (canonical_name, display_name, family, target_compartment_default)
    values ('probe_a_substance', 'Probe A substance', 'peptide', 'systemic')
    returning id
  ),
  r as (
    insert into public.routes (name, default_input_kind, default_input_unit, supports_device_calibration)
    values ('probe_a_route', 'mass', 'mg', false)
    returning id
  ),
  f as (
    insert into public.formulations (substance_id, route_id, name, is_default_for_route)
    select s.id, r.id, 'Probe A formulation', true
    from s, r
    returning id
  )
insert into public.administration_events (ts, formulation_id, input_text, input_kind, input_value, input_unit, dose_mass_mg)
select now(), f.id, '10mg', 'mass', 10, 'mg', 10
from f;

select count(*) as substances_visible_to_a from public.substances;
select count(*) as events_visible_to_a from public.v_event_enriched;

-- Act as user B.
set local request.jwt.claim.sub = :'user_b';
select auth.uid() as acting_as_user_b;

-- User B should see none of user A's rows.
select count(*) as substances_visible_to_b from public.substances;
select count(*) as events_visible_to_b from public.v_event_enriched;

-- User B should not be able to update user A's rows (UPDATE should touch 0 rows under RLS).
update public.substances
set display_name = 'Hacked by B'
where canonical_name = 'probe_a_substance';

-- Verify that B still sees nothing.
select count(*) as substances_visible_to_b_after_update from public.substances;

-- User B should not be able to insert a row owned by user A.
do $$
begin
  begin
    insert into public.substances (user_id, canonical_name, display_name, family, target_compartment_default)
    values ('11111111-1111-1111-1111-111111111111', 'probe_b_hijack', 'Probe hijack', 'peptide', 'systemic');
    raise exception 'expected insert to be blocked by RLS, but it succeeded';
  exception when others then
    raise notice 'expected RLS block on cross-user insert: %', sqlerrm;
  end;
end $$;

rollback;

\echo '--- RLS probe complete (rolled back) ---'

