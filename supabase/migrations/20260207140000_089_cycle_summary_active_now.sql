-- Fix `v_cycle_summary.cycle_length_days` for active cycles.
--
-- Bug:
-- The previous view used `coalesce(ci.end_ts, max(e.ts), now())` for the cycle end time,
-- which causes active cycles with at least one event to "freeze" their length at the last
-- event timestamp instead of continuing to grow until `now()`.
--
-- Desired behavior:
-- - If `ci.end_ts` is set: length = end_ts - start_ts.
-- - Else if status is `active`: length = now() - start_ts.
-- - Else (completed/abandoned but missing end_ts): fall back to max event ts, then now().

create or replace view public.v_cycle_summary
with (security_invoker = true)
as
with recs as (
  select
    user_id,
    substance_id,
    min(min_value) filter (
      where category = 'cycle_length_days' and lower(unit) in ('day', 'days')
    ) as recommended_cycle_days_min,
    max(max_value) filter (
      where category = 'cycle_length_days' and lower(unit) in ('day', 'days')
    ) as recommended_cycle_days_max,
    min(min_value) filter (
      where category = 'break_length_days' and lower(unit) in ('day', 'days')
    ) as recommended_break_days_min,
    max(max_value) filter (
      where category = 'break_length_days' and lower(unit) in ('day', 'days')
    ) as recommended_break_days_max
  from public.substance_recommendations
  where deleted_at is null
  group by user_id, substance_id
),
next_cycle as (
  select
    ci.user_id,
    ci.id as cycle_instance_id,
    lead(ci.start_ts) over (
      partition by ci.user_id, ci.substance_id order by ci.cycle_number
    ) as next_cycle_start_ts
  from public.cycle_instances ci
  where ci.deleted_at is null
)
select
  ci.user_id,
  ci.id as cycle_instance_id,
  ci.substance_id,
  s.display_name as substance_name,
  ci.cycle_number,
  ci.start_ts,
  ci.end_ts,
  ci.status,
  ci.goal,
  ci.notes,

  count(e.event_id) as event_count,
  sum(e.dose_mass_mg) as administered_mg_total,

  sum(e.eff_systemic_p05_mg) as eff_systemic_p05_mg_total,
  sum(e.eff_systemic_p50_mg) as eff_systemic_p50_mg_total,
  sum(e.eff_systemic_p95_mg) as eff_systemic_p95_mg_total,

  sum(e.eff_cns_p05_mg) as eff_cns_p05_mg_total,
  sum(e.eff_cns_p50_mg) as eff_cns_p50_mg_total,
  sum(e.eff_cns_p95_mg) as eff_cns_p95_mg_total,

  extract(
    epoch from (
      (
        case
          when ci.end_ts is not null then ci.end_ts
          when ci.status = 'active' then now()
          else coalesce(max(e.ts), now())
        end
      ) - ci.start_ts
    )
  ) / 86400.0 as cycle_length_days,

  case
    when ci.end_ts is null then null
    when nc.next_cycle_start_ts is null then null
    else extract(epoch from (nc.next_cycle_start_ts - ci.end_ts)) / 86400.0
  end as break_to_next_cycle_days,

  r.recommended_cycle_days_min,
  r.recommended_cycle_days_max,
  r.recommended_break_days_min,
  r.recommended_break_days_max
from public.cycle_instances ci
join public.substances s
  on s.user_id = ci.user_id and s.id = ci.substance_id
left join public.v_event_enriched e
  on e.user_id = ci.user_id and e.cycle_instance_id = ci.id and e.deleted_at is null
left join next_cycle nc
  on nc.user_id = ci.user_id and nc.cycle_instance_id = ci.id
left join recs r
  on r.user_id = ci.user_id and r.substance_id = ci.substance_id
where ci.deleted_at is null
group by
  ci.user_id,
  ci.id,
  ci.substance_id,
  s.display_name,
  ci.cycle_number,
  ci.start_ts,
  ci.end_ts,
  ci.status,
  ci.goal,
  ci.notes,
  nc.next_cycle_start_ts,
  r.recommended_cycle_days_min,
  r.recommended_cycle_days_max,
  r.recommended_break_days_min,
  r.recommended_break_days_max;

