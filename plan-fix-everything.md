# Fix Runtime Reliability, Complete Hub UX, and Expand Focused Browser Coverage

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository's ExecPlan format authority is `.agent/PLANSwHD.md` from the repository root. This plan must be maintained in accordance with it.

## Purpose / Big Picture

Peptaide has solid functional depth, but there are still critical gaps between what is implemented and what is reliable/polished in day-to-day use.

The immediate “fix everything” scope for this pass is:

1. Restore runtime reliability for `:3002` so the app consistently serves the correct built assets (no broken styling and no false UI failures caused by missing JS/CSS chunks).
2. Finish the metrics-first + compact-entry UX conversion for all CRUD-oriented pages reachable from the settings hub navigation (not only inventory/cycles), while keeping `/settings?tab=app` preferences-first with matching visual quality.
3. Add missing deep interaction coverage in browser tests for newly shipped flows (especially vial-to-order-item linking/cost autofill), while keeping the full conclusive run.
4. Make targeted browser runs fast and practical so we can verify only relevant surfaces during iteration without giving up full-sweep confidence.

After this plan is implemented, users should be able to open `http://100.95.0.36:3002` and get the intended UI every time, and all settings-hub routes should feel coherent, intentionally designed, and behaviorally covered by browser tests.

## Progress

- [x] (2026-02-11 22:40Z) Re-read `AGENTS.md` and `.agent/PLANSwHD.md`; reproduced stale-asset runtime failure on `:3002`; confirmed `:3003` fresh process served current chunks.
- [x] (2026-02-11 22:40Z) Audited hub UX coverage and browser harness gaps; confirmed missing conversions and missing explicit vial order-link assertions.
- [x] (2026-02-11 23:55Z) Implemented runtime guardrails:
  - `web/scripts/runtime-preflight.mjs` (sign-in HTML + referenced static assets + token contract),
  - `web/scripts/start-safe.mjs` (safe target-port process replacement),
  - `web/package.json` scripts (`start:safe`, `runtime:preflight`),
  - `web/next.config.ts` explicit `turbopack.root = process.cwd()`.
- [x] (2026-02-11 23:58Z) Updated `ops/systemd/peptaide-web.service` to run `start:safe` and `ExecStartPost` runtime preflight; applied unit on host (`daemon-reload`, restart). `systemctl status` now shows `ExecStartPost ... runtime:preflight` succeeded and service remains active.
- [x] (2026-02-12 00:05Z) Updated `ACCESS.md` with restart + runtime-preflight and asset-check troubleshooting commands.
- [x] (2026-02-12 00:07Z) Completed metrics-first + compact-entry conversion for remaining hub CRUD pages:
  - `orders`, `substances`, `routes`, `formulations`, `devices`, `distributions`, `evidence-sources`.
- [x] (2026-02-12 00:10Z) Expanded browser harness (`web/scripts/tbrowser/peptaide-e2e.mjs`) with:
  - scopes: `runtime`, `inventory`, `orders`, `reference`,
  - runtime preflight in harness startup,
  - deep vial order-link/cost-autofill assertions,
  - compact-module-aware form opening helpers.
- [x] (2026-02-12 00:12Z) Fixed hydration mismatch in `web/src/components/ui/compact-entry-module.tsx` by moving localStorage restoration from state initializer to `useEffect` gated by `storageReady`.
- [x] (2026-02-12 00:18Z) Fixed two long-stall E2E actions by replacing brittle role-click submit paths with explicit form `requestSubmit` fallbacks:
  - formulation-from-vial submit path,
  - cycle-card bootstrap substance-create path (plus explicit module open).
- [x] (2026-02-12 00:22Z) Final validation complete:
  - `npm run typecheck`,
  - `npm run lint`,
  - `npm test`,
  - `npm run runtime:preflight -- --base-url http://100.95.0.36:3002 --timeout-ms 60000`,
  - `npm run e2e:browser:smoke`,
  - `npm run e2e:browser:inventory`,
  - `npm run e2e:browser` (full conclusive run),
  - plus previously executed scoped runs: `e2e:browser:runtime`, `e2e:browser:orders`, `e2e:browser:reference`.

## Surprises & Discoveries

- Observation: The local/host service was not just stale; it could re-enter a build/start race pattern during restarts, masking the real issue as random frontend breakage.
  Evidence: Before unit hardening, `:3002` intermittently served stale chunk references. After switching to `start-safe` + post-start preflight, `systemctl status` shows deterministic start path and `runtime-preflight PASS`.

- Observation: `CompactEntryModule` initially caused hydration mismatch under SSR because localStorage state was read inside the `useState` initializer.
  Evidence: Browser runs hit React hydration mismatch until the storage read moved into `useEffect` with a `storageReady` gate.

- Observation: Compact module content remains in DOM when collapsed (`grid-rows-[0fr]` + `pointer-events-none`), so selectors can find inputs/buttons that are not interactable.
  Evidence: Full-scope E2E stalled on generic role-based `"Create"` and submit clicks until flows explicitly opened module panels and submitted forms via `requestSubmit` fallback.

- Observation: Runtime preflight token assertions provided a stronger early-failure signal than downstream visual assertions.
  Evidence: Harness now fails at startup with direct missing-token/missing-asset diagnostics instead of ambiguous later UI failures.

## Decision Log

- Decision: Treat the `:3002` break as a release/runtime correctness bug, not a styling bug.
  Rationale: The underlying issue is stale process/build artifact mismatch, which can invalidate any UI/test conclusions until fixed.
  Date/Author: 2026-02-11 / Codex

- Decision: Finish hub UX conversion via shared primitives (`MetricsStrip`, `CompactEntryModule`) instead of ad-hoc page redesigns.
  Rationale: This yields consistency quickly and reduces repeated bespoke implementations.
  Date/Author: 2026-02-11 / Codex

- Decision: Keep full conclusive browser run as the final gate, but add focused scopes for fast iterative coverage.
  Rationale: Fast feedback is needed during implementation; full sweep still protects against cross-page regressions.
  Date/Author: 2026-02-11 / Codex

- Decision: Add explicit runtime preflight checks (asset availability + CSS contract) to test harness/startup workflows.
  Rationale: Current failures present as downstream style/assertion errors; preflight will surface root cause immediately.
  Date/Author: 2026-02-11 / Codex

- Decision: Enforce deterministic runtime startup in service mode: `ExecStart` via `start-safe` and `ExecStartPost` runtime preflight.
  Rationale: This converts silent stale-manifest drift into a startup-time failure with explicit diagnostics.
  Date/Author: 2026-02-11 / Codex

- Decision: Set `turbopack.root = process.cwd()` in `next.config.ts`.
  Rationale: Explicit root selection removes lockfile-inference ambiguity and makes build/start behavior predictable.
  Date/Author: 2026-02-11 / Codex

- Decision: For compact-module flows in E2E, prefer explicit module opening + direct form submission fallback over generic role clicks.
  Rationale: Hidden-but-mounted content can satisfy selectors while remaining non-interactable; explicit submission paths remove this class of flake/stall.
  Date/Author: 2026-02-12 / Codex

- Decision: Preserve `/settings?tab=app` as preferences-first while converting CRUD pages to metrics-first modules.
  Rationale: It is configuration-oriented rather than CRUD entry-oriented, so parity is visual/systemic rather than structural.
  Date/Author: 2026-02-12 / Codex

## Outcomes & Retrospective

All four milestones were completed in this pass.

Delivered outcomes:

- Runtime reliability guardrails are now built into both operations and tests:
  - service startup is deterministic (`start-safe`),
  - post-start runtime contract is verified automatically (`runtime-preflight`),
  - host endpoint preflight passes on `http://100.95.0.36:3002`.
- Hub UX conversion is complete for all targeted CRUD routes, now consistently metrics-first with compact entry modules and preserved list/table flows.
- Browser coverage now includes explicit deep validation of vial order-link/cost behavior and practical focused scopes (`runtime`, `inventory`, `orders`, `reference`) while keeping full-sweep coverage.
- Full conclusive browser run passes after hardening two submit interactions that previously stalled.

Retrospective:

- The largest reliability win came from moving runtime correctness checks earlier (service post-start and harness preflight), which prevents false attribution to UI code.
- Compact entry modules improved UX consistency but required hydration-safe state initialization and test interactions that account for collapsed-yet-mounted DOM.
- Focused scopes meaningfully improved iteration speed without sacrificing final conclusive confidence.

## Context and Orientation

The authenticated app shell is `web/src/app/(app)/layout.tsx`, while settings-hub pages are under `web/src/app/(app)/(hub)/` with shared sidebar layout at `web/src/app/(app)/(hub)/layout.tsx` and `web/src/components/settings-hub/sidebar.tsx`.

In this plan, “metrics-first” means each CRUD hub page opens with summary/insight cards (`MetricsStrip`) above data-entry forms, and creation forms are hidden behind collapsed `CompactEntryModule` panels by default.

Current UX conversion status:

- Converted to metrics-first/collapsible modules:
  - `web/src/app/(app)/(hub)/inventory/page.tsx`
  - `web/src/app/(app)/(hub)/cycles/page.tsx`
  - `web/src/app/(app)/setup/inventory/page.tsx`
- Not yet converted (still form-first/open):
  - `web/src/app/(app)/(hub)/orders/page.tsx`
  - `web/src/app/(app)/(hub)/substances/page.tsx`
  - `web/src/app/(app)/(hub)/routes/page.tsx`
  - `web/src/app/(app)/(hub)/formulations/page.tsx`
  - `web/src/app/(app)/(hub)/devices/page.tsx`
  - `web/src/app/(app)/(hub)/distributions/page.tsx`
  - `web/src/app/(app)/(hub)/evidence-sources/page.tsx`

`/settings` has two distinct modes (`tab=substances` workspace editor and `tab=app` preferences). This plan treats `tab=substances` as a hub workspace parity target and treats `tab=app` as a settings/preferences surface that should remain scan-first but not necessarily use the same compact-entry module pattern as CRUD pages.

Browser harness lives at `web/scripts/tbrowser/peptaide-e2e.mjs` with scripts in `web/package.json`:

- `npm run e2e:browser`
- `npm run e2e:browser:smoke`
- `npm run e2e:browser:today`
- `npm run e2e:browser:settings`

Runtime/deployment support files currently in repo:

- `ops/systemd/peptaide-web.service`
- `ACCESS.md`

## Plan of Work

### Milestone 1: Runtime Reliability and Startup Guardrails

First, eliminate stale-process build drift as a recurring failure mode. Add a deterministic startup/check workflow that verifies the running server is serving the same asset manifest as the current build. This work will include:

- A runtime preflight script that fetches `/sign-in`, extracts referenced `/_next/static/*` assets, and asserts all return HTTP 200.
- A small rendered-style contract check in preflight (confirm shared theme tokens resolve to non-empty computed values on `/sign-in`).
- A safe local restart flow for port `3002` (terminate stale `next start` for this app before launching the new one).
- A deterministic Next.js root strategy (either explicit Next config for workspace root, or cleanup of accidental extra lockfile artifacts if they are not intentional) so build/start behavior is stable.
- Documentation updates so operational steps are explicit and reproducible.

Acceptance for this milestone is concrete: `:3002/sign-in` and all referenced static assets return 200; smoke browser scope no longer fails immediately on missing style tokens.

### Milestone 2: Complete Metrics-First Hub UX Conversion

Next, apply the same UX pattern used in inventory/cycles across all settings-hub pages. Each page should present “what matters now” first (metrics/summary), with data entry collapsed by default in compact modules.

Implementation shape:

- Add metrics strips on each unconverted hub page using existing rollups/counts already available (or lightweight aggregates in page-level server components).
- Wrap create/bulk-add/import forms inside `CompactEntryModule` with sensible default collapsed state and per-module localStorage keys.
- Keep list/table sections visible and polished with clearer empty states and actionable CTAs.
- Ensure mobile behavior is intentional (no clipping, no unreachable sections, no hidden critical actions).

Acceptance for this milestone is that every CRUD-oriented page linked from the hub sidebar opens in the same visual grammar (metrics header + compact entry modules + list/insights), and `/settings?tab=app` remains consistent with that system.

### Milestone 3: Browser Coverage for New and Converted Flows

Then, add missing deep interactions and sharpen scoped test lanes:

- Extend E2E to explicitly exercise:
  - inventory create-vial flow with `order_item_id` linkage toggle/select/provenance preview,
  - cost autofill behavior when linked order item has implied cost,
  - unlinked fallback behavior.
- Add scope-specific routines so targeted pages can be validated quickly (for example: `inventory`, `orders`, `reference`, `runtime`) while preserving existing broad scopes.
- Add runtime preflight into harness startup so asset-manifest mismatch fails with a direct diagnosis.

Acceptance for this milestone is that targeted scope runs pass for changed surfaces and full scope still passes.

### Milestone 4: Final Validation and Evidence

Finally, run full quality gates and capture evidence:

- static checks (`typecheck`, `lint`, unit tests),
- focused browser scopes for touched areas,
- full browser conclusive run.

Update this plan’s living sections with actual outcomes, surprises, and decisions from implementation.

## Concrete Steps

All commands are run from `/data/projects/peptaide` unless otherwise stated.

1. Reproduce and verify runtime correctness before/after changes.

    curl -sS -D /tmp/signin.hdr -o /tmp/signin.html http://127.0.0.1:3002/sign-in
    rg -o '"/_next/static/[^"]+\.(css|js)"' /tmp/signin.html
    rg -o '"/_next/static/[^"]+\.(css|js)"' /tmp/signin.html | tr -d '"' | awk '!seen[$0]++' | while read -r a; do curl -sS -o /tmp/asset.out -w "%{http_code} ${a}\n" "http://127.0.0.1:3002${a}"; done

2. Implement runtime preflight tooling and startup guardrails (new scripts under `web/scripts/` and/or `ops/scripts/`).

   When testing local restart logic, kill only the process bound to target port:

    pid=$(ss -ltnp | awk '/:3002/{print $NF}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1)
    [ -n "$pid" ] && kill "$pid" || true
    cd web && npm run start -- -p 3002 -H 0.0.0.0

3. Refactor unconverted hub pages to metrics-first + compact-entry pattern.

4. Extend `web/scripts/tbrowser/peptaide-e2e.mjs` with new flow coverage and additional scopes.

5. Run validation.

    cd web
    npm run typecheck
    npm run lint
    npm test
    npm run e2e:browser:smoke
    npm run e2e:browser:inventory   # new script to be added
    npm run e2e:browser:orders      # new script to be added
    npm run e2e:browser:reference   # new script to be added
    npm run e2e:browser:runtime     # new script to be added
    npm run e2e:browser

6. Record artifact paths and update this ExecPlan sections (`Progress`, `Surprises & Discoveries`, `Decision Log`, `Outcomes & Retrospective`).

## Validation and Acceptance

This plan is accepted when all of the following are true:

1. Runtime correctness:
   - The configured live app endpoint (`http://100.95.0.36:3002/sign-in` in current environment) renders with expected styling.
   - Referenced `/_next/static/*` assets from `/sign-in` return HTTP 200.
   - No stale-manifest symptom remains after standard restart workflow.

2. UX completion:
   - All CRUD-oriented settings-hub routes (`Substances`, `Routes`, `Formulations`, `Devices`, `Inventory`, `Orders`, `Cycles`, `Distributions`, `Evidence`) follow metrics-first layout with collapsed entry modules by default.
   - `/settings?tab=app` remains preferences-first, but uses the same visual system and clear information hierarchy as the converted hub routes.
   - Mobile and desktop layouts are both usable and visually coherent.

3. E2E coverage:
   - Browser tests explicitly cover vial order-linking interactions and assertions.
   - Targeted scopes execute successfully for touched surfaces.
   - Full conclusive browser run passes.

4. Core quality gates:
   - `npm run typecheck`, `npm run lint`, and `npm test` all pass.

## Idempotence and Recovery

- Runtime preflight scripts must be safe to run repeatedly and must not mutate data.
- Page refactors should remain additive and reversible per-page; if one page regresses, it can be reverted independently.
- New E2E scopes should share core helpers to avoid duplicated brittle selectors.
- If browser runs fail, diagnostics artifacts under `/tmp/peptaide-e2e-*` are the source of truth for triage.
- If `H1` is still open, keep local validation unblocked and record exactly which live-host checks remain pending.

## Artifacts and Notes

Implementation evidence:

- Runtime:
  - `systemctl status peptaide-web.service --no-pager` shows service active with:
    - `ExecStart=/.../npm run start:safe -- --port ${PORT} --host ${HOST}`
    - `ExecStartPost=/.../npm run runtime:preflight -- --base-url http://127.0.0.1:${PORT} --timeout-ms 60000`
    - `runtime-preflight PASS` in logs.
  - `cd web && npm run runtime:preflight -- --base-url http://100.95.0.36:3002 --timeout-ms 60000` -> PASS.

- Browser artifacts:
  - Full conclusive run: `/tmp/peptaide-e2e-2026-02-12T00-15-01-459Z` (PASS).
  - Inventory scope: `/tmp/peptaide-e2e-2026-02-12T00-08-42-347Z` (PASS).
  - Smoke scope: `/tmp/peptaide-e2e-2026-02-12T00-21-31-231Z` (PASS).

- Quality gates:
  - `cd web && npm run typecheck` -> PASS.
  - `cd web && npm run lint` -> PASS.
  - `cd web && npm test` -> PASS (14 files, 78 tests).

Plan revision note (2026-02-12): ExecPlan moved from investigation to implemented state; living sections updated with completed milestones, final validation, and post-implementation discoveries.
