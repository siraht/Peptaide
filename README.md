# Peptaide (MVP)

Peptaide is a recording and analytics app for tracking peptide/medication administrations. It is built to make daily logging fast (keyboard-first on desktop, tap-light on mobile) while treating uncertainty as a first-class concept via Monte Carlo percentiles.

**Scope disclaimer (non-negotiable):** Peptaide can store "recommendations" you enter, but it must never present itself as medical guidance, optimization, or protocol advice.

## What You Can Do

- Log 5-10+ administrations/day quickly in a day-scoped "Today" grid.
- Record administered dose (canonical mg and/or mL when applicable; IU preserved as IU).
- Compute effective dose percentiles (p05/p50/p95) for systemic and optionally CNS compartments when the model coverage is present.
- Track cycles per substance with a gap-based "new cycle" suggestion and break computation.
- Manage inventory (orders -> vials), attribute cost to events, and view spend/runway rollups.
- Export all data and import it back (portable, no lock-in).
- Rely on database-enforced privacy via Supabase/Postgres Row Level Security (RLS) on user-owned tables.

## What This Is Not

- Not a medical device.
- Not protocol optimization, dosing advice, diagnosis, or "AI decides your dose".

## Repo Layout

- `web/`: Next.js (App Router) + TypeScript web app.
- `supabase/`: SQL migrations, local Supabase config, and RLS probes/scripts.
- `ExecPlan.md`: the living implementation plan and current project status (authoritative for ongoing work).
- `AGENTS.md`: local agent/contributor instructions for working in this repo.

## Tech Stack (Current)

- Next.js App Router (currently Next.js 16.x)
- React (currently React 19.x)
- Supabase (Postgres + Auth + RLS) via `@supabase/ssr`
- Tailwind CSS
- `cmdk` for command palette navigation/actions
- Vitest for unit tests

## Local Development

### Prerequisites

- Node.js (recommended: v20+)
- Supabase CLI (for local Postgres/Auth)

### 1) Start Supabase (local)

From the repository root:

```bash
supabase start
supabase status
```

`supabase status` prints the local API URL and anon key used by the web app.

If you pulled new migrations or changed SQL locally, you may need to re-apply the schema:

```bash
supabase db reset
```

Note: `supabase db reset` destroys local data and re-applies all migrations.

### 2) Configure the web env

Create/update `web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Local values come from `supabase status`.

### 3) Run the web app

```bash
cd web
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Usage (Current UI)

Start with `/setup`:

1. Set profile defaults (timezone + units).
2. Bulk-add substances, routes, and formulations.
3. Create vials (or generate planned vials from orders).
4. Create distributions and fill model gaps:
   - base bioavailability specs (fraction distributions)
   - device calibrations (volume per unit distributions)
   - formulation modifier specs (multiplier distributions)

Then use:

- `/today`: primary logging surface (grid; Enter-to-save; multi-line paste).
- `/cycles`: cycle list + detail tools (split at event; end/abandon; start cycle now).
- `/inventory` + `/orders`: vial inventory and order entry (with basic vial generation).
- `/analytics`: read-only rollups from `security_invoker` SQL views.
- `/settings`: profile defaults + data portability (export/import + delete-my-data).

## Modeling Notes (MVP Semantics)

- "Bioavailability" is modeled as a **fraction** in `[0, 1]`.
- Enhancers/modifiers are modeled as **multipliers** `>= 0`.
- Composition is:
  - `BA_total = clamp(BA_base * product(multipliers), 0, 1)`
  - `effective_dose_mg = administered_dose_mg * BA_total`
- IU inputs are preserved as IU. The MVP does **not** convert IU into mg/mL without a substance-specific rule.

The database enforces key correctness constraints (distribution parameterization, value bounds, and `value_type` compatibility) and RLS is the primary privacy boundary.

## Quality Gates (Web)

From `web/`:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Data Import / Export

Peptaide exports and imports data as a ZIP bundle of CSV files (the importer expects the same format that `/api/export` generates).

Docs:

- `docs/SIMPLE_EVENTS_CSV_IMPORT.md`: recommended for sparse spreadsheets (event log import).
- `docs/IMPORT_ANALYSIS.md`: table-by-table analysis of what external systems usually track, and how sparse imports map to Peptaide.
- `docs/CSV_IMPORT_BUNDLE_V1.md`: full-fidelity Peptaide-to-Peptaide import/export bundle format.

## RLS Verification (Dev)

There is a scripted probe that asserts cross-user isolation in local Supabase:

```bash
supabase db reset
psql "$SUPABASE_DB_URL" -f supabase/scripts/rls_probe.sql
```

`SUPABASE_DB_URL` can be taken from `supabase status` for local dev.

## Schema Changes and Generated Types

- SQL migrations live in `supabase/migrations/`.
- After changing SQL locally, re-apply:

```bash
supabase db reset
```

- Regenerate Supabase TS types:

```bash
supabase gen types typescript --local > web/src/lib/supabase/database.types.ts
```

## Deployment (Not Yet Fully Automated)

The web app expects these environment variables in the deployed environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Auth redirect URLs must also be configured in Supabase for the deployed origin.

See `ExecPlan.md` for the current deployment blockers and required evidence.

## Contributor Notes

- `ExecPlan.md` is the living spec. Keep it accurate when making meaningful changes.
- If you use `zsh`, quote file paths containing `(app)` or `[param]` when running shell commands (to avoid glob expansion).
