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
  d_cal as (
    insert into public.distributions (name, value_type, dist_type, p1, units, quality_score)
    values ('probe_a_cal_dist', 'volume_ml_per_unit', 'point', 0.10, 'ml', 1)
    returning id
  ),
  dev as (
    insert into public.devices (name, default_unit)
    values ('probe_a_device', 'spray')
    returning id
  ),
  v as (
    insert into public.vendors (name)
    values ('probe_a_vendor')
    returning id
  ),
  o as (
    insert into public.orders (vendor_id, total_cost_usd, tracking_code)
    select v.id, 123.45, 'probe_track'
    from v
    returning id
  ),
  f as (
    insert into public.formulations (substance_id, route_id, name, is_default_for_route)
    select s.id, r.id, 'Probe A formulation', true
    from s, r
    returning id
  ),
  oi as (
    insert into public.order_items (order_id, substance_id, formulation_id, qty, unit_label, price_total_usd, expected_vials)
    select o.id, s.id, f.id, 1, 'vial', 100, 1
    from o, s, f
    returning id
  ),
  vial as (
    insert into public.vials (
      substance_id,
      formulation_id,
      order_item_id,
      status,
      content_mass_value,
      content_mass_unit,
      total_volume_value,
      total_volume_unit,
      concentration_mg_per_ml,
      cost_usd
    )
    select s.id, f.id, oi.id, 'active', 10, 'mg', 10, 'mL', 1, 100
    from s, f, oi
    returning id
  ),
  cyc as (
    insert into public.cycle_instances (substance_id, cycle_number, start_ts, status)
    select s.id, 1, now(), 'active'
    from s
    returning id
  ),
  dc as (
    insert into public.device_calibrations (device_id, route_id, unit_label, volume_ml_per_unit_dist_id)
    select dev.id, r.id, 'spray', d_cal.id
    from dev, r, d_cal
    returning id
  )
insert into public.administration_events (ts, formulation_id, input_text, input_kind, input_value, input_unit, dose_mass_mg)
select now(), f.id, '10mg', 'mass', 10, 'mg', 10
from f;

\echo '--- User A visibility (should be non-zero) ---'
select count(*) as substances_visible_to_a from public.substances;
select count(*) as vendors_visible_to_a from public.vendors;
select count(*) as orders_visible_to_a from public.orders;
select count(*) as order_items_visible_to_a from public.order_items;
select count(*) as vials_visible_to_a from public.vials;
select count(*) as device_calibrations_visible_to_a from public.device_calibrations;
select count(*) as cycles_visible_to_a from public.cycle_instances;
select count(*) as distributions_visible_to_a from public.distributions;

select count(*) as events_visible_to_a from public.v_event_enriched;
select count(*) as cycle_summary_visible_to_a from public.v_cycle_summary;
select count(*) as inventory_visible_to_a from public.v_inventory_status;
select count(*) as model_coverage_visible_to_a from public.v_model_coverage;
select count(*) as order_item_vial_counts_visible_to_a from public.v_order_item_vial_counts;

-- Act as user B.
set local request.jwt.claim.sub = :'user_b';
select auth.uid() as acting_as_user_b;

-- User B should see none of user A's rows.
\echo '--- User B visibility (should be zero) ---'
select count(*) as substances_visible_to_b from public.substances;
select count(*) as vendors_visible_to_b from public.vendors;
select count(*) as orders_visible_to_b from public.orders;
select count(*) as order_items_visible_to_b from public.order_items;
select count(*) as vials_visible_to_b from public.vials;
select count(*) as device_calibrations_visible_to_b from public.device_calibrations;
select count(*) as cycles_visible_to_b from public.cycle_instances;
select count(*) as distributions_visible_to_b from public.distributions;

select count(*) as events_visible_to_b from public.v_event_enriched;
select count(*) as cycle_summary_visible_to_b from public.v_cycle_summary;
select count(*) as inventory_visible_to_b from public.v_inventory_status;
select count(*) as model_coverage_visible_to_b from public.v_model_coverage;
select count(*) as order_item_vial_counts_visible_to_b from public.v_order_item_vial_counts;

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

  begin
    insert into public.vendors (user_id, name)
    values ('11111111-1111-1111-1111-111111111111', 'probe_b_vendor_hijack');
    raise exception 'expected insert to be blocked by RLS, but it succeeded';
  exception when others then
    raise notice 'expected RLS block on cross-user insert (vendors): %', sqlerrm;
  end;
end $$;

rollback;

\echo '--- RLS probe complete (rolled back) ---'
