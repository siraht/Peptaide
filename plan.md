# Settings Hub Styling + Inventory Total Stock + Sign-In Reliability

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository's ExecPlan format authority is `.agent/PLANSwHD.md` from the repository root. This plan must be maintained in accordance with it.

## Purpose / Big Picture

Peptaide’s `/settings` page already matches the new Stitch mockup style, but most pages linked from the settings sidebar (`/routes`, `/formulations`, `/devices`, `/inventory`, `/orders`, `/cycles`, `/distributions`, `/evidence-sources`, and the legacy `/substances` pages) still render as older, minimally styled pages and they do not preserve the left sidebar “hub” navigation when you click into them.

After this change:

1. All pages reachable from the settings sidebar render inside a shared “Settings Hub” layout that keeps the left sidebar visible while navigating between those pages, and those pages use the same theme tokens as the Stitch mockups (colors, surfaces, borders, typography).
2. The `/today` “Control Center” inventory cards show total in-stock inventory (across all vials you have on hand), not just the currently active vial. Optionally, the UI can show both “Current vial” and “Total stock”, but “Total stock” must exist.
3. Signing in from a remote browser (for example, a phone on the tailnet) works reliably even when Supabase is not directly reachable from the client, and end-to-end browser verification does not wipe real data by default.

You can see it working by starting the app, navigating to `/settings`, clicking into each linked page, and observing that the sidebar persists and the page styling matches the theme. Then navigate to `/today` and confirm the inventory bars reflect all vials (planned + active + closed leftover, excluding discarded), not only the active vial.

## Progress

- [x] (2026-02-10 02:17Z) Read `.agent/PLANSwHD.md` and inspected current `/settings` sidebar links and the pages they point to. plan[1-205]
- [x] (2026-02-10 03:10Z) Create a shared Settings Hub route-group layout that renders the left sidebar for all settings-linked pages, and move the relevant routes under it without changing URLs. plan[69-155]
- [x] (2026-02-10 03:10Z) Refactor `/settings` page to use the shared sidebar (no duplicate sidebar markup) and keep existing `data-e2e` hooks stable. plan[69-155]
- [x] (2026-02-10 03:25Z) Restyle each settings-linked page and its forms/tables to use the Stitch theme tokens (`bg-background-*`, `bg-surface-*`, `border-border-*`, slate/gray text) so they do not look like legacy inserts. Evidence: commit `3f4b0f2`. plan[88-111]
- [x] (2026-02-10 03:26Z) Add a DB-level inventory summary view that aggregates total stock per formulation (and joins active vial details) so `/today` can render total stock + runway. Evidence: commit `8e9b433`. plan[97-111]
- [x] (2026-02-10 03:26Z) Update `/today` Control Center to use the new inventory summary (total stock) instead of per-active-vial remaining/content, preserving existing behaviors and `data-e2e` hooks. Evidence: commit `8e9b433`. plan[97-111]
- [x] (2026-02-10 03:59Z) Fix remote sign-in reliability by routing OTP send/verify through same-origin server routes, persisting PKCE cookies for magic links, and optionally exposing the Mailpit OTP code in dev. Evidence: commits `ad967d5`, `0a9080d`. plan[164-205]
- [x] (2026-02-10 04:01Z) Make the “conclusive” browser verification safer and more complete: do not reset the DB unless explicitly requested, add a hub sidebar clickthrough sweep, and update the settings visual contract to account for the shared hub sidebar. Evidence: commits `755e0db`, `c5d3191`. plan[112-164]
- [x] (2026-02-10 04:01Z) Validation: `npm run typecheck`, `npm run lint`, `npm test`, and `node web/scripts/tbrowser/peptaide-e2e.mjs` all pass. Evidence: last E2E run printed `PASS` and wrote artifacts to `/tmp/peptaide-e2e-2026-02-10T04-00-03-885Z`. plan[112-164]
- [x] (2026-02-10 04:01Z) Write outcomes/retro and capture surprises. plan[47-49]

## Surprises & Discoveries

- Observation: The Stitch-style `/settings` page renders its own left sidebar and links directly to legacy pages like `/routes` and `/inventory`. Those pages live under `web/src/app/(app)/<route>` and use older zinc/white styling. They are outside of the settings page’s internal sidebar layout, so navigating to them naturally “drops” the sidebar.  
  Evidence: `web/src/app/(app)/(hub)/settings/page.tsx` links to `/routes`, `/formulations`, `/devices`, `/inventory`, `/orders`, `/cycles`, `/distributions`, `/evidence-sources`.

- Observation: `/today` “Control Center” cards are derived from `listInventoryStatus()` which reads `public.v_inventory_status`, and the page filters to `status === 'active'`. The progress bar and runway therefore represent only the active vial, not total on-hand stock from all vials.  
  Evidence: `web/src/app/(app)/today/page.tsx` uses `const activeInventory = inventory.filter((v) => v.status === 'active' ...)`.

- Observation: Server-side OTP send initially broke magic-link sign-in because PKCE state (code verifier) was not persisted in browser cookies. Switching `/api/auth/send-otp` to a Supabase SSR client that writes PKCE cookies fixed the redirect-to-`/today` flow.  
  Evidence: E2E failure `Timed out waiting for redirect to /today` (before) vs `PASS: conclusive browser verification completed` (after).

- Observation: The “conclusive” E2E harness previously ran `supabase db reset --yes` by default, which can wipe real local data if run casually.  
  Evidence: `web/scripts/tbrowser/peptaide-e2e.mjs` now skips reset unless `E2E_RESET_DB=1` is set.

## Decision Log

- Decision: Implement the persistent left sidebar using a Next.js route group layout (a directory name wrapped in parentheses) so URLs do not change and the sidebar is shared across multiple pages.  
  Rationale: This fixes the “sidebar disappears when clicking settings links” problem without redesigning `/today` or changing top-level routing. It also centralizes the sidebar markup so future nav changes are one edit.  
  Date/Author: 2026-02-10 / Codex

- Decision: Make the Settings Hub layout’s content area `overflow-hidden` and require each page to own its own scroll container.  
  Rationale: `/settings` is a 3-column workspace (left hub nav, main table, right editor). If the layout imposes a global scroll container, it becomes difficult to keep the right editor fixed while the table scrolls. Letting each page manage its own scroll keeps `/settings` working and forces legacy pages to be explicit about scrolling.  
  Date/Author: 2026-02-10 / Codex

- Decision: Compute “total stock” in the database as a security-invoker view (similar to `v_inventory_status`) and consume it via a small repo wrapper.  
  Rationale: The rollup needs consistent unit conversion/clamping behavior and should be cheap to query. Doing it in SQL avoids duplicating unit conversion logic in React and keeps RLS behavior consistent.  
  Date/Author: 2026-02-10 / Codex

- Decision: Route OTP send/verify through same-origin API routes so remote clients do not need direct network access to Supabase, and (in dev only) optionally expose the Mailpit OTP code to unblock login when Mailpit is not reachable from the client device.  
  Rationale: Mobile/tailnet clients often cannot reach `127.0.0.1:54321` or `localhost:54321` and may not be able to open Mailpit. Same-origin auth flows work anywhere the Next server is reachable, while keeping the service-role surface area at zero.  
  Date/Author: 2026-02-10 / Codex

- Decision: Change the E2E harness default to **not** reset the DB, and require an explicit `E2E_RESET_DB=1` to wipe + reseed.  
  Rationale: Prevent accidental loss of real user data while keeping deterministic reset available for CI.  
  Date/Author: 2026-02-10 / Codex

## Outcomes & Retrospective

Implemented a shared Settings Hub layout (persistent left sidebar) and restyled all settings-linked pages to match the Stitch theme tokens, eliminating the “legacy insert” look and the disappearing sidebar.

Updated `/today` Control Center inventory cards to reflect total in-stock inventory across all on-hand vials (planned + active + closed; excluding discarded) using a DB-level rollup view.

Improved sign-in reliability for remote browsers by routing OTP send/verify through same-origin API routes, ensuring PKCE cookies are persisted for magic-link sign-in, and adding an optional dev-only “show OTP code” path when Mailpit is not reachable from the client.

Hardened browser E2E verification by making DB reset opt-in, adding a hub sidebar clickthrough sweep, and keeping the Stitch visual contracts aligned with the new shared hub sidebar.

## Context and Orientation

This repo is a Next.js app with the App Router in `web/src/app/`.

- The authenticated application pages live under `web/src/app/(app)/...` and are wrapped by `web/src/app/(app)/layout.tsx` (header, command palette, etc).
- The Stitch-style settings page is `web/src/app/(app)/(hub)/settings/page.tsx`. The persistent sidebar for all hub pages is in `web/src/app/(app)/(hub)/layout.tsx` and `web/src/components/settings-hub/sidebar.tsx`.
- Theme tokens used by the Stitch mockups are defined in `web/src/app/globals.css` via `@theme inline` CSS variables:
  - `--color-primary`, `--color-background-light`, `--color-surface-dark`, etc.
  - Tailwind class names like `bg-background-light` and `border-border-light` reference those tokens.
- Inventory status data comes from Supabase Postgres views:
  - `public.v_inventory_status` is defined in `supabase/migrations/*inventory_status*.sql` and returns per-vial info (including remaining mass for that vial).
  - `web/src/lib/repos/inventoryStatusRepo.ts` reads that view.
  - `/today` reads the view then filters to active vials to render the right-side Control Center cards.

Important design constraint: URLs should not change (existing links and tests assume `/routes`, `/inventory`, etc). We should use route groups and layouts to change structure without changing the path.

## Plan of Work

Milestone 1: Shared Settings Hub layout (persistent sidebar)

1. Create a new route group under `web/src/app/(app)/` (for example `web/src/app/(app)/(hub)/`) with a `layout.tsx` that:
   - renders the Stitch-style left sidebar (extracted to a shared component),
   - renders a scrollable main content area for the page body,
   - highlights the active nav item based on the current pathname and (for `/settings`) the `tab` search param.
2. Move the settings-linked routes into that route group so they all share the sidebar layout without changing URLs:
   - `settings/`
   - `routes/`
   - `formulations/`
   - `devices/`
   - `inventory/`
   - `orders/`
   - `cycles/`
   - `distributions/`
   - `evidence-sources/`
   - `substances/` (and their detail pages), because existing settings code imports forms from there by relative path and other pages deep-link to them.
3. Keep the existing `data-e2e="settings-root"` and other E2E selectors stable so `web/scripts/tbrowser/peptaide-e2e.mjs` continues to work.

Milestone 2: Theme/style unification for settings-linked pages

1. For each settings-linked page (and its forms), update Tailwind classes to use the theme tokens and Stitch patterns:
   - replace `bg-white` with `bg-surface-light dark:bg-surface-dark`
   - replace `text-zinc-*` with slate/gray tokens used elsewhere (`text-slate-...`, `text-gray-...`)
   - replace raw borders with `border-border-light dark:border-border-dark`
   - ensure consistent spacing (`p-4` cards, `p-6` page padding, sticky headers where needed)
2. Keep all button texts and form names/inputs the same unless there is a strong reason, to avoid breaking automated tests that find elements by role/name.

Milestone 3: Total stock inventory rollups

1. Add a new Postgres view `public.v_inventory_summary` (name can be adjusted, but must be stable) in a new migration under `supabase/migrations/` that:
   - aggregates per formulation (user_id, formulation_id) over all non-deleted vials with `status in ('planned','active','closed')` (exclude `discarded`)
   - uses the same unit conversion approach as `v_inventory_status` so totals are in mg
   - sums `content_mass_mg` and sums per-vial `used_mass_mg` from `administration_events`
   - computes `total_remaining_mass_mg = greatest(0, total_content_mass_mg - total_used_mass_mg)`
   - computes a `runway_days_estimate_total_mg` using the same 14-day avg usage logic already used in `v_inventory_status`
   - joins the active vial (if any) for that formulation so the UI can still show the current vial label and optionally a “current vial” bar.
2. Create a repo wrapper `web/src/lib/repos/inventorySummaryRepo.ts` (or similar) that selects from this view.
3. Update `web/src/app/(app)/today/page.tsx` to use this summary view for the Control Center:
   - render the progress bar based on `total_remaining_mass_mg / total_content_mass_mg`
   - render runway based on `runway_days_estimate_total_mg`
   - keep “Log Dose” links pointing at the formulation.

Milestone 4: Validation

1. Run the repo’s existing end-to-end browser verification:

     cd /data/projects/peptaide
     node web/scripts/tbrowser/peptaide-e2e.mjs

2. Manually sanity check:
   - `/settings` sidebar persists when clicking into every nav link
   - `/routes`, `/devices`, `/inventory`, etc all match the Stitch theme and do not look like legacy inserts
   - `/today` Control Center totals match the sum of all vials (for a formulation) minus logged usage

## Concrete Steps

All commands below are run from the repo root: `/data/projects/peptaide`.

1. Add the Settings Hub layout and move routes:

   - Create `web/src/app/(app)/(hub)/layout.tsx`
   - Extract the sidebar into `web/src/components/settings-hub/sidebar.tsx` (client component) and import it from the layout.
   - `git mv` each of the routes listed above from `web/src/app/(app)/...` into `web/src/app/(app)/(hub)/...`.
   - Fix any broken relative imports.

2. Restyle pages and forms:

   - Edit each page and component under `web/src/app/(app)/(hub)/...`.
   - Prefer minimal, mechanical class substitutions first, then iterate visually.

3. Add inventory summary view:

   - Create migration `supabase/migrations/20260210000000_098_inventory_summary_view.sql` (timestamp may differ, but must be unique).
   - Apply it to the running local DB without wiping data by running the SQL directly via psql:

       psql \"postgresql://postgres:postgres@127.0.0.1:54322/postgres\" -v ON_ERROR_STOP=1 -f supabase/migrations/<new_file>.sql

4. Update `/today` Control Center:

   - Add `web/src/lib/repos/inventorySummaryRepo.ts`
   - Update `web/src/app/(app)/today/page.tsx`

5. Validation:

   - Run `node web/scripts/tbrowser/peptaide-e2e.mjs`

## Validation and Acceptance

Acceptance is:

1. Navigate to `/settings` and click each sidebar link (“Routes”, “Formulations”, “Devices”, “Inventory”, “Orders”, “Cycles”, “Distributions”, “Evidence”, “App Settings”). The left sidebar remains visible across navigation and highlights the current section.
2. The target pages look consistent with the Stitch theme (same backgrounds, border colors, typography, and button styles), not like the old zinc/white pages.
3. Navigate to `/today` and confirm each Control Center inventory card shows total remaining mg across all on-hand vials (not just the active vial), and the percent bar reflects total stock.
4. Run `node web/scripts/tbrowser/peptaide-e2e.mjs` and it completes successfully (no console errors, no failed network requests).

## Idempotence and Recovery

- Moving routes into a route group is idempotent as long as each URL path is defined only once. If a move causes a conflict, remove the duplicated old path.
- The DB migration is additive (new view). It can be applied multiple times because it uses `create or replace view`.
- If the local DB needs rebuilding, `supabase db reset --yes` will wipe data. The E2E harness no longer resets by default; set `E2E_RESET_DB=1` to opt into a wipe + reseed when desired. The spreadsheet import runner `node web/scripts/tbrowser/import-spreadsheetdata.mjs` can re-import events + reconcile to restore an October-present dataset for `t.hinton@protonmail.com`.

## Artifacts and Notes

- Settings hub nav source of truth: `web/src/components/settings-hub/sidebar.tsx`.
- Inventory view used today: `supabase/migrations/20260209095000_096_inventory_status_lot_and_clamp.sql`.
- `/today` Control Center logic: `web/src/app/(app)/today/page.tsx` (Control Center uses `v_inventory_summary` totals; events table still uses per-vial `v_inventory_status`).

## Interfaces and Dependencies

New DB interface:

- `public.v_inventory_summary` view (security invoker) must provide, at minimum:
  - `user_id uuid`
  - `formulation_id uuid`
  - `substance_id uuid`, `substance_name text`
  - `route_id uuid`, `route_name text`
  - `total_content_mass_mg numeric`
  - `total_used_mass_mg numeric`
  - `total_remaining_mass_mg numeric`
  - `avg_daily_administered_mg_14d numeric`
  - `runway_days_estimate_total_mg numeric`
  - plus optional active vial columns: `active_vial_id uuid`, `active_lot text`, `active_remaining_mass_mg numeric`

New app interface:

- `web/src/lib/repos/inventorySummaryRepo.ts` exports:
  - `export type InventorySummaryRow = Database['public']['Views']['v_inventory_summary']['Row']`
  - `export async function listInventorySummary(supabase: DbClient): Promise<InventorySummaryRow[]>`

Plan revisions:

- (2026-02-10) Initial plan created after repo inspection.
- (2026-02-10) Updated `Progress` and `Context` after implementing the Settings Hub layout + route moves (commit `9b6f9e4`).
- (2026-02-10) Marked the styling + inventory total-stock work complete, and expanded the plan to include sign-in reliability + safer E2E defaults. Evidence: commits `3f4b0f2`, `8e9b433`, `ad967d5`, `755e0db`.
