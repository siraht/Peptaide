# Traceability Matrix

This matrix links user workflows (`U*`) and fault classes (`F*`) to automated tests and target lanes.

## Workflows

| Workflow | Description | Current Automated Coverage | Target Lanes |
| --- | --- | --- | --- |
| U1 | Onboarding (`/sign-in` -> setup -> usable `/today`) | `e2e:browser:smoke`, `e2e:browser` | `pr-smoke`, `pr-critical` |
| U2 | Daily logging and downstream updates | `e2e:browser:today`, `e2e:browser`, `simpleEvents.test.ts` | `pr-critical`, `nightly-exhaustive` |
| U3 | Master data CRUD chains | `e2e:browser:settings`, `e2e:browser:reference`, `e2e:browser` | `pr-critical`, `nightly-exhaustive` |
| U4 | Procurement -> generated vials -> cost propagation | `e2e:browser:orders`, `e2e:browser:inventory`, `e2e:browser` | `pr-critical`, `nightly-exhaustive` |
| U5 | Inventory lifecycle + reconcile | `e2e:browser:inventory`, `e2e:browser` | `pr-critical`, `nightly-exhaustive` |
| U6 | Evidence/distributions/settings persistence | `e2e:browser:settings`, `e2e:browser:reference`, `e2e:browser` | `pr-critical`, `nightly-exhaustive` |
| U7 | Export/delete/import integrity | `e2e:browser`, `csvBundle.test.ts` | `pr-critical`, `nightly-exhaustive` |
| U8 | Cross-user isolation / RLS | `e2e:browser` (multi-user phase) | `pr-critical`, `nightly-exhaustive` |

## Fault Classes

| Fault | Description | Existing Detection | Planned Additions |
| --- | --- | --- | --- |
| F1 | Validation failures | Existing parser tests, some E2E form assertions | Add per-domain negative-path matrices |
| F2 | Authorization/RLS failures | Full-scope E2E cross-user checks | Add dedicated adversarial integration tests |
| F3 | Data integrity / invariants | Domain tests + partial E2E assertions | Add repo/action invariant suites |
| F4 | Timezone/math drift | Domain unit tests | Raise branch + mutation thresholds |
| F5 | Partial failure / retry corruption | Some import/reconcile checks in E2E | Add explicit fault-injection and retry suites |
| F6 | Runtime/session/network instability | Runtime preflight + E2E retry logic | Add structured resilience matrix |
| F7 | UX interaction regressions | E2E flow assertions, selector usage | Add selector/contract tests and keyboard checks |
| F8 | Cross-device/accessibility regressions | Mobile route sweeps in E2E | Add actionable mobile/tablet workflows + a11y smoke |
| F9 | Performance regressions | Informal timing from run logs | Add formal scenario timing budgets |
| F10 | Flake / observability blind spots | Diagnostics + screenshots + JSONL step traces + run summary artifacts in E2E | Add longitudinal flake metrics and alerting |

## Notes

- This file is intentionally stable and should be updated whenever workflow coverage changes.
- All new critical tests should include a workflow or fault tag in the test name or metadata.
