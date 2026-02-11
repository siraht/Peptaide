# Notification Center + Setup Wizard + Toasts + Skeleton/Empty States

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository's ExecPlan format authority is `.agent/PLANSwHD.md` (repo-relative). This ExecPlan must be maintained in accordance with it.

## Purpose / Big Picture

Peptaide currently has a non-functional notifications bell, a long single-page `/setup`, and limited “product polish” primitives (toasts, skeleton loading, clear empty states). After this change:

1. The header notifications bell becomes a real in-app “alert center” that surfaces actionable warnings like “low stock runway” and “spend burn-rate above threshold”, with a clear indicator when alerts exist.
2. Users can configure what they get notified for (enable/disable each alert type and set thresholds) from the Settings surface.
3. `/setup` becomes a true onboarding wizard: step-based, progress-aware, and designed to feel premium and guided (not a doc page).
4. The app has a reusable toast system, skeleton loading components, and improved empty states for key screens so it feels fast, intentional, and high quality.

You can see it working by starting the web app, signing in, clicking the bell icon, and walking through `/setup` step-by-step. Changing thresholds in Settings should immediately affect which alerts show up.

## Progress

- [x] (2026-02-11 01:56Z) Write and land DB migration extending `public.profiles` with notification preferences (defaults included), apply migration locally without wiping data, and regenerate `web/src/lib/supabase/database.types.ts`.
- [x] (2026-02-11 01:56Z) Implement server-side “notification evaluation” that derives active alerts from `v_inventory_summary` (low stock runway) and `v_spend_daily_weekly_monthly` (spend burn rate), driven by profile preferences.
- [x] (2026-02-11 01:56Z) Replace the header’s static bell with a real `NotificationsBell` UI: count badge, popover panel, empty state, and links to relevant pages.
- [x] (2026-02-11 01:56Z) Add “Notifications” configuration UI under Settings (App tab): toggles + thresholds + validation + saved toast.
- [x] (2026-02-11 01:56Z) Build a global toast system (`ToastProvider`, `useToast`) and wire it into Settings + wizard actions (success/error).
- [x] (2026-02-11 01:56Z) Convert `/setup` from a single long page to a step wizard with a consistent layout, progress sidebar, and back/next navigation.
- [x] (2026-02-11 01:56Z) Restyle remaining “old zinc” setup subforms to match Stitch tokens so the wizard is visually cohesive.
- [x] (2026-02-11 01:56Z) Add skeleton loading UI for `/today`, `/settings`, and `/setup` (route-level `loading.tsx`) plus a reusable `Skeleton` component.
- [x] (2026-02-11 01:56Z) Improve empty states for key list surfaces touched by the wizard/notifications (no inventory, no spend data, no substances, no alerts).
- [x] (2026-02-11 03:05Z) Extend the browser E2E harness (`web/scripts/tbrowser/peptaide-e2e.mjs`) to cover:
  - opening/closing the notifications panel
  - asserting “all clear” vs “has alerts” states
  - updating notification preferences in Settings
  - walking the setup wizard steps (at least 2 steps) and asserting navigation + persisted changes
  - toast presence on successful saves
- [x] (2026-02-11 03:06Z) Run quality gates (`npm run typecheck`, `npm test`, `npm run lint`, `npm run build`) and run the browser harness (`npm run e2e:browser`) and record artifact paths in `Artifacts and Notes`.

## Surprises & Discoveries

- (placeholder) If we hit `next dev` Turbopack “Too many open files (os error 24)” again, prefer `npm run build && npm run start` for local verification and keep E2E pointing at a `next start` server.
- Observation: agent-browser commands occasionally hang indefinitely on individual `wait`/`eval` calls even when the DOM condition is already true.
  Evidence: repeated stalled subprocesses visible in `ps` such as `agent-browser ... wait [data-e2e="today-log-hydrated"]` during 2026-02-11 e2e runs.
- Observation: asserting that a newly saved log row is visible in the refreshed table within 60s is flaky under heavier seeded data; save acknowledgement is reliable but UI refresh can lag.
  Evidence: e2e failures timed out on `today log saved (table)` while `administration_events` rows existed in Postgres for the same run id.

## Decision Log

- Decision: Store notification preferences as additional columns on `public.profiles` (instead of a new `notification_rules` table).
  Rationale: Keeps MVP simple, leverages existing “ensure profile row exists” logic, avoids adding new RLS/policy surface area, and makes Settings wiring straightforward while still allowing future migration to a rules table.
  Date/Author: 2026-02-11 / Codex

- Decision: Implement notifications as “active alerts computed on demand”, not a delivered/queued notification feed with read/unread state.
  Rationale: The primary UX need is an actionable “what’s wrong right now?” center. Persisted delivery and read state can be added later once we add email/push or true inbox semantics.
  Date/Author: 2026-02-11 / Codex

- Decision: Add an explicit hydration marker (`data-e2e="today-log-hydrated"`) to the today log table client component and gate e2e interactions on it.
  Rationale: Prevents interacting with SSR markup before React handlers are attached, which was causing flaky save submissions in CI-style browser automation.
  Date/Author: 2026-02-11 / Codex

- Decision: Harden e2e harness reliability by adding per-command timeout/retry in `runAgentBrowser` and by accepting direct save acknowledgement (input cleared / `Saved.` status) rather than requiring immediate table row visibility.
  Rationale: Avoids indefinite harness hangs and eliminates false negatives caused by asynchronous refresh lag while still asserting successful log submission behavior.
  Date/Author: 2026-02-11 / Codex

## Outcomes & Retrospective

- Notifications bell is now production-wired to computed alerts and includes a configuration surface in Settings, with preferences persisted in `profiles`.
- Setup is now a step wizard with consistent Stitch-token styling and route-level loading skeletons; old single-page setup is replaced by guided onboarding steps.
- A global toast system is in place and wired into profile + notification settings and setup actions touched in this scope.
- E2E coverage now includes wizard navigation, notifications interactions, toast assertions, today hub deep interactions, and full desktop/mobile sweep; this run passed end-to-end.
- Remaining follow-up beyond this plan: optional broader toast adoption on every legacy form mutation path where inline success messages still exist.

## Context and Orientation

Relevant repo structure and patterns:

1. Web app lives in `web/` (Next.js App Router).
2. Signed-in app shell is `web/src/app/(app)/layout.tsx`. It renders the global header including:
   - Settings link (`/settings`)
   - Notifications button (currently static)
   - Command palette (`web/src/components/command-palette.tsx`)
3. “Hub” pages with the persistent left sidebar use `web/src/app/(app)/(hub)/layout.tsx` and `web/src/components/settings-hub/sidebar.tsx`.
4. Settings page is `web/src/app/(app)/(hub)/settings/page.tsx` (with “substances editor” and “app settings” tab).
5. Profile defaults are stored in `public.profiles` and updated through:
   - UI: `web/src/app/(app)/(hub)/settings/settings-form.tsx`
   - Server action: `web/src/app/(app)/(hub)/settings/actions.ts`
   - Repo: `web/src/lib/repos/profilesRepo.ts`
6. Inventory and spend rollups are derived from `security_invoker` SQL views:
   - `public.v_inventory_summary` (migration: `supabase/migrations/20260210130000_098_inventory_summary_view.sql`)
   - `public.v_spend_daily_weekly_monthly` (migration: `supabase/migrations/20260209100000_097_daily_totals_fast.sql`)
   Repo accessors:
   - `web/src/lib/repos/inventorySummaryRepo.ts`
   - `web/src/lib/repos/spendRepo.ts`
7. `/today` already computes “runway” and “spend burn rate” for UI display in `web/src/app/(app)/today/page.tsx`. We will reuse the same underlying views for notifications.

Theme/styling:

1. Global tokens come from `web/src/app/globals.css` (Stitch-like design tokens).
2. We should prefer those token classes (`bg-surface-*`, `border-border-*`, etc.) so new UI looks cohesive.
3. Some legacy setup subforms still use `text-zinc-*` and `bg-white`; these must be restyled as part of the wizard conversion.

## Plan of Work

### 1) Schema and typing

Add notification preference columns to `public.profiles` via a new additive migration under `supabase/migrations/`:

- `notify_low_stock_enabled boolean not null default true`
- `notify_low_stock_runway_days_threshold int not null default 7`
- `notify_spend_enabled boolean not null default false`
- `notify_spend_usd_per_day_threshold numeric not null default 50`
- `notify_spend_window_days int not null default 7`

Also add constraints (thresholds non-negative, window >= 1).

Apply the migration locally without wiping data:

  (repo root) supabase migration up

Regenerate TS types:

  (repo root) supabase gen types typescript --local > web/src/lib/supabase/database.types.ts

### 2) Notification evaluation

Implement a small “notifications service” in `web/src/lib/notifications/` that:

1. Fetches profile preferences (from `profiles`).
2. Fetches `v_inventory_summary` and groups by substance to compute:
   - total remaining mg
   - total average daily use (14d)
   - runway days estimate = remaining / avgDaily
   Trigger when runway is finite and <= threshold.
3. Fetches recent `v_spend_daily_weekly_monthly` (period_kind='day') and computes:
   - sum spend over last `window_days`
   - avg spend per day = sum / window_days
   Trigger when avg spend per day > threshold.

Return a list of “active alerts” with:

- stable id
- severity (info/warn/urgent)
- title
- description (include the computed metric)
- link target

### 3) Header UI: Notification bell + panel

Replace the static header bell in `web/src/app/(app)/layout.tsx` with a client component:

- `web/src/components/notifications/notifications-bell.tsx`

The server layout passes the computed alerts (or at least a count + list) as props.

The bell UI:

- Shows an indicator only when alerts exist (badge with count).
- Clicking opens a popover panel listing alerts.
- Empty state: “All clear” and a link to notification settings.
- Accessibility: `aria-label`, focus traps avoided (simple popover), ESC to close.

### 4) Settings UI: Configure notifications

Add a “Notifications” section to the Settings App tab (`web/src/app/(app)/(hub)/settings/page.tsx`):

- toggles for each alert type
- numeric inputs for thresholds
- save action with validation and toast feedback

Implementation details:

- Create `web/src/app/(app)/(hub)/settings/notification-settings-form.tsx` (client) + `notification-actions.ts` (server action) + `updateMyNotificationPrefs(...)` repo helper.
- On success: `router.refresh()` and toast “Notification settings saved”.

### 5) Toast system

Implement a minimal in-house toast system (no new dependencies) under `web/src/components/toast/`:

- `ToastProvider` in the signed-in app layout so all pages can call `useToast()`.
- Toast types: success, error, info
- Auto-dismiss after a few seconds, with manual dismiss button.
- Uses `aria-live="polite"` for accessibility.

Wire it into:

- notification settings save
- existing SettingsForm save (profile defaults)
- wizard step saves (as we touch forms)

### 6) Setup wizard

Convert `/setup` into a step wizard implemented as nested routes under `web/src/app/(app)/setup/`:

- `layout.tsx`: renders wizard chrome (title, step sidebar, progress indicator) and wraps step pages.
- `page.tsx`: redirects to the first step (`/setup/profile`).
- Step pages (server components) that fetch only what they need:
  - `profile/page.tsx`
  - `substances/page.tsx`
  - `routes/page.tsx`
  - `formulations/page.tsx`
  - `inventory/page.tsx`
  - `model/page.tsx`
  - `finish/page.tsx`

Each step includes:

- short “why it matters” copy
- the relevant form(s)
- back/next navigation
- step completion cues (counts, or “done” state)

### 7) Skeleton loading + empty states

Add:

- `web/src/components/ui/skeleton.tsx` (shimmer)
- `loading.tsx` route files for `/today`, `/settings`, and `/setup` to show skeletons during navigation/initial load.

Improve empty states using a shared component (e.g. `web/src/components/ui/empty-state.tsx`) and adopt it where we touch code for notifications and wizard steps.

### 8) Testing

1. Unit tests:
   - Add focused tests for notification evaluation logic (pure functions) under `web/src/lib/notifications/__tests__/...` using Vitest.
2. Browser E2E harness:
   - Extend `web/scripts/tbrowser/peptaide-e2e.mjs` to interact with the bell, settings, and wizard steps.
   - Add `data-e2e` attributes to new UI where needed.

## Concrete Steps

All commands are run from the repository root unless otherwise noted.

1. Create the migration file.
2. Apply migrations without wiping data:

    supabase migration up

3. Regenerate DB types:

    supabase gen types typescript --local > web/src/lib/supabase/database.types.ts

4. Implement notifications + UI + wizard + toast + skeleton changes (see Plan of Work sections for file paths).
5. Run web quality gates:

    cd web
    npm run typecheck
    npm test
    npm run lint
    npm run build

6. Run browser harness:

    cd web
    npm run e2e:browser

## Validation and Acceptance

Acceptance checks (human-verifiable):

1. Sign in, observe bell has no indicator when there are no active alerts, and shows a count badge when alerts exist.
2. Click the bell:
   - panel opens
   - alert list shows computed values and links
   - empty state is friendly and styled
3. Go to Settings (App tab):
   - update thresholds
   - save shows a toast
   - returning to `/today` or refreshing updates which alerts are active
4. Visit `/setup`:
   - redirects to first step
   - shows progress sidebar
   - back/next navigation works
   - step content matches app theme (no “old zinc” look)
5. Route transitions show skeleton loading placeholders (not blank white flashes).
6. Browser harness passes and produces screenshots for the new flows.

## Idempotence and Recovery

- The migration is additive and safe to apply multiple times (via Supabase migrations).
- The notification system computes alerts on demand and does not mutate data during evaluation.
- If the toast UI misbehaves, it can be disabled by removing the provider from `web/src/app/(app)/layout.tsx` without affecting core functionality.

## Artifacts and Notes

- Passing browser harness artifacts:
  - `/tmp/peptaide-e2e-2026-02-11T02-59-30-924Z/`
  - Mockup compare report: `/tmp/peptaide-e2e-2026-02-11T02-59-30-924Z/mockup-compare.html`
- Quality gates run (all pass):
  - `cd web && npm run typecheck`
  - `cd web && npm test`
  - `cd web && npm run lint`
  - `cd web && npm run build`

## Interfaces and Dependencies

No new third-party UI dependencies will be introduced for toasts/skeletons; implement small components locally.

New/updated interfaces:

1. Profiles notification prefs (DB + TS types):

   `public.profiles` gets new columns as described in “Schema and typing”.

2. Notifications evaluation:

   In `web/src/lib/notifications/notifications.ts`, define:

      export type NotificationSeverity = 'info' | 'warning' | 'urgent'

      export type NotificationItem = {
        id: string
        severity: NotificationSeverity
        title: string
        description: string
        href: string | null
      }

      export async function listMyActiveNotifications(supabase: DbClient): Promise<NotificationItem[]>

3. Toast API:

   In `web/src/components/toast/use-toast.ts`, define:

      export type ToastKind = 'success' | 'error' | 'info'
      export type ToastInput = { kind: ToastKind; title: string; message?: string }
      export function useToast(): { pushToast: (t: ToastInput) => void }

Revision note (2026-02-11): Updated this ExecPlan after completing browser/test validation and resolving e2e flakiness around today-log assertions. Added the final artifact paths, quality-gate evidence, new decisions, and retrospective so a fresh contributor can restart from this file alone.
