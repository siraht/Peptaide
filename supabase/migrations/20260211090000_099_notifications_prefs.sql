-- Notification preferences (MVP)
--
-- Purpose:
-- - Back the header notifications bell with user-configurable alert thresholds.
-- - Keep MVP simple by storing prefs on `public.profiles` (existing per-user row) instead of a
--   separate rules table.

alter table public.profiles
  add column if not exists notify_low_stock_enabled boolean not null default true,
  add column if not exists notify_low_stock_runway_days_threshold int not null default 7,
  add column if not exists notify_spend_enabled boolean not null default false,
  add column if not exists notify_spend_usd_per_day_threshold numeric not null default 50,
  add column if not exists notify_spend_window_days int not null default 7;

alter table public.profiles
  add constraint profiles_notify_low_stock_runway_days_threshold_nonnegative
    check (notify_low_stock_runway_days_threshold >= 0),
  add constraint profiles_notify_spend_usd_per_day_threshold_nonnegative
    check (notify_spend_usd_per_day_threshold >= 0),
  add constraint profiles_notify_spend_window_days_positive
    check (notify_spend_window_days >= 1);

