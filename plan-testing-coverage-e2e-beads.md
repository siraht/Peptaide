# Test Coverage and E2E Bead Graph (v3, User-Risk Optimized)

This version supersedes v2. It keeps the workflow-first structure but strengthens fault-class coverage, adds release-time safeguards, and closes acceptance gaps that still allowed “green but unsafe” outcomes.

## Hard Truth (Scope of Guarantee)

No finite test plan can make bugs or missing functionality impossible.

What we can guarantee is this:

- Every known high-impact user workflow is protected by layered tests.
- Every major fault class has explicit detection tests.
- Release and post-release safeguards catch escaped defects quickly.
- Quality gates are measurable and merge-enforced.

This document is optimized for that guarantee.

## User-Critical Workflows

- `U1` Onboarding: sign-in -> setup wizard -> first usable `/today`.
- `U2` Daily logging: log dose -> inventory/runway/cycle updates appear correctly.
- `U3` Master data operations: substances/routes/devices/formulations CRUD and linkage.
- `U4` Procurement flow: vendor/order/order-item -> vial generation -> cost propagation.
- `U5` Inventory lifecycle: planned/active/closed/discarded + imported-vial reconciliation.
- `U6` Evidence/distributions/settings edits persist and rehydrate.
- `U7` Portability: export -> delete-my-data -> import -> integrity restoration.
- `U8` Isolation/security: user B cannot access/alter user A data.

## Fault Taxonomy (What We Must Detect)

- `F1` Validation errors (bad inputs, missing prerequisites).
- `F2` Authorization/RLS errors.
- `F3` Data integrity errors (mismatched totals, orphan links, broken invariants).
- `F4` Temporal/math errors (timezone/DST, rounding, conversion drift).
- `F5` Partial-failure/retry errors (import/reconcile half-applied states).
- `F6` Runtime infra errors (stale assets, session loss, transient network faults).
- `F7` UX regressions (critical controls inaccessible or broken interaction states).
- `F8` Cross-device/accessibility regressions.
- `F9` Performance regressions that materially degrade user workflows.
- `F10` Flake/observability blind spots that hide real regressions.

## Global Acceptance Contract (Program Exit)

The program is done only if every criterion below is satisfied.

- `A1 Workflow Traceability`: every workflow `U1..U8` maps to automated tests for:
  - happy path,
  - validation failure path,
  - transient-failure recovery path,
  - authorization failure path where applicable.
- `A2 Fault Coverage`: every fault class `F1..F10` has at least one deterministic test in CI-required lanes.
- `A3 Coverage Thresholds`:
  - Tier A (`lib/domain`, core parsers/transforms): line >= 97%, branch >= 95%.
  - Tier B (`lib/repos`, `app/api`, server actions): line >= 92%, branch >= 88%.
  - Tier C (UI helpers/components): line >= 82%, branch >= 78%.
- `A4 Diff Coverage`: changed-lines coverage >= 95% on PR-critical lane.
- `A5 Mutation`: mutation score >= 82% for Tier A and >= 72% for Tier B.
- `A6 No-Fake Enforcement`: integration suites contain no fake DB/query clients; waivers are explicit, owned, and expire.
- `A7 Invariant Checks`: workflow tests assert persisted invariants (not only UI text).
- `A8 E2E Completeness`: each `U1..U8` has browser tests with user-visible assertions and state-verification assertions.
- `A9 E2E Reliability`: PR-critical flake < 1.5% over 14 days; no unresolved critical flaky test older than 7 days.
- `A10 Runtime Budgets`:
  - PR smoke <= 8 minutes,
  - PR critical <= 22 minutes,
  - nightly exhaustive <= 80 minutes.
- `A11 Security Gate`: adversarial security/RLS suite has zero critical failures.
- `A12 Portability Gate`: round-trip integrity suite has zero critical mismatches.
- `A13 Forensics`: failing E2E runs emit JSONL step logs + artifact pointers sufficient for one-pass diagnosis.
- `A14 Release Safety`: pre-release synthetic checks pass and post-release workflow canaries detect breakage within 5 minutes.

## Dependency Overlay (Top-Level DAG)

- `B000 -> B010, B020, B040, B090`
- `B010 -> B050, B060, B120, B140`
- `B020 -> B030, B060, B070, B080, B100, B110, B130`
- `B030 -> B100, B110`
- `B040 -> B060, B070, B080, B100`
- `B050 -> B140`
- `B060 -> B140`
- `B070 -> B140`
- `B080 -> B140`
- `B090 -> B100, B130, B160`
- `B100 -> B140, B160`
- `B110 -> B140`
- `B120 -> B140`
- `B130 -> B140, B160`
- `B140 -> B150, B170`
- `B150 -> B170`
- `B160 -> B170`

Parallelization guidance:

After `B000/B010/B020/B040/B090`, run four lanes in parallel:

- correctness lane (`B050/B060/B070/B080`),
- workflow browser lane (`B100/B110/B120`),
- resilience lane (`B130`),
- governance lane (`B160`).

## Beads

### B000 - Workflow Contracts + Fault-Class Traceability

Depends on: none

Comment:

This bead prevents “high coverage, low confidence” by forcing explicit mapping from user workflows and fault classes to tests.

Subtasks:

- `B000.1` Create `web/docs/testing/traceability-matrix.md` mapping `U1..U8` to test IDs.
- `B000.2` Add fault mapping table from `F1..F10` to test IDs.
- `B000.3` Add risk-tier registry (Tier A/B/C by file path).

Done when:

- Every workflow and fault class has planned test coverage entries before implementation proceeds.

### B010 - Measurement Stack (Coverage, Diff Coverage, Mutation)

Depends on: B000

Comment:

Measurement is infrastructure. Without it, acceptance gates are unenforceable.

Subtasks:

- `B010.1` Add coverage provider + scripts.
- `B010.2` Add diff-coverage reporting in CI.
- `B010.3` Add mutation tooling for Tier A/B packages.
- `B010.4` Publish baseline report with dated metrics.

Done when:

- CI publishes line/branch/diff/mutation metrics for every PR-critical run.

### B020 - Deterministic Real-System Test Harness

Depends on: B000

Comment:

Integration reliability depends on deterministic state setup/reset, not mocks.

Subtasks:

- `B020.1` Add deterministic DB reset + seed harness for local Supabase.
- `B020.2` Add reusable fixture builders for valid cross-entity graphs.
- `B020.3` Add idempotent rerun safety and cleanup checks.

Done when:

- Integration suites can run repeatedly with identical outcomes.

### B030 - Scenario DSL for Stateful Workflow Tests

Depends on: B020

Comment:

A compact scenario DSL reduces duplicated setup logic and makes long workflow tests maintainable.

Subtasks:

- `B030.1` Add scenario builders for users/entities/events.
- `B030.2` Add state checkpoint helpers (before/after invariants).
- `B030.3` Add rollback/retry scenario primitives.

Done when:

- Workflow integration and E2E scenario definitions are concise and reuse common setup primitives.

### B040 - No-Fake Policy + Enforcement

Depends on: B000

Comment:

This guards against reintroducing fake DB/query abstractions that mask production bugs.

Subtasks:

- `B040.1` Add policy doc with allowed/disallowed test doubles.
- `B040.2` Add CI guard for banned patterns in integration suites.
- `B040.3` Add waiver mechanism requiring owner + reason + expiry.

Done when:

- CI blocks new violations and all waivers are explicit and time-bounded.

### B050 - Domain and Parser Correctness Hardening

Depends on: B010

Comment:

Covers high-risk math and transform logic where silent corruption is possible.

Subtasks:

- `B050.1` Fill branch gaps in Tier A modules.
- `B050.2` Add property/metamorphic tests for parsers and conversions.
- `B050.3` Kill surviving Tier A mutants with stronger assertions.

Done when:

- Tier A meets `A3/A5` and fault classes `F3/F4` are directly covered.

### B060 - Repository Integration Matrix

Depends on: B020, B040

Comment:

Repo correctness is central to most screens and workflows.

Subtasks:

- `B060.1` Add CRUD integration tests for all repo modules.
- `B060.2` Add soft-delete and filter semantics tests.
- `B060.3` Add derived-aggregate correctness tests.

Done when:

- Tier B repo modules satisfy coverage thresholds and `F3` detection.

### B070 - API and Server-Action Integration Matrix

Depends on: B020, B040

Comment:

Most user writes happen through APIs/actions; they need direct mutation-path coverage.

Subtasks:

- `B070.1` Add integration tests for critical API routes.
- `B070.2` Add integration tests for critical server actions.
- `B070.3` Add malformed/unauthorized/ownership-negative tests.

Done when:

- Fault classes `F1/F2/F5` are covered for all critical mutation surfaces.

### B080 - Portability and Data-Lifecycle Integration

Depends on: B020, B040

Comment:

Users need trusted backup/restore/delete behavior.

Subtasks:

- `B080.1` Add export/import/delete round-trip tests with strict integrity checks.
- `B080.2` Add partial/corrupt bundle tests.
- `B080.3` Add repeated-import idempotency tests.

Done when:

- `A12` is satisfied with deterministic integrity assertions.

### B090 - Structured E2E Forensics Platform

Depends on: B000

Comment:

Failure diagnosis speed is a product-quality multiplier.

Subtasks:

- `B090.1` Emit JSONL per-step logs with scenario/workflow IDs.
- `B090.2` Emit per-run summary JSON (workflow/fault class coverage + outcomes).
- `B090.3` Attach diagnostics/screenshot/network artifact pointers to failed steps.
- `B090.4` Add optional HAR capture on failure.

Done when:

- `A13` is met for all PR-critical and nightly lanes.

### B100 - E2E Workflow Matrix (Happy Paths)

Depends on: B020, B030, B040, B090

Comment:

Every user-critical workflow must pass in real browser execution.

Subtasks:

- `B100.1` Implement one canonical happy-path scenario per `U1..U8`.
- `B100.2` Add user-visible assertions for each checkpoint.
- `B100.3` Add persisted-state assertions after each workflow.

Done when:

- `A1/A8` happy-path requirements are complete for all workflows.

### B110 - E2E Failure and Recovery Matrix

Depends on: B020, B030, B090

Comment:

Users encounter broken inputs, transient failures, and partial operations.

Subtasks:

- `B110.1` Add validation-failure scenarios for all workflow mutation steps.
- `B110.2` Add transient-failure injection + retry/recovery assertions.
- `B110.3` Add partial-apply recovery scenarios for import/reconcile/data ops.

Done when:

- `A1` failure-path requirements are complete and `F1/F5/F6` are covered in browser tests.

### B120 - Cross-Device, Accessibility, and Performance Guards

Depends on: B010

Comment:

Protects real usability across form factors.

Subtasks:

- `B120.1` Expand mobile/tablet actionable workflow checks (not just route sweeps).
- `B120.2` Add keyboard/a11y smoke checks for critical controls.
- `B120.3` Add coarse scenario timing regression guards.

Done when:

- `F8/F9` are covered with stable tests and enforced thresholds.

### B130 - Fault Injection and Resilience Tests

Depends on: B020, B090

Comment:

Explicitly tests behavior under dependency and transport instability.

Subtasks:

- `B130.1` Add controlled network/API fault injection scenarios.
- `B130.2` Add session loss/refresh and stale asset edge checks.
- `B130.3` Add resilience assertions (no corrupt partial state, safe retry).

Done when:

- `F5/F6` have dedicated resilience coverage in integration and/or E2E lanes.

### B140 - CI Lane Architecture and Hard Gates

Depends on: B010, B050, B060, B070, B080, B100, B110, B120, B130

Comment:

Quality protection only matters if it blocks unsafe merges.

Subtasks:

- `B140.1` Define and enforce `pr-smoke`, `pr-critical`, `nightly-exhaustive` lanes.
- `B140.2` Enforce `A3/A4/A5/A6/A10` in required jobs.
- `B140.3` Enforce workflow/fault traceability checks (`A1/A2`).

Done when:

- CI enforces all required quantitative gates for merge decisions.

### B150 - Release and Post-Release User Safeguards

Depends on: B140

Comment:

Catches escaped defects quickly and protects users even after merge.

Subtasks:

- `B150.1` Add pre-release synthetic checks for `U1/U2/U4/U7/U8`.
- `B150.2` Add post-release canaries running every 5 minutes.
- `B150.3` Add rollback/escalation trigger rules for failed canaries.

Done when:

- `A14` is satisfied with documented and tested response procedures.

### B160 - Flake Governance and Quarantine Discipline

Depends on: B090, B100, B110, B130

Comment:

Flake management prevents noisy pipelines from masking real issues.

Subtasks:

- `B160.1` Track flake by scenario/workflow from JSONL artifacts.
- `B160.2` Add bounded rerun policy for approved transient categories only.
- `B160.3` Enforce quarantine owner + expiry + exit criteria.

Done when:

- `A9` is continuously met and no stale quarantines remain.

### B170 - Final Evidence Audit

Depends on: B140, B150, B160

Comment:

Provides objective evidence that the quality program is real and complete.

Subtasks:

- `B170.1` Publish `web/docs/testing/final-quality-report.md` with evidence for `A1..A14`.
- `B170.2` Verify every `U*` and `F*` mapping points to passing tests.
- `B170.3` Verify no expired waivers/quarantines are active.

Done when:

- All global acceptance criteria are evidenced and signed off.

## Why This v3 Is More Optimal Than v2

- Adds explicit fault taxonomy (`F1..F10`), not only workflow mapping.
- Adds diff coverage and state invariants, preventing “high line coverage, low semantic safety.”
- Adds release/post-release canary safeguards, improving real user protection.
- Adds scenario DSL bead to reduce implementation cost and improve maintainability.
- Tightens CI gate bead to enforce traceability and quantitative thresholds together.

## Fastest High-ROI Execution Order

1. `B000`, `B010`, `B020`, `B040`, `B090`.
2. `B050`, `B060`, `B070`, `B080`.
3. `B030`, `B100`, `B110`, `B130`.
4. `B120`, `B140`, `B160`.
5. `B150`, `B170`.

This order maximizes early risk reduction and keeps implementation parallel.
