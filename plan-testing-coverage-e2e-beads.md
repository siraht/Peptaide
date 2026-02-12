# Test Coverage and E2E Bead Graph (v2, Risk-Driven)

This version replaces the prior bead set with a stricter plan optimized for user outcomes, measurable quality gates, and faster execution.

## First Principles (Reality Check)

It is not mathematically possible to prove software is bug-free. No acceptance checklist can make bugs impossible.

What we can do is make critical bug classes extremely unlikely to ship, and make any escaped bugs fast to detect, diagnose, and contain.

This bead graph is therefore built around:

1. User-critical workflow protection.
2. Real-system testing (minimal mocks/fakes).
3. Quantitative, enforceable acceptance gates.
4. Fast failure forensics and low-flake execution.

## User-Critical Workflows (Must Be Protected End-to-End)

These workflow IDs are the anchor for all test criteria.

- `U1` New user onboarding: sign-in -> setup wizard -> first usable `/today`.
- `U2` Daily logging: log event -> inventory/runway/cycle effects visible.
- `U3` Master data maintenance: substances/routes/devices/formulations CRUD.
- `U4` Procurement chain: vendor/order/order-item -> generated vials -> cost propagation.
- `U5` Inventory operations: planned/active/closed/discarded transitions and reconciliation.
- `U6` Evidence/distributions/settings operations with persisted edits.
- `U7` Data portability: export -> delete-my-data -> import -> integrity restoration.
- `U8` Security isolation: user A data inaccessible by user B (RLS/ownership boundaries).

## Program-Level Acceptance Contract (Global Exit Criteria)

All beads complete is not enough. The program is complete only when all conditions below are true.

- `G1 Traceability`: every workflow (`U1`..`U8`) is mapped to automated tests for happy path and at least one meaningful failure path.
- `G2 Coverage`: line/branch thresholds by risk tier:
  - Tier A (`lib/domain`, safety-critical transforms): line >= 97%, branch >= 95%.
  - Tier B (`lib/repos`, `app/api`, server actions): line >= 90%, branch >= 85%.
  - Tier C (UI helpers/components): line >= 80%, branch >= 75%.
- `G3 Mutation`: mutation score >= 80% for Tier A and >= 70% for Tier B.
- `G4 No-Fake Policy`: no fake DB/query layer in integration tests; no new banned patterns introduced.
- `G5 E2E Matrix`: every workflow has browser-level tests for happy + negative/recovery variants.
- `G6 E2E Reliability`: critical lane flake rate < 1.5% rolling 14 days; no unresolved critical flaky test older than 7 days.
- `G7 Runtime Budget`:
  - PR smoke <= 8 min.
  - PR critical <= 20 min.
  - Nightly exhaustive <= 75 min.
- `G8 Security`: security/RLS regression suite has zero critical failures.
- `G9 Portability`: round-trip data integrity suite has zero critical mismatches.
- `G10 Forensics`: all failing E2E runs produce machine-readable step logs and artifact pointers sufficient for one-pass diagnosis.

## Dependency Overlay (Top-Level DAG)

- `B000 -> B010, B020, B030`
- `B010 -> B040, B050`
- `B020 -> B060, B070, B080`
- `B030 -> B090, B100, B110, B120, B130, B140`
- `B040 -> B090, B100`
- `B050 -> B150`
- `B060 -> B150`
- `B070 -> B150`
- `B080 -> B150`
- `B090 -> B160`
- `B100 -> B160`
- `B110 -> B160`
- `B120 -> B170`
- `B130 -> B170`
- `B140 -> B170`
- `B150 -> B180`
- `B160 -> B180`
- `B170 -> B180`

Parallelization note: after `B000/B010/B020/B030`, most work can run in parallel lanes (domain, integration, E2E, security/portability), reducing total cycle time.

## Bead Catalog

### B000 - Quality Contract and Traceability Matrix

Depends on: none

Why this matters for users:

Without explicit traceability, teams can hit high coverage numbers while still missing real user workflows.

Subtasks:

- `B000.1` Create `web/docs/testing/traceability-matrix.md` mapping `U1`..`U8` to test IDs.
- `B000.2` Define risk tiers (A/B/C) per module/file path.
- `B000.3` Define allowed exceptions policy (temporary, owner, expiry date required).

Done when:

- Every workflow has at least one planned happy and negative test entry, and every high-risk module has an assigned tier.

### B010 - Coverage Instrumentation Baseline

Depends on: B000

Why this matters for users:

You cannot improve what you cannot measure.

Subtasks:

- `B010.1` Add `@vitest/coverage-v8`, `test:coverage`, and reporting scripts.
- `B010.2` Configure `web/vitest.config.ts` coverage include/exclude and outputs.
- `B010.3` Publish initial baseline in `web/docs/testing/coverage-baseline.md`.

Done when:

- Coverage runs in CI and generates reproducible reports.

### B020 - Real Integration Test Platform (Supabase Local)

Depends on: B000

Why this matters for users:

Fake DB behavior can hide real persistence bugs users hit in production.

Subtasks:

- `B020.1` Add deterministic DB reset/seed harness for test runs.
- `B020.2` Add fixture builders for valid cross-table graphs.
- `B020.3` Add data cleanup/retry guards for idempotent repeated runs.

Done when:

- Integration tests run repeatedly with stable state and no manual cleanup.

### B030 - No-Fake Policy and Enforcement

Depends on: B000

Why this matters for users:

Prevents drift back to mock-heavy tests that miss real failures.

Subtasks:

- `B030.1` Add `web/docs/testing/no-fakes-policy.md`.
- `B030.2` Add CI guard for banned patterns (`Fake*` DB/query test classes, `as unknown as DbClient` in integration tests).
- `B030.3` Add waiver mechanism with owner + expiry metadata.

Done when:

- CI fails on new banned patterns; exceptions are explicit and time-bound.

### B040 - Contract Surface Locks (Selectors + API Shapes)

Depends on: B010

Why this matters for users:

Prevents silent breakage where flows exist but automation or integrations stop working.

Subtasks:

- `B040.1` Add selector contract tests for critical `data-e2e` hooks.
- `B040.2` Add API request/response contract tests for import/export/auth endpoints.
- `B040.3` Add compact-module behavior contract tests (focus query, open/close persistence).

Done when:

- Contract changes fail tests unless explicitly updated.

### B050 - Domain Correctness Hardening

Depends on: B010

Why this matters for users:

Math/transform bugs silently corrupt dose/cycle/cost behavior.

Subtasks:

- `B050.1` Fill branch gaps in `lib/domain/*` and parser edge logic.
- `B050.2` Add property-based/fuzz tests for CSV numeric and header permutations.
- `B050.3` Add mutation testing for Tier A modules and close surviving mutants.

Done when:

- Tier A meets `G2` and `G3` thresholds.

### B060 - Repository Integration Suite

Depends on: B020

Why this matters for users:

CRUD and joins are core to nearly every screen.

Subtasks:

- `B060.1` Add integration tests for each repo module in `web/src/lib/repos`.
- `B060.2` Assert soft-delete/list filtering semantics.
- `B060.3` Assert derived view correctness (`inventoryStatus`, order/vial aggregates).

Done when:

- Tier B repository modules meet coverage thresholds and workflow matrix references.

### B070 - Server Actions and API Integration Suite

Depends on: B020

Why this matters for users:

Most user mutations go through server actions and API routes.

Subtasks:

- `B070.1` Add integration tests for critical API routes (`import`, `import-simple-events`, `export`, `delete-my-data`).
- `B070.2` Add integration tests for critical hub server actions (create/delete/transition operations).
- `B070.3` Assert authorization, validation, and ownership failures.

Done when:

- Tier B action/API modules meet coverage and negative-path criteria.

### B080 - Workflow Integration Suite (Non-Browser)

Depends on: B020

Why this matters for users:

End-to-end business logic should be validated even outside browser flake surface.

Subtasks:

- `B080.1` Add workflow tests for `U2/U4/U5/U7` using real persistence and service entry points.
- `B080.2` Add invariant assertions (cost totals, cycle boundaries, inventory state consistency).
- `B080.3` Add rollback/error recovery checks for import/reconcile and delete/restore flows.

Done when:

- Core workflow invariants hold under happy and failure permutations.

### B090 - E2E Observability Upgrade (Structured Forensics)

Depends on: B030, B040

Why this matters for users:

When failures happen, fast diagnosis shortens time to fix user-visible issues.

Subtasks:

- `B090.1` Add JSONL step logs with step IDs, status, duration, and scenario ID.
- `B090.2` Emit run summary JSON with pass/fail counts by workflow ID.
- `B090.3` Include artifact pointers (screenshots, diagnostics, network snapshots) per failed step.
- `B090.4` Add optional HAR capture in failure mode.

Done when:

- A failed run is diagnosable from artifacts without rerunning locally.

### B100 - E2E Happy-Path Matrix (Workflow Complete)

Depends on: B030, B040

Why this matters for users:

Ensures core value-delivery paths always work in real browser execution.

Subtasks:

- `B100.1` Implement/verify explicit scenario coverage for each `U1`..`U8` happy path.
- `B100.2` Add assertions for user-visible success indicators, not only navigation.
- `B100.3` Add cross-role checks where relevant (user A vs user B).

Done when:

- All workflows have at least one stable E2E happy-path scenario in PR-critical or nightly lanes.

### B110 - E2E Negative and Recovery Matrix

Depends on: B030

Why this matters for users:

Users encounter failures, bad input, and partial operations; product must recover safely.

Subtasks:

- `B110.1` Add validation failure scenarios for each hub domain.
- `B110.2` Add transient backend/network failure scenarios with recovery assertions.
- `B110.3` Add import/reconcile failure and retry paths.

Done when:

- Every workflow has at least one negative and one recovery scenario.

### B120 - Security and RLS Adversarial Suite

Depends on: B030

Why this matters for users:

Data isolation failures are critical incidents.

Subtasks:

- `B120.1` Add cross-user unauthorized access attempts for direct URLs and API endpoints.
- `B120.2` Add malformed/forged request cases for ownership-protected actions.
- `B120.3` Add regression checks for deletion visibility and soft-delete boundaries.

Done when:

- Security suite has zero critical findings and is CI-required.

### B130 - Data Portability Integrity Suite

Depends on: B030

Why this matters for users:

Backups and restores must be trustworthy.

Subtasks:

- `B130.1` Add strict row-count and key-consistency round-trip checks.
- `B130.2` Add corrupted/partial bundle and schema-mismatch tests.
- `B130.3` Add idempotent re-import checks and conflict handling assertions.

Done when:

- Portability suite passes with deterministic integrity checks and no critical mismatches.

### B140 - Cross-Device, Accessibility, and Performance Gate

Depends on: B030

Why this matters for users:

Desktop-only correctness is insufficient; users need reliable behavior across devices.

Subtasks:

- `B140.1` Expand mobile and tablet workflow actions beyond route sweeps.
- `B140.2` Add keyboard-accessibility smoke checks for critical controls.
- `B140.3` Add coarse performance guards (scenario timing budgets; fail on large regressions).

Done when:

- Critical workflows pass on desktop/mobile/tablet with defined timing bounds.

### B150 - CI Lane Architecture and Enforcement

Depends on: B050, B060, B070, B080

Why this matters for users:

Quality only protects users when it blocks bad merges.

Subtasks:

- `B150.1` Define lanes: `pr-smoke`, `pr-critical`, `nightly-exhaustive`.
- `B150.2` Place tests into lanes based on workflow/risk.
- `B150.3` Enforce coverage thresholds and no-fake policy in required lanes.

Done when:

- CI enforces `G2`, `G4`, and runtime budgets in required jobs.

### B160 - Flake Governance and Triage System

Depends on: B090, B100, B110

Why this matters for users:

High flake hides real regressions and slows fixes.

Subtasks:

- `B160.1` Track per-scenario flake rate from JSONL outputs.
- `B160.2` Add bounded auto-rerun policy for known transient classes only.
- `B160.3` Add quarantine protocol requiring owner, reason, and expiry.

Done when:

- Flake remains below `G6` targets and quarantines are time-bounded.

### B170 - Security/Portability/Device Required Gates

Depends on: B120, B130, B140

Why this matters for users:

High-impact risk classes must be explicitly enforced before release.

Subtasks:

- `B170.1` Mark security and portability suites as merge-required.
- `B170.2` Mark cross-device/accessibility suite as nightly-required (or PR-required for touched areas).

Done when:

- CI policy reflects mandatory high-impact risk gates.

### B180 - Final Audit and Sign-Off

Depends on: B150, B160, B170

Why this matters for users:

Provides a single auditable proof that quality gates are real, not aspirational.

Subtasks:

- `B180.1` Publish `web/docs/testing/final-quality-report.md` with evidence for `G1`..`G10`.
- `B180.2` Verify all traceability matrix entries map to passing tests.
- `B180.3` Verify no active expired waivers/quarantines remain.

Done when:

- All global acceptance criteria `G1`..`G10` are satisfied and evidenced.

## Why This Version Is Better Than v1

- Starts from user workflows (`U1`..`U8`) instead of module activity lists.
- Adds hard quantitative gates (`G1`..`G10`) rather than broad “done” language.
- Separates coverage numbers from actual workflow protection.
- Makes no-fake enforcement operational in CI.
- Bakes in forensics and flake governance as first-class quality work.
- Optimizes parallel execution after early foundations.

## Practical First Wave (Highest ROI)

1. `B000`, `B010`, `B020`, `B030`.
2. `B060`, `B070`, `B090`.
3. `B100`, `B110`, `B120`, `B130`.
4. `B150`, `B160`, `B170`, `B180`.

This ordering prioritizes real-system correctness and gate enforcement before widening long-tail coverage.
