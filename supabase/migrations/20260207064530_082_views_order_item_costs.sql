-- Extend v_order_item_vial_counts with basic cost/spend rollups so `/orders` can show a
-- lightweight "cost allocation preview" without per-row queries.
--
-- Note: this view is SECURITY INVOKER so RLS applies to underlying tables.

create or replace view public.v_order_item_vial_counts
with (security_invoker = true)
as
with
  vial_counts as (
    select
      v.user_id,
      v.order_item_id,
      count(v.id) as vial_count_total,
      count(v.id) filter (where v.status = 'planned') as vial_count_planned,
      count(v.id) filter (where v.status = 'active') as vial_count_active,
      count(v.id) filter (where v.status = 'closed') as vial_count_closed,
      count(v.id) filter (where v.status = 'discarded') as vial_count_discarded,
      sum(v.cost_usd) as vial_cost_usd_sum,
      count(v.cost_usd) as vial_cost_usd_known_count
    from public.vials v
    where v.deleted_at is null and v.order_item_id is not null
    group by v.user_id, v.order_item_id
  ),
  event_costs as (
    select
      e.user_id,
      v.order_item_id,
      sum(e.cost_usd) as event_cost_usd_sum,
      count(e.id) as event_count_total,
      count(e.cost_usd) as event_cost_usd_known_count
    from public.administration_events e
    join public.vials v
      on v.user_id = e.user_id and v.id = e.vial_id
    where e.deleted_at is null and v.deleted_at is null and v.order_item_id is not null
    group by e.user_id, v.order_item_id
  )
select
  oi.user_id,
  oi.id as order_item_id,
  coalesce(vc.vial_count_total, 0) as vial_count_total,
  coalesce(vc.vial_count_planned, 0) as vial_count_planned,
  coalesce(vc.vial_count_active, 0) as vial_count_active,
  coalesce(vc.vial_count_closed, 0) as vial_count_closed,
  coalesce(vc.vial_count_discarded, 0) as vial_count_discarded,
  vc.vial_cost_usd_sum,
  coalesce(vc.vial_cost_usd_known_count, 0) as vial_cost_usd_known_count,
  ec.event_cost_usd_sum,
  coalesce(ec.event_count_total, 0) as event_count_total,
  coalesce(ec.event_cost_usd_known_count, 0) as event_cost_usd_known_count
from public.order_items oi
left join vial_counts vc
  on vc.user_id = oi.user_id and vc.order_item_id = oi.id
left join event_costs ec
  on ec.user_id = oi.user_id and ec.order_item_id = oi.id
where oi.deleted_at is null;

