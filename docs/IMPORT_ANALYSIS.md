# Import Analysis: Making CSV Imports Fair for Sparse External Data

This document explains, table by table, what Peptaide’s database *can* store versus what external systems (including simple spreadsheets) typically track, and how Peptaide supports importing **sparse** datasets with sane defaults and derived values.

If you want to import data, start here:

- Sparse spreadsheets (recommended for most real migrations): `docs/SIMPLE_EVENTS_CSV_IMPORT.md`
- Full-fidelity Peptaide-to-Peptaide migrations (export ZIP then import ZIP): `docs/CSV_IMPORT_BUNDLE_V1.md`

## The Core Problem

Peptaide’s full database schema includes many “app-internal” concepts that are extremely unlikely to exist in another tool:

- modeling distributions (bioavailability, modifiers, device calibration)
- inventory and cost attribution (vendors, orders, vials)
- cycle boundary bookkeeping (cycle rules/instances) distinct from events
- audit/revision data

Requiring those fields in a CSV import makes real migrations from existing trackers unrealistic.

The fix is to offer import “tiers”:

1. A sparse, single-file events import that matches what people actually have.
2. A full bundle import that is strict and round-trippable for Peptaide exports.

Peptaide now implements both.

## Import Tiers (What We Support)

### Tier 1: Sparse “Events CSV” import (implemented)

This is designed to import from spreadsheets as sparse as:

- timestamp (or date/time)
- substance name
- dose (mg or mL), optionally IU
- optional concentration (mg/mL) so mg can be computed from mL
- optional route, notes, tags

Implementation:

- Parser + inference: `web/src/lib/import/simpleEvents.ts` (`parseSimpleEventsCsvText(...)`)
- Apply/import: `web/src/lib/import/simpleEvents.ts` (`importSimpleEventsCsv(...)`)
- UI: `/settings` -> Data -> “Simple import: events CSV” (`web/src/app/(app)/settings/data-portability.tsx`)
- API: `POST /api/import-simple-events` (`web/src/app/api/import-simple-events/route.ts`)

Key behaviors:

- creates missing `substances`, `routes`, `formulations`
- computes canonical dose fields where possible (`dose_mass_mg`, `dose_volume_ml`)
- can infer `cycle_instances` from event timestamps (gap-based per substance)
- runs under the signed-in session (RLS enforced)
- apply mode is replace-oriented (safer than ambiguous merges)

### Tier 2: Full ZIP bundle import/export (implemented)

This is a strict “round trip” format that matches the app’s export exactly.

It is the right tool for:

- moving a Peptaide dataset between environments
- backups and restores

It is not the right tool for importing random spreadsheets.

Docs:

- `docs/CSV_IMPORT_BUNDLE_V1.md`

## Table-by-Table Fairness Analysis

The point of this section is to answer: “Would another system plausibly have this table/field?”

If the answer is “no”, Peptaide should not require it for sparse imports and should instead:

- default it,
- infer it from events, or
- leave it empty and let the user configure it later in the UI.

### `profiles`

What it is:

- user preferences and defaults (timezone, unit defaults, Monte Carlo settings, cycle gap threshold)

What external systems have:

- usually nothing like this; at most “timezone” is implicit

Import stance:

- never required for imports
- created automatically on first login
- sparse importer uses it only as a *hint* (timezone for naive timestamps; cycle gap days for cycle inference)

### `substances`

What it is:

- the “thing taken” (peptide/medication)

What external systems have:

- almost always at least a substance name

Import stance:

- sparse importer accepts a human name and creates `substances` automatically
- no UUIDs required in CSV

### `substance_aliases`

What it is:

- alternate names/synonyms for a substance

What external systems have:

- sometimes (e.g., user notes “tirz” for tirzepatide), but often not explicitly modeled

Import stance:

- not required for sparse imports
- can be added later via UI if needed

### `routes`

What it is:

- “how it was administered” and which input-kind/unit is typical for that route

What external systems have:

- sometimes a text field like “SubQ”, “IM”, “Oral”, “IN”
- sometimes absent entirely

Import stance:

- sparse importer defaults route to `Unspecified` if missing
- if route is present but unknown, it is created automatically
- it chooses a reasonable `default_input_kind` and `default_input_unit` from observed imported dose kinds:
  - volume -> `mL`
  - mass -> `mg`
  - iu -> `IU`

### `devices` and `device_calibrations`

What they are:

- device: “sprayer” / “syringe” abstraction (for dose entry like “2 sprays”)
- calibrations: uncertain conversion from “device units” to volume in mL

What external systems have:

- rarely: most spreadsheets track mg or mL directly, not “sprays” with a calibration distribution

Import stance:

- not required for sparse imports
- you can configure devices/calibrations later if you actually track in device units

### `formulations` and `formulation_components`

What they are:

- formulation: a user-defined combination of (substance, route, optional device) with a name
- components: enhancers/buffers/modifiers (optional modeling)

What external systems have:

- usually they only track substance + route, not named formulations and components

Import stance:

- sparse importer creates a single formulation per (substance, route, formulation name) key
- default formulation naming:
  - if route is unspecified: `<substance>`
  - else: `<substance> - <route>`
- components are not imported (configure later if desired)

### `distributions` and all modeling spec tables

Tables:

- `distributions`
- `bioavailability_specs`
- `formulation_modifier_specs`
- `component_modifier_specs`

What they are:

- the uncertainty model for converting administered dose into effective dose

What external systems have:

- almost never; even clinical tracking tools typically store only administered dose

Import stance:

- never required for sparse imports
- leaving these empty is acceptable: the app will still store administered dose and show “coverage gap” warnings

### `vendors`, `orders`, `order_items`, `vials`

What they are:

- optional inventory + cost attribution

What external systems have:

- some people track vial concentration and remaining volume in a spreadsheet
- fewer people track structured vendors/orders/order-items with prices and per-vial cost allocation

Import stance:

- not required for sparse imports
- sparse importer supports concentration *per event row* (mg/mL) purely to compute mg from mL
- full inventory import is out of scope for the sparse importer; you can set up vials later in UI

### `administration_events` (the main table sparse imports care about)

What it is:

- the time series of “I took X at time T”

What external systems have:

- this is the core thing they *do* have

Import stance:

- sparse importer writes:
  - `ts`
  - `formulation_id` (created/selected from substance + route)
  - `input_text` (raw, for auditability)
  - `input_kind` + `input_value` + `input_unit` when parseable
  - `dose_mass_mg` and/or `dose_volume_ml` when computable
  - `notes` if provided
  - `tags` (defaults to `[]` when absent)
- sparse importer intentionally leaves modeling outputs empty; those are computed when logging through the UI once modeling specs exist

### `event_revisions`

What it is:

- internal audit/history rows for event edits

What external systems have:

- almost never

Import stance:

- never imported (internal-only)

### `cycle_rules` and `cycle_instances`

What they are:

- cycle rules: per substance overrides (gap threshold, auto-start behavior)
- cycle instances: inferred or user-defined cycle boundaries and status

What external systems have:

- sometimes a “cycle #” column
- usually just a time series of events, with cycles understood implicitly

Import stance:

- sparse importer can infer `cycle_instances` from timestamps:
  - group by substance
  - sort by timestamp
  - create a new cycle when gap >= `profiles.cycle_gap_default_days` (default 7)
- cycles are optional; importer can disable inference (`infer_cycles=0`)
- cycle status is inferred conservatively:
  - if last event is “recent” (inside the gap threshold), the last cycle is `active`
  - otherwise cycles are `completed`

### `evidence_sources` and `substance_recommendations`

What they are:

- user-entered reference material (not advice)

What external systems have:

- typically not structured; maybe notes

Import stance:

- not required for sparse imports
- can be entered later if desired

## What “Sane Defaults” Means in Practice

For sparse imports, defaults should be:

- safe (do not invent medical assumptions)
- reversible (user can edit later)
- deterministic (imports are repeatable and predictable)

Peptaide’s sparse importer follows these rules:

1. Never require internal IDs in external CSVs.
2. Never require modeling or inventory to import an event timeline.
3. Preserve the raw dose text (`input_text`) so users can audit what was imported.
4. Compute canonical mg/mL fields only when it is mathematically justified (e.g., mL * mg/mL).
5. Infer cycles only from timestamps and a single, user-configurable gap threshold.

## Safety / Idempotence / Recovery

Sparse import apply mode is intentionally conservative:

- If `replace` is enabled, it deletes all user data first, then imports.
- If `replace` is disabled, it refuses to import into a non-empty events table to avoid accidental duplication.
- If apply fails mid-way, it performs best-effort rollback by deleting inserted rows again (and restoring profile where appropriate).

This is not as strong as a single database transaction (because PostgREST inserts are not a single multi-table transaction), but it keeps failures recoverable.

