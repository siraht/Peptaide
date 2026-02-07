-- Peptaide MVP - recommendations + evidence tables

create table public.evidence_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  source_type public.evidence_source_type_t not null,
  citation text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.evidence_sources
  add constraint evidence_sources_citation_not_blank check (length(trim(citation)) > 0);

create unique index evidence_sources_user_source_type_citation_key
on public.evidence_sources (user_id, source_type, citation);

create unique index evidence_sources_user_id_id_key on public.evidence_sources (user_id, id);

create trigger set_evidence_sources_updated_at
before update on public.evidence_sources
for each row execute function public.set_updated_at();

alter table public.evidence_sources enable row level security;

create policy evidence_sources_select_own
on public.evidence_sources
for select
using (auth.uid() = user_id);

create policy evidence_sources_insert_own
on public.evidence_sources
for insert
with check (auth.uid() = user_id);

create policy evidence_sources_update_own
on public.evidence_sources
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy evidence_sources_delete_own
on public.evidence_sources
for delete
using (auth.uid() = user_id);

create table public.substance_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  substance_id uuid not null,
  category public.recommendation_category_t not null,
  route_id uuid,
  min_value numeric,
  max_value numeric,
  unit text not null,
  notes text,
  evidence_source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.substance_recommendations
  add constraint substance_recommendations_substance_fk foreign key (user_id, substance_id)
    references public.substances (user_id, id),
  add constraint substance_recommendations_route_fk foreign key (user_id, route_id)
    references public.routes (user_id, id),
  add constraint substance_recommendations_evidence_source_fk foreign key (user_id, evidence_source_id)
    references public.evidence_sources (user_id, id),
  add constraint substance_recommendations_unit_not_blank check (length(trim(unit)) > 0),
  add constraint substance_recommendations_min_le_max check (
    min_value is null or max_value is null or min_value <= max_value
  ),
  add constraint substance_recommendations_has_min_or_max check (
    min_value is not null or max_value is not null
  );

create unique index substance_recommendations_user_id_id_key on public.substance_recommendations (user_id, id);
create index substance_recommendations_user_substance_idx on public.substance_recommendations (user_id, substance_id);
create index substance_recommendations_user_route_idx on public.substance_recommendations (user_id, route_id);

create trigger set_substance_recommendations_updated_at
before update on public.substance_recommendations
for each row execute function public.set_updated_at();

alter table public.substance_recommendations enable row level security;

create policy substance_recommendations_select_own
on public.substance_recommendations
for select
using (auth.uid() = user_id);

create policy substance_recommendations_insert_own
on public.substance_recommendations
for insert
with check (auth.uid() = user_id);

create policy substance_recommendations_update_own
on public.substance_recommendations
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy substance_recommendations_delete_own
on public.substance_recommendations
for delete
using (auth.uid() = user_id);
