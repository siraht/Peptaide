# Test Coverage and E2E Quality Beads

This document is a granular bead graph for getting Peptaide to:

1. Near-complete unit and integration coverage with explicit avoidance of mock-heavy test doubles.
2. Complete, production-like end-to-end coverage with detailed, forensic logging artifacts.

It is written as a dependency-aware backlog so work can be parallelized safely.

## Current State Snapshot (2026-02-12)

- Unit tests exist for selected pure-domain modules and selected import logic.
- Coverage tooling is not configured. Running `npm run test -- --coverage` fails due to missing `@vitest/coverage-v8`.
- Some tests currently use fakes:
  - Fake timers in `web/src/lib/import/simpleEvents.test.ts`.
  - A fake DB/query layer in `web/src/lib/import/csvBundle.test.ts`.
- Browser E2E harness (`web/scripts/tbrowser/peptaide-e2e.mjs`) has strong logging and diagnostics (console, network, screenshots, per-page diag files), but it is still not complete against all negative paths, recovery paths, and mutation permutations.

## Bead Legend

- `B###` = top-level bead (task cluster).
- `B###.x` = subtask.
- `Depends on` = hard dependency edges.
- `Comment` = rationale and implementation detail.
- `Done when` = acceptance criteria for that bead.

## Dependency Overlay (Top-Level DAG)

- `B001 -> B002, B003, B004`
- `B002 -> B010, B020, B030`
- `B003 -> B020, B021, B022`
- `B004 -> B021, B022, B030`
- `B010 -> B011, B012, B013`
- `B020 -> B023, B024`
- `B021 -> B025, B026, B027`
- `B022 -> B028, B029`
- `B023 -> B040`
- `B024 -> B040`
- `B025 -> B040`
- `B026 -> B040`
- `B027 -> B040`
- `B028 -> B041`
- `B029 -> B041`
- `B030 -> B031, B032, B033, B034`
- `B031 -> B035`
- `B032 -> B035`
- `B033 -> B035`
- `B034 -> B035`
- `B035 -> B040, B041, B042`
- `B040 -> B050`
- `B041 -> B050`
- `B042 -> B050`

## Bead Catalog

### B001 - Establish Measurement Baseline

Depends on: none

Comment: Do not start writing more tests before measurement is reproducible; otherwise effort gets diffused and regressions stay invisible.

Subtasks:

- `B001.1` Add Vitest coverage provider and scripts in `web/package.json`.
  Comment: Add `@vitest/coverage-v8`, `test:coverage`, and `test:coverage:open` scripts.
- `B001.2` Add baseline coverage config to `web/vitest.config.ts`.
  Comment: Start with text + lcov output and fail thresholds set to informational (not blocking) for first pass.
- `B001.3` Add `web/docs/testing/coverage-baseline.md` with first recorded numbers.
  Comment: Persist a dated baseline so improvements are measurable over time.

Done when:

- `npm run test:coverage` executes successfully and emits lcov + summary.

### B002 - Build Coverage Heatmap and Gap Matrix

Depends on: B001

Comment: The repo has many files and only a small tested subset. A heatmap prevents random test writing and forces risk-first ordering.

Subtasks:

- `B002.1` Generate file-level coverage report grouped by domain (`lib/domain`, `lib/import`, `lib/repos`, `app`, `components`, `api`).
- `B002.2` Create `web/docs/testing/coverage-gap-matrix.md` mapping critical flows to tested/untested status.
- `B002.3` Mark high-risk untested paths (auth, import/apply, delete-my-data, server actions, repo writes, setup flow transitions).

Done when:

- There is a checked-in matrix with explicit priority tiers P0/P1/P2.

### B003 - Define “No Mocks/Fakes” Testing Policy

Depends on: B001

Comment: “No mocks” must be explicit; otherwise contributors reintroduce fake DB clients and fragile stubs.

Subtasks:

- `B003.1` Add `web/docs/testing/no-fakes-policy.md` with allowed vs disallowed test doubles.
  Comment: Allow deterministic clock control only where unavoidable; disallow fake repo/query clients for integration behavior.
- `B003.2` Add lint/check script that flags new `Fake*` classes and `as unknown as DbClient` in tests.
  Comment: Use a lightweight grep guard in CI first; evolve later to custom lint rule if needed.
- `B003.3` Document migration plan for existing fake-based tests.

Done when:

- Policy file exists and CI fails on newly introduced banned patterns.

### B004 - Build Real Test Data Harness (Supabase Local)

Depends on: B001

Comment: Removing fake DB behavior requires a reliable local integration harness with idempotent setup/teardown.

Subtasks:

- `B004.1` Add test schema reset helpers under `web/src/lib/testHarness/`.
- `B004.2` Add seed fixtures for minimal valid graph (profile, substance, route, formulation, vial, distribution).
- `B004.3` Add transaction-safe cleanup/reset command script in `web/scripts/test-db-reset.mjs`.

Done when:

- Integration tests can run repeatedly without manual DB cleanup.

### B010 - Expand Pure Domain Unit Coverage to 95%+

Depends on: B002

Comment: Domain modules are easiest to harden and should reach near-total branch coverage before broader integration work.

Subtasks:

- `B010.1` Add branch-complete tests for units conversions and parsing edge cases.
- `B010.2` Add edge tests for cycle inference boundaries (same-day, DST boundaries, sparse events).
- `B010.3` Add uncertainty/cost combinator edge tests (zero, NaN defense, rounding boundaries).

Done when:

- Domain folders show >=95% line and branch coverage.

### B011 - Remove Nonessential Fake Timers

Depends on: B010

Comment: Fake timers are acceptable for deterministic time travel but should be minimized; prefer explicit timestamp input APIs where possible.

Subtasks:

- `B011.1` Refactor parser entry points to accept explicit `now` parameter where needed.
- `B011.2` Replace timer virtualization tests with direct timestamp injection.

Done when:

- Existing fake timer usage is eliminated or justified in policy exceptions.

### B012 - Add Fuzz/Property Tests for CSV Parsing

Depends on: B010

Comment: CSV import is user-input heavy; fuzz-like tests catch malformed edge cases missed by examples.

Subtasks:

- `B012.1` Add randomized numeric formatting cases (locale separators, whitespace, quoted fields).
- `B012.2` Add malformed header permutations and duplicate header tests.
- `B012.3` Add invalid encoding and truncation tests.

Done when:

- Parser tests include randomized/property-like cases with deterministic seeds.

### B013 - Mutation Guard for Domain Contracts

Depends on: B010

Comment: Mutation testing reveals false confidence in assertions.

Subtasks:

- `B013.1` Add mutation runner for `web/src/lib/domain` modules.
- `B013.2` Triage surviving mutants and add missing assertions.

Done when:

- Mutation score target for domain modules is defined and met.

### B020 - Convert CSV Bundle Tests from Fake DB to Real Integration

Depends on: B002, B003

Comment: Current CSV bundle tests use a fake query layer, which can diverge from actual Supabase/PostgREST behavior.

Subtasks:

- `B020.1` Replace fake DB harness in `web/src/lib/import/csvBundle.test.ts` with real local DB calls.
- `B020.2` Validate rollback semantics against actual failed insert/upsert paths.
- `B020.3` Validate profile merge behavior with real existing profile rows.

Done when:

- `csvBundle` tests run against local Supabase without fake query classes.

### B021 - Repository Layer Integration Test Suite

Depends on: B002, B003, B004

Comment: `web/src/lib/repos/*` currently lacks broad integration assertions; this is a major correctness blind spot.

Subtasks:

- `B021.1` Add CRUD integration tests for each repo module under `web/src/lib/repos/`.
- `B021.2` Assert soft-delete semantics and list filters include/exclude deleted rows correctly.
- `B021.3` Assert cross-table joins/derived views (`inventoryStatus`, `orderItemVialCounts`, etc.) for real data.

Done when:

- Every repo module has at least one integration test file and core behaviors are asserted.

### B022 - Server Actions + API Route Integration Tests

Depends on: B002, B003, B004

Comment: App Router server actions and API endpoints carry mutation risk and must be exercised end-to-end with real persistence.

Subtasks:

- `B022.1` Add tests for `/api/import`, `/api/import-simple-events`, `/api/export`, `/api/delete-my-data`.
- `B022.2` Add tests for critical server actions in hub pages (create/delete flows).
- `B022.3` Assert auth boundary behavior (unauthorized, malformed request, ownership mismatch).

Done when:

- API and server-action mutation paths are covered by integration tests using real DB behavior.

### B023 - UI Unit Tests for Deterministic Utilities

Depends on: B020

Comment: Keep UI unit scope narrow to deterministic behavior (formatters/selectors), not fake-heavy rendering.

Subtasks:

- `B023.1` Add tests for selector/data-shaping helpers used by UI.
- `B023.2` Add tests for shared UI utility functions.

Done when:

- Deterministic UI utilities are covered and stable.

### B024 - Add Contract Tests for Component Data Attributes

Depends on: B020

Comment: E2E depends heavily on `data-e2e` selectors; contract tests prevent accidental selector drift.

Subtasks:

- `B024.1` Add tests asserting required `data-e2e` hooks exist for critical forms/buttons.
- `B024.2` Add tests for compact-entry module open/close and focus query behavior.

Done when:

- Critical selector contracts fail fast in unit/integration tests before E2E breaks.

### B025 - Hub CRUD Integration Scenarios (DB-backed)

Depends on: B021

Comment: Each hub page has multi-step dependencies (substance -> formulation -> vial -> order link). Test these flows as integration scenarios.

Subtasks:

- `B025.1` Substances/routes/devices/formulations creation chains.
- `B025.2` Orders/items/vial generation flows with cost propagation.
- `B025.3` Inventory lifecycle transitions (planned->active->closed/discarded).

Done when:

- Core CRUD chains pass as deterministic integration tests.

### B026 - Setup Wizard Integration Scenarios

Depends on: B021

Comment: Setup is a workflow boundary and common onboarding failure point.

Subtasks:

- `B026.1` Route transitions from `/setup/profile` through finish.
- `B026.2` Validation and error handling for incomplete steps.
- `B026.3` Resume behavior after partial completion.

Done when:

- Setup flow has explicit integration coverage for happy + validation paths.

### B027 - Notification and Analytics Integration Scenarios

Depends on: B021

Comment: Notifications and analytics are derived-data heavy and prone to silent regressions.

Subtasks:

- `B027.1` Notification threshold behavior coverage with real persisted events.
- `B027.2` Analytics spend/non-spend branch coverage after reconciliation.

Done when:

- Derived metrics and notification triggers are asserted end-to-end at integration level.

### B028 - API Security Regression Suite

Depends on: B022

Comment: Security regressions are high impact; guard with explicit negative-path tests.

Subtasks:

- `B028.1` Auth-required endpoint checks.
- `B028.2` RLS ownership denial checks.
- `B028.3` Input validation and malformed payload checks.

Done when:

- Negative API/security tests are in CI and deterministic.

### B029 - Data Portability Integrity Suite

Depends on: B022

Comment: Export/import/delete is a critical trust boundary; needs integrity checks beyond happy path.

Subtasks:

- `B029.1` Round-trip row-count and key integrity checks.
- `B029.2` Partial bundle and invalid bundle resilience tests.
- `B029.3` Idempotency checks for repeated import.

Done when:

- Portability workflows are validated with strict integrity assertions.

### B030 - E2E Logging and Observability Upgrade

Depends on: B002, B004

Comment: Current logs are good but mostly plaintext. Add structured logs to make failures queryable and triage faster.

Subtasks:

- `B030.1` Emit JSONL per-step logs (start, end, duration, status).
- `B030.2` Attach screenshot and diag file references to each failed step.
- `B030.3` Emit per-run summary JSON with flow coverage checklist.
- `B030.4` Add optional HAR export for network debugging in failure mode.

Done when:

- Each E2E run outputs machine-readable artifacts suitable for automatic triage.

### B031 - E2E Auth and Session Resilience Matrix

Depends on: B030

Comment: Auth/session failures are common in local infra; must be explicitly covered.

Subtasks:

- `B031.1` OTP success/failure/retry cases.
- `B031.2` Session loss detection and recovery path checks.
- `B031.3` Multi-user sign-out/sign-in boundary checks.

Done when:

- Auth/session edge scenarios have explicit scripted coverage.

### B032 - E2E Hub CRUD Complete Matrix

Depends on: B030

Comment: Full CRUD should include create, edit, delete, and failure branches for each hub domain.

Subtasks:

- `B032.1` Substances/routes/devices/formulations full CRUD.
- `B032.2` Orders/items/vials generation and reconciliation branches.
- `B032.3` Evidence/distributions/settings CRUD branches.

Done when:

- E2E matrix documents and executes all hub CRUD permutations.

### B033 - E2E Negative and Recovery Paths

Depends on: B030

Comment: “Complete” requires failure-path verification, not just happy paths.

Subtasks:

- `B033.1` Invalid forms and inline validation assertions.
- `B033.2` Network/API failure injection and graceful UI handling assertions.
- `B033.3` Recovery flows after failed import/reconcile attempts.

Done when:

- Negative-path scenarios are included in default or nightly E2E runs.

### B034 - E2E Cross-Device and Responsive Parity

Depends on: B030

Comment: Current mobile sweeps are narrow; expand to core actions and interaction parity.

Subtasks:

- `B034.1` Mobile interaction flows for today, inventory, orders, settings substances workspace.
- `B034.2` Tablet viewport suite for layout overflow/regression checks.
- `B034.3` Keyboard navigation and accessibility smoke assertions.

Done when:

- Desktop/mobile/tablet parity checks run with concrete assertions, not just navigation sweeps.

### B035 - E2E Scope Recomposition and Runtime Budgeting

Depends on: B031, B032, B033, B034

Comment: As coverage grows, scope partitioning must keep feedback loops practical.

Subtasks:

- `B035.1` Define tiered lanes: PR smoke, PR critical, nightly exhaustive.
- `B035.2` Assign scenarios to lanes with target runtime budgets.
- `B035.3` Add lane-specific pass/fail summaries to artifacts.

Done when:

- Coverage is broad while PR runtime remains bounded.

### B040 - CI Gates for Unit/Integration Quality

Depends on: B023, B024, B025, B026, B027, B035

Comment: Results must be enforced; otherwise backlog completion does not protect future regressions.

Subtasks:

- `B040.1` Add required CI jobs for typecheck/lint/unit/integration/e2e-critical.
- `B040.2` Add incremental coverage thresholds by module tier.
- `B040.3` Add forbidden-pattern checks for fake/mocked DB behavior.

Done when:

- CI blocks merges on quality regressions and policy violations.

### B041 - CI Gates for Security and Portability

Depends on: B028, B029, B035

Comment: Security and data portability should be first-class merge gates.

Subtasks:

- `B041.1` Add mandatory API security regression job.
- `B041.2` Add mandatory data portability integrity job.

Done when:

- Security and portability suites are merge-required.

### B042 - Flake Management and Failure Forensics

Depends on: B035

Comment: Larger suites fail unless flake is measured and controlled.

Subtasks:

- `B042.1` Track flake rate per scenario from JSONL artifacts.
- `B042.2` Add automatic rerun-once policy for known transient categories only.
- `B042.3` Add quarantining workflow with explicit expiry and owner fields.

Done when:

- Flake is observable and controlled without hiding deterministic failures.

### B050 - Exit Criteria: “Complete and Trusted”

Depends on: B040, B041, B042

Comment: This is the terminal bead defining objective completion conditions.

Subtasks:

- `B050.1` Verify no fake DB/query classes remain in test suites.
- `B050.2` Verify coverage targets met for domain/repo/api/app layers.
- `B050.3` Verify e2e lane matrix passes with structured artifacts and zero unresolved critical flakes.
- `B050.4` Publish final quality report in `web/docs/testing/final-quality-report.md`.

Done when:

- Project can demonstrate high-confidence correctness with enforced, measurable, and observable automated quality gates.

## Suggested Initial Execution Order (First 2 Weeks)

1. `B001`, `B002`, `B003`, `B004` (foundation).
2. `B020`, `B021`, `B022` (remove fake-db blind spots).
3. `B030`, `B031`, `B032` (upgrade E2E logging + core completeness).
4. `B040` partial enablement with non-blocking thresholds, then ratchet up weekly.

## Notes

- This bead set is intentionally strict about fake DB layers because they create false confidence against real Supabase/PostgREST behavior.
- The fastest risk reduction is replacing fake-based import/repo tests with real local integration tests.
- E2E already has strong foundations; the main gap is matrix completeness and machine-readable forensic logging.
