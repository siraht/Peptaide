-- Peptaide MVP - SQL views for analytics and performance
--
-- Important: Views must not bypass RLS. Use `security_invoker = true` so policies apply to the
-- querying user rather than the view owner.

create or replace view public.v_event_enriched
with (security_invoker = true)
as
select
  e.id as event_id,
  e.user_id,
  e.ts,
  e.formulation_id,
  f.name as formulation_name,
  f.substance_id,
  s.display_name as substance_name,
  f.route_id,
  r.name as route_name,
  f.device_id,
  d.name as device_name,
  e.vial_id,
  v.status as vial_status,
  e.cycle_instance_id,
  e.input_text,
  e.input_value,
  e.input_unit,
  e.input_kind,
  e.dose_volume_ml,
  e.dose_mass_mg,
  e.eff_systemic_p05_mg,
  e.eff_systemic_p50_mg,
  e.eff_systemic_p95_mg,
  e.eff_cns_p05_mg,
  e.eff_cns_p50_mg,
  e.eff_cns_p95_mg,
  e.mc_n,
  e.mc_seed,
  e.model_snapshot,
  e.cost_usd,
  e.tags,
  e.notes,
  e.created_at,
  e.updated_at,
  e.deleted_at
from public.administration_events e
join public.formulations f
  on f.user_id = e.user_id and f.id = e.formulation_id
join public.substances s
  on s.user_id = e.user_id and s.id = f.substance_id
join public.routes r
  on r.user_id = e.user_id and r.id = f.route_id
left join public.devices d
  on d.user_id = e.user_id and d.id = f.device_id
left join public.vials v
  on v.user_id = e.user_id and v.id = e.vial_id;

create or replace view public.v_daily_totals_admin
with (security_invoker = true)
as
select
  e.user_id,
  (e.ts at time zone p.timezone)::date as day_local,
  f.substance_id,
  s.display_name as substance_name,
  sum(e.dose_mass_mg) as administered_mg,
  count(*) as event_count
from public.administration_events e
join public.profiles p
  on p.user_id = e.user_id
join public.formulations f
  on f.user_id = e.user_id and f.id = e.formulation_id
join public.substances s
  on s.user_id = e.user_id and s.id = f.substance_id
where e.deleted_at is null and e.dose_mass_mg is not null
group by e.user_id, day_local, f.substance_id, s.display_name;

create or replace view public.v_daily_totals_effective_systemic
with (security_invoker = true)
as
select
  e.user_id,
  (e.ts at time zone p.timezone)::date as day_local,
  f.substance_id,
  s.display_name as substance_name,
  sum(e.eff_systemic_p05_mg) as eff_systemic_p05_mg,
  sum(e.eff_systemic_p50_mg) as eff_systemic_p50_mg,
  sum(e.eff_systemic_p95_mg) as eff_systemic_p95_mg,
  count(*) as event_count
from public.administration_events e
join public.profiles p
  on p.user_id = e.user_id
join public.formulations f
  on f.user_id = e.user_id and f.id = e.formulation_id
join public.substances s
  on s.user_id = e.user_id and s.id = f.substance_id
where e.deleted_at is null and e.eff_systemic_p50_mg is not null
group by e.user_id, day_local, f.substance_id, s.display_name;

create or replace view public.v_daily_totals_effective_cns
with (security_invoker = true)
as
select
  e.user_id,
  (e.ts at time zone p.timezone)::date as day_local,
  f.substance_id,
  s.display_name as substance_name,
  sum(e.eff_cns_p05_mg) as eff_cns_p05_mg,
  sum(e.eff_cns_p50_mg) as eff_cns_p50_mg,
  sum(e.eff_cns_p95_mg) as eff_cns_p95_mg,
  count(*) as event_count
from public.administration_events e
join public.profiles p
  on p.user_id = e.user_id
join public.formulations f
  on f.user_id = e.user_id and f.id = e.formulation_id
join public.substances s
  on s.user_id = e.user_id and s.id = f.substance_id
where e.deleted_at is null and e.eff_cns_p50_mg is not null
group by e.user_id, day_local, f.substance_id, s.display_name;

create or replace view public.v_spend_daily_weekly_monthly
with (security_invoker = true)
as
with base as (
  select
    e.user_id,
    (e.ts at time zone p.timezone) as ts_local,
    e.cost_usd
  from public.administration_events e
  join public.profiles p
    on p.user_id = e.user_id
  where e.deleted_at is null and e.cost_usd is not null
)
select
  user_id,
  'day'::text as period_kind,
  (ts_local::date) as period_start_date,
  sum(cost_usd) as spend_usd
from base
group by user_id, period_start_date

union all
select
  user_id,
  'week'::text as period_kind,
  (date_trunc('week', ts_local)::date) as period_start_date,
  sum(cost_usd) as spend_usd
from base
group by user_id, period_start_date

union all
select
  user_id,
  'month'::text as period_kind,
  (date_trunc('month', ts_local)::date) as period_start_date,
  sum(cost_usd) as spend_usd
from base
group by user_id, period_start_date;

create or replace view public.v_order_item_vial_counts
with (security_invoker = true)
as
select
  oi.user_id,
  oi.id as order_item_id,
  count(v.id) as vial_count_total,
  count(v.id) filter (where v.status = 'planned' and v.deleted_at is null) as vial_count_planned,
  count(v.id) filter (where v.status = 'active' and v.deleted_at is null) as vial_count_active,
  count(v.id) filter (where v.status = 'closed' and v.deleted_at is null) as vial_count_closed,
  count(v.id) filter (where v.status = 'discarded' and v.deleted_at is null) as vial_count_discarded
from public.order_items oi
left join public.vials v
  on v.user_id = oi.user_id and v.order_item_id = oi.id
where oi.deleted_at is null
group by oi.user_id, oi.id;
