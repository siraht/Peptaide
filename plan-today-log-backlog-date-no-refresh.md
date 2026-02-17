# Today Log Backlog Date And Non-Refreshing Save

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository's ExecPlan format authority is `.agent/PLANSwHD.md`. This ExecPlan is maintained in accordance with that file.

## Purpose / Big Picture

After this change, the Today log input row will include a date field before the time field. The date will default to the user’s current local date but can be changed for backlogging doses. Saving a dose will no longer refresh the entire `/today` page and interrupt the workflow; the new row will appear inline in the table immediately.

## Progress

- [x] (2026-02-17 17:41Z) Located the relevant submit pipeline (`web/src/app/(app)/today/today-log-table.tsx` + `web/src/app/(app)/today/actions.ts`) and confirmed the full page refresh is caused by `router.refresh()` after save.
- [x] (2026-02-17 17:43Z) Added explicit local-date parsing/conversion helpers and tests in `web/src/lib/time/timeZone.ts` + `web/src/lib/time/timeZone.test.ts`.
- [x] (2026-02-17 17:44Z) Extended session creation/event action contract for `date_ymd` (`web/src/lib/app/sessions/createSession.ts`, `web/src/app/(app)/today/actions.ts`).
- [x] (2026-02-17 17:44Z) Updated Today log UI to include a date input before time, defaulted to local current date, and submitted in payload (`web/src/app/(app)/today/today-log-table.tsx`).
- [x] (2026-02-17 17:44Z) Removed `router.refresh()` from save path and added optimistic table-row insertion for same-day events only, preserving sort order and avoiding full-page refresh.
- [x] (2026-02-17 17:44Z) Ran web validation: `npm --prefix web run typecheck` passed; `npm --prefix web run test` passed (24 files / 119 tests); `npm --prefix web run lint` failed on pre-existing unrelated `no-explicit-any` issues in `web/src/lib/api/cli/{idempotency,query}.ts`.
- [x] (2026-02-17 17:57Z) Ran t-browser validation: full harness `npm --prefix web run e2e:browser:today` failed in initialization (existing harness/runtime issue), then completed direct t-browser (`agent-browser`) validation of requested behaviors, including DB timestamp verification for backlog date.
- [x] (2026-02-17 17:57Z) Finalized ExecPlan living sections with outcomes and evidence.

## Surprises & Discoveries

- Observation: The save path is already server-action based, but the client forces a full route refresh even after receiving a successful response.
  Evidence: `web/src/app/(app)/today/today-log-table.tsx` calls `startTransition(() => { router.refresh() })` inside the success branch.
- Observation: The packaged t-browser suite timed out before assertions because the runtime hit stale chunk/cache behavior during initialization; this was not specific to the new feature logic.
  Evidence: `/tmp/peptaide-e2e-2026-02-17T17-46-48-325Z/run.summary.json` failed with `Timed out waiting for today content rendered`, and browser diagnostics reported failed chunk loads.
- Observation: Running a fresh `next start` process and fresh agent-browser daemon/session eliminated the chunk-load runtime error for targeted validation.
  Evidence: direct t-browser session `tb-final` loaded `/today`, seeded demo data, and executed save/backlog checks successfully.

## Decision Log

- Decision: Keep server-side revalidation calls in `createEventAction`, but stop refreshing the route from the client and instead update only the log table state optimistically.
  Rationale: This preserves data freshness for future navigations while eliminating the immediate UX interruption on `/today`.
  Date/Author: 2026-02-17 / Codex
- Decision: Only optimistically append newly saved rows when they still belong to the rendered Today slice (same local day and not `showDeleted` mode).
  Rationale: `/today` intentionally renders today-only rows; backlogged saves should persist successfully but should not produce inconsistent, temporary off-day rows that disappear on next reload.
  Date/Author: 2026-02-17 / Codex

## Outcomes & Retrospective

Implemented the date backlog capability and non-refresh save behavior end to end.

User-visible outcomes:

- The inline Today log input row now has a date field before the time field.
- Date defaults to current local date.
- Save no longer triggers full page refresh/loading fallback.
- Same-day saves appear immediately in the table via optimistic insert.
- Backlogged saves persist with selected date/time and do not disrupt the Today-only list.

Validation outcomes:

- Typecheck and full test suite passed.
- Lint still fails on unrelated pre-existing files.
- Direct t-browser session verified both requested UX behaviors and DB timestamp correctness for a backlogged event.

## Context and Orientation

`web/src/app/(app)/today/today-log-table.tsx` is the interactive client component that renders the Today log table, collects input, and invokes `createEventAction`. It currently tracks `timeHHMM`, dose input text, and notes; it does not currently track a separate date.

`web/src/app/(app)/today/actions.ts` contains `createEventAction`, which receives form data from the table, calls `createSession`, and triggers route revalidation.

`web/src/lib/app/sessions/createSession.ts` derives the event timestamp from either an explicit ISO timestamp (`ts`) or a local time (`timeHHMM`) interpreted against the user profile timezone and “today.”

`web/src/lib/time/timeZone.ts` contains timezone conversion helpers used by `createSession`, including conversion from a local wall-clock time to UTC ISO.

## Plan of Work

I will first extend the time helper layer to accept an explicit local date string (`YYYY-MM-DD`) and convert local date+time+timezone to UTC ISO deterministically, then add tests for valid and invalid inputs and DST-sensitive conversion behavior. Next I will pass the new optional date field through the server action and session creation pipeline so saves can target non-today dates safely in the user’s timezone.

Then I will modify the Today log input row to render a date input before time, with default local date and existing time behavior. The submit payload will include `date_ymd` when present. I will remove the route refresh on success and replace it with local table state updates by appending the newly created event row returned by the server action, sorted chronologically with stable tie-breakers. This keeps the rest of `/today` static during save and removes the workflow interruption.

Finally I will run automated tests and then t-browser end-to-end checks to prove both requested behaviors: backlog date entry works and the page no longer hard-refreshes after save.

## Concrete Steps

From repository root (`/data/projects/peptaide`):

1. Implemented time/date conversion helpers and tests.
   `npm --prefix web run test -- src/lib/time/timeZone.test.ts`
2. Implemented `date_ymd` plumbing in Today action + session creation.
3. Implemented Today log date input and no-refresh optimistic save path.
4. Ran quality checks.
   `npm --prefix web run typecheck`
   `npm --prefix web run test`
   `npm --prefix web run lint` (known unrelated failures)
5. Ran t-browser checks.
   `npm --prefix web run e2e:browser:today` (failed during harness init)
   Direct agent-browser (`tb-final`) validation for:
   - date input exists and is ordered before time
   - default date equals current date
   - save does not surface `today-loading` marker
   - backlogged save writes selected date/time
6. Queried DB for proof of persisted backlog timestamp for the signed-in test user.
   `psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' ...`

## Validation and Acceptance

Acceptance criteria:

- In `/today`, the inline input row shows a date control before the time control.
- Date defaults to the user’s current local date on initial render.
- Changing date to a prior day and saving creates a new event with that backlogged day/time (verified by row placement/history output from t-browser checks).
- Clicking save does not trigger a full `/today` route refresh/loading state interruption; the row appears inline quickly without the page reloading.
- Automated checks (`typecheck`, `test`) pass.

## Idempotence and Recovery

All code edits are additive and can be rerun safely. If a validation step fails, fix-forward and rerun the same command. No destructive database reset is needed for this change; avoid running any db reset command.

## Artifacts and Notes

Key artifacts:

- E2E harness failure summaries:
  `/tmp/peptaide-e2e-2026-02-17T17-44-20-942Z/run.summary.json`
  `/tmp/peptaide-e2e-2026-02-17T17-46-48-325Z/run.summary.json`
- Direct t-browser screenshot after targeted checks:
  `/tmp/tb-final-today-log-after-tests.png`
- DB proof of backlog write (email `tb.manual+202602171756@example.com`):
  `ts=2026-02-16 09:30:00+00`, local projection `2026-02-16 09:30`.

## Interfaces and Dependencies

Implemented interface adjustments:

- `web/src/lib/time/timeZone.ts`
  Add a helper that converts explicit local date + local time + timezone to UTC ISO (using existing timezone offset iteration logic).
- `web/src/lib/app/sessions/createSession.ts`
  Extend `SessionCreateInput` with optional `dateYMD?: string` and update event time derivation to combine `dateYMD` + `timeHHMM` when provided.
- `web/src/app/(app)/today/actions.ts`
  Read `date_ymd` from `FormData`, pass it into `createSession`, and include the created enriched event row in success response for optimistic UI insertion.
- `web/src/app/(app)/today/today-log-table.tsx`
  Track `dateYMD` in local state, render a date input before the time input, submit `date_ymd`, and maintain local event rows without `router.refresh()`.

## Revision Notes

- 2026-02-17: Created initial ExecPlan to cover date backlogging input and no-refresh save behavior, with concrete implementation and validation steps.
- 2026-02-17: Updated all living sections after implementation/testing, recorded harness-level t-browser instability, and added direct t-browser + DB validation evidence for requested behaviors.
