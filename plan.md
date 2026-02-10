# Mockup Log UX + Substance-Level Control Center + Browser Coverage

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository's ExecPlan format authority is `.agent/PLANSwHD.md` from the repository root. This plan must be maintained in accordance with it.

## Purpose / Big Picture

Peptaide’s `/settings` hub and its linked pages now use the Stitch-style theme and keep a persistent left sidebar, and `/today` already resembles the “Log & Inventory Hub” mockup at the page layout level.

The remaining major UX gap is the logging workflow. Today, `/today` still uses the older “Log (grid)” multi-row entry component (`TodayLogGrid`). The HTML mockup (`mockups/logging_&_inventory_control_hub/code.html`) uses a single table with an inline “active input row” inside the table (time picker, compound selector, dose input with recommendation hint, notes input, and a check button), plus a per-row copy action to re-use an existing event as a starting point.

The Control Center inventory cards also still render one card per formulation, which duplicates substances when a single substance has multiple formulations in stock (for example SS-31). The mockup and desired UX is one card per substance, with a total-stock bar and (when applicable) multiple “current vial” bars for the active vial of each in-stock formulation.

After this change:

1. `/today` uses the mockup’s table-based logging UX (reusing the mockup markup as the starting point), replacing `TodayLogGrid`.
2. Logging supports an explicit time (HH:MM) and notes, and saved events appear immediately in the “Today log” table.
3. Control Center shows one card per substance (no SS-31 duplicates), while still showing multiple current-vial bars when multiple active formulations exist.
4. The conclusive browser verification (`web/scripts/tbrowser/peptaide-e2e.mjs`) fully covers the new `/today` interactions (quick log focus, inline row save via click and Enter, copy-row behavior, recommendation hint visibility, and the new substance-grouped Control Center) and keeps the existing Stitch-style visual contracts.

## Progress

Completed baseline work (already shipped; this plan builds on it):

- [x] (2026-02-10 05:01Z) Settings hub: persistent left sidebar via route-group layout (`web/src/app/(app)/(hub)/layout.tsx`, `web/src/components/settings-hub/sidebar.tsx`), and restyled settings-linked pages to match Stitch theme tokens. Evidence: commits `3f4b0f2`, `c5d3191`. plan[1-245]
- [x] (2026-02-10 05:01Z) Inventory totals: `/today` uses DB rollup view `public.v_inventory_summary` for total stock bars. Evidence: commit `8e9b433`. plan[1-245]
- [x] (2026-02-10 05:01Z) Remote sign-in reliability + safer E2E defaults: same-origin OTP routes and dev OTP UI fallback; E2E no longer resets DB by default. Evidence: commits `ad967d5`, `0a9080d`, `1a9e7e6`. plan[1-245]

New work (this change set):

- [x] (2026-02-10 17:35Z) Mockup deep dive: reviewed `mockups/logging_&_inventory_control_hub/code.html` and mapped it to current `/today` implementation gaps (inline input row inside the log table, time+notes support, copy-row action, and substance-level Control Center grouping with multiple current-vial bars). plan[1-245]
- [x] (2026-02-10 18:24Z) Extend event creation to accept `time_hhmm` and `notes`, compute `administration_events.ts` for “today” in the user profile timezone, and persist `notes`. Unit tests added for the time conversion helper. Evidence: commit `eb61809`. plan[1-245]
- [x] (2026-02-10 18:24Z) Replace `TodayLogGrid` with a mockup-derived “Enhanced Log Table” component that renders:
  - today event rows,
  - an inline active input row (time, compound/formulation select, dose input, route badge, notes input, check button),
  - per-row copy action that pre-fills the active input row.
  Evidence: commit `78b8944`. plan[1-245]
- [x] (2026-02-10 18:24Z) Update `/today` quick log pills and “Log Dose” links to focus and pre-select the new inline active input row (preserve `focus=log` and `formulation_id=...` URL params). Evidence: commit `78b8944`. plan[1-245]
- [x] (2026-02-10 18:24Z) Update Control Center rendering to group inventory summaries by `substance_id`:
  - one card per substance (fix SS-31 duplication),
  - total-stock bar aggregated across all formulations,
  - render multiple “current vial” bars (one per active formulation/vial) within the same substance card.
  Evidence: commit `78b8944`. plan[1-245]
- [x] (2026-02-10 18:24Z) Update demo seeding to create a second formulation + active vial for the demo substance so E2E can assert substance-level grouping and multiple current-vial bars deterministically. Evidence: commit `500cb8b`. plan[1-245]
- [x] (2026-02-10 18:24Z) Update `web/scripts/tbrowser/peptaide-e2e.mjs` to:
  - stop asserting for “Log (grid)” and grid-specific aria labels,
  - exercise the new inline row logging flow (click save and press Enter save),
  - exercise copy-row behavior,
  - assert recommendation hint appears when selecting a formulation with a saved dosing recommendation,
  - assert “one card per substance” and “multiple current-vial bars for substances with multiple active formulations”.
  Evidence: commit `4f1e9b5`. plan[1-245]
- [x] (2026-02-10 18:24Z) Validation: `cd web && npm run typecheck && npm run lint && npm test`, then `E2E_BASE_URL=http://127.0.0.1:3010 node scripts/tbrowser/peptaide-e2e.mjs` (PASS). Evidence: E2E artifacts dir `/tmp/peptaide-e2e-2026-02-10T18-21-04-959Z` and mockup compare report `/tmp/peptaide-e2e-2026-02-10T18-21-04-959Z/mockup-compare.html`. plan[1-245]
- [x] (2026-02-10 18:24Z) Write outcomes/retro and capture surprises. plan[1-245]

## Surprises & Discoveries

- Observation: The current `/today` already contains a “Today log” table, but it is separate from the “Log (grid)” entry UI; the mockup’s key behavior is that the input row is inside the table and copying rows is a first-class affordance.
  Evidence: `web/src/app/(app)/today/page.tsx` renders `<TodayLogGrid .../>` plus a separate `<table>` with event rows.

- Observation: `public.v_inventory_summary` is per formulation. Rendering one card per row will duplicate a substance when multiple formulations exist for the same `substance_id` (SS-31 case).
  Evidence: `supabase/migrations/20260210130000_098_inventory_summary_view.sql` groups by `(user_id, formulation_id)`.

- Observation: Focus-on-`focus=log` must also re-trigger when only `formulation_id` changes (for example clicking “Quick Log” then “Custom” keeps `focus=log` but removes the formulation id).
  Evidence: E2E initially failed until `web/src/app/(app)/today/today-log-table.tsx` focused the inline dose input on `[focus, formulationIdParam]`.

- Observation: The conclusive browser harness must run against a Next.js instance that includes the current working tree. In environments where port `3002` is already occupied by a stale `next start`, run the harness against another port and set `E2E_BASE_URL`.
  Evidence: `E2E_BASE_URL=http://127.0.0.1:3010 node web/scripts/tbrowser/peptaide-e2e.mjs` succeeded and produced `/tmp/peptaide-e2e-2026-02-10T18-21-04-959Z/mockup-compare.html`.

## Decision Log

- Decision: Implement the mockup log UX as a new client component derived directly from `mockups/logging_&_inventory_control_hub/code.html` markup, rather than incrementally restyling the existing `TodayLogGrid`.
  Rationale: The user explicitly wants the mockup’s method/UI/UX and wants to avoid Frankenstein merges. Starting from the mockup table structure is the fastest way to keep design coherence.
  Date/Author: 2026-02-10 / Codex

- Decision: Support a `time_hhmm` input by computing a timestamptz for “today in the profile timezone” server-side, with a small unit-tested helper.
  Rationale: We need deterministic correctness (especially around DST) and we should not rely on the browser’s local timezone matching the stored profile timezone.
  Date/Author: 2026-02-10 / Codex

- Decision: Fix duplicate Control Center cards by grouping inventory summaries by `substance_id` in the app layer (React) while reusing the existing formulation-level view.
  Rationale: The existing view already returns active-vial details per formulation; grouping in React keeps the DB migration surface minimal and still supports multiple current-vial bars.
  Date/Author: 2026-02-10 / Codex

- Decision: Treat `formulation_id` changes as a focus trigger when `focus=log`, not just `focus` changes.
  Rationale: `focus=log` remains constant across several in-page navigations (Quick Log chips, Custom, Log Dose). Without watching `formulation_id`, focus can be lost on navigation and the UX regresses.
  Date/Author: 2026-02-10 / Codex

## Outcomes & Retrospective

Baseline outcomes (already completed prior to this plan revision):

- Settings hub layout and styling are unified (no legacy inserts; sidebar persists).
- `/today` Control Center uses total stock (not just active vial).
- Remote sign-in + E2E harness safety improved.

Delivered in this change set:

- `/today` now uses the Stitch mockup’s table-based log UX (inline input row, per-row copy affordance, and immediate render after save).
- Event creation now supports explicit `time_hhmm` + `notes` inputs, and the notes are displayed in the log table.
- Control Center is substance-grouped (one card per substance, no SS-31 duplicates), while still showing multiple current-vial bars when multiple in-stock formulations exist.
- Conclusive browser verification was updated to cover the new `/today` flow end-to-end and passed locally.

Evidence:

- E2E PASS: `/tmp/peptaide-e2e-2026-02-10T18-21-04-959Z`
- Visual compare report: `/tmp/peptaide-e2e-2026-02-10T18-21-04-959Z/mockup-compare.html`

## Context and Orientation

Mockups:

- Logging + inventory hub mockup HTML: `mockups/logging_&_inventory_control_hub/code.html`
- Mockup intent summary: `mockups/mockupsinfo.md`

Today page implementation:

- `/today` server component: `web/src/app/(app)/today/page.tsx`
- Legacy log entry UI (kept for now but unused by `/today`): `web/src/app/(app)/today/today-log-grid.tsx` (`TodayLogGrid`)
- Event creation server action: `web/src/app/(app)/today/actions.ts` (`createEventAction`)

Inventory data:

- Formulation-level inventory rollup view: `supabase/migrations/20260210130000_098_inventory_summary_view.sql` (`public.v_inventory_summary`)
- Repo wrapper: `web/src/lib/repos/inventorySummaryRepo.ts` (`listInventorySummary`)

Browser verification:

- Conclusive run harness: `web/scripts/tbrowser/peptaide-e2e.mjs` (agent-browser driven)
- One-off spreadsheet importer: `web/scripts/tbrowser/import-spreadsheetdata.mjs`

## Plan of Work

First, extend the event creation server action so the new UI can save events with a chosen time and notes. The action will accept `time_hhmm` and compute the event timestamp for the profile’s timezone on “today” (the local day in that timezone), then save `notes` into `administration_events.notes`.

Second, replace the logging UI on `/today` by implementing a mockup-derived table component. This component will render existing events in the same table as the active input row. It will keep the existing quick log pill behavior (URL params) but re-target focus and default formulation selection to the inline input row. It will also implement the mockup “copy” affordance to pre-fill the active row.

Third, fix the Control Center duplication by grouping inventory summaries by substance, aggregating total stock values across formulations, and rendering multiple current-vial bars when multiple active vials exist (one per formulation). This removes duplicate cards like SS-31 while preserving the total-stock behavior.

Finally, update the agent-browser E2E harness to match the new UI, ensure we have deterministic coverage for multiple-active-formulation grouping (by extending demo seeding), and keep the existing Stitch visual contracts and mockup compare report.

## Concrete Steps

All commands below are run from `/data/projects/peptaide` unless stated otherwise.

1. Server action support for time + notes.

   - Edit `web/src/app/(app)/today/actions.ts`:
     - Accept `time_hhmm` (optional) and `notes` (optional) from `FormData`.
     - Compute `eventTs` from `time_hhmm` in the profile timezone (today’s local date).
     - Insert `notes` into `administration_events`.
   - Add unit tests under `web/src/lib/` (Vitest) for the timezone conversion helper.

2. Mockup-derived log table UI.

   - Create `web/src/app/(app)/today/today-log-table.tsx` as a client component.
   - Reuse the table and inline input row markup from `mockups/logging_&_inventory_control_hub/code.html`, but wire it up to:
     - `createEventAction` server action,
     - URL params (`focus`, `formulation_id`),
     - dosing recommendation hints via `doseRecommendationsByFormulationId`,
     - row copy actions.
   - Update `web/src/app/(app)/today/page.tsx` to render the new component and remove `TodayLogGrid`.

3. Substance-level Control Center.

   - Update `web/src/app/(app)/today/page.tsx` to group `listInventorySummary(...)` results by `substance_id`.
   - Render one card per substance with total-stock aggregated and multiple current-vial bars.
   - Keep `data-e2e` hooks stable or update the E2E script in the same commit.

4. Deterministic E2E coverage.

   - Update `seedDemoDataAction()` in `web/src/app/(app)/today/actions.ts` to create a second formulation + active vial for the demo substance.
   - Update `web/scripts/tbrowser/peptaide-e2e.mjs` to exercise and assert:
     - inline row save,
     - inline row save via Enter,
     - copy-row,
     - rec hint appears,
     - Control Center shows one card for demo substance but two current-vial bars.

5. Validation.

   - In `web/`:

     - `npm run typecheck`
     - `npm run lint`
     - `npm test`

   - E2E:

     - `node web/scripts/tbrowser/peptaide-e2e.mjs`

## Validation and Acceptance

Acceptance is:

- `/today` no longer contains the “Log (grid)” UI.
- On `/today`, the “Today log” table contains a highlighted inline input row with time, compound selector, dose input, route badge, notes, and a check button.
- Entering a dose + clicking the check button creates an event and adds it to the table immediately.
- Clicking the copy icon on an existing row pre-fills the inline input row with that row’s formulation + dose + notes.
- Control Center renders one card per substance (no duplicates for substances with multiple formulations), while still rendering multiple current-vial bars when multiple active formulations exist.
- `node web/scripts/tbrowser/peptaide-e2e.mjs` passes and produces an updated mockup compare report under `/tmp/peptaide-e2e-.../mockup-compare.html`.

## Idempotence and Recovery

- The logging UI work is confined to `/today` components and can be iterated on without DB resets.
- The time conversion helper is unit tested so failures are detected without needing browser runs.
- E2E remains non-destructive by default (no `supabase db reset` unless `E2E_RESET_DB=1` is set).

## Artifacts and Notes

- Target mockup: `mockups/logging_&_inventory_control_hub/code.html`.
- Target `/today` implementation: `web/src/app/(app)/today/page.tsx`.
- E2E harness: `web/scripts/tbrowser/peptaide-e2e.mjs`.

## Interfaces and Dependencies

New/updated interfaces:

- `createEventAction` (`web/src/app/(app)/today/actions.ts`) accepts optional `time_hhmm` and `notes` in addition to existing fields.
- A new client component (planned: `web/src/app/(app)/today/today-log-table.tsx`) exposes stable selectors for automation:
  - `[data-e2e="today-log-input-time"]`
  - `[data-e2e="today-log-input-formulation"]`
  - `[data-e2e="today-log-input-dose"]`
  - `[data-e2e="today-log-input-notes"]`
  - `[data-e2e="today-log-submit"]`
  - `[data-e2e="today-log-row-copy"]`

Plan revisions:

- (2026-02-10) Revised the ExecPlan to cover the Stitch mockup logging UX and substance-level Control Center grouping (SS-31 de-duplication) and to update browser verification coverage accordingly.
- (2026-02-10) Updated `Progress`, `Surprises & Discoveries`, and `Outcomes & Retrospective` after implementing the mockup-derived `/today` log table + substance-grouped Control Center, extending demo seeding, and passing the conclusive browser verification run.
