# No-Fakes Policy (Integration and E2E)

## Purpose

Integration and browser tests must validate real behavior against the real persistence stack. Fake DB/query layers can hide production failures and create false confidence.

## Rules

- Do not use fake query/database classes in integration tests.
- Do not cast arbitrary objects to `DbClient` for integration-path tests.
- Do not add `vi.mock(...)` in integration suites unless there is a documented, temporary waiver.

Unit tests for pure domain logic may still use deterministic test doubles where there is no persistence boundary.
When a unit test must call an API typed to `DbClient`, use the explicit unit-only adapter helper (`src/lib/testHarness/asDbClientForUnitTest.ts`) instead of ad-hoc casts in test bodies.

## Waivers

Waivers are allowed only when all conditions below are true:

- There is no practical short-term real-system alternative.
- The waiver has an owner, rationale, and explicit expiry date.
- The waiver is recorded in `web/docs/testing/no-fakes-waivers.json`.

Expired waivers are treated as violations.

## Enforcement

Run:

    npm run test:no-fakes

This script scans test files and fails on unwaived banned patterns.

## Migration Guidance

When replacing fake behavior:

1. Build fixtures through the real test harness (`test:db:reset` + deterministic seed).
2. Assert persisted state (tables/derived values), not only return messages.
3. Keep temporary waiver windows short.
