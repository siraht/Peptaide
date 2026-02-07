# Peptaide MVP: Peptide + Medication Tracker with Monte Carlo Percentiles

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository's ExecPlan format authority is `.agent/PLANSwHD.md` (from the repository root). This ExecPlan must be maintained in accordance with it.

## Purpose / Big Picture

Peptaide is a recording and analytics app for tracking peptide/medication administrations. After implementing this plan, a user can:

1. Log 5-10+ administration events per day quickly (keyboard-first desktop, tap-light mobile) in a day-scoped "Today Log" grid.
2. For each event, see both the administered dose (canonical mg and/or mL when applicable; IU preserved as IU) and an uncertainty-aware effective dose for systemic and optionally CNS compartments, expressed as Monte Carlo percentiles (p05/p50/p95).
3. Track cycles automatically per substance with a gap-based "new cycle" suggestion and deterministic break computation.
4. Manage inventory (orders -> vials), attribute cost to events, and see spend and runway analytics.
5. Export all data and import it back (portable, no lock-in).
6. Rely on database-enforced privacy via Supabase/Postgres Row Level Security (RLS) on every user-owned table.

Scope disclaimer (non-negotiable): this system can store "recommendations" you enter, but it must never present itself as medical guidance, optimization, or protocol advice.

## Progress

- [x] (2026-02-07 01:01Z) Read `AGENTS.md` and `.agent/PLANSwHD.md` and confirmed the ExecPlan envelope, required sections, and living-document maintenance rules. plan[1-777]
- [x] (2026-02-07 01:01Z) Read the entire `plan.md` and converted all of its sections into this self-contained ExecPlan, preserving all planning context and requirements. plan[1-777]
- [x] (2026-02-07 01:22Z) Fresh-eyes pass: audited `ExecPlan.md` against `plan.md` and patched omissions (explicit unit synonyms including `[iU]` and micro-unit variants; vials/events field grouping labels; `formulation_id` quick-add note; clarified `price_total_usd` rationale; restored the plan's reference URLs verbatim; noted optional mean/std in MC outputs). plan[180-260] plan[344-409] plan[752-761]
- [x] (2026-02-07 01:39Z) Fresh-eyes correctness audit: removed self-containment footguns (milestones no longer depend on `plan.md`), tightened probability/MC semantics (distribution parameterization + safety constraints, deterministic percentiles definition, explicit non-quantile labeling for summed-percentile day bands), clarified deterministic seeding via `model_snapshot`, fixed cost attribution to use administered dose with mg-or-volume fallback, and added key uniqueness/consistency constraints to prevent schema drift. plan[105-411] plan[500-635] plan[690-713]
- [x] (2026-02-07 01:49Z) Fresh-eyes environment probe: recorded local runtime/repo surprises (Bun `node` wrapper, repo not a git worktree) with evidence and updated this ExecPlan so concrete steps are executable in this workspace.
- [x] (2026-02-07 02:44Z) Fresh-eyes audit: re-checked `plan.md` vs `ExecPlan.md` coverage and fixed remaining probability/units footguns in `plan.md` (seed definition, distribution parameterization, IU vs mass-unit semantics, daily band labeling). Also updated this ExecPlan's `Progress`, `Artifacts and Notes`, and "Repository state today" so they match the actual working tree (migrations exist and are applied locally). plan[105-411]
- [x] (2026-02-07 03:36Z) Fresh-eyes audit: corrected additional plan footguns in `plan.md` (clarified distribution parameter mapping, clarified component-modifier double-counting rules, expanded micro-unit synonyms to include Greek mu, and clarified that `default_mass_unit` is only for true mass units). Updated `ExecPlan.md` to explicitly include the plan's new "Plan change notes" section so no plan context is lost. plan[118-129] plan[385-411] plan[304-343] plan[764-777]
- [x] (2026-02-07 04:23Z) Fresh-eyes parity + correctness pass: re-audited `plan.md` (including the appended "Plan change notes") against `ExecPlan.md` and confirmed full coverage. Updated `ExecPlan.md` references to reflect that `plan.md` is now 777 lines and extended the "Plan coverage index" to include the plan's change notes. plan[1-777]

- [ ] (H1) **HUMAN ACTION**: Choose and provision the hosted Supabase environment for deployment (local Supabase is already used for dev in this workspace), and provide the production environment variables. Evidence: the deployed web app can sign in, run migrations, and successfully query user-scoped tables with RLS enabled. Required env vars (deploy: hosting environment): `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional (avoid unless truly needed): a server-only `SUPABASE_SERVICE_ROLE_KEY` for offline admin scripts that cannot run in a user session; it must never be exposed to the browser and must not be used for normal app requests (to avoid bypassing RLS). If running direct SQL scripts/tests against hosted Supabase, also provide `SUPABASE_DB_URL` (a Postgres connection string with sufficient rights for migrations in the chosen environment). plan[17-29] plan[690-698]
- [ ] (H2) **HUMAN ACTION**: For hosted Supabase, configure Auth settings for the chosen sign-in method(s) and redirect URLs for production (and confirm local dev redirects are correct). Evidence: users can complete sign-in and return to `/today` without redirect errors, and sign-out invalidates the session. plan[17-29] plan[636-689]

- [x] (2026-02-07 01:58Z) Initialized git in `/data/projects/peptaide` and created initial commits so subsequent work can "commit frequently" as required. Evidence: `git rev-parse --is-inside-work-tree` returns true and `git log -n 2 --oneline` shows commits `73a9fe5` and `80d4a7a`.
- [x] (2026-02-07 02:01Z) Created the Next.js 16 App Router project in `web/` (TypeScript, Tailwind, ESLint). plan[17-36]
- [x] (2026-02-07 02:03Z) Installed core MVP web dependencies (Supabase, TanStack Table/Virtual, cmdk, Recharts, Zod, date-fns) and added Vitest so `npm run test` exists; verified `npm run build`, `npm run lint`, and `npm run test` all succeed.
- [x] (2026-02-07 02:12Z) Initialized and started local Supabase (`supabase init`, `supabase start`) and configured `web/.env.local` with the local Supabase URL + publishable key for dev auth and API access. plan[17-29] plan[690-698]
- [x] (2026-02-07 02:12Z) Added Supabase client wiring for Next.js using `@supabase/ssr`, and implemented authentication pages plus route protection for all app pages (middleware session refresh, `/sign-in`, `/auth/callback`, and a protected `/today`). plan[17-29] plan[690-698]

- [x] (2026-02-07 02:44Z) Initialized SQL migrations under `supabase/migrations/` and added the DB foundation migration `supabase/migrations/20260207023143_001_foundation.sql` (pgcrypto, shared enum types, `public.set_updated_at()` trigger helper). Evidence: local DB contains the expected enum types (see `Artifacts and Notes`). plan[105-117]
- [x] (2026-02-07 02:44Z) Implemented `profiles` (identity + defaults) with RLS via `supabase/migrations/20260207023215_010_profiles.sql` and applied it locally. Evidence: `public.profiles` exists and RLS is enabled with own-row policies (see `Artifacts and Notes`). plan[118-129]
- [x] (2026-02-07 02:49Z) Added app logic to ensure a `profiles` row exists for each user (insert-on-first-login using DB defaults; do not overwrite existing user preferences). Implementation: idempotent upsert in `web/src/app/(app)/layout.tsx`. plan[118-129]
- [x] (2026-02-07 02:47Z) Committed the new migrations under `supabase/migrations/` to git (`4a8ff2a`). (This repo requires frequent commits.)
- [x] (2026-02-07 02:49Z) Generated DB TypeScript types into `web/src/lib/supabase/database.types.ts` (local: `supabase gen types typescript --local`) so app code stays typed. plan[105-129]

- [x] (2026-02-07 02:54Z) Implemented reference-data tables (substances, substance_aliases, routes, devices, device_calibrations, formulations, formulation_components) including uniqueness-by-user constraints and RLS policies via `supabase/migrations/20260207025138_020_reference_data.sql` and applied it locally (`supabase db reset`). Regenerated `web/src/lib/supabase/database.types.ts`. plan[130-179]
- [x] (2026-02-07 02:58Z) Implemented inventory + commerce tables (vendors, orders, order_items, vials) including the partial unique index enforcing one active vial per (user, formulation) via `supabase/migrations/20260207025608_030_inventory.sql` and applied it locally (`supabase db reset`). Regenerated `web/src/lib/supabase/database.types.ts`. plan[180-229]
- [x] (2026-02-07 03:01Z) Implemented cycles tables (cycle_rules, cycle_instances) and RLS policies via `supabase/migrations/20260207025921_040_cycles.sql` and applied it locally (`supabase db reset`). Regenerated `web/src/lib/supabase/database.types.ts`. plan[261-282]
- [x] (2026-02-07 03:01Z) Implemented recommendations tables (substance_recommendations, evidence_sources) and RLS policies via `supabase/migrations/20260207025957_050_recommendations.sql` and applied it locally (`supabase db reset`). Regenerated `web/src/lib/supabase/database.types.ts`. plan[283-303]
- [x] (2026-02-07 03:05Z) Implemented uncertainty tables (distributions, bioavailability_specs, formulation_modifier_specs, component_modifier_specs) including constraints enforcing distribution parameterization and probability-safety, plus trigger-based enforcement of correct `value_type` usage per foreign key (including device calibration, component modifiers, and vial overrides) via `supabase/migrations/20260207030252_060_uncertainty.sql`. Applied locally (`supabase db reset`) and regenerated `web/src/lib/supabase/database.types.ts`. plan[304-343]

- [x] (2026-02-07 03:10Z) Implemented administration event logging tables (`administration_events`) with canonical fields (mg/mL), MC outputs (p05/p50/p95 per compartment), determinism fields (`mc_seed`, `mc_n`, `model_snapshot`), soft delete, and optional revision/audit support via `event_revisions` + triggers. Implemented via `supabase/migrations/20260207030653_070_events.sql`, applied locally (`supabase db reset`), and regenerated `web/src/lib/supabase/database.types.ts`. plan[88-96] plan[230-260] plan[344-384]

- [x] (2026-02-07 03:35Z) Implemented the units parser and canonicalization logic as a pure domain module in `web/src/lib/domain/units/` with unit tests in `web/src/lib/domain/units/units.test.ts` (supports mL/cc/uL, mg/mcg/ug/g, IU normalization, and device units tokenization). plan[385-411] plan[596-617]
- [x] (2026-02-07 03:35Z) Implemented the uncertainty engine as pure domain modules under `web/src/lib/domain/uncertainty/` (splitmix64 RNG, distribution sampling for point/uniform/triangular/lognormal/beta-pert, bioavailability composition with clamp, and Monte Carlo p05/p50/p95 with deterministic seeding) with unit tests in `web/src/lib/domain/uncertainty/uncertainty.test.ts`. plan[71-87] plan[304-384] plan[596-617]
- [x] (2026-02-07 03:35Z) Implemented the dose computation domain module `web/src/lib/domain/dose/computeDose.ts` (mass/volume/device_units canonicalization, calibration mean usage, and mg/mL when concentration is known) with unit tests in `web/src/lib/domain/dose/dose.test.ts`. plan[230-260] plan[385-411] plan[500-518] plan[596-617]
- [x] (2026-02-07 03:35Z) Implemented the cost attribution domain module `web/src/lib/domain/cost/cost.ts` (allocate vial cost, compute per-event cost based on fraction used: mg preferred; volume fallback) with unit tests in `web/src/lib/domain/cost/cost.test.ts`. plan[180-229] plan[230-260] plan[596-617]
- [ ] Implement cycles domain module for gap-based suggestion, auto-starting first cycle, and "split cycle at event" corrections (completed: `web/src/lib/domain/cycles/suggest.ts` + tests, including `suggestCycleAction`; implemented cycle assignment orchestration for new events in `/today` server action using real DB rows; remaining: split-at-event mechanics and the final cycle-prompt UX + `/cycles` page). plan[261-282] plan[462-540] plan[596-617]
- [x] (2026-02-07 03:35Z) Fixed `npm run typecheck` failing with `TS2737` BigInt literal errors by disabling `tsc` incremental compilation in `web/tsconfig.json` (stale `tsconfig.tsbuildinfo` from the earlier compiler target was causing a false "target < ES2020" error). Evidence: `npm run typecheck` now succeeds.

- [ ] Implement thin, typed data-access modules (repos) for all tables and views, and make them the only place that performs SQL queries from app code (completed: repo scaffolding + initial repos in `web/src/lib/repos/` for profiles/formulations/vials/distributions/events, plus repos for BA specs/modifiers/components/calibrations needed for event modeling; remaining: repos for the rest of the tables/views and refactor all app DB access to go through repos). plan[618-621]
- [x] (2026-02-07 04:09Z) Implemented a `/today` prototyping surface to exercise the end-to-end event pipeline (without the final virtualized grid yet): demo-data seeding action, a quick log form using Server Actions, and a recent-events table backed by `public.v_event_enriched`. The server action parses `input_text`, computes canonical dose (mg/mL when possible), computes MC percentiles when BA specs exist, and persists `model_snapshot`. Files: `web/src/app/(app)/today/page.tsx`, `web/src/app/(app)/today/actions.ts`, `web/src/app/(app)/today/today-log-form.tsx`. plan[462-499] plan[638-643]
- [x] (2026-02-07 04:16Z) Implemented basic reference-data CRUD pages and navigation needed for setup: `/substances` (create/list/soft-delete), `/routes` (create/list/soft-delete), and `/formulations` (create/list). Added header navigation links in `web/src/app/(app)/layout.tsx`. These are scaffolding toward the bulk-first Setup Wizard and detail pages. plan[422-461] plan[644-659]
- [x] (2026-02-07 04:27Z) Added a minimal `/distributions` page to create/list uncertainty distributions so model specs can reference real distribution rows. Implemented via typed repo helpers and linked it in the app nav (`web/src/app/(app)/layout.tsx`). plan[304-343] plan[422-461]
- [x] (2026-02-07 04:33Z) Added a minimal substance detail page (`/substances/[substanceId]`) to set base bioavailability specs (route + compartment + base fraction distribution). This unblocks configuring Monte Carlo percentiles without relying on demo seeding. plan[304-343] plan[644-652]
- [x] (2026-02-07 04:37Z) Extended `/distributions` to support creating `uniform`, `triangular`, `beta_pert`, and `lognormal` distributions (in addition to `point`), and expanded the list view to show all distribution parameter columns. plan[304-343] plan[422-461]
- [x] (2026-02-07 04:40Z) Added a minimal formulation detail page (`/formulations/[formulationId]`) to manage formulation components and attach optional multiplier distributions (fallback modifiers that apply to both systemic and CNS). plan[304-343] plan[653-659]
- [x] (2026-02-07 04:45Z) Added `/devices` reference CRUD (create/list/soft-delete) plus a device detail page (`/devices/[deviceId]`) to create/list device calibrations (device units -> mL via `volume_ml_per_unit` distributions). Linked `/devices` in the app nav. plan[130-179] plan[385-411] plan[422-461]
- [x] (2026-02-07 04:50Z) Added a minimal `/inventory` page to create vials (including active-vial replacement) and list vials via `public.v_inventory_status` with basic remaining/runway estimates. Linked `/inventory` in the app nav. plan[180-229] plan[500-518] plan[660-676]
- [x] (2026-02-07 04:53Z) Added a "Model coverage" section to `/today` using `public.v_model_coverage`, showing non-blocking gaps (missing base BA specs, missing device calibrations) with links to the relevant setup pages. plan[556-582] plan[690-713]
- [x] (2026-02-07 04:59Z) Implemented automatic cycle assignment on event creation in `/today` (auto-start first cycle and auto-create a new cycle when gap >= rule threshold), and persisted `cycle_instance_id` on `administration_events`. The default-yes prompt UX and split-at-event corrections remain pending. plan[261-282] plan[462-540]
- [x] (2026-02-07 05:02Z) Added a minimal `/cycles` page backed by `public.v_cycle_summary` to view cycle timelines and computed breaks (split/merge tools remain pending). Linked `/cycles` in the app nav. plan[261-282] plan[556-582] plan[666-670]
- [x] (2026-02-07 05:11Z) Bugfix: `createDistributionAction` now rejects empty required numeric fields (blank strings no longer silently parse as `0` via `Number('')`). File: `web/src/app/(app)/distributions/actions.ts`.
- [x] (2026-02-07 05:11Z) Bugfix: `/today` cycle assignment no longer auto-starts cycles when `suggestCycleAction(...)` returns `'none'`; it only starts the first cycle when explicitly suggested. File: `web/src/app/(app)/today/actions.ts`.
- [x] (2026-02-07 05:11Z) Bugfix: `/today` model coverage now treats irrelevant compartments as `n/a` and excludes them from gap detection (systemic-only substances no longer show "missing CNS"). File: `web/src/app/(app)/today/page.tsx`.
- [x] (2026-02-07 05:21Z) UI robustness: `/today` model coverage and `/cycles` tables now defensively handle nullable view fields (safe row keys, no `.../null` links) and show device calibration as `n/a` when no device is configured. Files: `web/src/app/(app)/today/page.tsx`, `web/src/app/(app)/cycles/page.tsx`.
- [x] (2026-02-07 05:30Z) Bugfix: device calibration `unit_label` normalization now matches the units parser behavior (first token, lowercased, punctuation stripped, tiny plural heuristic) to avoid calibration mismatches. File: `web/src/app/(app)/devices/[deviceId]/actions.ts`.
- [x] (2026-02-07 05:38Z) Bugfix: distribution repo helpers now ignore soft-deleted distributions (consistent with other repos and prevents silently using deleted uncertainty primitives). File: `web/src/lib/repos/distributionsRepo.ts`.
- [x] (2026-02-07 05:40Z) Bugfix: enriched formulation lookup now respects soft deletes for related substance/route/device rows (prevents inconsistent behavior between list vs detail/event flows). File: `web/src/lib/repos/formulationsRepo.ts`.
- [x] (2026-02-07 05:42Z) Bugfix: `getVialById` no longer returns soft-deleted vials (consistent soft-delete semantics across repos). File: `web/src/lib/repos/vialsRepo.ts`.
- [x] (2026-02-07 05:54Z) Bugfix: `model_snapshot.compartments[].missing` is now de-duped and sorted before hashing so Monte Carlo seeds remain deterministic even when spec query ordering varies. File: `web/src/app/(app)/today/actions.ts`.
- [x] (2026-02-07 05:54Z) Bugfix: `/today` model coverage now defaults unknown target-compartment relevance to systemic-only, reducing false CNS gap alerts for orphaned/soft-deleted reference data. File: `web/src/app/(app)/today/page.tsx`.
- [x] (2026-02-07 05:54Z) Bugfix: device calibration `unit_label` normalization now also normalizes micro symbols (`µ`/`μ`) to ASCII `u`, matching quantity parsing. File: `web/src/app/(app)/devices/[deviceId]/actions.ts`.
- [x] (2026-02-07 06:05Z) Added a minimal `/orders` page to create/list/soft-delete vendors, orders, and order items (soft-deleting an order also soft-deletes its order items to avoid orphan rows in list views). Added typed repos for `vendors`, `orders`, and `order_items`, and linked `/orders` in the app nav. Files: `web/src/app/(app)/orders/page.tsx`, `web/src/app/(app)/orders/actions.ts`, `web/src/lib/repos/vendorsRepo.ts`, `web/src/lib/repos/ordersRepo.ts`, `web/src/lib/repos/orderItemsRepo.ts`, `web/src/app/(app)/layout.tsx`. plan[180-229] plan[500-518] plan[671-676]
- [x] (2026-02-07 06:09Z) Expanded the RLS probe script to cover additional user-owned tables and `security_invoker` views (orders/inventory/cycles/model coverage), and verified user B sees 0 rows across those surfaces. File: `supabase/scripts/rls_probe.sql`. plan[690-698]
- [x] (2026-02-07 06:14Z) Implemented "Generate vials" from an order item in `/orders` (creates planned vials linked via `vials.order_item_id`, with optional per-vial cost defaulting to `price_total_usd / expected_vials` when set). Extended the vials repo insert helper to accept `orderItemId`. Files: `web/src/app/(app)/orders/actions.ts`, `web/src/app/(app)/orders/generate-vials-form.tsx`, `web/src/lib/repos/vialsRepo.ts`. plan[180-229] plan[500-518]
- [x] (2026-02-07 06:18Z) Added vial lifecycle actions to `/inventory` so generated planned vials can be promoted to active and active vials can be closed/discarded without creating new rows. Files: `web/src/app/(app)/inventory/page.tsx`, `web/src/app/(app)/inventory/actions.ts`, `web/src/lib/repos/vialsRepo.ts`. plan[180-229] plan[660-676]
- [x] (2026-02-07 06:26Z) Added a minimal `/settings` page to edit profile defaults (timezone, default units, default MC N, cycle gap days), implemented via a typed repo update helper + Server Action, and linked it in the app nav. Files: `web/src/app/(app)/settings/page.tsx`, `web/src/app/(app)/settings/actions.ts`, `web/src/lib/repos/profilesRepo.ts`, `web/src/app/(app)/layout.tsx`. plan[682-689]
- [x] (2026-02-07 06:26Z) Added a minimal `/analytics` dashboard backed by the existing SQL views (daily totals + spend rollups), with typed repos for each view, and linked it in the app nav. Files: `web/src/app/(app)/analytics/page.tsx`, `web/src/lib/repos/dailyTotalsRepo.ts`, `web/src/lib/repos/spendRepo.ts`, `web/src/app/(app)/layout.tsx`. plan[556-582] plan[677-681]
- [x] (2026-02-07 06:40Z) Fresh-eyes UI polish + robustness: updated `/orders` copy to match current vial-generation behavior, surfaced vial status counts per order item via `public.v_order_item_vial_counts`, and made numeric formatting tolerant of numeric-string values (PostgREST edge) in `/orders`, `/today`, and `/analytics`. Files: `web/src/app/(app)/orders/page.tsx`, `web/src/app/(app)/orders/create-order-item-form.tsx`, `web/src/app/(app)/analytics/page.tsx`, `web/src/app/(app)/today/page.tsx`, `web/src/lib/repos/orderItemVialCountsRepo.ts`. plan[180-229] plan[500-518] plan[556-582] plan[677-681]
- [x] (2026-02-07 06:50Z) Started "cost allocation preview" for orders: extended `public.v_order_item_vial_counts` (SECURITY INVOKER) to include per-order-item vial cost sums and event spend rollups, and updated `/orders` to show vial cost sum, spent, and remaining per order item (plus cost-known counts). Files: `supabase/migrations/20260207064530_082_views_order_item_costs.sql`, `web/src/lib/supabase/database.types.ts`, `web/src/app/(app)/orders/page.tsx`. plan[180-229] plan[500-518] plan[660-676]
- [x] (2026-02-07 06:58Z) Hardened analytics/inventory SQL views to tolerate missing `profiles` rows by falling back to UTC timezone, and expanded the RLS probe script to cover additional model tables (BA/modifiers/recommendations/cycle rules) plus analytics views (daily totals + spend rollups). Files: `supabase/migrations/20260207070010_083_views_timezone_fallback.sql`, `supabase/scripts/rls_probe.sql`. plan[556-582] plan[677-681] plan[690-713]
- [x] (2026-02-07 07:09Z) Implemented the first slice of data portability: a signed-in CSV export bundle endpoint (`/api/export`) that zips one CSV per public table (with a stable column order auto-generated from `database.types.ts`). Linked the export from `/settings`. Files: `web/src/app/api/export/route.ts`, `web/src/app/(app)/settings/page.tsx`, `web/src/lib/export/csv.ts`, `web/src/lib/export/exportColumns.ts`, `web/src/lib/repos/exportRepo.ts`, `web/scripts/generate-export-columns.mjs`. plan[583-595] plan[682-689]
- [x] (2026-02-07 07:24Z) Bugfix: made `/api/export` pagination deterministic by adding a stable tie-breaker ordering (`created_at`/`ts`/etc, then `id` or `user_id`) so large tables export in a consistent order even when timestamps tie. File: `web/src/lib/repos/exportRepo.ts`. plan[583-595]
- [x] (2026-02-07 07:45Z) Implemented CSV bundle import v1: added a dry-run validator and an apply mode (`/api/import`) with optional replace mode (delete all user data first, in FK-safe order). Added a "Danger zone" delete endpoint (`/api/delete-my-data`) and a `/settings` UI section for export/import/delete. Import rebases all rows to the current signed-in `user_id` and preserves UUID ids for FK integrity; it requires the exact exported header set (column order is tolerated) and is replace-only (no merge/dedupe yet). Files: `web/src/app/api/import/route.ts`, `web/src/app/api/delete-my-data/route.ts`, `web/src/lib/import/csvBundle.ts`, `web/src/lib/import/deleteMyData.ts`, `web/src/lib/import/csv.ts`, `web/src/app/(app)/settings/data-portability.tsx`, `web/src/app/(app)/settings/page.tsx`. plan[583-595] plan[682-689]
- [x] (2026-02-07 07:52Z) Bugfix: hardened `/api/import` and `/api/delete-my-data` to return JSON error payloads on failures (instead of crashing with a 500 HTML page), and improved the `/settings` import UI to surface the first table-level error when top-level errors are empty. Files: `web/src/app/api/import/route.ts`, `web/src/app/api/delete-my-data/route.ts`, `web/src/app/(app)/settings/data-portability.tsx`.
- [x] (2026-02-07 07:56Z) Safety: added a browser confirmation prompt when running an import in replace mode (delete-all-then-import) to reduce the chance of accidental data loss. File: `web/src/app/(app)/settings/data-portability.tsx`.
- [x] (2026-02-07 08:21Z) DB fix: hard-deleting `administration_events` should not attempt to write an `event_revisions` row. Updated the revision trigger to fire on UPDATE only (soft deletes are UPDATEs). Migration: `supabase/migrations/20260207080010_084_event_revisions_delete_fix.sql`. plan[230-260]
- [x] (2026-02-07 08:21Z) Import/export robustness: tolerate a UTF-8 BOM in CSV headers, treat invalid ZIP bundles as a structured 400 response (not a 500 crash), and add internal checks ensuring import/delete table order lists cover every exported table (to avoid silent partial imports/deletes after schema changes). Files: `web/src/lib/import/csv.ts`, `web/src/lib/import/csvBundle.ts`, `web/src/lib/import/deleteMyData.ts`, `web/src/app/api/import/route.ts`. plan[583-595]
- [x] (2026-02-07 08:29Z) Import robustness + regression coverage: CSV parsing now ignores blank lines (so manual edits / some tools do not introduce spurious "wrong column count" errors), and tests now cover UTF-8 BOM headers and invalid ZIP inputs. Files: `web/src/lib/import/csv.ts`, `web/src/lib/import/csv.test.ts`, `web/src/lib/import/csvBundle.test.ts`. plan[583-595]
- [x] (2026-02-07 08:32Z) Import compatibility: CSV bundle import now accepts CSVs whose header columns are reordered (as long as the exact expected column set is present), and added a regression test that permutes the `profiles` header. Files: `web/src/lib/import/csvBundle.ts`, `web/src/lib/import/csvBundle.test.ts`. plan[583-595]
- [x] (2026-02-07 08:37Z) UI: added a Ctrl/Cmd+K command palette for fast navigation between existing pages, and added a header sign-out action. Files: `web/src/components/command-palette.tsx`, `web/src/app/(app)/layout.tsx`. plan[17-29] plan[414-421]
- [x] (2026-02-07 03:21Z) Implemented the SQL views needed for dashboards and performance: `v_event_enriched`, `v_daily_totals_admin`, `v_daily_totals_effective_systemic`, `v_daily_totals_effective_cns`, `v_spend_daily_weekly_monthly`, `v_order_item_vial_counts` (`supabase/migrations/20260207031330_080_views.sql`) plus `v_cycle_summary`, `v_inventory_status`, `v_model_coverage` (`supabase/migrations/20260207031911_081_views_more.sql`). Applied locally (`supabase db reset`) and regenerated `web/src/lib/supabase/database.types.ts`. plan[622-635] plan[706-713]

- [x] (2026-02-07 08:40Z) UI: expanded the command palette to cover keyboard-first "actions" (not just navigation): "log event" focuses the dose input on `/today`, and "add substance" / "add formulation" deep-link with a `?focus=new` query param that focuses the primary create input. Files: `web/src/components/command-palette.tsx`, `web/src/app/(app)/today/today-log-form.tsx`, `web/src/app/(app)/substances/create-substance-form.tsx`, `web/src/app/(app)/formulations/create-formulation-form.tsx`. plan[414-421]
- [x] (2026-02-07 08:46Z) UI: added simple bulk-add (paste) forms for `/substances` and `/routes` (best-effort per-line creates; reports per-line errors without aborting the whole batch). Files: `web/src/app/(app)/substances/bulk-add-substances-form.tsx`, `web/src/app/(app)/substances/actions.ts`, `web/src/app/(app)/substances/page.tsx`, `web/src/app/(app)/routes/bulk-add-routes-form.tsx`, `web/src/app/(app)/routes/actions.ts`, `web/src/app/(app)/routes/page.tsx`. plan[422-461] plan[644-652]
- [x] (2026-02-07 08:50Z) UI: added a simple bulk-add (paste) form for `/formulations` that creates multiple formulation rows for a selected (substance, route, optional device). Files: `web/src/app/(app)/formulations/bulk-add-formulations-form.tsx`, `web/src/app/(app)/formulations/actions.ts`, `web/src/app/(app)/formulations/page.tsx`. plan[422-461] plan[653-659]

- [x] (2026-02-07 09:04Z) Fix: corrected the cmdk command palette implementation to control the search query via `Command.Input value/onValueChange` (the `Command` root `value` controls selection, not search), and replaced non-ASCII ellipsis in the settings import/delete UI with ASCII `...`. Files: `web/src/components/command-palette.tsx`, `web/src/app/(app)/settings/data-portability.tsx`.
- [x] (2026-02-07 09:04Z) UI: added a minimal `/setup` onboarding hub page that embeds profile defaults and bulk-add reference data (substances, routes, formulations), and linked it from the `/today` empty state and the command palette. Files: `web/src/app/(app)/setup/page.tsx`, `web/src/app/(app)/today/page.tsx`, `web/src/components/command-palette.tsx`.
- [x] (2026-02-07 09:09Z) UI: extended `/setup` to cover vials and model coverage: embedded a minimal "create vial" form, linked to `/orders` for generating planned vials, and added a coverage-gaps table that links to the correct substance/device pages for base bioavailability specs and device calibrations. File: `web/src/app/(app)/setup/page.tsx`.
- [x] (2026-02-07 09:13Z) UI: added a "quick add base bioavailability spec" form directly on `/setup` (substance + route + compartment + fraction distribution), backed by a dedicated Server Action that revalidates `/setup`, `/today`, and the relevant substance detail page. Files: `web/src/app/(app)/setup/page.tsx`, `web/src/app/(app)/setup/actions.ts`, `web/src/app/(app)/setup/base-ba-spec-form.tsx`.
- [x] (2026-02-07 09:18Z) UI: added a "quick add device calibration" form directly on `/setup` (device + route + unit label + volume distribution). Also refactored calibration unit-label normalization to share the same `normalizeDeviceUnitLabel(...)` logic as quantity parsing, so what users type during logging matches calibration keys. Files: `web/src/app/(app)/setup/page.tsx`, `web/src/app/(app)/setup/actions.ts`, `web/src/app/(app)/setup/device-calibration-form.tsx`, `web/src/app/(app)/devices/[deviceId]/actions.ts`, `web/src/lib/domain/units/types.ts`.
- [x] (2026-02-07 09:22Z) UI: added a minimal formulation modifier spec entry form on `/setup` (per formulation + compartment) backed by an upsert-style repo helper, so users can model formulation-level enhancer multipliers without jumping into detail pages. Files: `web/src/app/(app)/setup/page.tsx`, `web/src/app/(app)/setup/actions.ts`, `web/src/app/(app)/setup/formulation-modifier-form.tsx`, `web/src/lib/repos/formulationModifierSpecsRepo.ts`.
- [x] (2026-02-07 09:25Z) UI: embedded "Generate vials" from order items directly into `/setup` (reusing the existing `/orders` Server Action) so onboarding can produce planned vials without navigating away. File: `web/src/app/(app)/setup/page.tsx`.
- [x] (2026-02-07 09:29Z) UI: extended the command palette with a dynamic "Log" group that includes one entry per formulation, linking to `/today?focus=log&formulation_id=...` so logging a specific formulation is keyboard-only (Ctrl/Cmd+K, type formulation, Enter, type dose, Enter). Files: `web/src/app/(app)/layout.tsx`, `web/src/components/command-palette.tsx`, `web/src/app/(app)/today/today-log-form.tsx`.
- [x] (2026-02-07 09:38Z) UI: added a soft-delete action for events in the `/today` recent-events table (sets `administration_events.deleted_at` via a Server Action; revalidates `/today` and `/analytics`). Files: `web/src/app/(app)/today/actions.ts`, `web/src/app/(app)/today/page.tsx`. plan[88-96] plan[462-499]
- [x] (2026-02-07 09:38Z) UI copy: clarified `/setup` model-coverage text to reflect that base BA specs and device calibrations can be entered inline (not only on detail pages). Also tidied device calibration action formatting. Files: `web/src/app/(app)/setup/page.tsx`, `web/src/app/(app)/devices/[deviceId]/actions.ts`. plan[422-461]
- [x] (2026-02-07 09:46Z) UI: added a "Show deleted" toggle and a restore action for soft-deleted events on `/today`, and extended the events repo to list deleted events (so mistakes can be corrected without losing history). Files: `web/src/app/(app)/today/actions.ts`, `web/src/app/(app)/today/page.tsx`, `web/src/lib/repos/eventsRepo.ts`. plan[88-96] plan[462-499]
- [x] (2026-02-07 09:54Z) UI: added a cycle detail route (`/cycles/[cycleInstanceId]`) and a minimal "Split cycle here" correction tool. Splitting completes the current (most recent active) cycle at the chosen event, creates a new active cycle starting at that event, and reassigns that event and all later events to the new cycle. Files: `web/src/app/(app)/cycles/page.tsx`, `web/src/app/(app)/cycles/[cycleInstanceId]/page.tsx`, `web/src/app/(app)/cycles/[cycleInstanceId]/actions.ts`, `web/src/lib/repos/eventsRepo.ts`, `web/src/lib/repos/cyclesRepo.ts`, `web/src/lib/repos/cycleSummaryRepo.ts`. plan[261-282] plan[462-540]
- [x] (2026-02-07 09:57Z) UI: added an "End cycle now" action on cycle detail, and updated `/today` cycle assignment so that if the last cycle was explicitly ended (no active cycle), the next administration starts a new cycle even when the gap is below the suggestion threshold. Files: `web/src/app/(app)/cycles/[cycleInstanceId]/page.tsx`, `web/src/app/(app)/cycles/[cycleInstanceId]/actions.ts`, `web/src/app/(app)/today/actions.ts`. plan[261-282] plan[462-540]
- [x] (2026-02-07 11:03Z) Correctness: `/today` cycle assignment now treats an `abandoned` last-cycle status the same as `completed` (the next event starts a new cycle when there is no active cycle), preventing silent "no cycle assigned" behavior if/when abandon is used. File: `web/src/app/(app)/today/actions.ts`. plan[261-282]
- [x] (2026-02-07 11:02Z) Defensive correctness: "End cycle now" now clamps `end_ts` so it can never be before `start_ts` (prevents an edge-case constraint error if the cycle start is in the future). File: `web/src/app/(app)/cycles/[cycleInstanceId]/actions.ts`. plan[261-282]
- [x] (2026-02-07 10:56Z) Correctness: made the "Split cycle here" correction tool transactional by moving the multi-step split into a single Postgres function `public.split_cycle_at_event(...)` (invoker/RLS-respecting). Updated the server action to call it via `supabase.rpc(...)` and regenerated types so the RPC is type-checked. Files: `supabase/migrations/20260207130000_087_cycle_split_fn.sql`, `web/src/app/(app)/cycles/[cycleInstanceId]/actions.ts`, `web/src/lib/supabase/database.types.ts`. plan[261-282] plan[462-540] plan[618-621]
- [x] (2026-02-07 11:00Z) Security: extended the local RLS probe script to assert that a different authenticated user cannot call `public.split_cycle_at_event(...)` on another user's cycle/event ids (expected failure under RLS). File: `supabase/scripts/rls_probe.sql`. plan[690-698]
- [x] (2026-02-07 10:04Z) UI: added user-entered reference recommendations on the substance detail page and wired them into cycles displays (cycle detail now shows recommended cycle/break ranges; `/cycles` list already uses those ranges via `v_cycle_summary`). Files: `web/src/app/(app)/substances/[substanceId]/page.tsx`, `web/src/app/(app)/substances/[substanceId]/actions.ts`, `web/src/app/(app)/substances/[substanceId]/recommendations-form.tsx`, `web/src/lib/repos/substanceRecommendationsRepo.ts`, `web/src/app/(app)/cycles/[cycleInstanceId]/page.tsx`. plan[283-303] plan[541-555]
- [x] (2026-02-07 10:09Z) UI: made `/today` day-scoped by adding a per-user local-day events view (`public.v_events_today`, based on `profiles.timezone` with UTC fallback) and updating the `/today` event table to read from it (avoids JS timezone math and ensures the "Today log" is actually today). Files: `supabase/migrations/20260207100530_085_views_events_today.sql`, `web/src/lib/supabase/database.types.ts`, `web/src/lib/repos/eventsRepo.ts`, `web/src/app/(app)/today/page.tsx`. plan[462-499] plan[556-582]
- [x] (2026-02-07 10:15Z) UI: replaced the single-row quick log with a minimal multi-row log grid on `/today` (8 rows). Each row supports Enter-to-save, multi-line paste (fills subsequent rows), and a "Save filled rows" batch action. Files: `web/src/app/(app)/today/page.tsx`, `web/src/app/(app)/today/today-log-grid.tsx`. plan[462-499]
- [x] (2026-02-07 10:34Z) Fresh-eyes bugfix pass: hardened timezone handling by validating `profiles.timezone` in the `/settings` Server Action (reject invalid IANA names) and updating all local-day analytics views to use `public.safe_timezone(...)` (fallback to UTC on invalid names). Also fixed `/cycles/[cycleInstanceId]` to show "End cycle now" for any active cycle (not only split-eligible), and prevented double-submit races in the `/today` log grid by tracking per-row in-flight saves. Files: `web/src/app/(app)/settings/actions.ts`, `supabase/migrations/20260207123000_086_safe_timezone.sql`, `web/src/app/(app)/cycles/[cycleInstanceId]/page.tsx`, `web/src/app/(app)/today/today-log-grid.tsx`. plan[118-129] plan[261-282] plan[462-540] plan[556-582] plan[682-689]
- [x] (2026-02-07 11:05Z) Timezone robustness: `/settings` now canonicalizes timezones via `public.safe_timezone(...)` before saving them to `profiles.timezone`, ensuring the stored value is accepted by Postgres `AT TIME ZONE` even if JS accepts a variant spelling/casing. File: `web/src/app/(app)/settings/actions.ts`. plan[118-129] plan[682-689]
- [x] (2026-02-07 10:43Z) Fresh-eyes UX robustness: removed the numeric keyboard hint for the `/today` dose input (units are required, so decimal-only keyboards are counterproductive) and disabled autocorrect/spellcheck/autocaps for both the dose input and the timezone input to avoid accidental invalid values. Files: `web/src/app/(app)/today/today-log-grid.tsx`, `web/src/app/(app)/settings/settings-form.tsx`. plan[385-411] plan[462-499] plan[682-689]
- [x] (2026-02-07 10:45Z) Fresh-eyes correctness: switched the `/today` grid `rowsRef` sync from `useEffect` to `useLayoutEffect` so async saves always read the latest row state (removes a potential stale-state edge case after paste or fast edits). File: `web/src/app/(app)/today/today-log-grid.tsx`. plan[462-499]
- [x] (2026-02-07 10:58Z) `/today` grid UX: added spreadsheet-like row navigation (ArrowUp/ArrowDown to move between rows; Shift+Enter to save-and-move-up; Enter on a blank row moves focus instead of showing an error). File: `web/src/app/(app)/today/today-log-grid.tsx`. plan[462-499]
- [x] (2026-02-07 11:21Z) Correctness: normalized micro-unit symbols (micro sign `µ` and Greek mu `μ`) to ASCII `u` in `public.v_inventory_status` so imported or manually-entered `μg`/`μL` units do not silently become "unconvertible". Added a regression test covering Greek-mu micrograms parsing. Validated by applying migrations (`supabase db reset`), running the RLS probe script, and running all web quality gates (typecheck/test/lint/build). Files: `supabase/migrations/20260207133000_088_inventory_unit_normalization.sql`, `web/src/lib/domain/units/units.test.ts`. plan[180-229] plan[385-411] plan[690-698]
- [x] (2026-02-07 11:26Z) UI data freshness: `createEventAction(...)` now revalidates the other affected pages (`/analytics`, `/cycles`, `/inventory`, `/orders`) after saving an event, so Next.js fetch caching cannot leave those pages stale immediately after logging. File: `web/src/app/(app)/today/actions.ts`. plan[462-499] plan[556-582]
- [x] (2026-02-07 11:33Z) Cycle UX: `/today` now implements the gap-based "New cycle?" suggestion with default-yes behavior. When a gap suggests a new cycle and an active cycle exists, `createEventAction(...)` returns a `confirm_new_cycle` state; the grid prompts via `window.confirm(...)` (OK = start new cycle; Cancel = keep current cycle) and resubmits with an explicit `cycle_decision`. Also added `router.refresh()` after successful saves so the server-rendered "Today log" list updates immediately. Files: `web/src/app/(app)/today/actions.ts`, `web/src/app/(app)/today/today-log-grid.tsx`. plan[261-282] plan[462-540]
- [x] (2026-02-07 11:35Z) `/today` grid UX: when saving the last visible row, the grid now appends a new blank row and focuses it, so the logging surface is not capped at the initial 8 rows. File: `web/src/app/(app)/today/today-log-grid.tsx`. plan[462-499]
- [x] (2026-02-07 11:39Z) UI: added per-component per-compartment modifier spec editing on formulation detail (`component_modifier_specs`), including create/update (upsert-style) and soft delete. This unblocks modeling component multipliers differently for systemic vs CNS without relying on the fallback `formulation_components.modifier_dist_id`. Files: `web/src/app/(app)/formulations/[formulationId]/page.tsx`, `web/src/app/(app)/formulations/[formulationId]/actions.ts`, `web/src/app/(app)/formulations/[formulationId]/component-modifier-spec-form.tsx`, `web/src/lib/repos/componentModifierSpecsRepo.ts`. plan[304-343] plan[653-659]

- [ ] UI: implement Setup Wizard A1-A6 (preferences, bulk add substances, bulk add routes, bulk add formulations, bulk add vials and/or generate from orders, base BA + modifiers entry) (completed: `/setup` exists as an onboarding hub and now embeds profile defaults, bulk-add primitives for substances/routes/formulations, a minimal "create vial" form, "generate vials from order items", a model-coverage gaps table, quick base BA spec entry, quick device calibration entry, and a minimal formulation modifier spec form; component-level per-compartment modifier specs are now supported on formulation detail; remaining: add a true bulk-vials paste/import (optional), consider embedding component-level modifier spec entry into `/setup`, and refine `/setup` into a true wizard flow with completion state). plan[422-461]
- [ ] UI: implement `/substances` list + bulk add + detail page (formulations, BA specs, recommendations, analytics links) (completed: basic `/substances` list + create + soft delete; added a minimal substance detail page to set base BA specs; added a basic bulk-add textarea form; remaining: aliases, bulk grid/paste UX, and the rest of the detail page (formulations, recommendations, analytics links)). plan[644-652]
- [ ] UI: implement `/formulations` list + bulk add + detail page (components + modifier distributions, default device/vial settings) (completed: basic `/formulations` list + create; added a minimal formulation detail page to manage components with optional multiplier distributions; added a per-component per-compartment modifier specs editor (`component_modifier_specs`); added a basic bulk-add textarea form; remaining: bulk grid/paste UX, formulation-level per-compartment modifier spec editing on the detail page (currently on `/setup`), and default device/vial settings). plan[653-659]

- [ ] UI: implement `/orders` and `/inventory` flows including order entry, order items, cost allocation preview, generate vials, set active vial, close/discard vial, runway estimates (completed: minimal `/inventory` page for creating/listing vials with runway estimates; added a minimal `/orders` page for vendors/orders/order-items CRUD; added a basic "generate planned vials" flow from order items (requires `formulation_id`; links `vials.order_item_id`; defaults `cost_usd` to `price_total_usd / expected_vials` when available); added basic vial lifecycle actions (activate planned vials; close/discard vials); order items now show vial counts and a basic cost/spend rollup via `public.v_order_item_vial_counts`; remaining: richer cost allocation preview UX and a shipping allocation policy if desired). plan[500-518] plan[660-676]

- [ ] UI: implement `/today` as the primary keyboard-first logging surface (virtualized table, fast formulation selection, input_text parsing, enter-to-save, immediate next-row focus, non-blocking warnings for missing model pieces). (completed: `/today` end-to-end logging works; it now shows a day-scoped event list via `public.v_events_today`; command palette provides per-formulation log shortcuts; events support soft delete + restore; `/today` now has a minimal multi-row log grid with Enter-to-save and multi-line paste; remaining: full spreadsheet-like navigation (arrow keys, Shift+Enter reverse, per-cell paste), virtualization for larger days, and higher-fidelity formulation search/autocomplete in-cell). plan[9-13] plan[462-499] plan[638-643]
- [ ] UI: implement the cycle automation UX in `/today` (gap-based new-cycle suggestion with default-yes behavior that preserves fast entry) and complete the `/cycles` experience (timeline, manual create/end flows, and any remaining correction tools). (completed: `/today` server action assigns cycles automatically and now prompts for "New cycle?" on gap thresholds with default-yes behavior; `/cycles` has list + detail pages plus "split cycle here" correction and "end cycle now"; remaining: manual cycle creation, richer end-cycle UX (choose end time, break clock), and any merge tooling). plan[261-282] plan[462-540] plan[666-670]

- [ ] UI: implement `/recommendations` surfaces within substance detail (manual entry now; clearly labeled as user-entered reference ranges, not advice) and comparisons shown in cycle detail. (completed: substance detail now supports creating/listing/soft-deleting user-entered recommendations; cycle detail now surfaces recommended cycle/break ranges; remaining: evidence sources UI, dosing/frequency recommendations, and richer comparisons (cycle length vs recommended, total dose vs recommended, by route where possible)). plan[283-303] plan[541-555]

- [ ] UI: implement `/analytics` dashboard: today summary, calendar, trends, cycles/breaks analytics, inventory runway, spend (USD/day/week/month) including uncertainty bands where applicable (completed: minimal read-only `/analytics` surface backed by daily totals + spend views; remaining: richer dashboards (calendar/trends), cycle/break analytics, inventory runway summaries, and uncertainty-band UX). plan[556-582] plan[677-681]

- [ ] UI: implement `/settings` including profile defaults (units, default MC N, cycle defaults) and data import/export with dry-run validation and dedupe (completed: profile defaults editor for timezone/units/MC N/cycle gap; added a signed-in CSV export bundle endpoint at `/api/export` and linked it from `/settings`; added CSV bundle import v1 with dry-run + apply (replace-only) plus a danger-zone "delete my data"; remaining: merge/dedupe semantics and id mapping for non-empty imports, clipboard/paste "template" imports for setup tables, and compatibility handling for schema evolution). plan[583-595] plan[682-689]

- [ ] Security verification pass: confirm RLS is enabled and correct on every user-owned table; add explicit probes/tests that demonstrate cross-user reads/writes are blocked (completed: expanded `supabase/scripts/rls_probe.sql` to exercise cross-user isolation across a broader set of core tables (`substances`, `formulations`/`formulation_components`, `vendors`/`orders`/`order_items`/`vials`, `administration_events`/`event_revisions`, `device_calibrations`, `cycle_instances`/`cycle_rules`, `distributions`, `bioavailability_specs`/`formulation_modifier_specs`/`component_modifier_specs`, `evidence_sources`/`substance_recommendations`) and key `security_invoker` views (`v_event_enriched`, `v_cycle_summary`, `v_inventory_status`, `v_model_coverage`, `v_order_item_vial_counts`, `v_daily_totals_*`, `v_spend_daily_weekly_monthly`); remaining: expand probes to cover any remaining tables/views and add a repeatable "RLS audit" checklist. Note: `profiles` is harder to probe with simulated auth IDs because it references `auth.users`, but the views now fall back to UTC when `profiles` is missing). plan[690-698]
- [ ] Correctness and performance pass: confirm canonical units semantics, IU behavior, MC determinism with stored seed/snapshot, required indexes, and that daily aggregation semantics are documented and conservative. plan[699-713]

- [ ] Run the full MVP definition-of-done verification, and record evidence snippets/transcripts in `Artifacts and Notes`. plan[729-751]

## Milestones

Milestones are narrative checkpoints. Each milestone must produce something demonstrably usable, and should be independently verifiable.

### Milestone 0: Repo Bootstrap + Auth Skeleton

Goal: create the Next.js app and a working sign-in/sign-out flow so all later work can be tested end-to-end with real user sessions.

Work:

Create a Next.js App Router project in `web/` with TypeScript, Tailwind, and ESLint. Add Supabase client wiring using `@supabase/ssr` (not the deprecated Auth Helpers) and implement an auth surface (sign-in page, sign-out action, and a protected "app" route group that redirects unauthenticated users).

Result:

A user can start the dev server, load the app, sign in, and land on `/today` (even if `/today` is a placeholder).

Proof (commands and what to observe):

    cd /data/projects/peptaide/web
    npm run dev

Open the dev URL in a browser. Confirm:

1. Visiting `/today` while signed out redirects to the sign-in page.
2. Completing sign-in returns to `/today`.
3. Signing out returns to sign-in and invalidates the session.

### Milestone 1: Database Schema + RLS + Type Generation

Goal: implement the MVP schema in Postgres and enforce "only I can see my data" at the database layer.

Work:

Create SQL migrations under `supabase/migrations/` that implement the full data model described in this ExecPlan (see `Context and Orientation`, sections 4.*) and enable RLS with explicit policies on all user-owned tables. Ensure the schema includes the critical constraints (unique-by-user, one active vial per formulation, and no redundant substance_id/route_id stored in events). Generate TypeScript types for the DB schema so app code is typed.

Result:

With RLS enabled, a signed-in user's session can create and query their own rows, and cannot query another user's rows.

Proof:

1. Apply migrations (local Supabase or hosted, depending on H1/H2).
2. Generate types into `web/src/lib/supabase/database.types.ts`.
3. Add a minimal protected page that queries `profiles` and renders the current user's profile data.

### Milestone 2: Pure Domain Logic (Units, Dose, Uncertainty, Cycles, Cost)

Goal: build the correctness-critical parts as pure functions first, with unit tests, so UI and persistence are glue rather than logic.

Work:

Implement the modules described in this ExecPlan (see `Context and Orientation`, section 8.1):

1. Units parsing and canonicalization to mg/mL.
2. Dose computation (including device calibration conversion).
3. Uncertainty distribution sampling and Monte Carlo effective dose simulation with deterministic seeding, producing p05/p50/p95.
4. Cycle suggestion/assignment logic and split-at-event correction helpers.
5. Cost attribution helpers.

Result:

`npm run test` and `npm run typecheck` pass and demonstrate: parsing works for common inputs, MC output is deterministic for a fixed seed, BA composition never exceeds [0,1], and cost/cycle helpers behave as specified.

Proof:

    cd /data/projects/peptaide/web
    npm run test
    npm run typecheck

### Milestone 3: Setup Wizard + Reference Data CRUD

Goal: support bulk-first setup so a new user can get from empty DB to ready-to-log without clicky friction.

Work:

Implement Setup Wizard Flow A (see `Context and Orientation`, section 7, Flow A) and the `/substances` and `/formulations` pages. The wizard must support grid/paste bulk add for substances, routes, formulations, and vials, and it must provide screens to enter base BA distributions and modifier distributions (manual entry now).

Result:

A user can complete setup and reach `/today` with at least one formulation and active vial per formulation configured.

Proof:

In the UI, complete steps A1-A6 and confirm the "Definition of done" for setup: opening `/today` shows a ready blank row where the formulation selector contains the created formulation(s).

### Milestone 4: Today Log End-to-End (Fast Entry, Canonical Dose, MC Percentiles, Cycles)

Goal: the primary user value: logging 5-10+ events/day rapidly, with computed outputs stored.

Work:

Implement `/today` as a spreadsheet-like grid (TanStack Table + virtualization) with a keyboard-first flow and a command palette shortcut to open it. On row save, the server must:

1. Parse and store `input_text` and structured parse fields.
2. Compute canonical dose fields `dose_mass_mg` and `dose_volume_ml`.
3. Resolve bioavailability distributions and modifier distributions and compute MC percentiles when possible. If some model inputs are missing, store null percentiles for those compartment(s) and record the missing coverage in `model_snapshot` so the UI can warn without blocking the save. Only block saving when the input cannot be canonicalized into a numeric dose at all (for example, device units with no calibration to convert units to volume).
4. Assign cycle instance using gap-based new-cycle suggestion logic.

Result:

Entering an event and pressing Enter stores an event row with canonical dose and MC percentiles; the UI immediately shows computed percentiles and advances focus to a new row.

Proof:

In `/today`, add 10 rows in about 1 minute on desktop and confirm the app remains responsive. Pick inputs like `0.3mL`, `2 sprays`, and `250mcg` and confirm conversions. For a substance with a long gap since last event, confirm the new-cycle suggestion appears with default-yes behavior that does not interrupt fast entry.

### Milestone 5: Inventory, Orders, Vials, and Spend Attribution

Goal: connect logging to inventory and cost.

Work:

Implement `/orders` and `/inventory` plus the server-side cost attribution for events. Support generating vials from an order item, setting an active vial, and attributing per-event cost from vial cost and fraction used.

Result:

A user can enter an order, generate vials, set one active, log events tied to that vial, and see per-event cost and spend rollups.

Proof:

Create an order with an item, generate N vials, set one active, log an event, and confirm the event has `cost_usd` populated. Confirm spend analytics can compute USD/day/week/month.

### Milestone 6: Cycles, Breaks, Recommendations, and Comparisons

Goal: support the "cycle tracking" and "recommendations" features without implying advice.

Work:

Implement `/cycles` with per-substance timelines, computed breaks, and split-at-event correction. Implement recommendations CRUD and display comparisons in cycle details (actual vs recommended cycle length, break length, and total dose vs recommended range when possible).

Result:

Cycles can be viewed and corrected; recommendations can be entered; cycle detail compares actuals vs user-entered reference ranges with clear disclaimers.

Proof:

End a cycle, confirm computed break duration appears, and perform a split-at-event correction. Add a recommendation and confirm comparisons render.

### Milestone 7: Analytics Dashboards + Coverage Warnings

Goal: provide useful summaries and highlight missing model inputs.

Work:

Implement `/analytics` including the required v1 views: Today summary, calendar, trends, cycles/breaks analytics, inventory runway, and spend. Implement "coverage" views (or badges) that highlight missing base BA, missing modifiers, or missing device calibration needed to compute dose.

Result:

Analytics pages load quickly for growing history (views make queries cheap), show administered and effective totals with uncertainty bands, and show spend and runway.

Proof:

Log events across multiple days and confirm calendar and trends render correct totals. Confirm missing model pieces produce visible warnings that do not block saving unless dose cannot be computed.

### Milestone 8: Import/Export and Portability

Goal: no lock-in.

Work:

Implement Settings -> Data export for all user-owned tables (CSV bundle) and import with dry-run validation, id mapping, and dedupe by unique keys. Support clipboard paste imports for core setup tables.

Result:

A user can export, wipe the local DB (in a safe test environment), and import to restore the same state.

Proof:

Perform an export/import round trip and confirm counts and key entities match.

### Milestone 9: Hardening (RLS Audit, Performance, Definition of Done)

Goal: match the nonfunctional requirements and the MVP definition-of-done.

Work:

Audit RLS and confirm no cross-user access. Confirm correctness invariants (canonical units, IU behavior, MC determinism). Add or verify required indexes. Run through the full definition-of-done checklist and record evidence.

Result:

The MVP meets the definition of done and can be validated by a novice following this ExecPlan.

Proof:

Record the outputs and checks in `Artifacts and Notes`.

## Surprises & Discoveries

- Observation: `node` on this machine is Bun's `node` wrapper, not the real Node.js binary. `node --version` fails (Bun wrapper does not implement the Node REPL/version flag), which can break common Next.js tooling assumptions.
  Evidence:
    command -v node
    /home/ubuntu/.bun/bin/node

    node --version
    error: Missing script to execute. Bun's provided 'node' cli wrapper does not support a repl.

- Observation: A real Node.js install exists (via nvm), but it is later in `PATH` than Bun, so it is not the default `node`.
  Evidence:
    /home/ubuntu/.nvm/versions/node/v22.21.1/bin/node --version
    v22.21.1

- Observation: `/data/projects/peptaide` started without a git worktree, so the "commit frequently" instruction in `AGENTS.md` was initially not executable. Git was initialized and the initial docs/spec were committed.
  Evidence:
    git rev-parse --is-inside-work-tree
    true

    git log -n 2 --oneline
    73a9fe5 chore: track ExecPlan spec and ignore local tooling
    80d4a7a chore: initial docs and ExecPlan

- Observation: When starting `next dev` in this workspace, port 3000 was already in use, so Next.js selected port 3001.
  Evidence:
    npm run dev
    ⚠ Port 3000 is in use by an unknown process, using available port 3001 instead.

- Observation: Supabase Auth (local) enforces an exact allow-list for redirects (`auth.site_url` and `auth.additional_redirect_urls`). If the chosen callback origin/path is not allow-listed, Supabase will silently fall back to `site_url` in the emailed magic link.
  Evidence:
    The local Supabase config defaulted to `site_url = http://127.0.0.1:3000`, which caused emailed links to use `redirect_to=http://127.0.0.1:3000` even when requesting a different `emailRedirectTo`. Updating `supabase/config.toml` to include `http://localhost:3000|3001|3002/auth/callback` (and the `127.0.0.1` variants) produced emailed links with `redirect_to=http://localhost:3002/auth/callback` as expected.

- Observation: `supabase db reset --yes` applies all migrations but can exit non-zero with `Error status 502: An invalid response was received from the upstream server` immediately after "Restarting containers..." (transient 502s while Supabase services come back up, observed on the storage API route). Treat this as a local-dev tooling flake; validate readiness with `supabase status` and a health check like `curl http://127.0.0.1:54321/storage/v1/status` (expect HTTP 200) before proceeding.
  Evidence:
    supabase db reset --yes
    ...
    Restarting containers...
    Error status 502: An invalid response was received from the upstream server

- Observation: PKCE magic-link verification requires a code-verifier cookie from the browser session that initiated sign-in. Pure `curl`-only verification attempts (without that cookie) cannot prove the end-to-end session cookie behavior; manual browser validation remains required for Milestone 0 acceptance.
  Evidence:
    The Supabase verify endpoint redirects to `/auth/callback?code=...` for PKCE tokens, but without the browser's verifier cookie, the server-side callback exchange cannot be validated using a stateless HTTP client alone.

- Observation: `tsc` incremental compilation can surface a false "BigInt literals are not available when targeting lower than ES2020" error if a stale `tsconfig.tsbuildinfo` exists from an earlier `target`. Disabling incremental in `web/tsconfig.json` made `npm run typecheck` reliable again.
  Evidence:
    Before: `npm run typecheck` reported `TS2737` in `src/lib/domain/uncertainty/rng.ts` and `src/lib/domain/uncertainty/uncertainty.test.ts` even though `tsc --showConfig` showed `target: es2020`.
    After: with `"incremental": false`, `npm run typecheck` succeeds.

- Observation: Monte Carlo determinism depends on the `model_snapshot` being canonical (stable JSON). Unordered DB results (for example, modifier-spec rows) can change incidental array ordering (like missing-codes), which would perturb the hashed `mc_seed` even if the underlying model is unchanged.
  Evidence:
    `listFormulationModifierSpecs` and `listComponentModifierSpecs` do not specify ordering. The event action now de-dupes and sorts `model_snapshot.compartments[].missing` before hashing in `web/src/app/(app)/today/actions.ts`.

- Observation: Soft-delete-aware enrichment can yield partial rows (for example, `substance: null` in `listFormulationsEnriched`), which can cause UI inference (like "is CNS relevant?") to produce false-positive warnings when the target compartment is unknown.
  Evidence:
    `/today` model coverage now defaults unknown target-compartment relevance to systemic-only in `web/src/app/(app)/today/page.tsx`, reducing false CNS gap alerts for orphaned reference rows.

- Observation: `public.profiles` has a foreign key to `auth.users`, which makes it hard to create synthetic profile rows in an RLS probe that uses simulated JWT subjects (UUIDs not present in `auth.users`). Views that inner-join `profiles` would silently return 0 rows in that probe even when events exist.
  Evidence:
    `supabase/scripts/rls_probe.sql` uses simulated `request.jwt.claim.sub` values.
    After updating the views to left-join `profiles` and fall back to `'UTC'`, the probe shows non-zero counts for `public.v_daily_totals_admin` and `public.v_spend_daily_weekly_monthly` for user A.

## Decision Log

- Decision: The MVP uses Next.js App Router + TypeScript and uses Server Actions for mutations; heavy compute (Monte Carlo) runs on the server by default.
  Rationale: Minimizes custom backend surface while keeping data writes co-located with UI and avoiding compute in the browser.
  Date/Author: 2026-02-07 / Codex

- Decision: Use Supabase Postgres + Auth + RLS, and use `@supabase/ssr` (not the deprecated Auth Helpers).
  Rationale: RLS provides the privacy boundary at the database layer; `@supabase/ssr` is the maintained path for Next.js server-side auth/session integration.
  Date/Author: 2026-02-07 / Codex

- Decision: Use PKCE flow for Supabase email magic-link auth, and handle the callback at `/auth/callback` by exchanging `?code=...` for a session and persisting it in cookies.
  Rationale: The implicit "access_token in URL hash" flow is not visible to server-side code; PKCE is compatible with SSR and with `@supabase/ssr` cookie-based session storage.
  Date/Author: 2026-02-07 / Codex

- Decision: Avoid using the Supabase service role key in the normal request path; all user flows should run under the authenticated user's session with RLS enforced by the database.
  Rationale: The service role key bypasses RLS and is a common way to accidentally break the security model; keeping RLS in force by default matches the plan's security requirements.
  Date/Author: 2026-02-07 / Codex

- Decision: SQL migrations are the schema source of truth; Prisma is not used in the MVP.
  Rationale: Keeps schema and constraints explicit (including RLS policies, views, and indexes) and avoids adding an ORM layer until it provides clear leverage.
  Date/Author: 2026-02-07 / Codex

- Decision: The schema uses a "fraction vs multiplier" bioavailability model: base bioavailability is a fraction in [0,1], modifiers are multipliers >= 0, and the composed fraction is clamped to [0,1].
  Rationale: Prevents impossible values (> 1) and is Monte Carlo-friendly while staying simple.
  Date/Author: 2026-02-07 / Codex

- Decision: The event table stores only `formulation_id` as the source-of-truth link to substance + route, rather than duplicating `substance_id` and `route_id` in events.
  Rationale: Avoids drift between duplicated columns; joins or views provide denormalized access cheaply.
  Date/Author: 2026-02-07 / Codex

- Decision: Keep `substance_id` alongside `formulation_id` on `order_items` and `vials` as in the source plan, but enforce consistency with triggers when `formulation_id` is present.
  Rationale: Preserves the plan's schema while preventing silent drift from redundant columns (the same class of bug the plan explicitly avoids for events).
  Date/Author: 2026-02-07 / Codex

- Decision: Define an explicit distribution parameterization contract and enforce probability-safety constraints (fractions in [0,1], multipliers >= 0, calibration volumes > 0), with `beta_pert` using lambda = 4 and `lognormal` parameterized as (median, log_sigma).
  Rationale: Without a precise contract, Monte Carlo sampling is error-prone and different implementations will silently disagree; constraints prevent the "fraction > 1" footgun the plan explicitly calls out.
  Date/Author: 2026-02-07 / Codex

- Decision: Deterministic recomputation is anchored on `model_snapshot` + `mc_seed`, where `mc_seed` is a hash of `(user_id, event_id, canonical_model_snapshot)`.
  Rationale: This prevents silent drift if distributions are edited and makes "recompute" an explicit, auditable action.
  Date/Author: 2026-02-07 / Codex

- Decision: Cost attribution uses administered dose (not effective dose) and prefers a mass-based fraction when mg is known; otherwise it falls back to a volume-based fraction when mL is known.
  Rationale: This supports IU-only workflows (where mg is intentionally unknown) while keeping cost attribution deterministic and explainable.
  Date/Author: 2026-02-07 / Codex

- Decision: In this workspace, prefer the real Node.js binary (for example via nvm) over Bun's `node` wrapper, and ensure `node` and `npm` commands use that real Node when running Next.js tooling.
  Rationale: The Bun `node` wrapper fails for `node --version`/REPL and may not match Node semantics that Next.js tooling assumes; using a real Node avoids non-obvious tool failures.
  Date/Author: 2026-02-07 / Codex

- Decision: Disable TypeScript incremental compilation in `web/tsconfig.json`.
  Rationale: In this environment, a stale `tsconfig.tsbuildinfo` caused `tsc` to incorrectly behave as if `target < ES2020` (surfacing `TS2737` on BigInt literals) even when `tsc --showConfig` reported `target: es2020`. Disabling incremental makes `npm run typecheck` deterministic; if incremental is re-enabled later, ensure the buildinfo is cleared or moved.
  Date/Author: 2026-02-07 / Codex

- Decision: Initialize git in `/data/projects/peptaide` if missing so "commit frequently" is actually possible while implementing this ExecPlan.
  Rationale: `AGENTS.md` requires frequent commits; without a git worktree the instruction is not executable.
  Date/Author: 2026-02-07 / Codex

- Decision: For MVP, treat distributions as independent per-event draws in Monte Carlo simulations, and do not attempt to model cross-event correlation of uncertainties.
  Rationale: This keeps the Monte Carlo engine simple and predictable. If later we interpret some distributions as "unknown fixed parameters" (epistemic uncertainty), upgrade aggregation to use correlated sampling by reusing per-distribution draws within a simulation iteration for all events that share that distribution.
  Date/Author: 2026-02-07 / Codex

- Decision: For MVP, device calibration distributions are used to derive a deterministic point estimate for canonical dose fields (`dose_volume_ml`, and `dose_mass_mg` when concentration is known) using the distribution mean, and are not sampled into the effective-dose Monte Carlo percentiles.
  Rationale: The MVP stores administered dose as canonical single values (mg/mL) and uses Monte Carlo percentiles primarily to model bioavailability uncertainty. If calibration uncertainty needs to be reflected in effective-dose percentiles later, incorporate calibration sampling into the simulation and document how that relates to the stored canonical dose fields.
  Date/Author: 2026-02-07 / Codex

- Decision: Daily uncertainty bands computed by summing event percentiles are labeled as an approximate heuristic band, not true daily quantiles; accurate daily quantiles require day-level MC of summed samples.
  Rationale: The summed-percentiles band is easy to compute and explain, but quantiles are not additive in general; overstating these as true quantiles would be misleading. If accurate day-level quantiles are needed, implement day-level MC of summed samples.
  Date/Author: 2026-02-07 / Codex

- Decision: For MVP, the gap-based "New cycle?" suggestion during logging is implemented as a two-step Server Action flow: `createEventAction(...)` returns `confirm_new_cycle` when a gap suggests starting a new cycle and an active cycle exists, and the client prompts via `window.confirm(...)` and resubmits with an explicit `cycle_decision` (`new_cycle` or `continue_cycle`).
  Rationale: Avoids adding a separate preflight request on every save, preserves a default-yes keyboard flow (Enter = OK), and is easy to replace later with a richer non-blocking prompt UI.
  Date/Author: 2026-02-07 / Codex

- Decision: Analytics/inventory SQL views that compute "local day" groupings left-join `profiles` and fall back to `UTC` when a profile row is missing.
  Rationale: The app tries to ensure a `profiles` row exists, but treating it as a hard dependency makes dashboards brittle (and prevents an RLS probe that uses simulated auth IDs from exercising those views). Falling back to UTC keeps the views useful and predictable in edge cases.
  Date/Author: 2026-02-07 / Codex

- Decision: For MVP, generating vials from an order item requires `order_items.formulation_id` to be set; otherwise the UI refuses to generate vials.
  Rationale: `vials.formulation_id` is required for inventory/runway and for linking event cost attribution to inventory. Allowing vials without a formulation would create inconsistent downstream behavior.
  Date/Author: 2026-02-07 / Codex

- Decision: For MVP, order-item vial generation creates vials in `planned` status, links them via `vials.order_item_id`, and defaults `vials.cost_usd` only when both `order_items.price_total_usd` and a positive `order_items.expected_vials` are present (cost per vial = price_total_usd / expected_vials). Shipping is tracked on the order but not auto-allocated.
  Rationale: Keeps the initial cost model simple and auditable while still enabling spend attribution once vials are activated and used. Shipping allocation is a product decision that should be made explicitly, not implied.
  Date/Author: 2026-02-07 / Codex

- Decision: `/settings` constrains `profiles.default_mass_unit` choices to true mass units (mg, mcg, g) and keeps IU out of mass defaults.
  Rationale: IU is not a mass unit and IU->mg conversion is substance-specific; treating IU as mass would violate unit correctness and create incorrect analytics.
  Date/Author: 2026-02-07 / Codex

- Decision: Data export format (v1) is a ZIP of per-table CSV files generated under the signed-in user session, using a stable column order derived from `web/src/lib/supabase/database.types.ts` (auto-generated mapping) and zipped in-memory via `jszip`.
  Rationale: CSV is easy to inspect and use in spreadsheets; a ZIP bundle keeps multi-table exports portable; deriving column order from generated DB types avoids manual drift; running under the user session keeps the RLS boundary intact.
  Date/Author: 2026-02-07 / Codex

- Decision: Data import format (v1) consumes the same ZIP-of-CSV bundle as `/api/export` and is replace-oriented: apply mode either requires an empty dataset or explicitly deletes all user data first; the import rebinds `user_id` to the current signed-in user and preserves UUID ids to keep foreign keys intact. The v1 importer requires exact header matches to the current generated export column order and does not implement merge/dedupe yet.
  Rationale: Replace-mode is the safest default for an MVP: it avoids ambiguous merge semantics, keeps imports deterministic, and ensures referential integrity without building a full id-mapping/dedupe engine up front. Exact header matching prevents silent schema drift; compatibility logic can be added once we have real exports from multiple schema versions.
  Date/Author: 2026-02-07 / Codex

## Outcomes & Retrospective

2026-02-07: Milestone 0 (Repo Bootstrap + Auth Skeleton) is implemented for local development. Milestone 1 (DB schema + RLS + type generation) is implemented locally, including the analytics/coverage views. Milestone 2 (Pure Domain Logic) is implemented for units/uncertainty/dose/cost, with cycles logic partially implemented (gap-based suggestion + auto-start decision helper, but not DB orchestration yet). A `/today` prototyping surface exists to exercise the end-to-end event pipeline (not the final virtualized grid yet).

What exists now:

1. A Next.js 16 app in `web/` with working `npm run build`, `npm run lint`, `npm run test` (Vitest), and `npm run typecheck`.
2. Local Supabase is initialized (`supabase/config.toml`) and can be started via `supabase start`. For local email sign-in, Mailpit runs at `http://127.0.0.1:54324`.
3. Supabase SSR auth skeleton is in place: `web/middleware.ts` performs session refresh, `/sign-in` sends OTP/magic-link email, `/auth/callback` exchanges the code for a session, `/today` is protected by the `(app)` layout, and a server-action sign-out exists.
4. The MVP schema is migrated locally under `supabase/migrations/` through reference data, inventory, cycles, recommendations, uncertainty distributions/specs, administration events (plus `event_revisions` audit), and the dashboard/coverage SQL views. All user-owned tables have RLS enabled with own-row policies. DB types are generated at `web/src/lib/supabase/database.types.ts`.
5. Pure domain logic modules exist under `web/src/lib/domain/` with unit tests: `units/`, `uncertainty/`, `dose/`, and `cost/` are implemented; `cycles/` currently only includes gap-based suggestions and the "auto-start first cycle" decision helper.
6. A `/today` prototype exists that can seed demo reference data, log events via Server Actions, and render recent events from `public.v_event_enriched`. It exercises parsing, canonical dose computation, MC percentiles (when BA specs exist), and `model_snapshot` persistence.
7. Setup/scaffolding CRUD pages exist for reference data and model inputs: `/substances` (+ detail BA spec editor), `/routes`, `/devices` (+ calibrations), `/formulations` (+ components), `/distributions`, plus `/cycles` (summary) and `/inventory`.
8. Orders/inventory scaffolding exists: `/orders` can create vendors/orders/order items and generate planned vials; `/inventory` can create vials and supports vial lifecycle actions (activate, close, discard).
9. Minimal read-only dashboards exist: `/analytics` (daily totals + spend rollups) and `/settings` (profile defaults editor + CSV export/import bundle tools + a danger-zone delete-my-data action).

What remains (next highest-leverage work):

1. Manually validate the sign-in flow end-to-end in a browser (send link, open Mailpit, click link, confirm `/today`, sign out). Note: in this workspace, `next dev` bound to port 3001 because port 3000 was already in use.
2. Security verification pass: expand the RLS probe/checklist to cover every user-owned table and every view surfaced by the UI (a solid probe exists already, but coverage is not complete yet).
3. Implement thin, typed data-access modules (repos) for all tables and views, and route all app data access through them (Milestone 3+ foundation).
4. Finish cycles logic beyond "suggestion" (auto-start/assignment orchestration and split-at-event correction mechanics).
5. Start the core UI flows: Setup Wizard (bulk add + model specs) and Today Log end-to-end.

## Context and Orientation

Repository state today:

1. The repo is a git worktree and contains the core docs: `AGENTS.md`, the source design doc `plan.md` (Feb 2026), this living spec `ExecPlan.md`, and the ExecPlan format authority `.agent/PLANSwHD.md`.
2. A Next.js 16 App Router app exists in `web/` (TypeScript, Tailwind, ESLint) with `npm run build`, `npm run lint`, `npm run test` (Vitest), and `npm run typecheck` (tsc --noEmit).
3. Supabase local dev is initialized under `supabase/` (`supabase/config.toml`). Local Supabase can be started with `supabase start` and inspected with `supabase status`.
4. Auth skeleton is implemented in the web app (middleware session refresh, `/sign-in`, `/auth/callback`, protected `/today`) using `@supabase/ssr`. The MVP schema is migrated locally under `supabase/migrations/` through `administration_events` and the dashboard/coverage views, and TypeScript DB types are generated at `web/src/lib/supabase/database.types.ts`.
5. Pure domain logic modules exist under `web/src/lib/domain/` with unit tests (Milestone 2): units/uncertainty/dose/cost are implemented; cycles is partially implemented (gap-based suggestion and the auto-start-first-cycle decision helper only so far). These modules are designed to be imported by server actions and UI without embedding business logic in React components.

Core concepts and definitions (plain language):

1. Substance: the chemical or medication being tracked (for example, "Semax").
2. Route: how a substance is administered (for example, subcutaneous or intranasal). Routes also define the default kind/unit of user input.
3. Device: a physical delivery mechanism (for example, syringe or nasal spray). Device units (sprays/clicks) may need calibration.
4. Device calibration: a model that converts a device unit count (for example, "2 sprays") into a volume in mL. Calibrations are uncertain, so they are stored as a distribution.
5. Formulation: a user-defined variant of a substance + route, optionally tied to a device and components (enhancers/buffers). Users pick a formulation when logging.
6. Vial: an inventory container for a formulation with known or estimated content (mass, optionally volume), optional concentration, and cost. Exactly one vial may be "active" per formulation.
7. Administration event: a single log entry at a timestamp, linked to a formulation (and optionally a vial and cycle), preserving the raw user input text and storing computed canonical dose and effective-dose percentiles.
8. Cycle: a per-substance grouping of events into contiguous usage periods. Breaks are computed deterministically as gaps between cycles.
9. Recommendations: user-entered reference ranges (dose, cycle length, break length, frequency) stored for comparison only; never presented as advice.
10. Distribution: a stored uncertainty model (point/uniform/triangular/lognormal/beta-pert) used for bioavailability fractions, modifier multipliers, and device calibrations.
11. Bioavailability: the fraction of an administered dose that reaches a target compartment (systemic and/or CNS). In this plan, base bioavailability is a fraction in [0,1].
12. Modifier: a multiplier (>= 0) that adjusts base bioavailability, for example from formulation components.
13. Monte Carlo simulation: repeatedly sampling the distributions (base fraction and multipliers) to produce a distribution over effective dose, then summarizing it via percentiles.
14. Percentiles (p05/p50/p95): summary statistics of a distribution. p50 is the median; p05 and p95 provide a 90% interval.
15. RLS (Row Level Security): Postgres policies that restrict which rows a user can read/write, enforced by the database itself.

The remainder of this section embeds all requirements and design details from `plan.md` (plan[1-777]) in a way that is directly actionable for implementation.

### 0) Design goals (non-negotiable)

Fast logging: the primary UX must support logging 5-10+ items/day without friction. Desktop should be keyboard-first; mobile should be tap-light.

Extensible by construction: new routes, devices, analytics, and model types must be addable without schema pain.

Uncertainty-native from day 1: Monte Carlo percentiles are first-class outputs, stored and displayed, not a later rewrite.

Data portability: export/import must exist and cover all tables.

Correctness over cleverness: canonical units and deterministic recomputation matter more than clever optimizations. Semantics for "fraction vs multiplier" must be clear and enforced.

### 1) Recommended stack (2026-current, minimal backend code)

Core stack:

1. Next.js 16.x with the App Router and TypeScript.
2. Use Server Actions for mutations. In plain language: data writes happen in server-side functions called from UI, rather than building a separate backend service.
3. Keep heavy compute (Monte Carlo) on the server by default.
4. Supabase provides managed Postgres, authentication, and RLS. RLS is the privacy boundary: only the owning user can see their data.
5. Use `@supabase/ssr` for auth/session integration in Next.js. Auth Helpers are deprecated / maintenance mode and should not be used.

UI and interaction (because fast entry is a requirement, not a nice-to-have):

1. Tailwind CSS plus shadcn/ui-style components (component source lives in the repo).
2. TanStack Table plus TanStack Virtual for spreadsheet-like grids and virtualization.
3. cmdk for a command palette to quickly select/create formulations and navigate.
4. Charts: Recharts is acceptable for v1; a future upgrade may move to ECharts if richer time-series interactions and uncertainty bands become limiting.

Data access and migrations:

SQL migrations are the schema source of truth (using Supabase migration conventions). An ORM is optional; Prisma 7.x can be used later if it meaningfully improves speed, but MVP should not require it.

Secondary option (not default): PocketBase + SQLite is operationally small, but gives up Postgres constraints and analytics power, and would require re-implementing many capabilities.

### 2) "Complete" MVP definition (updated)

"Complete" means all of the following exist and are usable:

1. The system models substances, routes, formulations, devices, vials, and orders.
2. Logging supports multiple administrations quickly via a multi-row Today Log.
3. The system computes administered dose (canonical mg and/or mL when possible; IU remains IU in MVP) and effective dose distributions (systemic and CNS) with Monte Carlo percentiles.
4. Cycle tracking is automatic with a gap-based new-cycle suggestion, and breaks are tracked (computed deterministically).
5. Manual recommendations (dose range, cycle length, break length) can be stored and actuals can be compared vs those ranges.
6. Analytics exist for normalized totals plus spend burn-rate (USD/day/week/month) and inventory runway.
7. Bulk creation flows exist (setup wizard; orders -> vials generation) plus import/export.
8. RLS is enabled and correct everywhere.

Non-goals: protocol optimization, any "AI decides your dose" behavior, diagnosis, and adherence nudging beyond explicit reminders/alerts you configure.

### 3) Core conceptual corrections (fresh-eyes sanity pass)

#### 3.1 Bioavailability semantics: base fraction vs modifier multipliers

Bioavailability must not be an ambiguous "fraction or multiplier" field. It is split into:

1. Base bioavailability (BA_base): a fraction in [0,1] that represents what fraction of administered mass reaches a compartment.
2. Modifiers (M_i): multipliers >= 0 from formulation-level and component-level modifier specs (and later, possibly device-level modifiers).

Composition rule:

BA_total = clamp( BA_base * product(M_i), 0, 1 )

dose_eff_mg = dose_admin_mg * BA_total

This rule prevents impossible results (> 1 as a fraction), stays physically consistent, and is Monte Carlo-friendly.

#### 3.2 Mutable event log with audit, not true immutability

The system must allow corrections without losing history. MVP uses soft deletes and optional revision records:

1. `administration_events.deleted_at` implements soft delete.
2. `administration_events.updated_at` records updates.
3. Optionally, `event_revisions` stores old values on update (only when changes occur), so edits can be audited.

#### 3.3 Avoid redundant truth in events

Do not store both `formulation_id` and also `substance_id`/`route_id` in `administration_events`. That redundancy can drift. Events store `formulation_id` as the truth and derive substance and route via joins/views.

### 4) Data model (MVP schema, designed for easy growth)

#### 4.1 Conventions for all user-owned tables

Unless explicitly noted, user-owned tables follow these conventions:

1. `id uuid primary key default gen_random_uuid()`
2. `user_id uuid not null` (used by RLS policies)
3. `created_at timestamptz default now()`
4. `updated_at timestamptz default now()`
5. `deleted_at timestamptz null` for soft delete (where appropriate)
6. Unique constraints include `user_id` so multi-user hosting is safe.

The table definitions below list only the business-specific columns. Unless a table explicitly says otherwise (for example `profiles` using `user_id` as its primary key), assume the conventional columns above are also present and enforced.

#### 4.2 Identity

`profiles`:

1. `user_id` (primary key; foreign key to `auth.users`)
2. `timezone` (IANA string)
3. `default_mass_unit` (text, e.g. mg, mcg; IU is handled separately as `input_kind = iu` and is not a mass unit)
4. `default_volume_unit` (text, e.g. mL)
5. `default_simulation_n` (int, default 2048)
6. `cycle_gap_default_days` (int, default 7)

Timezone semantics: store event timestamps as `timestamptz` in the database. Use `profiles.timezone` to determine the user's day boundaries for `/today` and calendar analytics (for example, what counts as "today" for that user), and for displaying times in the UI.

#### 4.3 Reference data

`substances`:

1. `canonical_name` (text; normalized key; unique per user)
2. `display_name` (text)
3. `family` (text; peptide, small_molecule, biologic, etc.)
4. `target_compartment_default` (enum-like; systemic, cns, both)
5. `notes` (text)

`substance_aliases` (for search/typing speed):

1. `substance_id` (foreign key)
2. `alias` (text)

`routes`:

1. `name` (text; subcutaneous, intranasal, oral, etc.)
2. `default_input_kind` (enum-like; mass, volume, device_units, IU)
3. `default_input_unit` (text; mg, mL, spray, actuation, IU, etc.)
4. `supports_device_calibration` (bool)
5. `notes` (text)

`devices` (route-level abstractions):

1. `name` (text)
2. `device_kind` (enum-like; syringe, spray, dropper, pen, other)
3. `default_unit` (text; actuation, spray, click, IU, mL)
4. `notes` (text)

`device_calibrations` (optional but extremely useful):

1. `device_id` (foreign key)
2. `route_id` (foreign key)
3. `unit_label` (text; e.g. "spray", "actuation", "click")
4. `volume_ml_per_unit_dist_id` (foreign key to `distributions`; nullable)
5. `notes` (text)

Uniqueness: enforce at most one calibration row per `(user_id, device_id, route_id, unit_label)` so dose conversion is deterministic.

`formulations`:

1. `substance_id` (foreign key)
2. `route_id` (foreign key)
3. `device_id` (foreign key; nullable)
4. `name` (text; variant label, e.g. "IN + enhancer A")
5. `is_default_for_route` (bool)
6. `notes` (text)

`formulation_components`:

1. `formulation_id` (foreign key)
2. `component_name` (text; free-text; can later become a foreign key)
3. `role` (text; enhancer/buffer/preservative)
4. `modifier_dist_id` (foreign key to `distributions`; multiplier; nullable)
5. `notes` (text)

Note: The model supports per-compartment component multipliers via `component_modifier_specs` (section 4.8). To avoid double-counting, use this explicit MVP rule: for a given formulation component and compartment, if a `component_modifier_specs` row exists for that component with `compartment = <that compartment>` or `compartment = both`, use those distribution(s); otherwise, if `formulation_components.modifier_dist_id` is set, treat it as a fallback multiplier that applies to both systemic and CNS.

#### 4.4 Orders -> order items -> vials (inventory + cost)

`vendors`:

1. `name` (text)
2. `notes` (text)

`orders`:

1. `vendor_id` (foreign key)
2. `ordered_at` (timestamptz)
3. `shipping_cost_usd` (numeric)
4. `total_cost_usd` (numeric)
5. `tracking_code` (text; nullable)
6. `notes` (text)

`order_items`:

1. `order_id` (foreign key)
2. `substance_id` (foreign key)
3. `formulation_id` (foreign key; nullable; link if known at purchase time)
4. `qty` (int; how many units purchased)
5. `unit_label` (text; "vial", "kit", etc.)
6. `price_total_usd` (numeric; total for the line item; less ambiguous than a per-unit price)
7. `expected_vials` (int; nullable; used by "generate vials" UX)
8. `notes` (text)

Cost allocation policy (make this explicit so analytics are interpretable): in MVP, treat `order_items.price_total_usd` as the primary cost basis for vials created from that item (simple default `cost_per_vial = price_total_usd / expected_vials`). `orders.shipping_cost_usd` is tracked but does not have to be automatically allocated in MVP; if you do allocate it, use a clearly documented policy (for example, proportional to `order_items.price_total_usd`) and record the choice in `Decision Log`.

Consistency constraints to prevent silent drift: because `order_items` stores both `substance_id` and (optionally) `formulation_id`, enforce that when `formulation_id` is non-null it matches the formulation's substance. Similarly, because `vials` stores both `substance_id` and `formulation_id`, enforce `vials.substance_id = formulations.substance_id` on insert/update (this requires a trigger in Postgres, since a check constraint cannot reference another table).

`vials`:

1. `substance_id` (foreign key)
2. `formulation_id` (foreign key)
3. `order_item_id` (foreign key; nullable)
4. `lot` (text; nullable)
5. `received_at` (timestamptz; nullable)
6. `opened_at` (timestamptz; nullable)
7. `closed_at` (timestamptz; nullable)
8. `status` (enum-like; planned, active, closed, discarded)

Contents & concentration:

9. `content_mass_value` (numeric)
10. `content_mass_unit` (text; mg/mcg/IU/etc)
11. `total_volume_value` (numeric; nullable)
12. `total_volume_unit` (text; nullable; mL etc)
13. `concentration_mg_per_ml` (numeric; nullable; stored for speed, computed if mass+volume known)

Calibration overrides (per-vial if needed):

14. `volume_ml_per_unit_override_dist_id` (foreign key to `distributions`; nullable; per-vial calibration override)

Cost:

15. `cost_usd` (numeric; nullable; computed default from order-item allocation but overrideable)
16. `notes` (text)

Unit correctness note: only compute `concentration_mg_per_ml` when `content_mass_unit` is convertible to mg (for example mg/mcg/g). If `content_mass_unit` is IU, do not invent an IU->mg conversion; leave `concentration_mg_per_ml` null in MVP.

Hard constraint (DB): only one active vial per formulation per user.

Implement via a partial unique index on `(user_id, formulation_id)` where `status = 'active'` and `deleted_at is null`.

#### 4.5 Canonical event log (fast entry + recomputation)

`administration_events`:

1. `ts` (timestamptz; source-of-truth timestamp)
2. `formulation_id` (foreign key; required; quick-add can create a formulation inline)
3. `vial_id` (foreign key; nullable; resolved to active vial by default)
4. `cycle_instance_id` (foreign key; nullable; normally auto-set)

User input (preserved):

5. `input_text` (text; raw user input, e.g. "0.3mL", "2 sprays", "250mcg")
6. `input_value` (numeric; nullable)
7. `input_unit` (text; nullable)
8. `input_kind` (enum-like; mass, volume, device_units, IU, other)

Canonical computed:

9. `dose_volume_ml` (numeric; nullable)
10. `dose_mass_mg` (numeric; nullable)

Monte Carlo outputs (persisted summaries; recomputable):

11. `eff_systemic_p05_mg` (numeric; nullable)
12. `eff_systemic_p50_mg` (numeric; nullable)
13. `eff_systemic_p95_mg` (numeric; nullable)
14. `eff_cns_p05_mg` (numeric; nullable)
15. `eff_cns_p50_mg` (numeric; nullable)
16. `eff_cns_p95_mg` (numeric; nullable)
17. `mc_n` (int; nullable)
18. `mc_seed` (bigint; nullable; deterministic recomputation)
19. `model_snapshot` (jsonb; nullable; distribution IDs + resolved params at log time)

Cost attribution (optional but powerful):

20. `cost_usd` (numeric; nullable; derived from vial cost x fraction used, where fraction is computed from mass when mg is available and otherwise from volume when mL is available)
21. `tags` (text[])
22. `notes` (text)
23. `deleted_at` (timestamptz; nullable)

Why store percentiles: dashboards are fast, and recomputation remains possible via `model_snapshot` + `mc_seed`.

`model_snapshot` must be structured, not an untyped blob, so future contributors can recompute without reverse-engineering. Minimum required shape (illustrative; keep stable keys):

1. `model_snapshot.schema_version`: integer starting at 1.
2. `model_snapshot.systemic` and `model_snapshot.cns`: each contains `base_fraction` (distribution id + parameters) and `multipliers` (array of distribution id + parameters) that were sampled for that compartment.
3. `model_snapshot.calibration`: null if the event dose was entered as mass or volume; otherwise contains the calibration distribution (id + parameters) used to convert device units to mL, and a `source` string such as `vial_override` or `device_calibration`.
4. `model_snapshot.notes`: optional short text for human debugging (for example, which fallbacks were applied when coverage was missing).

When persisting `model_snapshot`, canonicalize it for hashing (stable key ordering and stable numeric formatting) so `mc_seed` remains stable across runtimes.

Optional audit table for edits (if you implement `event_revisions` in MVP): store one row per update/delete of an administration event with `event_id`, `revised_at`, `old_values` (jsonb), `new_values` (jsonb), and an optional `reason` text. Implement with a Postgres trigger on `administration_events` updates so the audit is automatic and cannot be bypassed by application bugs.

#### 4.6 Cycles + breaks (automated, with manual override)

`cycle_rules` (per substance; user-editable; defaults from profile):

1. `substance_id` (foreign key)
2. `gap_days_to_suggest_new_cycle` (int; default 7)
3. `auto_start_first_cycle` (bool; default true)
4. `notes` (text)

Uniqueness: enforce at most one cycle rule row per `(user_id, substance_id)` so the gap threshold is unambiguous.

`cycle_instances`:

1. `substance_id` (foreign key; derived from formulation at create time for convenience)
2. `cycle_number` (int)
3. `start_ts` (timestamptz)
4. `end_ts` (timestamptz; nullable)
5. `status` (enum-like; active, completed, abandoned)
6. `goal` (text; nullable)
7. `notes` (text)

Breaks are computed deterministically as the interval between `end_ts` of cycle N and `start_ts` of cycle N+1. If explicit "on break now" tracking is needed later, add a `break_instances` table, but MVP can compute breaks.

#### 4.7 Recommendations (manual now; AI later)

These tables exist so an LLM agent can fill them later, but MVP works with manual entry.

`substance_recommendations`:

1. `substance_id` (foreign key)
2. `category` (enum-like; cycle_length_days, break_length_days, dosing, frequency)
3. `route_id` (foreign key; nullable; for route-specific recommendations)
4. `min_value` (numeric; nullable)
5. `max_value` (numeric; nullable)
6. `unit` (text; days, mg, mcg, IU, times_per_week, etc.)
7. `notes` (text)
8. `evidence_source_id` (foreign key; nullable)

`evidence_sources`:

1. `source_type` (enum-like; paper, label, clinical_guideline, vendor, anecdote, personal_note)
2. `citation` (text; DOI/PMID/ISBN/URL/free-text)
3. `notes` (text)

#### 4.8 Uncertainty engine primitives (shared by bioavailability + calibration)

Instead of hardcoding p1/p2/p3 everywhere, model uncertainty explicitly.

`distributions`:

1. `name` (text)
2. `value_type` (enum-like; fraction, multiplier, volume_ml_per_unit, other)
3. `dist_type` (enum-like; point, uniform, triangular, lognormal, beta_pert)
4. `p1` (numeric; nullable)
5. `p2` (numeric; nullable)
6. `p3` (numeric; nullable)
7. `min_value` (numeric; nullable)
8. `max_value` (numeric; nullable)
9. `units` (text; for display)
10. `quality_score` (int; 0-5)
11. `evidence_summary` (text)
12. `created_at` (timestamptz)
13. `updated_at` (timestamptz)

Distribution parameterization (how to interpret the columns) must be explicit so sampling is correct and reproducible. Use the following rules consistently in both code and validation:

1. `dist_type = 'point'`: the distribution is deterministic. Use `p1` as the point value. (`min_value`, `max_value`, `p2`, `p3` must be null.)
2. `dist_type = 'uniform'`: sample uniformly on `[min_value, max_value]`. (`min_value` and `max_value` are required; `p1`, `p2`, `p3` must be null.)
3. `dist_type = 'triangular'`: the distribution is defined by `(min, mode, max)`. Use `p1 = min`, `p2 = mode`, `p3 = max`. Sample with the standard triangular inverse-CDF. (`min_value`/`max_value` should be null to avoid two sources of truth.)
4. `dist_type = 'beta_pert'`: the distribution is a beta-PERT on `[min,max]` with a chosen most-likely value. Use `p1 = min`, `p2 = mode`, `p3 = max`, and use the common fixed "lambda" (shape) of 4. Sampling definition: compute `alpha = 1 + 4 * (mode - min) / (max - min)` and `beta = 1 + 4 * (max - mode) / (max - min)`, sample `u ~ Beta(alpha,beta)`, and return `min + u * (max - min)`.

Implementation note for `Beta(alpha,beta)` sampling: for beta-PERT with lambda = 4 and `min <= mode <= max`, both `alpha` and `beta` are >= 1, so you can sample using two gamma variates with a shape >= 1 and avoid the tricky "shape < 1" branch. Sample `x ~ Gamma(alpha, 1)` and `y ~ Gamma(beta, 1)` and return `u = x / (x + y)`. A standard choice for `Gamma(k, 1)` with `k >= 1` is the Marsaglia-Tsang method: let `d = k - 1/3` and `c = 1 / sqrt(9d)`, then loop sampling `z ~ Normal(0,1)`, `v = (1 + c*z)^3`, `u ~ Uniform(0,1)` (clamp away from 0 before taking logs) until `v > 0` and `ln(u) < 0.5*z^2 + d - d*v + d*ln(v)`, then return `d * v`.
5. `dist_type = 'lognormal'`: the distribution is log-normal (always positive). Use `p1 = median` and `p2 = log_sigma` where `log_sigma` is the standard deviation of `ln(X)`. Sampling definition: sample `z ~ Normal(0,1)` (Box-Muller: for `u1,u2 ~ Uniform(0,1)`, `z = sqrt(-2 * ln(u1)) * cos(2*pi*u2)`; ensure `u1 > 0` by clamping `u1 = max(u1, 1e-12)`) and return `exp(ln(median) + log_sigma * z)`. If `min_value`/`max_value` are provided, clamp the sample into `[min_value, max_value]` to avoid extreme outliers (and record in `Surprises & Discoveries` if clamping happens frequently in realistic data).

Some parts of the system need a deterministic point estimate derived from a distribution (for example, converting device units into a single stored `dose_volume_ml`). Use the distribution mean (expected value) as the default point estimate so behavior is deterministic and consistent:

1. point: mean = `p1`
2. uniform: mean = `(min_value + max_value) / 2`
3. triangular: mean = `(p1 + p2 + p3) / 3`
4. beta_pert (lambda = 4): mean = `(p1 + 4 * p2 + p3) / 6`
5. lognormal: mean = `median * exp(0.5 * log_sigma^2)` where `median = p1` and `log_sigma = p2`

Validation and probability-safety constraints (DB check constraints where feasible; otherwise enforce in application code) must prevent the common probability-theory footguns:

1. For `value_type = 'fraction'`: require values to stay in `[0,1]`. Concretely: point `p1` in `[0,1]`; uniform `min_value >= 0` and `max_value <= 1`; triangular/beta_pert `p1 >= 0`, `p3 <= 1`, and `p1 <= p2 <= p3`.
2. For `value_type = 'multiplier'`: require values to be non-negative. Concretely: point `p1 >= 0`; uniform `min_value >= 0`; triangular/beta_pert `p1 >= 0` and `p1 <= p2 <= p3`; lognormal `p1 > 0` and `p2 >= 0`.
3. For `value_type = 'volume_ml_per_unit'`: require values to be non-negative and realistically positive for active calibrations (treat 0 as invalid in UI for real calibrations). Concretely: point `p1 > 0`; uniform `min_value > 0`; triangular/beta_pert `p1 > 0` and `p1 <= p2 <= p3`; lognormal `p1 > 0` and `p2 >= 0`.
4. Always require basic interval sanity: `min_value <= max_value` when both present; and for triangular/beta_pert require `p1 < p3` (strict, to avoid divide-by-zero in sampling).
5. Constrain valid `(value_type, dist_type)` combinations to avoid nonsense: for `value_type = 'fraction'`, disallow `dist_type = 'lognormal'` (it is unbounded above 0 and only stays in [0,1] via clamping, which is usually a modeling mistake).

DB enforcement note: several tables below reference `distributions.id` but require a specific `distributions.value_type` (for example, `bioavailability_specs.base_fraction_dist_id` must reference a `fraction`). Postgres cannot express a cross-table check constraint, so enforce these expectations with `BEFORE INSERT OR UPDATE` triggers on the referencing tables (raise an error if the referenced distribution's `value_type` does not match).

`bioavailability_specs` (selectable base fraction per substance/route/compartment):

1. `substance_id` (foreign key)
2. `route_id` (foreign key)
3. `compartment` (enum-like; systemic, cns)
4. `base_fraction_dist_id` (foreign key to distributions; must reference `value_type = 'fraction'`)
5. `notes` (text)
6. `evidence_source_id` (foreign key; nullable)

Uniqueness: enforce at most one base BA spec per `(user_id, substance_id, route_id, compartment)`.

`formulation_modifier_specs`:

1. `formulation_id` (foreign key)
2. `compartment` (enum-like; systemic, cns, both)
3. `multiplier_dist_id` (foreign key to distributions; must reference `value_type = 'multiplier'`)
4. `notes` (text)

Uniqueness: enforce at most one row per `(user_id, formulation_id, compartment)` (including `compartment = both`) so modifier selection is deterministic.

`component_modifier_specs`:

1. `formulation_component_id` (foreign key)
2. `compartment` (enum-like; systemic, cns, both)
3. `multiplier_dist_id` (foreign key to distributions; `value_type = 'multiplier'`)
4. `notes` (text)

Uniqueness: enforce at most one row per `(user_id, formulation_component_id, compartment)` (including `compartment = both`).

This structure matches how the model is conceptualized: base BA + modifiers, and is easy to extend later (absorption lag, half-life, etc.).

### 5) Monte Carlo simulation (MVP, not "later")

What we simulate for each event and compartment:

1. Sample BA_base from a fraction distribution in [0,1].
2. Sample each modifier multiplier M_i from a multiplier distribution in [0, +infinity).
3. Compose BA_total = clamp(BA_base * product(M_i), 0, 1).
4. Compute dose_eff_mg = dose_admin_mg * BA_total.

For MVP, the per-compartment modifier set M_i is constructed from `formulation_modifier_specs` (rows matching the event's formulation and the target compartment, plus any `compartment = both` rows) and `component_modifier_specs` for that formulation's components (again filtering by compartment with `both` applying to both). If a component has no `component_modifier_specs`, fall back to `formulation_components.modifier_dist_id` as described in the formulation components note.

Outputs stored per event:

1. p05/p50/p95 (systemic and optionally CNS; optionally mean/std later)
2. `mc_seed` and `mc_n`
3. `model_snapshot` recording which distributions were used and the resolved params

Percentile definition (make this deterministic): given `n` simulated samples, sort ascending and take index `i = floor(p * (n - 1))` for percentile `p` (for example p05 uses `p = 0.05`). This "nearest-rank" style indexing is simple, deterministic, and good enough for MVP.

Distribution choices:

1. Fractions in [0,1]: prefer beta-PERT (parameterized by min/mode/max).
2. Multipliers >= 0: prefer lognormal (or triangular if only rough bounds are known).
3. Uniform/range is allowed but should be visually flagged as low-evidence quality.

Determinism:

1. `model_snapshot` is the source of truth for reproducibility: it must record exactly which distribution IDs were used and the resolved numeric parameters that were used. In MVP, BA fractions and multipliers are sampled by Monte Carlo; device calibration distributions (when present) are used to derive a deterministic point estimate for converting device units into a stored canonical dose.
2. `mc_seed` must be derived from stable inputs so recomputation produces identical percentiles: compute `mc_seed = hash(user_id, event_id, canonical_model_snapshot)` where `canonical_model_snapshot` is a canonicalized JSON representation (stable key ordering, stable numeric formatting) of the snapshot. Store the resulting 64-bit value as a Postgres `bigint`.
3. If distribution rows are edited later (parameter changes, evidence changes, etc.), historical recomputation uses the stored `model_snapshot` so results do not silently drift. If the user wants updated results under the new model, provide an explicit "recompute affected events" action that replaces `model_snapshot`, `mc_seed`, and the stored percentiles.

When to run MC:

1. On event save: compute canonical dose. If the administered dose in mg is computable and the needed distributions exist, run MC with `default_simulation_n` (for example 2048) and persist percentiles. If dose mass cannot be computed (missing concentration, missing device calibration, IU-only input) or if model coverage is missing (no base BA or no modifiers where required), still save the event but persist null percentiles for the affected compartment(s) and surface coverage warnings in the UI.
2. On dashboards: aggregate using p50 as the central estimate and p05/p95 for uncertainty bands.
3. MVP day-level aggregation (when avoiding an explicit day-level Monte Carlo) can use a simple heuristic band by summing event percentiles (day_band_low = sum(event_p05), day_central = sum(event_p50), day_band_high = sum(event_p95)). This band is monotone and easy to explain, but it is not a mathematically correct quantile of the daily sum distribution; label it as an approximate uncertainty band in the UI.

If accurate day-level percentiles are needed, implement a day-level Monte Carlo that samples each event's effective dose per iteration and sums the samples (and then takes p05/p50/p95 of the summed samples). If later you interpret some distributions as "unknown fixed parameters" rather than per-event variability, upgrade this day-level MC to use correlated sampling by sampling each such distribution once per iteration and reusing it for all events that reference it.

### 6) Unit input parsing

Rules:

1. Always store raw `input_text`.
2. Parse to `(value, unit)` when possible. If parsing fails, block save with a clear error (do not store a half-baked canonical dose).

Canonicalization targets:

1. Mass -> mg
2. Volume -> mL
3. Device units (spray/actuation/click) -> unit_count, then convert to volume via calibration distribution

IU is intentionally not part of the mg canonicalization path in MVP. If an input parses as IU, store it as `input_kind = IU` and preserve the numeric value, but leave `dose_mass_mg` null unless a future substance-specific IU->mg conversion rule is added.

Supported synonyms (MVP):

1. Volume units: `ml`, `mL`, `cc` (1 cc = 1 mL), and `uL` plus the micro-liter spellings that use a Unicode micro sign / Greek mu (all converted to mL).
2. Mass units: `mg`, `mcg`, `ug`, and the micro-gram spellings that use a Unicode micro sign / Greek mu (all converted to mg), plus `g` (converted to mg).
3. IU: accept `IU` and `[iU]`, store as IU, and do not auto-convert to mg (conversion is substance-specific and out of scope for MVP).
4. Device units: spray, actuation, pump, click (labels should be user-configurable).

Implementation approach:

MVP uses a small parser and lookup table (regex + normalization). A future upgrade may integrate a UCUM parser to canonicalize unit expressions to base units and then map to mg/mL where appropriate.

### 7) User flows (UX is a requirement)

Global interaction primitives:

1. Command palette (Ctrl+K / Cmd+K): log, create substance, create formulation, open today log, jump to analytics.
2. Spreadsheet grids (bulk edit): arrow keys, Enter to advance, Shift+Enter reverse, paste multi-cell, undo.
3. Mobile quick add: bottom sheet, big tap targets, one-hand reachable primary actions.

Flow A: First-time setup (bulk-first)

Entry: first login -> Setup Wizard.

A1 Preferences: timezone, default units, default MC N, default cycle gap days.

A2 Bulk add substances: add single; bulk add in grid (paste CSV/clipboard); add aliases (optional); retire/restore.

A3 Bulk add routes: select seeded defaults (subq, intranasal, oral, IM, IV, buccal, transdermal, etc.); add custom route; set default input kind/unit per route.

A4 Bulk add formulations: grid columns include substance, route, name, device, is_default; support inline creation of missing substances/routes/devices without leaving the grid.

A5 Bulk add vials (or generate from orders): grid entry (formulation, mass, volume, received_at, cost); set active vial per formulation with one keystroke.

A6 Add base BA + modifiers (manual now): enter base BA distribution per substance+route+compartment; enter modifier distributions per formulation/component; link evidence sources (optional but supported).

Definition of done for setup: open Today Log and enter multiple lines rapidly with computed effective-dose percentiles.

Flow B: Logging (primary flow)

Entry: Today Log (default landing after setup).

UI shape: a day-scoped table where each row is one event; minimal columns visible; advanced fields in a drawer.

Row-level requirements:

1. Timestamp defaults to now; the table is day-scoped so the user typically edits time-of-day.
2. Choose formulation via typing/autocomplete and command palette insert.
3. Input dose in `input_text` (examples: 0.3mL, 2 sprays, 250mcg).
4. Press Enter: resolve vial (active vial default), compute canonical dose, run MC and store percentiles, auto-assign cycle (with new-cycle suggestion if needed), then append a blank row focused in the formulation cell.

Post-save quick actions: add another (default), duplicate row (available but not default), open details (tags, notes, vial override, evidence snapshot).

Cycle automation while logging:

On save, find last event for the same substance. If none and `auto_start_first_cycle` is true, create cycle #1 and assign. Otherwise compute gap days; if gap >= rule threshold, prompt "New cycle?" with default yes. If yes, create new cycle and assign; if no, assign to the existing active/most recent cycle.

Multi-substance days:

The table supports 5-10+ rows quickly with minimal modal interruptions. Mobile uses the same concept but as stacked cards.

Flow C: Vials (including generation from orders)

Entry: Inventory.

Actions: create vial (single), bulk create vials (grid), generate vials from an order item (choose item -> generate N vials -> creates planned vials linked to `order_item_id`, with an optional shared-defaults prompt), set active vial (hotkey), close/discard vial (prompt if events still expected).

System behaviors: concentration auto-computed if mass+volume known; cost auto-computed if order item has `price_total_usd` and `expected_vials` (allocation per vial).

Flow D: Cycles + breaks

Entry: Cycles.

Actions: view per-substance timeline (cycles and computed breaks); manually create a cycle (rare; choose substance, the app checks last-event gap and suggests start_ts; on confirm, optionally auto-assign eligible events); end a cycle (set end_ts; show break clock); fix missed new-cycle selection using "Split cycle here" (pick event -> create new cycle starting at that event -> reassign later events).

Comparisons in cycle detail: actual cycle length vs recommended cycle length; actual break length vs recommended break length; total dose vs recommended dose range (by route where possible).

Flow E: Recommendations (manual now, AI later)

Entry: Recommendations (or within Substance detail).

Actions: add cycle length recommendations (min/max days), break length recommendations (min/max days), dosing recommendations by route (min/max + units), frequency recommendations (times/week), attach evidence source links/notes.

UI requirement: it must be obvious these are user-entered reference ranges, not medical advice.

Flow F: Analytics (including spend)

Entry: Dashboard.

Must-have v1 views:

1. Today summary: administered mg by substance; effective systemic/CNS p50 with p05-p95 band; alerts for missing base BA or missing device calibration.
2. Calendar: day rows x substance columns (toggle administered vs effective views).
3. Trends: 7/30/90 day rolling totals (admin and effective p50) with uncertainty ribbons (p05-p95).
4. Cycles and breaks: cycle length distribution across history; days on vs days off.
5. Inventory: remaining mass/volume per active vial (estimated) and runway computed as remaining / recent average daily usage.
6. Spend: USD/day/week/month (from cost attribution); cost per administered mg and per effective mg (p50); per-substance spend share.

Flow G: Import/export

Entry: Settings -> Data.

Actions: export all tables (CSV bundle); import CSV templates with dry-run validation, id mapping, and dedupe by unique keys; clipboard paste import for quick setup (substances/formulations/vials).

Conceptual note (from the source plan): "bulk add" is just import with a nicer UI. Treat grid/paste flows as thin, user-friendly wrappers around the same validation + dedupe logic used by the import pipeline.

### 8) Implementation modules (concrete boundaries, easy to extend)

Domain modules (pure logic; no DB/React):

1. `units/`: `parseQuantity(input_text) -> {kind, value, unit}`, plus conversion helpers to canonical mass mg and volume mL.
2. `dose/`: `resolveVial(formulationId, explicitVialId?)` and `computeDose({input, vial, calibration}) -> {dose_mass_mg, dose_volume_ml}`.
3. `uncertainty/`: `sample(dist, rng)`, `simulateEffectiveDose({dose_mg, dists}, n, seed) -> percentiles`, `composeBioavailability({baseFraction, multipliers}) -> fraction`.
4. `cycles/`: `suggestCycleAction({substanceId, ts, gapDaysRule}) -> {createNew?: boolean}`, and `splitCycleAtEvent(eventId)`.
5. `cost/`: `allocateVialCost({priceTotalUsd, expectedVials}) -> cost_per_vial_usd`, and `eventCostFromVial({doseMassMg?, doseVolumeMl?, vialContentMassMg?, vialTotalVolumeMl?, vialCostUsd}) -> cost_usd?` (use administered dose, not effective dose).

Data access modules (thin wrappers, typed): `substancesRepo`, `routesRepo`, `formulationsRepo`, `vialsRepo`, `eventsRepo`, `cyclesRepo`, `recsRepo`, `distsRepo`.

SQL views to make dashboards cheap:

1. `v_event_enriched` (event join formulation -> substance/route -> vial)
2. `v_daily_totals_admin`
3. `v_daily_totals_effective_systemic` (p05/p50/p95 sums)
4. `v_daily_totals_effective_cns`
5. `v_cycle_summary` (length, totals, adherence to recommendations)
6. `v_spend_daily_weekly_monthly`
7. `v_inventory_status` (used/remaining/runway)
8. `v_model_coverage` (missing BA/calibration/modifiers)
9. `v_order_item_vial_counts` (vials created/active/closed per order item; remaining/used)

### 9) Required pages (routes)

`/today` (default): spreadsheet-like grid for fast event entry; inline cycle prompt; inline missing-model/calibration warnings without blocking save unless dose cannot be computed.

`/substances`: list + bulk add; substance detail includes formulations, base BA specs per route/compartment, recommendations, and analytics links.

`/formulations`: list + bulk add; formulation detail includes components + modifier distributions, and default vial/device settings.

`/inventory`: vials grouped by formulation; generate from order item; remaining/runway plus event timeline per vial.

`/cycles`: per-substance cycles and computed breaks; split/merge tools for corrections.

`/orders`: orders/items/shipping; cost allocation preview; generate vials.

`/analytics`: calendar + trends + uncertainty bands; spend analytics.

`/settings`: profile/units/default MC N/cycle defaults; data import/export; danger zone for deletion (export first, then delete).

### 10) Nonfunctional requirements (treat as features)

Security and privacy:

1. RLS on all user-owned tables.
2. No public read/write.
3. Optional: require re-auth to view/export (UI-level).
4. Consider encrypting especially sensitive free-text notes if multi-user sharing is ever added (not MVP).

Correctness:

1. Canonical units (mg/mL) internally; preserve raw input.
2. IU is never auto-converted to mg without a substance-specific rule (future).
3. MC determinism via stored seed + model snapshot.
4. Clear compartment semantics: systemic vs CNS are separate outputs.

Performance:

1. Index `(user_id, ts desc)` on events.
2. Partial index for active vial uniqueness.
3. Use SQL views or materialized views for daily aggregates when history grows.

### 11) LLM agent research readiness (store now)

To enable a future agent to fetch real-world values, store these today:

1. Substance identity: canonical name plus aliases.
2. Route + device context (BA depends on them).
3. Base BA distributions per substance+route+compartment with evidence links.
4. Modifier distributions per formulation/component and device calibration with evidence links.
5. Recommendations (dose/cycle/break/frequency) with evidence links.
6. Explicit "unknown" coverage status so the UI can highlight gaps.

Rationale: distributions and specs are separate tables so a future agent fills specs while the app consumes them.

### 12) Practical definition of done (MVP)

The MVP is done when:

1. Bulk add works (paste/grid) for substances, formulations, and vials.
2. Today Log allows entering 10 rows in about 1 minute on desktop without fighting the UI.
3. Each saved event has: parsed input stored as text + structured fields; canonical dose mg (when possible); MC percentiles for systemic (and CNS if configured); cycle auto-assigned with gap-based new-cycle suggestion.
4. Cycles page can split a cycle at an event (fix missed new cycle).
5. Recommendations can be entered and compared vs actual cycle/break lengths.
6. Orders -> generate vials works, and order items show vials remaining/used.
7. Analytics shows administered totals, effective p50 with p05-p95 bands, and spend USD/day/week/month.
8. Export/import round-trip succeeds.
9. RLS prevents cross-user access by construction.

### References from the original plan (verbatim; not required to execute this ExecPlan)

The ExecPlan is intended to be self-contained and not require external reading. The source plan included this reference list; it is captured verbatim below so no context is lost, but none of the links are required to implement the MVP described here.

    [Next.js 16]: https://nextjs.org/blog/next-16
    [Next.js upgrade v16]: https://nextjs.org/docs/app/guides/upgrading/version-16
    [Supabase SSR migration]: https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers
    [Supabase Auth Helpers deprecated]: https://github.com/supabase/auth-helpers
    [Prisma ORM 7 announcement]: https://www.prisma.io/blog/announcing-prisma-orm-7-0-0
    [UCUM]: https://ucum.org/ucum
    [ucum.js]: https://github.com/jmandel/ucum.js/

### Plan change notes (from `plan.md`)

The source `plan.md` file in this repo was amended on 2026-02-07 to clarify a few correctness footguns (distribution parameter mapping, avoiding double-counting component modifiers, and micro-unit token variants). Those clarifications are integrated into this ExecPlan above, but the note is repeated here so no plan context is lost:

1. Distribution parameter mapping (MVP):
   - `point`: `p1=value`
   - `uniform`: `min_value`, `max_value`
   - `triangular`: `p1=min`, `p2=mode`, `p3=max`
   - `beta_pert`: `p1=min`, `p2=mode`, `p3=max` (lambda=4)
   - `lognormal`: `p1=median`, `p2=log_sigma` (optionally clamp with `min_value`/`max_value`)

2. Component modifiers: avoid double-counting. If `component_modifier_specs` rows exist for a component (for a given compartment or `both`), use those. Otherwise, `formulation_components.modifier_dist_id` (if set) is a fallback multiplier that applies to both systemic and CNS.

## Plan of Work

This section translates the requirements into a concrete sequence of repository edits. Paths are repository-relative.

Repository layout decision:

1. Place the Next.js app in `web/` to avoid conflicts with root-level docs (`plan.md`, `AGENTS.md`) and to keep room for future tooling.
2. Keep Supabase SQL migrations and config at the repository root under `supabase/`.

Planned code layout (new files and where to put logic):

1. Supabase clients and auth helpers:

   `web/src/lib/supabase/server.ts` (create a server client from request cookies)

   `web/src/lib/supabase/browser.ts` (create a browser client)

   `web/src/lib/supabase/database.types.ts` (generated)

2. Domain logic modules (pure functions):

   `web/src/lib/domain/units/*`

   `web/src/lib/domain/uncertainty/*`

   `web/src/lib/domain/dose/*`

   `web/src/lib/domain/cycles/*`

   `web/src/lib/domain/cost/*`

3. Data access modules:

   `web/src/lib/repos/*` (one repo per table/view; only place SQL queries live)

4. Server Actions:

   `web/src/app/actions/*` (mutations like save event, create substance, bulk import)

5. Pages (App Router routes):

   `web/src/app/(auth)/sign-in/page.tsx` (and any sign-up / magic link flow)

   `web/src/app/(app)/today/page.tsx`

   `web/src/app/(app)/substances/*`

   `web/src/app/(app)/formulations/*`

   `web/src/app/(app)/inventory/*`

   `web/src/app/(app)/orders/*`

   `web/src/app/(app)/cycles/*`

   `web/src/app/(app)/analytics/*`

   `web/src/app/(app)/settings/*`

Schema work plan:

1. Implement enum types (or stable text+check constraints) for the "enum-like" fields described above.
2. Create tables in this order to satisfy foreign keys cleanly: identity, reference data, distributions/specs, orders/vials, cycles, administration events.
3. Add constraints and indexes: unique-by-user keys, active vial partial unique index, and the `(user_id, ts desc)` event index.
4. Enable RLS for all user-owned tables and add explicit policies for select/insert/update/delete that enforce `user_id = auth.uid()`.
5. Add SQL views for analytics.

Monte Carlo implementation plan:

1. Implement distribution sampling for each dist type.
2. Define the parameterization contract for each dist type in code and in a short doc comment.
3. Implement deterministic seeding and RNG.
4. Implement percentiles calculation.
5. Implement model snapshot structure stored in `administration_events.model_snapshot`.

UI implementation plan:

1. Implement the command palette and navigation early so the app stays usable while building.
2. Implement Setup Wizard before Today Log to avoid manual DB seeding.
3. Implement Today Log end-to-end (parse -> compute -> simulate -> store) before building complex analytics.
4. Implement inventory/orders and cycles/recommendations next.
5. Implement analytics and import/export last, but add the necessary views early to keep queries cheap.

## Concrete Steps

All commands below assume a Unix-like shell. Record the actual outputs you observe under `Artifacts and Notes` as you implement.

Prerequisites check:

    command -v node
    node --version
    npm --version

If Node is not installed or too old to run Next.js 16, install a current Node LTS before continuing.

If `node --version` fails with an error indicating Bun's `node` wrapper, ensure a real Node.js binary is first in `PATH` (for example by using nvm). In this workspace, a known-good real Node binary is:

    export PATH="$HOME/.nvm/versions/node/v22.21.1/bin:$PATH"
    command -v node
    node --version

Create the Next.js app:

    cd /data/projects/peptaide
    npm create next-app@latest web -- --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

Install dependencies for the stack (exact packages may be revised during implementation; record changes in `Decision Log`):

    cd /data/projects/peptaide/web
    npm install @supabase/supabase-js @supabase/ssr
    npm install @tanstack/react-table @tanstack/react-virtual cmdk recharts zod date-fns
    npm install -D vitest @types/node

Initialize Supabase migrations (choose local or hosted; hosted Supabase requires H1/H2):

    cd /data/projects/peptaide
    supabase init

Create the first migration file under `supabase/migrations/` and add the schema described in this ExecPlan.

Run migrations (local example):

    cd /data/projects/peptaide
    supabase start
    supabase db reset

Generate TypeScript types (local example):

    cd /data/projects/peptaide
    supabase gen types typescript --local > web/src/lib/supabase/database.types.ts

Run the dev server:

    cd /data/projects/peptaide/web
    npm run dev

Run tests:

    cd /data/projects/peptaide/web
    npm run test

Lint:

    cd /data/projects/peptaide/web
    npm run lint

Note: if the Supabase CLI is not installed, install it for your environment and confirm `supabase --version` works. If you cannot install it in your environment, use either a hosted Supabase project (H1/H2) or a direct Postgres connection string (`SUPABASE_DB_URL`) plus a migration runner (for example `psql`) to apply the SQL migrations.

## Validation and Acceptance

Acceptance is phrased as user-observable behavior and database-enforced properties.

Global acceptance criteria:

1. Privacy: With RLS enabled, a user can only read/write their own rows across all user-owned tables.
2. Fast logging: On desktop, the Today Log allows adding 10 events in about 1 minute without fighting UI focus, and the app remains responsive.
3. Correctness: Canonical dose fields (mg/mL) and effective-dose percentiles are computed consistently when the input supports mg/mL canonicalization (IU remains IU in MVP); bioavailability fractions never exceed [0,1]; deterministic recomputation works via stored seed/snapshot.
4. Cycle behavior: New cycles are suggested based on a configurable gap and can be corrected by splitting cycles.
5. Portability: Export/import round-trip restores the same state.

Concrete validation steps:

1. Sign in and complete Setup Wizard.
2. Create at least one substance, route, device (if relevant), formulation, and active vial.
3. Add base BA and at least one modifier distribution.
4. In Today Log, enter events using at least three input types: volume (0.3mL), device units (2 sprays), and mass (250mcg). Confirm canonicalization and MC outputs.
5. Create a gap large enough to trigger a new-cycle suggestion and confirm the UX and assignment.
6. Create an order and generate vials; confirm cost attribution and spend rollups.
7. Export and import into a fresh test DB; confirm counts match and key entities are restored.

## Idempotence and Recovery

This plan should be safe to run repeatedly.

1. Local Supabase resets should use `supabase db reset` so migrations re-apply cleanly.
2. Import operations must support dry-run validation and must be repeatable with dedupe by unique keys.
3. Any "danger zone" deletes must require an explicit confirmation and should strongly encourage export first.
4. When changing distributions/specs, recomputation should be explicit and traceable (record in `Decision Log` when it changes stored percentiles).

## Artifacts and Notes

As implementation proceeds, paste short, focused evidence here (no giant logs). Keep outputs that prove correctness.

Evidence captured so far (domain modules):

    cd /data/projects/peptaide/web
    npm run test
    # 30 tests passed (units/uncertainty/dose/cost/cycles + smoke)

    cd /data/projects/peptaide/web
    npm run typecheck
    # exits 0 (no errors)

Evidence captured so far (RLS probe):

    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/scripts/rls_probe.sql
    # tables: substances/vendors/orders/order_items/vials/device_calibrations/cycle_instances/distributions visible_to_a = 1; visible_to_b = 0
    # views: v_event_enriched/v_cycle_summary/v_inventory_status/v_model_coverage/v_order_item_vial_counts visible_to_a = 1; visible_to_b = 0
    # cross-user inserts blocked (substances, vendors) with: "new row violates row-level security policy"

Evidence captured so far (local Supabase):

    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select table_schema, table_name from information_schema.tables where table_schema='public' order by table_name;"

     table_schema | table_name
    --------------+------------
     public       | profiles
    (1 row)

After applying `supabase/migrations/20260207025138_020_reference_data.sql` (2026-02-07 02:54Z):

    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select table_name from information_schema.tables where table_schema='public' order by table_name;"

           table_name
    ------------------------
     device_calibrations
     devices
     formulation_components
     formulations
     profiles
     routes
     substance_aliases
     substances
    (8 rows)

After applying `supabase/migrations/20260207025608_030_inventory.sql` (2026-02-07 02:58Z):

    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select table_name from information_schema.tables where table_schema='public' order by table_name;"

           table_name
    ------------------------
     device_calibrations
     devices
     formulation_components
     formulations
     order_items
     orders
     profiles
     routes
     substance_aliases
     substances
     vendors
     vials
    (12 rows)

After applying `supabase/migrations/20260207025921_040_cycles.sql` and `supabase/migrations/20260207025957_050_recommendations.sql` (2026-02-07 03:01Z):

    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select table_name from information_schema.tables where table_schema='public' order by table_name;"

            table_name
    ---------------------------
     cycle_instances
     cycle_rules
     device_calibrations
     devices
     evidence_sources
     formulation_components
     formulations
     order_items
     orders
     profiles
     routes
     substance_aliases
     substance_recommendations
     substances
     vendors
     vials
    (16 rows)

After applying `supabase/migrations/20260207030252_060_uncertainty.sql` (2026-02-07 03:05Z):

    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select table_name from information_schema.tables where table_schema='public' order by table_name;"

             table_name
    ----------------------------
     bioavailability_specs
     component_modifier_specs
     cycle_instances
     cycle_rules
     device_calibrations
     devices
     distributions
     evidence_sources
     formulation_components
     formulation_modifier_specs
     formulations
     order_items
     orders
     profiles
     routes
     substance_aliases
     substance_recommendations
     substances
     vendors
     vials
    (20 rows)

After applying `supabase/migrations/20260207030653_070_events.sql` (2026-02-07 03:10Z):

    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select table_name from information_schema.tables where table_schema='public' order by table_name;"

             table_name
    ----------------------------
     administration_events
     bioavailability_specs
     component_modifier_specs
     cycle_instances
     cycle_rules
     device_calibrations
     devices
     distributions
     event_revisions
     evidence_sources
     formulation_components
     formulation_modifier_specs
     formulations
     order_items
     orders
     profiles
     routes
     substance_aliases
     substance_recommendations
     substances
     vendors
     vials
    (22 rows)

    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select typname from pg_type where typnamespace = 'public'::regnamespace and typname in ('compartment_t','input_kind_t','distribution_dist_type_t') order by typname;"

              typname
    ----------------------------
     compartment_t
     distribution_dist_type_t
     input_kind_t
    (3 rows)

Recommended artifacts to record:

1. A short transcript showing migrations applied.
2. A short transcript showing `npm run test` passing.
3. A sample `administration_events` row (redacting IDs/keys) showing canonical dose, p05/p50/p95, seed, and snapshot.
4. Evidence of RLS blocking cross-user access (for example, an attempted select from another user's rows returning 0 rows or a permission error).
5. Export/import round-trip evidence (row counts before/after).

Plan coverage index (source plan -> this ExecPlan):

1. plan[1-6] Title + scope disclaimer: represented in `Purpose / Big Picture` and `Context and Orientation`.
2. plan[7-16] Design goals: represented in `Context and Orientation` section "0) Design goals".
3. plan[17-49] Recommended stack: represented in `Context and Orientation` section "1) Recommended stack" and `Decision Log`.
4. plan[50-68] MVP definition and non-goals: represented in `Context and Orientation` section "2) Complete MVP definition".
5. plan[69-104] Conceptual corrections: represented in `Context and Orientation` section "3) Core conceptual corrections" and `Decision Log`.
6. plan[105-343] Data model: represented in `Context and Orientation` section "4) Data model".
7. plan[344-384] Monte Carlo: represented in `Context and Orientation` section "5) Monte Carlo" and `Decision Log`.
8. plan[385-411] Unit parsing: represented in `Context and Orientation` section "6) Unit input parsing".
9. plan[412-595] User flows: represented in `Context and Orientation` section "7) User flows" and in milestones for UI work.
10. plan[596-635] Implementation modules: represented in `Context and Orientation` section "8) Implementation modules" and in `Plan of Work`.
11. plan[636-689] Required pages: represented in `Context and Orientation` section "9) Required pages" and in `Progress`.
12. plan[690-713] Nonfunctional requirements: represented in `Context and Orientation` section "10) Nonfunctional requirements" and in `Progress`.
13. plan[714-728] LLM agent research readiness: represented in `Context and Orientation` section "11) LLM agent research readiness".
14. plan[729-751] Definition of done: represented in `Context and Orientation` section "12) Practical definition of done" and in `Validation and Acceptance`.
15. plan[752-761] References: captured in `Context and Orientation` section "References from the original plan".
16. plan[764-777] Plan change notes: captured in `Context and Orientation` section "Plan change notes (from `plan.md`)" and reflected in this ExecPlan's `Plan Change Notes` log.

## Interfaces and Dependencies

This section makes the most important interfaces prescriptive so the implementation stays consistent.

Database interfaces:

1. All user-owned tables must include `user_id` and be protected by RLS policies enforcing `user_id = auth.uid()`.
2. `administration_events` must not store redundant `substance_id`/`route_id`; those are derived from `formulation_id`.
3. The vials active constraint must be enforced by a partial unique index.

TypeScript domain interfaces (minimum required signatures):

In `web/src/lib/domain/units/types.ts`:

    export type QuantityKind = 'mass' | 'volume' | 'device_units' | 'iu' | 'other'

    export type ParsedQuantity = {
      kind: QuantityKind
      value: number
      unit: string
      normalizedUnit: string
    }

    export function parseQuantity(inputText: string): ParsedQuantity

In `web/src/lib/domain/units/canonicalize.ts`:

    export function toCanonicalMassMg(value: number, unit: string): number

    export function toCanonicalVolumeMl(value: number, unit: string): number

In `web/src/lib/domain/uncertainty/types.ts`:

    export type DistributionValueType = 'fraction' | 'multiplier' | 'volume_ml_per_unit' | 'other'

    export type DistributionDistType = 'point' | 'uniform' | 'triangular' | 'lognormal' | 'beta_pert'

    export type Distribution = {
      id: string
      valueType: DistributionValueType
      distType: DistributionDistType
      p1: number | null
      p2: number | null
      p3: number | null
      minValue: number | null
      maxValue: number | null
    }

In `web/src/lib/domain/uncertainty/rng.ts`:

    export type Rng = { next: () => number }

    export function rngFromSeed(seed: bigint): Rng

In `web/src/lib/domain/uncertainty/sample.ts`:

    export function sample(dist: Distribution, rng: Rng): number

In `web/src/lib/domain/uncertainty/monteCarlo.ts`:

    export type Percentiles = { p05: number; p50: number; p95: number }

    export function composeBioavailability(baseFraction: number, multipliers: number[]): number

    export function simulateEffectiveDose(opts: {
      doseMg: number
      baseFractionDist: Distribution
      multiplierDists: Distribution[]
      n: number
      seed: bigint
    }): Percentiles

In `web/src/lib/domain/dose/computeDose.ts`:

    // `volumeMlPerDeviceUnit` should be a deterministic point estimate derived from the calibration distribution (use the distribution mean as defined in the distributions section).
    export type DoseComputationInput = {
      inputText: string
      inputKind: QuantityKind
      inputValue: number
      inputUnit: string
      vial: {
        contentMassMg: number | null
        totalVolumeMl: number | null
        concentrationMgPerMl: number | null
      } | null
      volumeMlPerDeviceUnit: number | null
    }

    export function computeDose(input: DoseComputationInput): {
      doseMassMg: number | null
      doseVolumeMl: number | null
    }

In `web/src/lib/domain/cycles/suggest.ts`:

    export function shouldSuggestNewCycle(opts: {
      lastEventTs: Date | null
      newEventTs: Date
      gapDaysThreshold: number
    }): boolean

In `web/src/lib/domain/cost/cost.ts`:

    export function eventCostFromVial(opts: {
      doseMassMg: number | null
      doseVolumeMl: number | null
      vialContentMassMg: number | null
      vialTotalVolumeMl: number | null
      vialCostUsd: number | null
    }): number | null

Dependency list (MVP): Next.js, React, TypeScript, Tailwind, Supabase JS client + SSR helpers, TanStack Table/Virtual, cmdk, Recharts, Zod, date-fns, Vitest, jszip. Any additions or substitutions must be recorded in `Decision Log`.

## Plan Change Notes

2026-02-07: Created `ExecPlan.md` by fully ingesting `plan.md` and translating it into the repository's ExecPlan format while preserving all requirements and context. This provides a single restartable document for implementing the MVP.

2026-02-07: Fresh-eyes audit against `plan.md` to ensure no details were lost. Updates: made unit-synonym handling explicit (including `[iU]` and micro-unit Unicode variants described in the source plan), restored the plan's reference URLs verbatim (still not required for execution), added the schema field-group labels present in the source plan (vials and events), clarified the rationale for `order_items.price_total_usd`, and recorded that mean/std may be stored later alongside MC percentiles.

2026-02-07: Fresh-eyes correctness audit focusing on conceptual rigor and probability safety. Updates: removed milestone references that would require reading `plan.md`, defined explicit distribution parameterization and sampling (including beta-PERT details) plus validation constraints, made MC percentile computation deterministic, corrected the daily-percentile-summing language to an "approximate band" (not true quantiles), clarified deterministic recomputation via `model_snapshot` hashing, widened cost attribution to support mg-or-volume fractioning (important for IU workflows), and added key uniqueness/consistency constraints (including trigger-based enforcement for redundant `substance_id` columns) to prevent drift.

2026-02-07: Fresh-eyes execution audit for this workspace. Updates: recorded environment surprises (Bun `node` wrapper; repo not a git worktree) with evidence in `Surprises & Discoveries`, updated `Concrete Steps` with a concrete PATH workaround to use a real Node.js binary, added a `Progress` step to initialize git (so "commit frequently" is executable), removed a duplicated daily-band decision log entry, clarified the day-level MC upgrade path to include correlated sampling for epistemic uncertainties, added a DB trigger note for enforcing distribution `value_type` across foreign keys, and fixed the `eventCostFromVial` interface to accept `vialCostUsd: number | null`.

2026-02-07: Added the source plan's conceptual note that "bulk add" grids are simply imports with a nicer UI, so validation + dedupe logic stays unified.

2026-02-07: Updated the living plan to reflect real implementation progress (git worktree created; Next.js app and local Supabase initialized; Supabase SSR auth skeleton implemented). Updated `Progress`, `Surprises & Discoveries`, `Outcomes & Retrospective`, and the "Repository state today" orientation to match the current working tree.

2026-02-07: Auth integration hardening. Updates: configured Supabase clients to use PKCE flow, adjusted `/auth/callback` to attach cookies to the redirect response, updated local Supabase redirect allow-list in `supabase/config.toml` to include common local dev origins and `/auth/callback`, and captured the redirect allow-list + PKCE verifier-cookie implications in `Surprises & Discoveries`.

2026-02-07: Milestone 1 started. Updates: added and applied local DB migrations for the schema foundation and `profiles` (with RLS), updated `Progress`, `Outcomes & Retrospective`, and "Repository state today" to match reality, and captured initial migration evidence in `Artifacts and Notes`. Also tightened a few plan-level semantics in `plan.md` (seed definition, distribution parameterization, IU/mg clarifications, and labeling for summed-percentile daily bands) so the source plan no longer contains probability-theory footguns.

2026-02-07: Added the reference-data tables migration (`supabase/migrations/20260207025138_020_reference_data.sql`) implementing substances/routes/devices/formulations (and related tables) with RLS and uniqueness constraints. Reset local DB to apply, regenerated `web/src/lib/supabase/database.types.ts`, and updated `Progress` + `Artifacts and Notes` evidence accordingly.

2026-02-07: Added the inventory + commerce tables migration (`supabase/migrations/20260207025608_030_inventory.sql`) implementing vendors/orders/order_items/vials, including the "one active vial per formulation" partial unique index and trigger-based consistency checks for redundant `substance_id` fields. Reset local DB to apply, regenerated `web/src/lib/supabase/database.types.ts`, and updated `Progress` + `Artifacts and Notes` evidence accordingly.

2026-02-07: Added cycles tables migration (`supabase/migrations/20260207025921_040_cycles.sql`) and recommendations/evidence migration (`supabase/migrations/20260207025957_050_recommendations.sql`), both with RLS + constraints. Reset local DB to apply, regenerated `web/src/lib/supabase/database.types.ts`, and updated `Progress` + `Artifacts and Notes` evidence accordingly.

2026-02-07: Added uncertainty tables migration (`supabase/migrations/20260207030252_060_uncertainty.sql`) implementing `distributions` and BA/modifier spec tables with explicit parameterization + probability-safety constraints and trigger-based enforcement of `distributions.value_type` across foreign keys (including earlier tables like device calibrations and vial overrides). Reset local DB to apply, regenerated `web/src/lib/supabase/database.types.ts`, and updated `Progress` + `Artifacts and Notes` evidence accordingly.

2026-02-07: Added administration events migration (`supabase/migrations/20260207030653_070_events.sql`) implementing `administration_events` and the optional audit trail table `event_revisions` (with triggers). Reset local DB to apply, regenerated `web/src/lib/supabase/database.types.ts`, and updated `Progress` + `Artifacts and Notes` evidence accordingly.

2026-02-07: Updated `Outcomes & Retrospective` and "Repository state today" to reflect that Milestone 1 is now implemented locally through `administration_events`, and to shift the "what remains" focus onto SQL views, RLS probes, and Milestone 2 pure domain modules.

2026-02-07: Added initial analytics/performance views migration (`supabase/migrations/20260207031330_080_views.sql`) with `security_invoker = true` so views do not bypass RLS. Implemented `v_event_enriched`, daily totals views, spend rollups, and order-item vial counts; left the remaining views (cycle summary, inventory status, model coverage) for a follow-up migration.

2026-02-07: Added follow-up views migration (`supabase/migrations/20260207031911_081_views_more.sql`) implementing `v_cycle_summary`, `v_inventory_status`, and `v_model_coverage` (also `security_invoker = true`). Applied locally and regenerated `web/src/lib/supabase/database.types.ts`.

2026-02-07: Fresh-eyes hardening updates. Recorded and fixed determinism and UX edge cases discovered during review: canonicalized `model_snapshot.compartments[].missing` for stable `mc_seed` hashing; defaulted unknown target-compartment relevance to systemic-only in `/today` coverage UI; and extended device calibration `unit_label` normalization to treat micro symbols as ASCII `u`. Updated `Progress` and `Surprises & Discoveries` accordingly.

2026-02-07: Implemented a minimal `/orders` CRUD surface (vendors, orders, order items) and added typed repos (`vendorsRepo`, `ordersRepo`, `orderItemsRepo`) so later "generate vials" and spend attribution work can build on a consistent data-access layer. Updated `Progress` to reflect the new routes and remaining scope.

2026-02-07: Expanded `supabase/scripts/rls_probe.sql` to probe RLS across additional user-owned tables and key `security_invoker` views (inventory, cycles, model coverage, order-item vial counts). Updated `Progress` and `Artifacts and Notes` with the new evidence.

2026-02-07: Implemented an initial "generate planned vials" flow from order items in `/orders` and extended the vials repo insert helper to persist `order_item_id`. Updated `Progress` to reflect that "generate vials" is now partially implemented (remaining work: vial lifecycle actions and cost allocation preview).

2026-02-07: Implemented basic vial lifecycle actions in `/inventory` (activate planned vials; close/discard vials) and added corresponding repo helpers. Updated `Progress` to reflect reduced remaining scope for inventory workflows.

2026-02-07: Added minimal read-only `/analytics` (daily totals + spend rollups) and a minimal `/settings` page (profile defaults editor), plus header nav links for both. Updated `Progress`, `Decision Log`, and `Outcomes & Retrospective` to reflect the new surfaces and remaining work (notably import/export and richer analytics).

2026-02-07: UI correctness fix: the cmdk command palette now controls the search query via `Command.Input value/onValueChange` (previously it incorrectly controlled the selected-item value on the `Command` root) and the data portability UI now uses ASCII `...` labels (no Unicode ellipsis).

2026-02-07: Added a minimal `/setup` onboarding hub page that embeds profile defaults and bulk-add reference data (substances/routes/formulations), and linked it from the `/today` empty state and the command palette so new users have a single obvious starting point.

2026-02-07: Extended `/setup` to include vial creation and a model-coverage gaps table, so onboarding covers "inventory" and "why are percentiles missing?" without requiring users to discover `/inventory` and `/today` first.

2026-02-07: Added a quick base bioavailability spec entry form on `/setup` (substance + route + compartment + fraction distribution) backed by `web/src/app/(app)/setup/actions.ts`, so users can close the most common model-coverage gaps without bouncing into substance detail pages.

2026-02-07: Added a quick device calibration entry form on `/setup` and refactored unit-label normalization to use `normalizeDeviceUnitLabel(...)` from `web/src/lib/domain/units/types.ts` so calibration keys match what users type during logging.

2026-02-07: Added a minimal formulation modifier spec entry form on `/setup` backed by an upsert-style repo helper, so formulation-level enhancer multipliers can be configured during onboarding.

2026-02-07: Embedded "Generate vials" from order items directly into `/setup` so onboarding can produce planned vials without switching pages.

2026-02-07: Extended the command palette with per-formulation "Log" shortcuts and added `/today` support for `formulation_id` query params, making fast keyboard-only logging practical without waiting for the full virtualized grid.

2026-02-07: Added a soft-delete action for events in `/today` (sets `administration_events.deleted_at` via a Server Action) so users can correct mistakes without losing history. Also clarified `/setup` model-coverage copy to reflect the inline entry forms. Updated `Progress` accordingly.

2026-02-07: Added a `/today` toggle to view deleted events and restore them (undo soft delete), and extended `web/src/lib/repos/eventsRepo.ts` to support listing deleted events. Updated `Progress` accordingly.

2026-02-07: Added `/cycles/[cycleInstanceId]` cycle detail with a minimal split-at-event correction tool (most recent active cycle only). Updated `Progress` accordingly.

2026-02-07: Added a minimal "End cycle now" action and updated event-cycle assignment semantics so ended cycles reliably cause the next event to start a new cycle. Updated `Progress` accordingly.

2026-02-07: Added minimal user-entered recommendations CRUD on substance detail pages and surfaced recommended cycle/break ranges in cycle detail. Updated `Progress` accordingly.

2026-02-07: Added `public.v_events_today` and switched `/today` to show events for the user's local day (timezone from `profiles`, UTC fallback). Updated `Progress` accordingly.

2026-02-07: Replaced the `/today` single-row quick log with a minimal multi-row log grid (Enter-to-save, multi-line paste). Updated `Progress` accordingly.
