-- Peptaide MVP - inventory + commerce tables
-- - vendors, orders, order_items
-- - vials (including the "one active vial per formulation" constraint)

-- vendors
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.vendors
  add constraint vendors_name_not_blank check (length(trim(name)) > 0);

create unique index vendors_user_name_key on public.vendors (user_id, name);
create unique index vendors_user_id_id_key on public.vendors (user_id, id);

create trigger set_vendors_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

alter table public.vendors enable row level security;

create policy vendors_select_own
on public.vendors
for select
using (auth.uid() = user_id);

create policy vendors_insert_own
on public.vendors
for insert
with check (auth.uid() = user_id);

create policy vendors_update_own
on public.vendors
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy vendors_delete_own
on public.vendors
for delete
using (auth.uid() = user_id);

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  vendor_id uuid not null,
  ordered_at timestamptz not null default now(),
  shipping_cost_usd numeric,
  total_cost_usd numeric,
  tracking_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.orders
  add constraint orders_vendor_fk foreign key (user_id, vendor_id)
    references public.vendors (user_id, id),
  add constraint orders_shipping_cost_nonnegative check (shipping_cost_usd is null or shipping_cost_usd >= 0),
  add constraint orders_total_cost_nonnegative check (total_cost_usd is null or total_cost_usd >= 0);

create unique index orders_user_id_id_key on public.orders (user_id, id);
create index orders_user_vendor_idx on public.orders (user_id, vendor_id);

create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

create policy orders_select_own
on public.orders
for select
using (auth.uid() = user_id);

create policy orders_insert_own
on public.orders
for insert
with check (auth.uid() = user_id);

create policy orders_update_own
on public.orders
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy orders_delete_own
on public.orders
for delete
using (auth.uid() = user_id);

-- order_items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  order_id uuid not null,
  substance_id uuid not null,
  formulation_id uuid,
  qty int not null,
  unit_label text not null,
  price_total_usd numeric,
  expected_vials int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.order_items
  add constraint order_items_order_fk foreign key (user_id, order_id)
    references public.orders (user_id, id) on delete cascade,
  add constraint order_items_substance_fk foreign key (user_id, substance_id)
    references public.substances (user_id, id),
  add constraint order_items_formulation_fk foreign key (user_id, formulation_id)
    references public.formulations (user_id, id),
  add constraint order_items_qty_positive check (qty > 0),
  add constraint order_items_unit_label_not_blank check (length(trim(unit_label)) > 0),
  add constraint order_items_price_total_nonnegative check (price_total_usd is null or price_total_usd >= 0),
  add constraint order_items_expected_vials_nonnegative check (expected_vials is null or expected_vials >= 0);

create unique index order_items_user_id_id_key on public.order_items (user_id, id);
create index order_items_user_order_idx on public.order_items (user_id, order_id);
create index order_items_user_substance_idx on public.order_items (user_id, substance_id);

create trigger set_order_items_updated_at
before update on public.order_items
for each row execute function public.set_updated_at();

alter table public.order_items enable row level security;

create policy order_items_select_own
on public.order_items
for select
using (auth.uid() = user_id);

create policy order_items_insert_own
on public.order_items
for insert
with check (auth.uid() = user_id);

create policy order_items_update_own
on public.order_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy order_items_delete_own
on public.order_items
for delete
using (auth.uid() = user_id);

-- Enforce that when `order_items.formulation_id` is set, it matches `order_items.substance_id`.
create or replace function public.enforce_order_items_formulation_matches_substance()
returns trigger
language plpgsql
as $$
declare
  expected_substance uuid;
begin
  if new.formulation_id is null then
    return new;
  end if;

  select f.substance_id
  into expected_substance
  from public.formulations f
  where f.user_id = new.user_id and f.id = new.formulation_id;

  if expected_substance is null then
    raise exception 'formulation % not found for user %', new.formulation_id, new.user_id;
  end if;

  if new.substance_id <> expected_substance then
    raise exception 'order_items.substance_id (%) does not match formulations.substance_id (%) for formulation %',
      new.substance_id, expected_substance, new.formulation_id;
  end if;

  return new;
end;
$$;

create trigger enforce_order_items_formulation_matches_substance
before insert or update on public.order_items
for each row execute function public.enforce_order_items_formulation_matches_substance();

-- vials
create table public.vials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  substance_id uuid not null,
  formulation_id uuid not null,
  order_item_id uuid,
  lot text,
  received_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  status public.vial_status_t not null default 'planned',
  content_mass_value numeric not null,
  content_mass_unit text not null,
  total_volume_value numeric,
  total_volume_unit text,
  concentration_mg_per_ml numeric,
  volume_ml_per_unit_override_dist_id uuid,
  cost_usd numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.vials
  add constraint vials_substance_fk foreign key (user_id, substance_id)
    references public.substances (user_id, id),
  add constraint vials_formulation_fk foreign key (user_id, formulation_id)
    references public.formulations (user_id, id),
  add constraint vials_order_item_fk foreign key (user_id, order_item_id)
    references public.order_items (user_id, id),
  add constraint vials_content_mass_positive check (content_mass_value > 0),
  add constraint vials_content_mass_unit_not_blank check (length(trim(content_mass_unit)) > 0),
  add constraint vials_total_volume_positive check (total_volume_value is null or total_volume_value > 0),
  add constraint vials_total_volume_unit_not_blank check (total_volume_value is null or length(trim(total_volume_unit)) > 0),
  add constraint vials_concentration_positive check (concentration_mg_per_ml is null or concentration_mg_per_ml > 0),
  add constraint vials_cost_nonnegative check (cost_usd is null or cost_usd >= 0);

create unique index vials_user_id_id_key on public.vials (user_id, id);
create index vials_user_formulation_idx on public.vials (user_id, formulation_id);
create index vials_user_status_idx on public.vials (user_id, status);

-- Hard constraint (DB): only one active vial per formulation per user.
create unique index vials_one_active_per_formulation_key
on public.vials (user_id, formulation_id)
where status = 'active' and deleted_at is null;

create trigger set_vials_updated_at
before update on public.vials
for each row execute function public.set_updated_at();

alter table public.vials enable row level security;

create policy vials_select_own
on public.vials
for select
using (auth.uid() = user_id);

create policy vials_insert_own
on public.vials
for insert
with check (auth.uid() = user_id);

create policy vials_update_own
on public.vials
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy vials_delete_own
on public.vials
for delete
using (auth.uid() = user_id);

-- Enforce that `vials.substance_id` matches the formulation's substance.
create or replace function public.enforce_vials_substance_matches_formulation()
returns trigger
language plpgsql
as $$
declare
  expected_substance uuid;
begin
  select f.substance_id
  into expected_substance
  from public.formulations f
  where f.user_id = new.user_id and f.id = new.formulation_id;

  if expected_substance is null then
    raise exception 'formulation % not found for user %', new.formulation_id, new.user_id;
  end if;

  if new.substance_id <> expected_substance then
    raise exception 'vials.substance_id (%) does not match formulations.substance_id (%) for formulation %',
      new.substance_id, expected_substance, new.formulation_id;
  end if;

  return new;
end;
$$;

create trigger enforce_vials_substance_matches_formulation
before insert or update on public.vials
for each row execute function public.enforce_vials_substance_matches_formulation();
