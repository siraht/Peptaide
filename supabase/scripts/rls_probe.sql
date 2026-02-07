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
  es as (
    insert into public.evidence_sources (source_type, citation)
    values ('personal_note', 'probe evidence')
    returning id
  ),
  d_cal as (
    insert into public.distributions (name, value_type, dist_type, p1, units, quality_score)
    values ('probe_a_cal_dist', 'volume_ml_per_unit', 'point', 0.10, 'ml', 1)
    returning id
  ),
  d_frac as (
    insert into public.distributions (name, value_type, dist_type, p1, units, quality_score)
    values ('probe_a_base_ba', 'fraction', 'point', 0.50, 'fraction', 1)
    returning id
  ),
  d_mult as (
    insert into public.distributions (name, value_type, dist_type, p1, units, quality_score)
    values ('probe_a_multiplier', 'multiplier', 'point', 1.20, 'x', 1)
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
  bas_sys as (
    insert into public.bioavailability_specs (
      substance_id,
      route_id,
      compartment,
      base_fraction_dist_id,
      evidence_source_id
    )
    select s.id, r.id, 'systemic', d_frac.id, es.id
    from s, r, d_frac, es
    returning id
  ),
  bas_cns as (
    insert into public.bioavailability_specs (
      substance_id,
      route_id,
      compartment,
      base_fraction_dist_id,
      evidence_source_id
    )
    select s.id, r.id, 'cns', d_frac.id, es.id
    from s, r, d_frac, es
    returning id
  ),
  fms as (
    insert into public.formulation_modifier_specs (formulation_id, compartment, multiplier_dist_id)
    select f.id, 'systemic', d_mult.id
    from f, d_mult
    returning id
  ),
  fc as (
    insert into public.formulation_components (formulation_id, component_name, role, modifier_dist_id)
    select f.id, 'Enhancer A', 'enhancer', d_mult.id
    from f, d_mult
    returning id
  ),
  cms as (
    insert into public.component_modifier_specs (formulation_component_id, compartment, multiplier_dist_id)
    select fc.id, 'systemic', d_mult.id
    from fc, d_mult
    returning id
  ),
  cr as (
    insert into public.cycle_rules (substance_id, gap_days_to_suggest_new_cycle, auto_start_first_cycle, notes)
    select s.id, 7, true, 'probe rule'
    from s
    returning id
  ),
  rec as (
    insert into public.substance_recommendations (
      substance_id,
      category,
      route_id,
      min_value,
      max_value,
      unit,
      evidence_source_id
    )
    select s.id, 'dosing', r.id, 1, 2, 'mg', es.id
    from s, r, es
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
insert into public.administration_events (
  ts,
  formulation_id,
  vial_id,
  cycle_instance_id,
  input_text,
  input_kind,
  input_value,
  input_unit,
  dose_mass_mg,
  eff_systemic_p05_mg,
  eff_systemic_p50_mg,
  eff_systemic_p95_mg,
  eff_cns_p05_mg,
  eff_cns_p50_mg,
  eff_cns_p95_mg,
  mc_n,
  mc_seed,
  model_snapshot,
  cost_usd
)
select
  now(),
  f.id,
  vial.id,
  cyc.id,
  '10mg',
  'mass',
  10,
  'mg',
  10,
  1,
  2,
  3,
  0.1,
  0.2,
  0.3,
  1,
  42,
  '{"probe":true}'::jsonb,
  5.25
from f, vial, cyc;

-- Force an event revision row to exist (audit trigger).
update public.administration_events
set notes = 'probe edit'
where input_text = '10mg';

\echo '--- User A visibility (should be non-zero) ---'
select count(*) as formulations_visible_to_a from public.formulations;
select count(*) as formulation_components_visible_to_a from public.formulation_components;
select count(*) as bioavailability_specs_visible_to_a from public.bioavailability_specs;
select count(*) as formulation_modifier_specs_visible_to_a from public.formulation_modifier_specs;
select count(*) as component_modifier_specs_visible_to_a from public.component_modifier_specs;
select count(*) as cycle_rules_visible_to_a from public.cycle_rules;
select count(*) as evidence_sources_visible_to_a from public.evidence_sources;
select count(*) as substance_recommendations_visible_to_a from public.substance_recommendations;

select count(*) as administration_events_visible_to_a from public.administration_events;
select count(*) as event_revisions_visible_to_a from public.event_revisions;

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
select count(*) as daily_totals_admin_visible_to_a from public.v_daily_totals_admin;
select count(*) as daily_totals_effective_systemic_visible_to_a from public.v_daily_totals_effective_systemic;
select count(*) as daily_totals_effective_cns_visible_to_a from public.v_daily_totals_effective_cns;
select count(*) as spend_rollups_visible_to_a from public.v_spend_daily_weekly_monthly;

-- Act as user B.
set local request.jwt.claim.sub = :'user_b';
select auth.uid() as acting_as_user_b;

-- User B should see none of user A's rows.
\echo '--- User B visibility (should be zero) ---'
select count(*) as formulations_visible_to_b from public.formulations;
select count(*) as formulation_components_visible_to_b from public.formulation_components;
select count(*) as bioavailability_specs_visible_to_b from public.bioavailability_specs;
select count(*) as formulation_modifier_specs_visible_to_b from public.formulation_modifier_specs;
select count(*) as component_modifier_specs_visible_to_b from public.component_modifier_specs;
select count(*) as cycle_rules_visible_to_b from public.cycle_rules;
select count(*) as evidence_sources_visible_to_b from public.evidence_sources;
select count(*) as substance_recommendations_visible_to_b from public.substance_recommendations;

select count(*) as administration_events_visible_to_b from public.administration_events;
select count(*) as event_revisions_visible_to_b from public.event_revisions;

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
select count(*) as daily_totals_admin_visible_to_b from public.v_daily_totals_admin;
select count(*) as daily_totals_effective_systemic_visible_to_b from public.v_daily_totals_effective_systemic;
select count(*) as daily_totals_effective_cns_visible_to_b from public.v_daily_totals_effective_cns;
select count(*) as spend_rollups_visible_to_b from public.v_spend_daily_weekly_monthly;

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
