# Simple CSV Import: Events (Sparse Spreadsheets)

Peptaide supports a **simple event-log CSV import** designed for sparse external datasets, including spreadsheets that only track:

- a timestamp (or date/time),
- what you took (substance),
- optional route,
- the dose (mg or mL), and
- optional vial concentration (mg/mL) so Peptaide can compute mg from mL.

This importer **does not** require you to provide Peptaide’s full internal database schema (UUID ids, created_at/updated_at columns, inventory/order tables, uncertainty distributions, etc).

Import UI:

- Go to `/settings` -> **Data** -> **Simple import: events CSV**
- Run **Dry run** first, then **Import**.
- Optional: enable **Replace existing data** to delete all your current data first.

## What It Creates

From a single events CSV, Peptaide will:

1. Create missing `substances`
2. Create missing `routes` (or use a default route name if your CSV omits it)
3. Create missing `formulations` (one per (substance, route, formulation name) combination)
4. Import `administration_events`
5. Optionally infer `cycle_instances` from timestamps and assign `cycle_instance_id` on imported events

It intentionally does **not** import:

- vials, orders, vendors, cost tracking (unless you later add those in the UI)
- distributions / bioavailability specs / modifiers / calibrations (modeling can be configured later)

## Required Columns

Your CSV must include:

- **Substance**: one of `substance`, `compound`, `drug`, `peptide`, `medication`
- **Timestamp**:
  - either `ts`/`timestamp`/`datetime` (preferred), or
  - `date` (optionally `time`)
- **Dose**, via either:
  - `dose` / `input_text` / `dose_text` (a single string like `0.25 mL` or `5 mg`), or
  - `dose_mg` / `mg`, or
  - `dose_ml` / `ml`, or
  - `dose_iu` / `iu`

All headers are case-insensitive.

## Optional Columns

- Route: `route` or `roa` (default: `Unspecified`)
- Formulation name: `formulation` (default: generated as `<substance> - <route>`)
- Concentration mg/mL:
  - `concentration_mg_per_ml`, `mg_per_ml`, `mg/ml`, `mg_ml`, `conc_mg_per_ml`, `conc_mg_ml`
  - Used to compute `dose_mass_mg` from `dose_ml * concentration_mg_per_ml` when possible.
- Notes: `notes`, `note`, `comment`, `comments`, `memo`
- Tags: `tags` (comma- or semicolon-separated, e.g. `fasted;morning`)

## Timestamp Parsing Rules

If your CSV has a `ts`/`timestamp` column:

- If the value includes an explicit timezone (`Z` or `+/-HH:MM`), it is used as-is.
- If the value has no timezone, Peptaide interprets it as **local time in your profile timezone** and converts it to UTC for storage.

If your CSV uses `date` and `time`:

- `date` supports `YYYY-MM-DD` or `MM/DD/YYYY` (US-style) and common `MM-DD-YYYY`.
- `time` supports `HH:MM` or `HH:MM:SS` (24-hour).
- If `time` is missing, Peptaide defaults to `12:00` (noon) to avoid accidental day-boundary shifts.

## Dose Parsing Rules

Peptaide stores your dose in two layers:

1. **Raw input** (`input_text` and `input_kind`), and
2. **Canonical computed fields** (when possible): `dose_mass_mg` and/or `dose_volume_ml`.

If you provide dose as `dose_ml` plus `concentration_mg_per_ml`, Peptaide will compute the mg dose.

If you provide an unparseable dose string, the import still succeeds, but the event is stored as `input_kind=other` and canonical mg/mL fields may remain empty.

## Example CSVs

### Minimal mg-based log

```csv
substance,ts,dose_mg
Tirzepatide,2026-02-08T10:00:00-08:00,5
```

### Volume-based log with concentration (mg computed)

```csv
substance,ts,dose_ml,mg_per_ml,route
Semaglutide,2026-02-08T10:00:00-08:00,0.25,10,SubQ
```

### Date + time (timezone inferred from profile)

```csv
substance,date,time,dose
BPC-157,02/08/2026,10:30,0.2 mL
```

## Cycle Inference

If **Infer cycles from timestamps** is enabled, Peptaide will:

- group events by substance
- sort by timestamp
- start a new cycle when the gap between consecutive administrations is >= your profile’s `cycle_gap_default_days` (default 7)

This produces reasonable historical cycles without requiring you to have explicitly tracked cycle boundaries.

## Troubleshooting

- “Missing required column: substance”
  - Add a `substance` column (or rename your existing one to one of the accepted synonyms).

- “Missing required dose column”
  - Provide `dose` (text) or one of `dose_mg`/`dose_ml`/`dose_iu`.

- “Invalid timestamp/date”
  - Prefer ISO 8601 timestamps like `2026-02-08T10:00:00-08:00`.
  - If using `date`/`time`, ensure the date is `YYYY-MM-DD` or `MM/DD/YYYY` and time is `HH:MM`.

## Source of Truth (Implementation)

- Parser + importer: `web/src/lib/import/simpleEvents.ts`
- API route: `web/src/app/api/import-simple-events/route.ts`
- Settings UI: `web/src/app/(app)/settings/data-portability.tsx`

