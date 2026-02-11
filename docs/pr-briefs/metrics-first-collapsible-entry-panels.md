# PR Brief: Metrics-First UX with Collapsible Data-Entry Panels (Non-Logging Pages)

## Goal
Adopt a consistent interaction model across non-logging pages:
- primary surface shows insights/metrics/charts/status first
- data-entry forms are minimized/collapsed by default and expanded on demand

Initial explicit target: `/orders` cards (`Quick import`, `Add vendor`, `Add order`, etc.) should be minimized by default in a distinctive, easy-to-use pattern.
Then apply the same lens across all settings/hub pages.

## Problem to Solve
Many pages currently front-load form blocks, which increases visual weight and hides insights. The product should feel analytics-first, with data entry available when intentionally invoked.

## Scope
This brief covers a multi-page UX pass. Logging page (`/today`) is excluded from this default-collapse rule.

Primary pages to audit and update:
- `/orders`
- `/inventory`
- `/cycles`
- `/substances`
- `/routes`
- `/formulations`
- `/devices`
- `/distributions`
- `/evidence-sources`
- `/settings?tab=app`
- setup wizard pages under `/setup/*` (preserve wizard progress clarity while reducing passive form clutter)

## UX Requirements
- Introduce a reusable "compact module" interaction pattern:
  - collapsed header with title + key status metrics + expand affordance
  - smooth expand/collapse transition
  - clear "open editor" and "close editor" controls
- On `/orders`, each existing action card starts collapsed, showing concise summary stats (counts, most recent activity, total value where available).
- For each non-logging page, default viewport should emphasize insights and operational state over inputs.
- Empty states should include a direct CTA to expand/create.
- Mobile behavior must avoid tall initial form stacks and keep first screen meaningful.

## Implementation Strategy
Use phased implementation to reduce risk:
1. Build reusable collapsible module component and instrument `/orders`.
2. Apply to remaining hub/settings pages with per-page metric summaries.
3. Tune mobile spacing/interaction and animation performance.

## Technical Notes
Likely file touchpoints:
- orders feature files under `web/src/app/(app)/(hub)/orders/*`
- hub pages under `web/src/app/(app)/(hub)/*/page.tsx`
- reusable UI component(s) under `web/src/components/`
- optional persisted preference state (local storage or profile-level) if needed

Ensure compatibility with current toasts, loading skeletons, and notification patterns.

## Acceptance Criteria
- `/orders` action cards are collapsed by default with an intuitive expansion pattern.
- Non-logging pages default to metrics/insights-first composition.
- Forms remain fully functional when expanded.
- Visual behavior is coherent across desktop and mobile.

## Testing Requirements
- Add browser tests for:
  - default collapsed state on `/orders`
  - expand -> submit -> collapse flow for at least one form block
  - representative settings/hub pages showing metrics-first initial state
- Keep diagnostics gate: no console errors, no page errors, no failed 4xx/5xx requests in covered flow.

## Out of Scope
- Replacing the logging-first model on `/today`.
- Fundamental data model changes unrelated to presentation/interaction.
