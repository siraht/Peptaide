# Add an AI-Agent-Friendly CLI for Session Calculation, Logging, and Personal Settings

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository's ExecPlan format authority is `.agent/PLANSwHD.md`. This plan follows that file and must be maintained in accordance with it.

## Purpose / Big Picture

Peptaide currently supports fast session logging in the web UI, but automation from external AI agents still requires brittle browser automation or custom scripts. After this change, an agent will be able to call a stable CLI to: parse free text into structured session inputs, run dose/effective-dose calculations with full parameter control, persist sessions safely, manage session lifecycle actions (list/get/update/delete/restore), query read models across nearly all stored domains, manage cycle actions, and update personal settings.

The target outcome is a script-first interface where `--json` output is stable and automation-safe. Human users should also be able to use it interactively when needed.

## Progress

- [x] (2026-02-16 00:00Z) Audited existing session, calculation, cycle, import/export, and settings code paths to define required CLI surface and parameter coverage.
- [x] (2026-02-16 00:00Z) Brainstormed multiple implementation avenues with explicit pros/cons and selected a recommended architecture.
- [x] (2026-02-16 00:00Z) Re-reviewed this plan using the `t-create-cli` skill and corrected auth, tiering, idempotency, and Monte Carlo-contract ambiguities.
- [x] (2026-02-16 00:00Z) Re-reviewed the entire plan again and fixed remaining command-safety inconsistencies, idempotency conflict semantics, and deterministic MC details.
- [x] (2026-02-16 00:00Z) Performed another full fresh-eyes sweep and fixed context-resolution, non-interactive cycle-confirmation, and mutation idempotency requirements.
- [x] (2026-02-16 00:00Z) Performed final consistency pass and fixed missing flag declarations plus strict model-coverage behavior.
- [x] (2026-02-16 00:00Z) Expanded plan to explicitly include broad CLI query/retrieval coverage (substances/routes/formulations/dose history/inventory remaining/active-vial remaining and discoverable resource metadata).
- [x] (2026-02-16 00:00Z) Performed an additional full pass and corrected MC determinism wording, query command/schema details, and catalog/query alias clarity.
- [x] (2026-02-16 00:00Z) Performed final wording cleanup to remove residual deterministic-seeding ambiguity in MC parameter rules.
- [x] (2026-02-16 16:20Z) Completed command/flag contract and shared JSON schema contracts in `web/src/lib/api/contracts/cli.ts` and CLI command parser wiring in `cli/src/index.ts`.
- [x] (2026-02-16 16:26Z) Extracted reusable session service (`web/src/lib/app/sessions/createSession.ts`, `web/src/lib/app/sessions/calc.ts`) and rewired `createEventAction` to use shared service behavior.
- [x] (2026-02-16 16:31Z) Implemented machine-oriented API routes for auth/calc/sessions/cycles/settings/data/query/catalog under `web/src/app/api/cli/*`.
- [x] (2026-02-16 16:34Z) Added server-side idempotency persistence via migration `supabase/migrations/20260216173000_102_cli_idempotency.sql` and route integration through `withIdempotency`.
- [x] (2026-02-16 16:40Z) Built `cli/` package with profile/config precedence, output envelopes, exit-code mapping, and all command families from this plan.
- [x] (2026-02-16 16:55Z) Added tests and usage validation: `web` typecheck/tests, new CLI/unit tests, CLI usage smoke (`test:usage`, local profile/auth dry-run), and calc API smoke via CLI.
- [x] (2026-02-16 16:57Z) Ran browser regression smoke with t-browser harness (`npm run e2e:browser:smoke`) after implementation and after runtime fixes; both runs passed.
- [x] (2026-02-16 17:08Z) Performed a fresh-eyes post-implementation audit and fixed correctness issues in CLI/API behavior (auth refresh retry path, batch/update idempotency, import/batch error envelope semantics, stricter date validation, and safe stdout ZIP export behavior).
- [x] (2026-02-16 17:12Z) Performed a second fresh-eyes audit and fixed additional safety/clarity issues (force-required destructive applies across CLI/API destructive commands, safer export output ordering/sanitization, and minor settings message clarity).

## Surprises & Discoveries

- Observation: Most of the business logic needed for session creation already exists in `web/src/app/(app)/today/actions.ts`, but it is tied to server actions and `FormData` shape instead of a reusable service contract.
  Evidence: `createEventAction` handles quantity parsing, dose canonicalization, calibration, MC simulation, cycle suggestion/assignment, and event insert in one function.

- Observation: Import endpoints already provide a machine-friendly pathway for bulk events, including dry-run and apply modes.
  Evidence: `web/src/app/api/import-simple-events/route.ts` + `web/src/lib/import/simpleEvents.ts` support robust CSV import with summary/errors.

- Observation: Personal settings are fully represented in `profiles` and already validated in server actions.
  Evidence: `web/src/lib/repos/profilesRepo.ts`, `web/src/app/(app)/(hub)/settings/actions.ts`, and `web/src/app/(app)/(hub)/settings/notification-actions.ts` cover profile and notification preference updates.

- Observation: The initial plan under-specified headless auth constraints by implicitly leaning on browser-like session assumptions.
  Evidence: Existing API patterns include same-origin validation in several machine endpoints, which must be intentionally handled for CLI callers.

- Observation: The initial MC parameter section allowed ambiguous distribution mapping when requesting `compartment=both`.
  Evidence: A single base/multiplier flag set cannot unambiguously describe two distinct compartment models without compartment-scoped options.

- Observation: A second consistency pass found that some mutating commands in the command tree were missing explicit `--apply`, which conflicted with the plan-wide mutation safety rule.
  Evidence: `sessions create-from-text`, `sessions copy`, auth token mutation commands, and `data delete-all` originally lacked explicit apply markers.

- Observation: The previous model-resolution section did not require explicit context when dist IDs were omitted, which could make `calc effective` behavior under-specified.
  Evidence: Without `formulation_id` or `substance_id + route_id`, server-side distribution lookup has no deterministic key path.

- Observation: Current event creation seeds Monte Carlo using a random event identifier, so identical create requests are not automatically replay-deterministic unless idempotency/replay is applied.
  Evidence: `createEventAction` generates `eventId = randomUUID()` before deriving the MC seed.

- Observation: `query` and `catalog` command families partially overlapped, which risked schema drift unless explicitly linked.
  Evidence: both families listed substances/routes/formulations/vials retrieval commands with similar intent.

- Observation: Zod v4 throws at runtime when extending refined object schemas while overwriting keys with `.extend`.
  Evidence: `/api/cli/calc` initially failed with HTTP 500: `Cannot overwrite keys on object schemas containing refinements. Use .safeExtend() instead.`; fixed with `.safeExtend()` for `calcFromTextRequestSchema` and `sessionBatchItemSchema`.

- Observation: Commander command registration fails at runtime on duplicate option flags, even when TypeScript passes.
  Evidence: `test:usage` failed with `Cannot add option '--formulation-id <id>' ... conflicting flag` until duplicate `--formulation-id` declaration was removed from session-create flag composition.

- Observation: Several routes returned `ok: true` envelopes while using error-like codes (`validation_error`/`conflict`), causing automation to treat failures as success.
  Evidence: `sessions batch` partial failures and data import errors used `okEnvelope(...)` with conflict/error codes; fixed to return proper error envelopes (`ok: false`) via `CliApiError`.

- Observation: CLI refresh retry logic performed an unnecessary unauthenticated retry and skipped proper refresh behavior for some auth-domain calls.
  Evidence: `cli/src/http.ts` called `doFetch(null)` before refresh and had an auth-domain branch that bypassed refresh; fixed to explicit refresh-then-retry flow with recursion guard.

- Observation: Destructive CLI actions could still apply without `--force` in common non-prompt flows, and some API delete routes accepted `force` but ignored it.
  Evidence: `sessions delete`, `cycles rules delete`, and `data delete-all` initially allowed apply without force at one or both layers; fixed with explicit force checks in CLI and route handlers.

## Decision Log

- Decision: Treat "session" as the canonical `administration_events` record and include cycle actions as session-adjacent management commands.
  Rationale: This matches current product behavior and schema while minimizing naming ambiguity.
  Date/Author: 2026-02-16 / Codex

- Decision: Prefer a machine-first CLI contract (`--json`, non-interactive defaults, idempotency support) while retaining optional interactive ergonomics.
  Rationale: Primary consumer is an external AI agent; human convenience should not break scriptability.
  Date/Author: 2026-02-16 / Codex

- Decision: Recommended architecture is a staged hybrid: shared service layer + dedicated API routes + CLI client.
  Rationale: Reuses existing trusted logic and RLS boundaries, avoids duplicating core domain behavior in the CLI, and gives a stable contract for agents.
  Date/Author: 2026-02-16 / Codex

- Decision: Implement Tier 2 CLI architecture (framework parser) rather than a minimal Tier 1 parser.
  Rationale: The command tree exceeds Tier 1 complexity and needs consistent nested help, validation, and extension points.
  Date/Author: 2026-02-16 / Codex

- Decision: Do not rely on browser-only same-origin assumptions for CLI endpoints; use explicit CLI auth contracts.
  Rationale: Headless agent clients are non-browser callers and need deterministic authentication without CSRF-coupled browser semantics.
  Date/Author: 2026-02-16 / Codex

- Decision: Treat mutating CLI operations as explicit-apply commands and require server-side idempotency persistence.
  Rationale: Agent-driven retries and partial failures are common; explicit apply plus idempotency prevents accidental duplicate writes.
  Date/Author: 2026-02-16 / Codex

- Decision: Constrain `mc_seed` to uint53 and label effective-dose percentiles as Monte Carlo estimates.
  Rationale: This matches current numeric seed bounds and avoids overstating probabilistic precision.
  Date/Author: 2026-02-16 / Codex

- Decision: Define `mc_seed=auto` as deterministic canonical-request hashing, not random per invocation.
  Rationale: Predictable replay is essential for agent workflows, testing, and debugging.
  Date/Author: 2026-02-16 / Codex

- Decision: Treat idempotency-key hash mismatches as explicit conflicts.
  Rationale: Silent overwrite or duplicate creation under key reuse is unsafe for automated retry behavior.
  Date/Author: 2026-02-16 / Codex

- Decision: Require explicit context (`formulation_id` or `substance_id + route_id`) when effective-dose distributions are not passed explicitly.
  Rationale: This removes lookup ambiguity and keeps calculation requests deterministic.
  Date/Author: 2026-02-16 / Codex

- Decision: Default partial model coverage behavior to warnings + null compartment outputs, with an opt-in strict failure mode.
  Rationale: Matches current application behavior while allowing automation callers to enforce strict completeness when needed.
  Date/Author: 2026-02-16 / Codex

- Decision: Keep mutation safety default as dry-run and require explicit `--apply` on CLI mutating commands, even for token/profile-local helpers.
  Rationale: Preserves automation safety and aligns with plan-wide "no implicit mutation" policy.
  Date/Author: 2026-02-16 / Codex

- Decision: Add focused unit tests for helper contracts (`idempotency`, `request` safety, query resource metadata, CLI config/filter/exit-code behavior) before broader live integration coverage.
  Rationale: Fast deterministic validation gives immediate protection for contract regressions while keeping implementation velocity.
  Date/Author: 2026-02-16 / Codex

- Decision: Use the existing t-browser smoke harness for regression checks after service extraction from `createEventAction`.
  Rationale: This change touched core today/session behavior; browser-level verification confirms no major UI/workflow regression.
  Date/Author: 2026-02-16 / Codex

- Decision: Treat CLI/API envelope correctness (`ok` flag fidelity) as a hard contract and fail routes with `CliApiError` when import/batch operations report domain errors.
  Rationale: Agent automation and exit-code mapping depend on `ok` semantics; code-only error labels inside success envelopes are unsafe.
  Date/Author: 2026-02-16 / Codex

- Decision: Enforce `force=true` for destructive apply operations in CLI/API routes rather than relying on interactive confirmations that are not currently implemented.
  Rationale: This prevents accidental irreversible mutations and makes safety behavior deterministic for automation.
  Date/Author: 2026-02-16 / Codex

## Outcomes & Retrospective

Implementation outcome for this phase:

- Delivered shared service extraction for session computation/persistence and integrated it back into Today server actions.
- Delivered CLI route surface (`auth`, `calc`, `sessions`, `cycles`, `settings`, `data`, `query`, `catalog`) with stable envelope responses and request validation.
- Delivered server-side idempotency persistence and replay/conflict semantics.
- Delivered `cli/` package command tree and supporting runtime modules (config/profile/http/output/filter/exit-code).
- Delivered docs (`docs/CLI.md`, `README.md` CLI quick start) and test coverage additions across `web` and `cli`.

Validation outcome:

- `web`: `npm run typecheck`, `npm test` passed.
- `cli`: `npm run typecheck`, `npm run build`, `npm test`, `npm run test:usage` passed.
- Browser regression: `npm run e2e:browser:smoke` passed (twice, including post-fix rerun).

Remaining gaps:

- Full authenticated end-to-end command matrix (all mutating CLI flows against a seeded local dataset) is not yet automated in a dedicated CLI integration suite.
- A post-implementation review pass fixed several contract-level correctness gaps without changing command surface area; the remaining gap is deeper live integration coverage rather than core behavior.

## Context and Orientation

Relevant current implementation areas:

- Session creation and calculation orchestration:
  - `web/src/app/(app)/today/actions.ts`
  - `web/src/lib/domain/dose/computeDose.ts`
  - `web/src/lib/domain/units/types.ts`
  - `web/src/lib/domain/uncertainty/monteCarlo.ts`
  - `web/src/lib/domain/cycles/suggest.ts`
- Session read/list helpers:
  - `web/src/lib/repos/eventsRepo.ts`
- Cycle actions:
  - `web/src/lib/repos/cyclesRepo.ts`
  - `web/src/app/(app)/(hub)/cycles/actions.ts`
  - `web/src/app/(app)/(hub)/cycles/[cycleInstanceId]/actions.ts`
- Personal settings and notification preferences:
  - `web/src/lib/repos/profilesRepo.ts`
  - `web/src/app/(app)/(hub)/settings/actions.ts`
  - `web/src/app/(app)/(hub)/settings/notification-actions.ts`
- Existing machine endpoints for portability/import:
  - `web/src/app/api/import-simple-events/route.ts`
  - `web/src/app/api/import/route.ts`
  - `web/src/app/api/export/route.ts`
  - `web/src/app/api/delete-my-data/route.ts`

## Avenues Considered (Pros/Cons)

### Avenue A: Thin CLI on top of existing/expanded Next API routes

Description:
CLI communicates only with web API endpoints. Add new routes for sessions/cycles/settings and reuse server-side domain behavior.

Pros:
- Reuses server-side domain logic and current RLS trust model.
- Fastest path to production with lowest duplication.
- Easier parity with web behavior over time.

Cons:
- Requires robust API design and versioning discipline.
- Session-cookie auth and same-origin/CSRF constraints can be awkward for headless agents unless a CLI-specific auth mode is defined.
- More backend route surface to maintain.

### Avenue B: Direct Supabase CLI mode (no new API routes)

Description:
CLI authenticates with Supabase directly and writes/reads tables via generated client.

Pros:
- Fewer web-server changes.
- Potentially lower latency and high throughput for bulk automation.

Cons:
- High risk of logic drift by duplicating server logic (dose/cycle/model semantics).
- More security risk if service-role credentials leak into agent workflows.
- Harder to preserve exact web parity for validations and side effects.

### Avenue C: Hybrid with shared domain service + API adapter + CLI

Description:
Extract session calculation/persistence into shared application services in `web/src/lib/app/` (or similar), expose via stable API routes, consume from CLI.

Pros:
- Single source of truth for business logic.
- Best long-term maintainability and testability.
- Clean machine contract and easier backward compatibility.

Cons:
- Higher initial refactor cost than Avenue A.
- Requires careful separation from Next server action specifics.

### Recommended Path

Choose Avenue C in staged rollout:

1. Phase 1 uses API-first access, but only after extracting a shared service layer from `createEventAction`.
2. CLI calls stable API routes with deterministic JSON contracts and an explicit non-browser auth contract.
3. Keep direct Supabase mode out of MVP; revisit only for explicit high-volume batch requirements.

## CLI Design Goals

- Agent-first: predictable JSON, no hidden prompts, explicit failure semantics.
- Human-usable: clear help, examples, safe defaults, optional prompts in TTY.
- Full parameter exposure for calculations and persistence decisions.
- Idempotent creation options for retry-safe automation.
- Backward-compatible contracts with explicit versioning.

## Workflow Path and Tier Selection

This plan started with a `t-create-cli` contract-first path and has now been implemented in this repository.

Tier recommendation:

- Use Tier 2 for implementation (framework-based command parser, likely Commander.js), because the proposed command surface is large, nested, and includes non-trivial validation relationships across flags.

## Proposed CLI Name and Usage

Name: `peptaide`

One-liner: `Agent-friendly CLI for Peptaide session calculation, logging, cycle actions, and personal settings.`

Usage:

- `peptaide [global flags] <command> [subcommand] [flags]`

Global flags:

- `-h, --help`
- `--version`
- `--json` (machine output)
- `--plain` (stable line-based output)
- `-q, --quiet`
- `-v, --verbose`
- `--no-input` (disable prompts)
- `--no-color`
- `--api-url <url>`
- `--profile <name>`
- `--timeout-ms <int>`
- `--request-id <id>`

Config/env precedence:

- flags > env > project config > user config > built-in defaults
- env examples:
  - `PEPTAIDE_API_URL`
  - `PEPTAIDE_PROFILE`
  - `PEPTAIDE_TIMEOUT_MS`
  - `PEPTAIDE_AUTH_TOKEN`

## Proposed Command Tree

### Auth

- `peptaide auth login --email <email>`
- `peptaide auth verify --email <email> --code <otp>`
- `peptaide auth token create --name <label> [--expires-days <n>] [--apply]`
- `peptaide auth token revoke --token-id <id> [--apply --force]`
- `peptaide auth whoami`
- `peptaide auth logout`

### Calculation

- `peptaide calc parse --text "0.3mL"`
- `peptaide calc dose [full parameter set]`
- `peptaide calc effective [full MC/model parameter set]`
- `peptaide calc from-text --text "..." [overrides]`

### Sessions (administration events)

- `peptaide sessions create [structured fields] [--apply]`
- `peptaide sessions create-from-text --text "..." [mapping flags] [--apply]`
- `peptaide sessions batch --jsonl <file> [--apply|--dry-run]`
- `peptaide sessions list [filters]`
- `peptaide sessions get --id <event_id>`
- `peptaide sessions update --id <event_id> [editable fields] [--apply]`
- `peptaide sessions delete --id <event_id> [--apply --force]`
- `peptaide sessions restore --id <event_id> [--apply]`
- `peptaide sessions copy --id <event_id> [overrides] [--apply]`

### Cycles

- `peptaide cycles suggest --substance-id <id> --new-event-ts <iso>`
- `peptaide cycles start --substance-id <id> [--start-ts <iso>] [--apply]`
- `peptaide cycles end --cycle-id <id> [--end-ts <iso>] [--apply]`
- `peptaide cycles abandon --cycle-id <id> [--end-ts <iso>] [--apply]`
- `peptaide cycles split --cycle-id <id> --event-id <id> [--apply]`
- `peptaide cycles list [--substance-id <id>] [--active]`
- `peptaide cycles get --cycle-id <id>`
- `peptaide cycles rules get --substance-id <id>`
- `peptaide cycles rules set --substance-id <id> --gap-days-to-suggest-new-cycle <int> [--auto-start-first-cycle=true|false] [--notes <text>] [--apply]`
- `peptaide cycles rules delete --cycle-rule-id <id> --apply --force`

### Settings

- `peptaide settings profile get`
- `peptaide settings profile set [profile flags] [--apply]`
- `peptaide settings notifications get`
- `peptaide settings notifications set [notification flags] [--apply]`

### Data portability

- `peptaide data export --out <zip_path>`
- `peptaide data import-bundle --file <zip_path> [--apply|--dry-run] [--replace]`
- `peptaide data import-simple-events --file <csv_path> [--apply|--dry-run] [--replace] [--infer-cycles|--no-infer-cycles]`
- `peptaide data delete-all --confirm DELETE --apply --force`

Data command note:

- `data export` should support `--out -` to write ZIP bytes to stdout for pipeline automation.

Query resource coverage target (MVP):

- Core reference data: `substances`, `routes`, `formulations`, `devices`, `distributions`, `evidence_sources`.
- Session data: `administration_events` (dose history), including deleted/non-deleted filtering.
- Inventory data: `vials`, inventory-status view, inventory-summary view, active-vial rollups.
- Cycle data: `cycle_instances`, `cycle_rules`, cycle-summary view.
- Operational data: `orders`, `order_items`, `vendors`, order-item-vial counts.
- Settings/profile data: `profiles` (read), notification preference fields.
- Analytics read models currently used by UI pages (for example daily totals, spend/runway summaries, warning views).

### Catalog helpers (for agent lookup by name/id)

- `peptaide catalog substances list [--query]`
- `peptaide catalog routes list [--query]`
- `peptaide catalog formulations list [--query] [--substance-id]`
- `peptaide catalog vials list [--formulation-id] [--status]`

Catalog note:

- `catalog` commands are convenience aliases over `query` shortcuts and must return the same schema contracts.

### Query (broad read access)

- `peptaide query resources` (list all supported queryable resources and filters)
- `peptaide query list --resource <name> [filters] [--sort <field:asc|desc>] [--limit <n>] [--cursor <token>] [--fields <csv>]`
- `peptaide query get --resource <name> --id <id> [--fields <csv>]`
- `peptaide query aggregate --resource <name> --metric <metric> [filters]`

Required first-class shortcuts (must map to stable query contracts):

- `peptaide query substances [--query]`
- `peptaide query routes [--query]`
- `peptaide query formulations [--query] [--substance-id]`
- `peptaide query dose-history [--from] [--to] [--substance-id] [--formulation-id] [--include-deleted]`
- `peptaide query inventory [--substance-id] [--formulation-id] [--status]`
- `peptaide query inventory-summary [--substance-id]`
- `peptaide query active-vials [--substance-id] [--formulation-id]`

## Full Parameter Exposure for Calculation

The CLI must support both raw text input and fully structured inputs.

### Input parsing parameters

- `--input-text <string>` (source text)
- `--input-kind <mass|volume|device_units|iu|other>`
- `--input-value <number>`
- `--input-unit <string>`
- `--normalized-unit <string>` (optional override, mostly for debug/replay)
- `--prefer-structured` (resolve input-text + structured conflicts by preferring structured fields)

Rules:
- Either provide `--input-text` alone, or provide full structured triplet (`--input-kind`, `--input-value`, `--input-unit`).
- If both are present, structured values win only when `--prefer-structured` is set; otherwise return validation error.
- For text parsing parity with current app behavior, unknown unit tokens map to `device_units`; `other` is allowed only through explicit structured input.

### Dose computation parameters

- `--concentration-mg-per-ml <number>`
- `--vial-content-mass-mg <number>`
- `--vial-total-volume-ml <number>`
- `--volume-ml-per-device-unit <number>`
- `--prefer-direct-concentration`

Rules:
- `concentration` can be provided directly or derived from `vial-content-mass-mg / vial-total-volume-ml`.
- If both direct concentration and vial-derived concentration are provided and differ beyond a small tolerance, fail validation unless `--prefer-direct-concentration` is set.
- For `device_units`, `volume-ml-per-device-unit` is required.

### Effective dose / MC parameters

- `--dose-mg <number>` (optional override)
- `--compartment <systemic|cns|both>`
- `--base-fraction-dist-id <id>`
- `--multiplier-dist-id <id>` (repeatable)
- `--formulation-id <id>` (context fallback for server-side model resolution)
- `--substance-id <id>` / `--route-id <id>` (advanced context fallback when formulation is not provided)
- `--systemic-base-fraction-dist-id <id>` / `--cns-base-fraction-dist-id <id>` (required when explicit `--compartment both` modeling is requested)
- `--systemic-multiplier-dist-id <id>` / `--cns-multiplier-dist-id <id>` (repeatable, compartment-scoped)
- `--mc-n <int>`
- `--mc-seed <uint53|auto>`
- `--strict-model-coverage`

Rules:
- If distribution IDs are omitted, require either `--formulation-id` or the pair `--substance-id` + `--route-id` for server-side model resolution.
- If `--compartment both` is requested with explicit distribution IDs, require per-compartment flags (`--systemic-base-fraction-dist-id`, `--cns-base-fraction-dist-id`, and compartment-scoped multipliers) to avoid ambiguous mappings.
- `mc_seed` must be a non-negative integer in `[0, 2^53 - 1]` to match current numeric seed bounds/storage.
- For `calc` commands, when `mc_seed=auto`, derive a deterministic seed from canonicalized request payload so repeated dry-runs are reproducible.
- For session-create commands, preserve server parity unless an explicit deterministic-seed mode is requested.
- Percentiles are nearest-rank empirical quantiles of Monte Carlo draws from the configured model and converge with larger `n`; they are not exact posterior quantiles.
- If model coverage is missing for a requested compartment, return warnings and null estimates by default; with `--strict-model-coverage`, fail validation instead.
- If provided, run explicit deterministic simulation contract and store snapshot metadata.

### Session persistence parameters

- `--formulation-id <id>` or `--formulation-name <name>`
- `--vial-id <id>` (optional explicit vial binding)
- `--ts <iso8601>` or `--date <YYYY-MM-DD> --time <HH:MM> --timezone <iana>`
- `--notes <text>`
- `--tag <text>` (repeatable)
- `--cycle-decision <auto|new_cycle|continue_cycle>`
- `--idempotency-key <string>`
- `--dry-run` / `--apply`

Rules:
- If `--ts` is not provided, `--date`, `--time`, and `--timezone` are all required to avoid ambiguous local-time interpretation.
- `--cycle-decision auto` means run normal suggestion logic and only prompt/return confirm states when required by cycle rules.
- In `--no-input` mode, if cycle logic requires user confirmation and no explicit `--cycle-decision` was supplied, return conflict (`exit code 5`) with actionable guidance.
- `--formulation-name` is a convenience resolver only; if it matches multiple rows, fail and require `--formulation-id`.

## Session Management Scope

Session lifecycle coverage in CLI MVP:

- create (single)
- create from text
- create batch (JSONL)
- list with filters
- read single
- update editable fields (notes, tags, timestamp, input fields), with server-side recomputation of derived values only when dose/model-affecting fields change
- soft delete
- restore

Non-goal for MVP session updates:

- CLI callers cannot directly set derived fields (`dose_mass_mg`, percentile outputs, `model_snapshot`, `mc_seed`, `mc_n`, `cost_usd`); those are recomputed or preserved by server rules.

Filters to expose:

- time range (`--from`, `--to`)
- formulation/substance/cycle IDs
- include deleted / deleted only
- limit / pagination cursor

## Query and Retrieval Scope

Query commands must be machine-stable and support:

- Resource discovery (`query resources`) with documented filter/sort fields.
- Deterministic ordering defaults per resource (for example timestamp desc for histories).
- Cursor pagination and explicit limits.
- Field projection (`--fields`) to reduce payload size for agents.
- Consistent filter grammar across resources (`--filter key=op:value` and first-class flags for common paths).
- Stable schema versioning metadata in `query resources` output so automation can detect contract changes.

Inventory-specific retrieval guarantees:

- Expose remaining mass/volume for each vial where available.
- Expose substance-level total stock and active-vial identifiers.
- Expose active-vial remaining values used by Control Center cards.

## Personal Settings Scope

Profile settings:

- `timezone`
- `default_mass_unit`
- `default_volume_unit`
- `default_simulation_n`
- `cycle_gap_default_days`

Notification settings:

- `notify_low_stock_enabled`
- `notify_low_stock_runway_days_threshold`
- `notify_spend_enabled`
- `notify_spend_usd_per_day_threshold`
- `notify_spend_window_days`

All settings commands must support read-after-write output to make automation assertions easy.

## Output Contract and Exit Codes

Standard JSON envelope for all commands when `--json`:

- `ok: boolean`
- `code: string` (stable machine code)
- `message: string`
- `data: object | null`
- `warnings: string[]`
- `errors: string[]`
- `request_id: string`

Human/plain output rules:

- Primary command results go to stdout.
- Diagnostics, warnings, retries, and failures go to stderr.
- `--plain` must remain line-stable for scripts that do not use JSON.

Exit codes:

- `0` success
- `1` unexpected runtime failure
- `2` usage/validation error
- `3` auth failure
- `4` not found
- `5` conflict (duplicate/idempotency/cycle conflict)
- `6` upstream/network timeout

## Safety and Idempotence Rules

- Mutating commands (`auth token create/revoke`, `sessions create/create-from-text/copy/update/delete/restore/batch`, `cycles start/end/abandon/split/rules set/rules delete`, settings set commands, data import/delete) require explicit `--apply`; otherwise they run in `--dry-run`.
- Destructive actions require one of:
  - interactive confirmation in TTY, or
  - `--force --no-input` in non-interactive mode.
- All network mutation endpoints should support idempotency keys, with mandatory enforcement for create-like operations (`sessions create`, `sessions create-from-text`, `sessions copy`, `sessions batch`) in non-interactive automation modes.
- Retries with same idempotency key must not create duplicate sessions.
- Server-side idempotency storage is required (request hash + key + user scope + response replay), not just client-side retry logic.
- Reusing the same idempotency key with a different request hash must return a deterministic conflict (`409` / exit code `5`) rather than applying a second write.

## Plan of Work

### Milestone 1: Contract-first API and shared service extraction

Create a reusable application service for session creation and calculation by extracting logic from `createEventAction` into composable, typed functions. Add API routes for sessions, cycles, and settings that return stable JSON envelopes. Define auth for CLI routes explicitly (cookie-jar OTP flow and/or bearer tokens), and avoid browser-only CSRF assumptions for machine callers.

### Milestone 2: CLI skeleton and auth/config foundation

Implement CLI command tree, shared output/error handling, auth flows, config precedence, and global flags. Add non-interactive defaults, durable credential storage/profile switching, and `--json` stability tests.

### Milestone 3: Calculation and session commands

Implement `calc *` and `sessions *` commands, including full parameter exposure and `create-from-text` mode with deterministic parse + override behavior.

### Milestone 4: Cycle/settings/data commands

Implement cycle management, profile/notification settings management, and portability helpers (export/import/delete-all).

### Milestone 4b: Broad query surface

Implement `query` resource discovery, list/get/aggregate contracts, and first-class shortcuts for dose history and inventory remaining/active-vial remaining.

### Milestone 5: Hardening and docs

Add contract tests, scenario e2e tests, command examples, migration notes, and operational docs.

## Concrete Steps

When implementation starts, execute in this order:

1. Define TypeScript API request/response schemas under a shared folder (`web/src/lib/api/contracts/`).
2. Extract session service from `createEventAction` into `web/src/lib/app/sessions/` with unit tests.
3. Introduce new API routes:
   - `web/src/app/api/cli/sessions/*`
   - `web/src/app/api/cli/cycles/*`
   - `web/src/app/api/cli/settings/*`
4. Add server-side idempotency persistence (new table + unique user/key index + response replay policy) for mutation endpoints.
5. Create CLI workspace package (proposed `cli/`) with command parser and shared HTTP client.
6. Add command-by-command integration tests against local web server.
7. Implement query resource adapters and snapshot tests for resource schemas/ordering/pagination behavior.
8. Add docs:
   - `docs/CLI.md`
   - update `README.md` with quick-start examples.

## Validation and Acceptance

Accept this feature when all are true:

1. An agent can provide text input and persist a session via one command in non-interactive mode.
2. CLI can run dry-run calculation with full override parameters and returns deterministic JSON.
3. CLI supports complete session lifecycle actions including restore.
4. CLI supports profile and notification settings get/set flows.
5. Cycle actions (suggest/start/end/abandon/split) are callable from CLI.
6. Contract tests and integration tests pass in CI, and docs include at least 10 realistic examples.
7. CLI auth works in true headless mode without requiring browser-only same-origin assumptions.
8. Effective-dose outputs are reproducible when `mc_seed` is provided and clearly labeled as Monte Carlo estimates.
9. CLI query commands can retrieve substances, routes, formulations, dose history, vial inventory remaining, and active-vial remaining values through stable machine contracts.
10. `query resources` enumerates supported resources and filter fields so agents can discover available data without source inspection.

## Interfaces and Dependencies

Primary new interfaces to define during implementation:

- `SessionCreateRequest` / `SessionCreateResponse`
- `SessionCalculationRequest` / `SessionCalculationResponse`
- `SessionListRequest` / `SessionListResponse`
- `ProfileUpdateRequest` / `ProfileResponse`
- `NotificationPrefsUpdateRequest` / `NotificationPrefsResponse`
- `CycleActionRequest` / `CycleActionResponse`
- `CliAuthLoginRequest` / `CliAuthLoginResponse`
- `IdempotencyRecord` (user-scoped key, request hash, stored response envelope)

Likely dependency choices:

- CLI parser: `commander` or `yargs` (choose one and standardize)
- Runtime validation: `zod`
- HTTP client: `undici`/native fetch
- Test runner in CLI package: `vitest`

## Risks and Mitigations

Risk: Divergence between web UI behavior and CLI behavior.
Mitigation: shared service extraction and contract tests that exercise both paths.

Risk: Auth complexity for headless agent environments.
Mitigation: support both OTP cookie-jar login and scoped CLI bearer tokens, each with explicit revocation and expiration behavior.

Risk: Free-text ingestion ambiguity.
Mitigation: deterministic parse path with explicit override flags and dry-run review mode.

Risk: Monte Carlo outputs are over-interpreted as exact certainty.
Mitigation: label outputs as sampled estimates, expose `mc_n`/`mc_seed`, and document convergence behavior.

Risk: duplicate session writes during retries or partial network failures.
Mitigation: require server-enforced idempotency keys for mutation commands.

Risk: partial model coverage can silently produce null compartment estimates.
Mitigation: emit explicit warnings by default and provide `--strict-model-coverage` to fail fast in automation workflows.

Risk: broad query endpoints drift from UI read models and create inconsistent numbers.
Mitigation: back query endpoints with the same repository/view layer used by UI pages and add contract/snapshot tests for key rollups (inventory summary, active-vial remaining, dose history ordering).

## Revision Note

Created this plan to define how Peptaide can add an AI-agent-oriented CLI without coding yet. The plan includes architecture options, pros/cons, recommended path, full command surface, parameter exposure requirements, and phased implementation milestones.

2026-02-16 revision: re-audited with the `t-create-cli` skill and corrected design gaps around tier selection, headless auth assumptions, idempotency guarantees, cycle-rule coverage, and Monte Carlo parameter semantics.

2026-02-16 revision (second fresh-eyes pass): fixed remaining command-tree/apply consistency gaps, clarified idempotency conflict behavior, and tightened deterministic Monte Carlo seed semantics.

2026-02-16 revision (third fresh-eyes pass): fixed model-resolution context requirements, clarified non-interactive cycle-confirmation failure behavior, and tightened idempotency requirements for automated mutation flows.

2026-02-16 revision (final consistency pass): fixed missing option declarations referenced by rules and clarified strict vs warning behavior for partial model coverage.

2026-02-16 revision (query scope pass): explicitly added broad query/retrieval command surface and acceptance criteria for substances, routes, formulations, dose history, inventory remaining, and active-vial remaining.

2026-02-16 revision (additional fresh-eyes pass): corrected MC determinism wording to match current behavior, clarified query/list/get schema controls, and aligned catalog aliases with query contracts.

2026-02-16 revision (wording cleanup): removed remaining ambiguous deterministic-seed wording in MC rule text to keep probabilistic behavior statements precise.

2026-02-16 revision (implementation complete): updated the living plan after delivery to reflect completed milestones, added runtime discoveries (Zod safeExtend + Commander duplicate flags), recorded implementation decisions, and replaced planning-only retrospective text with concrete implementation/test/browser-validation outcomes.

2026-02-16 revision (fresh-eyes audit): fixed post-delivery correctness bugs discovered during careful review, including envelope `ok` semantics for import/batch failures, CLI auth-refresh retry flow, session batch/update idempotency behavior, date parsing validation strictness, and binary stdout export safety for `data export --out -`.

2026-02-16 revision (second fresh-eyes audit): tightened destructive apply safety by requiring force at CLI/API layers for destructive commands, improved data export file-output ordering/sanitization, and updated CLI docs to match enforced force semantics.
