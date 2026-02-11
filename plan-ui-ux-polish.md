# Premium UI/UX Polish + Guidelines Compliance

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository's ExecPlan format authority is `.agent/PLANSwHD.md` from the repository root. This plan must be maintained in accordance with it.

## Purpose / Big Picture

Peptaide already has the core product surfaces working (logging, inventory, reference data, import/export), but it still has several “MVP-looking” seams that make the experience feel less coherent and less premium than the Stitch mockups and the `/today` hub.

After this plan, the UI should feel consistent and “Stripe-level” in the ways that matter most for a daily-use tool:

1. Theming consistency: `/setup` and `/analytics` visually match the Stitch-style surfaces (tokens, spacing, cards, typography) and do not look like legacy scaffolding pages.
2. Interaction polish: keyboard focus is always visible (but not noisy on mouse click), icon-only controls are labeled for accessibility, and animations avoid `transition-all`.
3. Locale correctness: user-visible numbers and currency use `Intl.NumberFormat` instead of manual string formatting.
4. Conclusive verification: the existing conclusive browser harness (`web/scripts/tbrowser/peptaide-e2e.mjs`) continues to cover the primary workflows and captures screenshots for the key pages at desktop and mobile viewports so regressions are observable.

## Progress

- [x] (2026-02-11 00:40Z) Refreshed the Vercel Web Interface Guidelines via Firecrawl so audit output and fixes are based on current rules. Evidence: `firecrawl scrape https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md -o .firecrawl/web-interface-guidelines-command.md`.
- [x] (2026-02-11 00:40Z) Repo state audit: identified current uncommitted UI polish changes (10 files) and confirmed existing conclusive browser harness already sweeps `/setup` and `/analytics` and deeply exercises `/settings` and `/today`. Evidence: `git status --porcelain=v1` and inspection of `web/scripts/tbrowser/peptaide-e2e.mjs`.

- [x] (2026-02-11 00:46Z) Commit the current uncommitted UI polish changes (ellipsis fixes, `color-scheme`, `theme-color`, mobile hub sidebar collapse, and the `/analytics` restyle) so they are not lost and so future diffs stay reviewable. Evidence: commit `7a65753`.
- [x] (2026-02-11 00:51Z) Restyle `/setup` to match the Stitch theme tokens (surface cards, slate/gray typography, spacing) and remove remaining `bg-white`/`text-zinc-*` scaffolding look. Evidence: commit `a501970`.
- [x] (2026-02-11 00:51Z) Fix `/analytics` number + currency formatting to use `Intl.NumberFormat` (no manual `$${n.toFixed(2)}`), while keeping the current table layout. Evidence: commit `a501970`.
- [x] (2026-02-11 01:11Z) Focus and accessibility pass:
  - add a skip link in `web/src/app/(app)/layout.tsx` (keyboard users can jump to main content),
  - replace focus styling in key inputs/buttons to use `focus-visible:*` rings (keep border focus if useful),
  - ensure icon-only controls have `aria-label` (especially any header-only icons).
- [x] (2026-02-11 01:11Z) Animation pass: replaced all remaining `transition-all` usages in `web/src/` with `transition-colors` to avoid accidental layout transitions.
- [x] (2026-02-11 01:11Z) Validation: ran web quality gates and the conclusive browser harness.
  - `cd web && npm run typecheck`
  - `cd web && npm run lint`
  - `cd web && npm test`
  - `E2E_BASE_URL=http://127.0.0.1:3010 node web/scripts/tbrowser/peptaide-e2e.mjs` (PASS, artifacts: `/tmp/peptaide-e2e-2026-02-11T01-05-28-607Z`)

## Surprises & Discoveries

- Observation: The project already has a strong, “conclusive” E2E harness that sweeps key pages and fails on console/network errors, plus a mockup compare report for `/today` and `/settings`. This is a good backbone for UI polish work, because it makes regressions visible without adding heavyweight snapshot infra.
  Evidence: `web/scripts/tbrowser/peptaide-e2e.mjs` (see `sweepPages(...)` and `writeMockupCompareReport()`).

- Observation: `next dev` using Turbopack can crash in this environment with `Too many open files (os error 24)`, which breaks conclusive E2E runs if we rely on a dev server.
  Evidence: Turbopack panic log path `/tmp/next-panic-acfd0f6908ed27b40552d7421a380652.log` (seen when starting `npm run dev -p 3010`).

- Observation: Next.js 16 warns when `themeColor` is configured under `metadata`; it expects `export const viewport = { themeColor: ... }`.
  Evidence: `npm run build` emitted warnings until `web/src/app/layout.tsx` was updated to use the `viewport` export.

## Decision Log

- Decision: Treat the Stitch token system in `web/src/app/globals.css` (`bg-surface-*`, `border-border-*`, etc.) as the single source of truth for page-level styling, and restyle outliers (`/setup`, `/analytics`) to match it rather than inventing new page-specific themes.
  Rationale: “Premium” comes from consistency more than novelty; keeping everything on the same token rails prevents Frankenstein merges.
  Date/Author: 2026-02-11 / Codex

- Decision: Prefer small, mechanical refactors for guideline compliance (`transition-all` removal, `focus-visible` rings, `Intl.NumberFormat`) before any “visual redesign” work.
  Rationale: These changes are high impact, low risk, and are directly recommended by the guidelines; they improve perceived quality without re-laying out the app.
  Date/Author: 2026-02-11 / Codex

## Outcomes & Retrospective

- (2026-02-11) Delivered: `/setup` and `/analytics` now match the Stitch-style token system, user-visible numeric formatting on `/today`, `/analytics`, `/orders`, and `/cycles` uses `Intl.NumberFormat`, focus rings are `focus-visible` on key controls (plus a skip link), and `transition-all` has been eliminated in `web/src/`. Conclusive browser verification passed and produced updated sweep screenshots and mockup compare output under `/tmp/peptaide-e2e-2026-02-11T01-05-28-607Z/`.

## Context and Orientation

Frontend stack:

- Next.js App Router lives under `web/src/app/`.
- Global theme tokens are defined in `web/src/app/globals.css` under `@theme inline` (for example: `bg-surface-light dark:bg-surface-dark`).
- The “settings hub” layout with a persistent left sidebar is under `web/src/app/(app)/(hub)/layout.tsx` and `web/src/components/settings-hub/sidebar.tsx`.

Key pages in this plan:

- `/setup`: `web/src/app/(app)/setup/page.tsx` (server component, uses several hub forms).
- `/analytics`: `web/src/app/(app)/analytics/page.tsx` (server component, table summaries).
- App shell layout: `web/src/app/(app)/layout.tsx` (header + main container).

Conclusive browser verification:

- The harness is `web/scripts/tbrowser/peptaide-e2e.mjs`.
- It signs in via Supabase OTP + Mailpit, exercises core CRUD flows, and sweeps major pages at desktop and mobile viewports, taking screenshots under `/tmp/peptaide-e2e-.../`.

Guideline baseline (embedded here so the plan is self-contained):

- Never use `transition: all` / Tailwind `transition-all`. Prefer `transition-colors`, `transition-shadow`, `transform`, and `opacity` animations.
- Interactive elements must have visible keyboard focus, preferably using `:focus-visible` so focus rings do not appear on mouse click.
- Icon-only controls require `aria-label`.
- Numbers and currency should use `Intl.NumberFormat` instead of manual `toFixed` or `$` concatenation.
- Dark themes should set `color-scheme: dark` on `<html>` and set a matching `<meta name="theme-color">`.

## Plan of Work

First, land the existing uncommitted polish work as an atomic commit so subsequent changes are easy to isolate and review.

Second, restyle `/setup` and finish bringing it onto the Stitch token system. The content and flows remain the same; only layout, card surfaces, and typography should change.

Third, update `/analytics` number and currency formatting to use `Intl.NumberFormat` and ensure table numeric columns keep `tabular-nums`.

Fourth, do a focused accessibility and interaction pass: add a skip link in the app layout, ensure icon-only buttons are labeled, and standardize focus rings using `focus-visible` (starting with the app shell, command palette, and settings search inputs).

Finally, remove `transition-all` from the touched surfaces and run the full validation suite including the conclusive browser harness.

## Concrete Steps

All commands below are run from `/data/projects/peptaide` unless stated otherwise.

1. Commit current work.

   - Inspect: `git diff`
   - Commit: `git commit -am "style: polish theme consistency + copy"`, then `git commit` for any new files if needed.

2. Restyle `/setup`.

   - Edit `web/src/app/(app)/setup/page.tsx`:
     - Wrap the page content in a max-width container with consistent padding (match `/analytics`).
     - Replace `text-zinc-*` with the app’s slate/gray palette used elsewhere.
     - Replace `bg-white` scaffolding callouts/cards with `bg-surface-light dark:bg-surface-dark` (or a subtle tinted surface consistent with the hub).
     - Update the model coverage table to match the restyled `/analytics` table style: `tabular-nums`, consistent borders, and dark-mode-safe status pills.

3. Fix `/analytics` formatting.

   - Edit `web/src/app/(app)/analytics/page.tsx`:
     - Replace `formatNumber(...)` / `formatMoney(...)` to use `Intl.NumberFormat`.
     - Keep the restyled structure (cards, headers, `tabular-nums`).

4. Focus + accessibility pass.

   - Edit `web/src/app/(app)/layout.tsx`:
     - Add a skip link targeting the main content container (for example `href="#main-content"`).
     - Ensure icon-only controls (settings, notifications) have `aria-label` (keep existing labels where present).
   - Edit `web/src/components/command-palette.tsx`:
     - Add a visible focus treatment for the open button and the palette container (use `focus-visible` or `focus-within`).
   - Edit the settings search input in `web/src/app/(app)/(hub)/settings/page.tsx` to use `focus-visible:ring-*` (not `focus:ring-*`) and avoid `transition-all`.

5. Animation cleanup.

   - Replace `transition-all` with `transition-colors` in the files touched by this plan (at minimum the settings search input and any hub input controls in the surfaced paths).

6. Validation.

   - In `web/`:
     - `npm run typecheck`
     - `npm run lint`
     - `npm test`
   - E2E:
     - `node web/scripts/tbrowser/peptaide-e2e.mjs`

## Validation and Acceptance

This plan is accepted when:

- `/setup` visually matches the Stitch token system (no “white page with zinc text” scaffolding feel) and remains fully functional.
- `/analytics` uses `Intl.NumberFormat` for numbers and USD spend, and the page remains readable in dark mode.
- Keyboard navigation shows visible focus rings on key controls without noisy rings on mouse click (use `:focus-visible`).
- `node web/scripts/tbrowser/peptaide-e2e.mjs` passes, and the artifacts folder contains updated screenshots for `/setup`, `/analytics`, `/settings`, and `/today`.

## Idempotence and Recovery

- All UI changes are additive and CSS/class-based; they can be iterated safely without DB changes.
- If E2E fails due to local port conflicts, run Next.js on a different port and re-run with `E2E_BASE_URL=http://127.0.0.1:<port>`.
- If the conclusive harness fails mid-run, it will have already written screenshots under `/tmp/peptaide-e2e-.../` that can be used to diagnose the regression.

## Artifacts and Notes

- Conclusive E2E harness: `web/scripts/tbrowser/peptaide-e2e.mjs`
- Mockup compare report (generated by harness): `/tmp/peptaide-e2e-.../mockup-compare.html`
- Setup page: `web/src/app/(app)/setup/page.tsx`
- Analytics page: `web/src/app/(app)/analytics/page.tsx`
