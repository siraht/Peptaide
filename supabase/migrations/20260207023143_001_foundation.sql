-- Peptaide MVP - foundation migration
-- - required extensions
-- - shared enum types
-- - updated_at trigger helper

create extension if not exists pgcrypto;

do $$
begin
  create type public.compartment_t as enum ('systemic', 'cns', 'both');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.route_input_kind_t as enum ('mass', 'volume', 'device_units', 'iu');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.device_kind_t as enum ('syringe', 'spray', 'dropper', 'pen', 'other');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.vial_status_t as enum ('planned', 'active', 'closed', 'discarded');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.cycle_status_t as enum ('active', 'completed', 'abandoned');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.recommendation_category_t as enum (
    'cycle_length_days',
    'break_length_days',
    'dosing',
    'frequency'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.evidence_source_type_t as enum (
    'paper',
    'label',
    'clinical_guideline',
    'vendor',
    'anecdote',
    'personal_note'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.distribution_value_type_t as enum (
    'fraction',
    'multiplier',
    'volume_ml_per_unit',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.distribution_dist_type_t as enum (
    'point',
    'uniform',
    'triangular',
    'lognormal',
    'beta_pert'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.input_kind_t as enum ('mass', 'volume', 'device_units', 'iu', 'other');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
