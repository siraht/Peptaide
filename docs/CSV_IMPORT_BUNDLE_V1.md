# Peptaide CSV Import Format (ZIP Bundle v1)

Important: this ZIP-bundle format is intended for **Peptaide-to-Peptaide** migrations (export from `/api/export`, then import back). It is not a good fit for manually migrating sparse spreadsheets.

If you are importing a sparse external dataset (timestamp + substance + dose), use the simple importer instead:

- `docs/SIMPLE_EVENTS_CSV_IMPORT.md`

Peptaide imports data as a **ZIP bundle of CSV files**. This import format is intentionally identical to the app’s own export format, so the most reliable way to build a valid import is to:

1. Sign in to Peptaide.
2. Go to `/settings` -> **Data** -> **Export CSV bundle**.
3. Unzip it and use it as a template.
4. Edit the `tables/*.csv` files (or generate them from your existing data).
5. Zip it back up and import it from `/settings` -> **Data** -> **Import bundle**.

This document describes the exact structure and rules the importer enforces (as of 2026-02-08).

## Quick Summary

- Import file must be a `.zip`.
- ZIP must include `meta.json` with `format: "peptaide-csv-bundle-v1"`.
- ZIP must include a CSV for **every** table at `tables/<table>.csv` (files may be empty except for a header row).
- Each CSV must have a header row containing the **exact expected columns** for that table:
  - Column order does not matter.
  - Extra columns are rejected.
  - Missing columns are rejected.
  - Duplicate columns are rejected.
- Cell parsing rules:
  - Empty cell (`""`) becomes SQL `NULL`.
  - `number` columns must parse with JavaScript `Number(...)` (example: `12`, `12.5`).
  - `boolean` columns must be the lowercase string `true` or `false`.
  - `json` columns must be valid JSON (example: `[]`, `{}`, `["a","b"]`).
  - All other columns are treated as strings.
- `user_id` is **ignored** during import and is always overwritten with the currently signed-in user’s id.
- For `apply` imports:
  - Either your dataset must be empty (except `profiles`), or you must enable “Replace existing data”.
  - Replace mode deletes all your existing data first, then imports.

## Where Import Happens

In the web app:

- `/settings` -> **Data** -> “Import bundle”
- First run **Dry run** (no DB writes; validates the ZIP and all CSVs).
- Then run **Import**.

The UI calls the API route:

- `POST /api/import?mode=dry-run` or `POST /api/import?mode=apply`
- Optional: `replace=1` (delete existing data first)

## ZIP Bundle Layout

Your ZIP file must contain:

- `meta.json`
- `tables/` directory
- One CSV per table: `tables/<table>.csv`

Peptaide’s export also includes a `README.txt`, which is optional for import.

### `meta.json`

Required fields:

```json
{
  "format": "peptaide-csv-bundle-v1",
  "exported_at": "2026-02-08T00:00:00.000Z",
  "tables": ["..."]
}
```

Notes:

- `format` must be exactly `peptaide-csv-bundle-v1` or the import fails.
- `exported_at` is informational (shown in the UI).
- `tables` is informational (the importer validates the actual `tables/*.csv` files).

## CSV Rules

### General CSV format

The importer expects standard comma-separated CSV:

- delimiter: comma (`,`)
- supports quoted fields (`"like this"`) with `""` escapes
- supports LF or CRLF line endings
- tolerates a UTF-8 BOM in the first header cell (common from Excel)

### Headers must match exactly

Each `tables/<table>.csv` must:

- contain a header row
- include every expected column
- include no unexpected columns
- include no duplicate columns

Column order does **not** matter.

### Cell value parsing

Cells are parsed according to the column’s expected kind:

- **string**: used as-is (including whitespace)
- **number**: `Number(raw)` must be finite (no commas like `1,000`)
- **boolean**: must be exactly `true` or `false` (lowercase)
- **json**: must be valid JSON, parsed with `JSON.parse(raw)`

Empty cell (`""`) becomes `NULL`.

Important: many DB columns are `NOT NULL` with defaults in SQL (for example `created_at`, `updated_at`, `tags`).
Defaults **do not apply** when you insert an explicit `NULL`. Since empty cells become `NULL`, you must supply values for required fields in your CSV rows.

### IDs and foreign keys

Almost all tables use `id` (UUID) as a primary key. The importer:

- requires `id` to be present and non-empty in every row (except `profiles`, which uses `user_id` as its primary key)
- requires primary keys to be unique within each table CSV
- preserves your UUID ids exactly, so foreign keys must reference those exact UUIDs

If you are migrating from another system, you must generate stable UUIDs for every row and use them consistently across tables.

### `user_id` is always overwritten

Every imported row is rebound to the currently signed-in user. Your `user_id` column values in CSV files are ignored and replaced at import time.

Practical advice:

- Keep the `user_id` column in the header (required), but you can leave it blank in every row.

## Table List (Bundle v1)

The bundle must contain CSVs for each of the following tables:

- `tables/profiles.csv`
- `tables/distributions.csv`
- `tables/evidence_sources.csv`
- `tables/substances.csv`
- `tables/substance_aliases.csv`
- `tables/routes.csv`
- `tables/devices.csv`
- `tables/device_calibrations.csv`
- `tables/vendors.csv`
- `tables/orders.csv`
- `tables/formulations.csv`
- `tables/formulation_components.csv`
- `tables/bioavailability_specs.csv`
- `tables/formulation_modifier_specs.csv`
- `tables/component_modifier_specs.csv`
- `tables/cycle_rules.csv`
- `tables/cycle_instances.csv`
- `tables/order_items.csv`
- `tables/vials.csv`
- `tables/administration_events.csv`
- `tables/event_revisions.csv`
- `tables/substance_recommendations.csv`

If you don’t have data for a table, keep the CSV with only the header row (0 data rows).

## Allowed Enum Values (Common Import Failures)

Several columns accept only specific string values. These are the current allowed values:

- `compartment` (`compartment_t`): `systemic`, `cns`, `both`
- `cycle_instances.status` (`cycle_status_t`): `active`, `completed`, `abandoned`
- `devices.device_kind` (`device_kind_t`): `syringe`, `spray`, `dropper`, `pen`, `other`
- `distributions.dist_type` (`distribution_dist_type_t`): `point`, `uniform`, `triangular`, `lognormal`, `beta_pert`
- `distributions.value_type` (`distribution_value_type_t`): `fraction`, `multiplier`, `volume_ml_per_unit`, `other`
- `evidence_sources.source_type` (`evidence_source_type_t`): `paper`, `label`, `clinical_guideline`, `vendor`, `anecdote`, `personal_note`
- `administration_events.input_kind` (`input_kind_t`): `mass`, `volume`, `device_units`, `iu`, `other`
- `routes.default_input_kind` (`route_input_kind_t`): `mass`, `volume`, `device_units`, `iu`
- `substance_recommendations.category` (`recommendation_category_t`): `cycle_length_days`, `break_length_days`, `dosing`, `frequency`
- `vials.status` (`vial_status_t`): `planned`, `active`, `closed`, `discarded`

## Table Schemas (Expected Headers)

Below are the expected header columns for each CSV (the header row must contain exactly these column names).

### `tables/profiles.csv`

Columns:

```csv
created_at,cycle_gap_default_days,default_mass_unit,default_simulation_n,default_volume_unit,timezone,updated_at,user_id
```

Notes:

- Only one profile row is meaningful. The importer upserts the **first** row by `user_id`.
- `user_id` can be blank in the CSV; it will be overwritten to your current user.

### `tables/distributions.csv`

```csv
created_at,deleted_at,dist_type,evidence_summary,id,max_value,min_value,name,p1,p2,p3,quality_score,units,updated_at,user_id,value_type
```

Notes:

- `dist_type` and `value_type` must be one of the allowed enums above.
- For `json`-like fields in your source data: this table does not have JSON columns; it is mostly strings and numbers.

### `tables/evidence_sources.csv`

```csv
citation,created_at,deleted_at,id,notes,source_type,updated_at,user_id
```

### `tables/substances.csv`

```csv
canonical_name,created_at,deleted_at,display_name,family,id,notes,target_compartment_default,updated_at,user_id
```

Notes:

- `target_compartment_default` uses the `compartment_t` enum.

### `tables/substance_aliases.csv`

```csv
alias,created_at,deleted_at,id,substance_id,updated_at,user_id
```

### `tables/routes.csv`

```csv
created_at,default_input_kind,default_input_unit,deleted_at,id,name,notes,supports_device_calibration,updated_at,user_id
```

Notes:

- `supports_device_calibration` is a boolean: `true` or `false`.

### `tables/devices.csv`

```csv
created_at,default_unit,deleted_at,device_kind,id,name,notes,updated_at,user_id
```

### `tables/device_calibrations.csv`

```csv
created_at,deleted_at,device_id,id,notes,route_id,unit_label,updated_at,user_id,volume_ml_per_unit_dist_id
```

### `tables/vendors.csv`

```csv
created_at,deleted_at,id,name,notes,updated_at,user_id
```

### `tables/orders.csv`

```csv
created_at,deleted_at,id,notes,ordered_at,shipping_cost_usd,total_cost_usd,tracking_code,updated_at,user_id,vendor_id
```

### `tables/formulations.csv`

```csv
created_at,deleted_at,device_id,id,is_default_for_route,name,notes,route_id,substance_id,updated_at,user_id
```

Notes:

- `is_default_for_route` is a boolean: `true` or `false`.

### `tables/formulation_components.csv`

```csv
component_name,created_at,deleted_at,formulation_id,id,modifier_dist_id,notes,role,updated_at,user_id
```

### `tables/bioavailability_specs.csv`

```csv
base_fraction_dist_id,compartment,created_at,deleted_at,evidence_source_id,id,notes,route_id,substance_id,updated_at,user_id
```

Notes:

- `compartment` uses the `compartment_t` enum.

### `tables/formulation_modifier_specs.csv`

```csv
compartment,created_at,deleted_at,formulation_id,id,multiplier_dist_id,notes,updated_at,user_id
```

### `tables/component_modifier_specs.csv`

```csv
compartment,created_at,deleted_at,formulation_component_id,id,multiplier_dist_id,notes,updated_at,user_id
```

### `tables/cycle_rules.csv`

```csv
auto_start_first_cycle,created_at,deleted_at,gap_days_to_suggest_new_cycle,id,notes,substance_id,updated_at,user_id
```

Notes:

- `auto_start_first_cycle` is a boolean: `true` or `false`.

### `tables/cycle_instances.csv`

```csv
created_at,cycle_number,deleted_at,end_ts,goal,id,notes,start_ts,status,substance_id,updated_at,user_id
```

Notes:

- `status` uses the `cycle_status_t` enum.

### `tables/order_items.csv`

```csv
created_at,deleted_at,expected_vials,formulation_id,id,notes,order_id,price_total_usd,qty,substance_id,unit_label,updated_at,user_id
```

### `tables/vials.csv`

```csv
closed_at,concentration_mg_per_ml,content_mass_unit,content_mass_value,cost_usd,created_at,deleted_at,formulation_id,id,lot,notes,opened_at,order_item_id,received_at,status,substance_id,total_volume_unit,total_volume_value,updated_at,user_id,volume_ml_per_unit_override_dist_id
```

Notes:

- `status` uses the `vial_status_t` enum.

### `tables/administration_events.csv`

```csv
cost_usd,created_at,cycle_instance_id,deleted_at,dose_mass_mg,dose_volume_ml,eff_cns_p05_mg,eff_cns_p50_mg,eff_cns_p95_mg,eff_systemic_p05_mg,eff_systemic_p50_mg,eff_systemic_p95_mg,formulation_id,id,input_kind,input_text,input_unit,input_value,mc_n,mc_seed,model_snapshot,notes,tags,ts,updated_at,user_id,vial_id
```

Notes:

- `ts` is required (timestamp with timezone recommended as ISO 8601).
- `input_text` must be non-empty.
- `input_kind` uses the `input_kind_t` enum. Do not leave it blank.
- `tags` is `json` and should usually be `[]` (do not leave blank; the DB column is `NOT NULL`).
- If you import any percentile columns (`eff_*_p05/p50/p95_mg`), the DB requires `mc_n`, `mc_seed`, and `model_snapshot` to be non-null as well. If you don’t have MC outputs, leave all percentile fields blank and also leave `mc_*` and `model_snapshot` blank.
- If you set `vial_id`, it must refer to a vial whose `formulation_id` matches the event’s `formulation_id` (DB trigger enforced).
- If you set `cycle_instance_id`, it must refer to a cycle whose `substance_id` matches the event’s formulation’s `substance_id` (DB trigger enforced).

### `tables/event_revisions.csv`

```csv
created_at,event_id,id,new_values,old_values,reason,revised_at,user_id
```

Notes:

- `old_values` is `json` and must be a JSON object string (example: `{}` is allowed, but typically you’ll have real content).
- `event_id` must refer to an existing row in `administration_events`.

### `tables/substance_recommendations.csv`

```csv
category,created_at,deleted_at,evidence_source_id,id,max_value,min_value,notes,route_id,substance_id,unit,updated_at,user_id
```

Notes:

- `category` uses the `recommendation_category_t` enum.

## Minimal Migration Recipes

### Importing just your event log (common case)

To migrate only an existing “dose log” (date/time + substance + route + dose), you still need enough reference data for events to reference:

1. `profiles` (1 row)
2. `routes` (one per route you use)
3. `substances` (one per substance you track)
4. `formulations` (at least one per (substance, route) pair you log)
5. `administration_events` (your actual events)

Everything else can remain empty (but the CSV files must exist with headers).

Recommended approach:

- Create one formulation per route/substance (example name: `Tirzepatide - SubQ`).
- Import events with:
  - `ts` = your event timestamp (ISO 8601 recommended)
  - `input_text` = a human readable dose string (example: `5 mg`)
  - `input_kind` and `input_value`/`input_unit` filled when you have structured values
  - `tags` = `[]`
  - leave MC/percentile fields blank (unless you are also migrating the full model + MC snapshot)

After import, you can use the UI to refine:

- distributions and model specs (`/setup`)
- inventory (`/orders`, `/inventory`)
- cycle tooling (`/cycles`)

### Full migration (including inventory + model specs)

If you want Peptaide to immediately reproduce your full current state (inventory costs/runway, cycles, and MC effective doses), you must also import:

- distributions + spec tables (`distributions`, `bioavailability_specs`, `device_calibrations`, modifier specs)
- inventory tables (`vendors`, `orders`, `order_items`, `vials`)
- cycle tables (`cycle_rules`, `cycle_instances`)

And then ensure your events link correctly:

- set `vial_id` on events only when the vial matches the event formulation
- set `cycle_instance_id` only when the cycle substance matches the formulation’s substance

## Editing and Re-Zipping (Command Line)

Example workflow on Linux/macOS:

```bash
mkdir -p /tmp/peptaide-import
unzip peptaide-export-2026-02-08.zip -d /tmp/peptaide-import

# Edit CSVs under /tmp/peptaide-import/tables/

cd /tmp/peptaide-import
zip -r peptaide-import.zip meta.json README.txt tables
```

Then import `peptaide-import.zip` via `/settings` -> Data -> Import bundle.

## Common Errors and Fixes

- “Missing tables/<table>.csv”
  - Ensure every table CSV exists in `tables/` (use the Peptaide export ZIP as your template).

- “Unexpected header… Missing… Extra…”
  - Your header row must contain exactly the expected columns (copy/paste from this doc or from an export).

- “expected boolean 'true'/'false'”
  - Use lowercase `true` or `false` (not `TRUE`, not `1`).

- DB constraint errors during apply
  - Dry run only validates ZIP/CSV structure and basic parsing.
  - Apply inserts into the real DB and will fail if foreign keys or check constraints are violated.
  - Use the dry run per-table report to locate which file/table has problems, then fix values and retry.

## Source of Truth

This format is implemented in:

- Importer: `web/src/lib/import/csvBundle.ts`
- Exporter: `web/src/app/api/export/route.ts`
- Expected columns and kinds (auto-generated): `web/src/lib/export/exportColumns.ts`, `web/src/lib/export/exportColumnKinds.ts`
