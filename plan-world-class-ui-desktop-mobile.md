# World-Class Desktop + Mobile UI/UX Polish Pass

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository's ExecPlan format authority is `.agent/PLANSwHD.md` from the repository root. This plan must be maintained in accordance with it.

## Purpose / Big Picture

Peptaide already has strong core functionality, but several everyday surfaces still feel utilitarian rather than premium. The biggest friction is not missing features, but uneven visual hierarchy, mobile ergonomics, and inconsistent “state design” (loading, empty, and feedback moments).

After this plan, the app should feel cohesive and polished on both desktop and mobile. Desktop should emphasize density, clarity, and confidence for power use. Mobile should emphasize reachability, readable hierarchy, and frictionless navigation. Users should be able to move through sign-in, logging, inventory awareness, and settings workflows with fewer visual dead ends and clearer action affordances.

## Progress

- [x] (2026-02-11 03:40Z) Re-audited UI architecture and identified the highest leverage surfaces for a premium redesign pass: app shell header, settings/hub navigation model, `/today` visual hierarchy, and shared loading/empty feedback primitives.
- [x] (2026-02-11 03:40Z) Created this ExecPlan and anchored scope to a desktop/mobile split so implementation choices are modality-specific, not one-size-fits-all.
- [x] (2026-02-11 03:55Z) Implemented app shell redesign in `web/src/app/(app)/layout.tsx` plus supporting updates in `web/src/components/command-palette.tsx` and `web/src/components/notifications/notifications-bell.tsx` to improve brand presence, control hierarchy, and compact/mobile ergonomics.
- [x] (2026-02-11 03:55Z) Replaced narrow mobile settings sidebar behavior with a dedicated mobile-first hub top navigation rail while preserving desktop persistent sidebar (`web/src/components/settings-hub/sidebar.tsx`, `web/src/app/(app)/(hub)/layout.tsx`), and fixed settings mobile editor ergonomics in `web/src/app/(app)/(hub)/settings/page.tsx`.
- [x] (2026-02-11 03:55Z) Upgraded `/today` information architecture and card polish in `web/src/app/(app)/today/page.tsx` and made `TodayLogTable` more mobile-usable with responsive column visibility (`web/src/app/(app)/today/today-log-table.tsx`).
- [x] (2026-02-11 03:55Z) Improved shared visual primitives by adding `web/src/components/ui/empty-state.tsx`, enhancing skeleton shimmer and toast motion (`web/src/components/ui/skeleton.tsx`, `web/src/components/toast/toast-provider.tsx`, `web/src/app/globals.css`), and applying empty states across hub pages.
- [x] (2026-02-11 03:55Z) Polished sign-in in `web/src/app/(auth)/sign-in/page.tsx` and `web/src/app/(auth)/sign-in/sign-in-form.tsx` for stronger trust and clearer OTP flow framing.
- [x] (2026-02-11 03:55Z) Validation completed:
  - `cd web && npm run typecheck`
  - `cd web && npm run lint`
  - `cd web && npm test`
  - `node web/scripts/tbrowser/peptaide-e2e.mjs` (PASS, artifacts: `/tmp/peptaide-e2e-2026-02-11T03-50-06-950Z`)

## Surprises & Discoveries

- Observation: The app already has a robust browser harness (`web/scripts/tbrowser/peptaide-e2e.mjs`) with broad interaction coverage. This makes it practical to do meaningful visual interaction changes while keeping workflow risk low.
  Evidence: Existing test harness scripts and prior successful artifact runs in `/tmp/peptaide-e2e-*`.

- Observation: Mobile settings navigation quality is currently constrained by sidebar-first architecture. Improving this likely requires an explicit mobile nav component rather than incremental class changes.
  Evidence: Current sidebar implementation in `web/src/components/settings-hub/sidebar.tsx` and mobile screenshots where navigation intrudes into content width.

- Observation: The old fixed-height settings toolbar and fixed-width right editor are major contributors to mobile clipping and overlap; converting the toolbar to wrapped rows and the editor to an overlay sheet resolves this without introducing route-level complexity.
  Evidence: Updated `web/src/app/(app)/(hub)/settings/page.tsx` behavior under the conclusive mobile sweep and manual screenshot diffs in `/tmp/peptaide-e2e-2026-02-11T03-50-06-950Z`.

## Decision Log

- Decision: Focus this pass on high-leverage structural components first (shell/header, navigation model, `/today`) before touching every individual form page.
  Rationale: Structural polish improves the entire product feel immediately and consistently, and avoids piecemeal styling divergence.
  Date/Author: 2026-02-11 / Codex

- Decision: Apply desktop and mobile improvements intentionally and separately, not by simply shrinking desktop layouts.
  Rationale: The user requested modality-specific optimization, and this is required for truly premium ergonomics.
  Date/Author: 2026-02-11 / Codex

- Decision: Use a mobile top navigation rail (horizontal chips) for hub pages instead of a collapsible/overlay left drawer.
  Rationale: It keeps route switching one-tap and preserves content width while avoiding extra state machinery in the shell.
  Date/Author: 2026-02-11 / Codex

- Decision: Keep `/today` as a single canonical log table and make it responsive by hiding lower-priority columns on smaller viewports instead of creating a second mobile-only logging component.
  Rationale: This avoids dual-maintenance while materially improving mobile readability and preserving test coverage stability.
  Date/Author: 2026-02-11 / Codex

## Outcomes & Retrospective

- (2026-02-11) Delivered a modality-aware UI polish pass that materially improved perceived quality without changing core behavior. Desktop now has stronger shell hierarchy and visual rhythm; mobile now has dedicated hub navigation and less clipping in settings/substance editing.
- System states were elevated from utilitarian to intentional through a reusable empty-state primitive, shimmer skeleton improvements, and updated toast presentation/placement.
- `/today` now has cleaner section framing and better mobile table usability via responsive column visibility while keeping all existing logging flows intact.
- Validation passed end-to-end with full browser workflow coverage (including mobile page sweeps), confirming no functional regressions.

## Context and Orientation

The frontend is a Next.js App Router app in `web/src/app`. The authenticated shell lives in `web/src/app/(app)/layout.tsx`. Settings and operational pages use a shared hub layout in `web/src/app/(app)/(hub)/layout.tsx` with the left navigation in `web/src/components/settings-hub/sidebar.tsx`. The primary daily workflow page is `web/src/app/(app)/today/page.tsx`.

Reusable feedback primitives already exist: `web/src/components/ui/skeleton.tsx`, `web/src/components/toast/toast-provider.tsx`, and notifications in `web/src/components/notifications/notifications-bell.tsx`.

Authentication entry is `web/src/app/(auth)/sign-in/page.tsx` and `web/src/app/(auth)/sign-in/sign-in-form.tsx`, which currently works but lacks the same premium visual treatment as in-app surfaces.

## Plan of Work

I will first redesign the global app shell header so branding, context, and utility actions are cleaner and better balanced on desktop and mobile. This includes tightening spacing, improving hierarchy of controls, and making the top bar feel intentionally composed.

Next, I will split settings/hub navigation into desktop and mobile modes. Desktop keeps persistent left navigation. Mobile gets an explicit, dedicated navigation pattern that preserves content width and improves discoverability and reachability.

Then I will tune `/today` for better hierarchy and polish: clearer section framing, more intentional card depth and spacing, more legible data rhythm, and stronger action emphasis where users make decisions (quick log, inventory cards, control actions).

After that, I will improve shared system-state primitives. Skeletons will get better perceived loading quality, toasts will gain higher visual polish, and reusable empty-state treatment will be introduced and applied to the most visible views.

Finally, I will polish the sign-in entry surface and run full quality checks plus browser E2E to ensure workflows still pass under the new UI.

## Concrete Steps

All commands are run from `/data/projects/peptaide` unless noted.

1. Edit core shell and navigation files.
   - `web/src/app/(app)/layout.tsx`
   - `web/src/app/(app)/(hub)/layout.tsx`
   - `web/src/components/settings-hub/sidebar.tsx`

2. Edit primary workflow and shared visual primitives.
   - `web/src/app/(app)/today/page.tsx`
   - `web/src/components/ui/skeleton.tsx`
   - `web/src/components/toast/toast-provider.tsx`
   - add reusable empty-state component under `web/src/components/ui/` and integrate into key pages.

3. Edit auth entry polish.
   - `web/src/app/(auth)/sign-in/page.tsx`
   - `web/src/app/(auth)/sign-in/sign-in-form.tsx`

4. Validate and capture results.
   - `cd web && npm run typecheck`
   - `cd web && npm run lint`
   - `cd web && npm test`
   - `node web/scripts/tbrowser/peptaide-e2e.mjs`

5. Update this plan with surprises, decisions, and outcomes discovered during implementation.

## Validation and Acceptance

This plan is complete when:

- The authenticated shell feels visually premium and coherent at both desktop and mobile sizes.
- Settings/hub navigation is explicitly optimized for mobile without sacrificing desktop efficiency.
- `/today` has improved scanability, visual hierarchy, and action clarity while preserving existing functionality.
- Loading, empty, and toast states look intentional and consistent with the app’s theme.
- Sign-in visually aligns with the rest of the product.
- Typecheck, lint, tests, and browser E2E all pass.

## Idempotence and Recovery

All changes are frontend and styling/interaction focused with no schema or migration changes. If a UI change causes regressions, the work can be reverted commit-by-commit safely. E2E screenshots and logs provide quick diagnosis points without destructive recovery steps.

## Artifacts and Notes

Primary artifact paths expected after validation:

- Browser E2E artifact root: `/tmp/peptaide-e2e-2026-02-11T03-50-06-950Z/`
- Core UI files touched:
  - `web/src/app/(app)/layout.tsx`
  - `web/src/app/(app)/(hub)/layout.tsx`
  - `web/src/components/settings-hub/sidebar.tsx`
  - `web/src/app/(app)/today/page.tsx`
  - `web/src/components/ui/skeleton.tsx`
  - `web/src/components/toast/toast-provider.tsx`
  - `web/src/app/(auth)/sign-in/page.tsx`
  - `web/src/app/(auth)/sign-in/sign-in-form.tsx`

Plan revision note (2026-02-11, initial): Created this ExecPlan to drive a dedicated world-class desktop+mobile polish pass requested by the user, with explicit modality-specific design goals.
Plan revision note (2026-02-11, implementation): Updated all living sections after delivery, recorded decisions made during execution, and attached concrete validation evidence/artifacts so the plan is restartable and auditable.
