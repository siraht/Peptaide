## Peptide + medication tracker (MVP w/ Monte Carlo) — “simple but extensible” plan (Feb 2026)

**Scope disclaimer:** this is a **recording + analytics** system. It can store “recommendations” you enter, but it must never present itself as medical guidance or optimization.

---

## 0) Design goals (non‑negotiable)

1. **Fast logging for 5–10+ items/day** (desktop keyboard-first, mobile tap-light).
2. **Extensible by construction** (new routes, new devices, new analytics, new model types without schema pain).
3. **Uncertainty-native from day 1**: Monte Carlo **percentiles** are first-class outputs, not a later rewrite.
4. **Data portability**: full export/import; no lock-in.
5. **Correctness over cleverness**: canonical units, deterministic recomputation, and clear semantics for “fraction vs multiplier”.

---

## 1) Recommended stack (2026-current, minimal backend code)

If your priority is **minimal custom backend** + **relational integrity** + **fast CRUD + analytics**, the cleanest stack remains:

### Core

* **Next.js 16.x** (App Router) + **TypeScript** ([Next.js 16], [Next.js upgrade v16])
  * Use **Server Actions** for mutations (keeps “backend” co-located with UI).
  * Keep heavy compute (Monte Carlo) on the server by default.
* **Supabase** (managed **PostgreSQL**, **Auth**, **RLS**) ([Supabase SSR migration])
  * **RLS** enforces “only I can see my data” at the database layer.
  * Use **@supabase/ssr** (Auth Helpers are deprecated / maintenance mode) ([Supabase Auth Helpers deprecated]).

### UI / interaction (critical for your “lots of daily entries” requirement)

* **shadcn/ui** + **Tailwind CSS**
* **TanStack Table** + **TanStack Virtual** for spreadsheet-like “Today Log” + bulk editors (keyboard nav, large lists).
* **cmdk** (command palette) for “add/select formulation fast” on desktop.
* Charts: **Recharts** is fine for v1; if you later want uncertainty bands + richer time-series interactions, consider ECharts.

### Data access & migrations

* Prefer **SQL migrations** (Supabase CLI) as the source of truth.
* Optional ORM:
  * **Prisma ORM 7.x** if it makes you faster (typed queries, migrations still okay) ([Prisma ORM 7 announcement]).
  * Skip Prisma if you’re happy with SQL + Supabase-generated types.

### Secondary option (if “local-first” beats convenience)

* **PocketBase + SQLite** remains operationally tiny, but you’ll miss **Postgres** superpowers for analytics + constraints (and you’ll end up re-implementing things). Keep it as a later migration path, not the default.

---

## 2) “Complete” MVP definition (updated for your feedback)

“Complete” means:

1. Model **substances / routes / formulations / devices / vials / orders**.
2. Log **multiple administrations quickly** (multi-row “Today Log”).
3. Compute:
   * **Administered** dose (canonical **mg**, **mL**)
   * **Effective** dose distributions (systemic + CNS) with **Monte Carlo percentiles**
4. **Automatic cycle tracking** with “gap-based new cycle suggestion” and **break tracking**.
5. Store manual **recommendations** (dose range, cycle length, break length) and compare your actuals vs those.
6. Analytics: normalized totals + **spend burn-rate** (USD/day/week/month) + inventory runway.
7. Bulk creation flows (setup + orders → vials) + import/export.
8. **RLS** everywhere.

Non-goals (still): protocol optimization, “AI decides your dose”, diagnosis, adherence nudging beyond simple reminders/alerts you explicitly configure.

---

## 3) Core conceptual corrections (fresh-eyes sanity pass)

### 3.1 Avoid a probability-theory footgun: “bioavailability” must be a **fraction**, enhancers are **multipliers**

The original plan allowed “fraction vs multiplier” but didn’t specify composition rules. Without rules you’ll routinely generate impossible values (>1 as a fraction).

**Fix (semantics):**

* Define **Base Bioavailability** as a **fraction** in \[0, 1\]:
  **BA_base(substance, route, compartment)** = fraction of administered mass reaching that compartment.
* Define **Modifiers** (formulation, components, devices) as **multipliers** ≥ 0:
  **M_i(formulation/component/device)** multiplies BA_base.
* Compose:
  * **BA_total = clamp( BA_base × Π M_i , 0, 1 )**
* Effective dose:
  * **dose_eff = dose_admin_mg × BA_total**

This is simple, physically consistent, and Monte Carlo-friendly.

### 3.2 “Append-only event log” vs edits

You want corrections without losing history. The MVP should use **soft deletes** + optional **revision records**, not true immutability.

**Fix (MVP):** `administration_events` is mutable but audited:
* `deleted_at` (soft delete)
* `updated_at`
* optional `event_revisions` table storing old values (only when changes occur)

### 3.3 Redundancy risk: storing substance_id + route_id inside events

If `administration_events` stores both `formulation_id` and `substance_id/route_id`, they can drift.

**Fix:** event stores `formulation_id` (required) and derives substance/route via join. If you later need speed, create views/materialized views—don’t duplicate truth.

---

## 4) Data model (MVP schema, designed for easy feature growth)

### 4.1 Conventions (applies to all user-owned tables)

* `id uuid primary key default gen_random_uuid()`
* `user_id uuid not null` (RLS gate)
* `created_at timestamptz default now()`
* `updated_at timestamptz default now()`
* `deleted_at timestamptz null` (soft delete where appropriate)
* Unique constraints include `user_id` so multi-user hosting is safe.

---

### 4.2 Identity

**profiles**
* `user_id` (PK/FK → auth.users)
* `timezone` (IANA string)
* `default_mass_unit` (text; e.g. mg, mcg, IU)
* `default_volume_unit` (text; e.g. mL)
* `default_simulation_n` (int; default 2048)
* `cycle_gap_default_days` (int; default 7)

---

### 4.3 Reference data (fast to add in bulk)

**substances**
* `canonical_name` (text; normalized key, unique per user)
* `display_name` (text)
* `family` (text; peptide, small_molecule, biologic, etc.)
* `target_compartment_default` (enum: systemic, cns, both)
* `notes`

**substance_aliases** (for search/typing speed)
* `substance_id` (FK)
* `alias` (text)

**routes**
* `name` (text; subcutaneous, intranasal, oral, etc.)
* `default_input_kind` (enum: mass, volume, device_units, IU)
* `default_input_unit` (text; mg, mL, spray, actuation, IU, etc.)
* `supports_device_calibration` (bool)
* `notes`

**devices** (route-level abstractions: syringe, nasal spray, pen, etc.)
* `name` (text)
* `device_kind` (enum: syringe, spray, dropper, pen, other)
* `default_unit` (text; actuation, spray, click, IU, mL)
* `notes`

**device_calibrations** (optional in MVP but extremely useful)
* `device_id` (FK)
* `route_id` (FK)
* `unit_label` (text; “spray”, “actuation”, “click”)
* `volume_ml_per_unit_dist_id` (FK → distributions; nullable)
* `notes`

**formulations**
* `substance_id` (FK)
* `route_id` (FK)
* `device_id` (FK nullable)
* `name` (text; your variant label, e.g. “IN + enhancer A”)
* `is_default_for_route` (bool)
* `notes`

**formulation_components**
* `formulation_id` (FK)
* `component_name` (text; free-text; you can later make this a FK)
* `role` (text; enhancer/buffer/preservative)
* `modifier_dist_id` (FK → distributions; multiplier; nullable)
* `notes`

---

### 4.4 Orders → order items → vials (inventory + cost)

**vendors**
* `name` (text)
* `notes`

**orders**
* `vendor_id` (FK)
* `ordered_at` (timestamptz)
* `shipping_cost_usd` (numeric)
* `total_cost_usd` (numeric)
* `tracking_code` (text nullable)
* `notes`

**order_items**
* `order_id` (FK)
* `substance_id` (FK)
* `formulation_id` (FK nullable) — link if known at purchase time
* `qty` (int) — “how many units purchased”
* `unit_label` (text; “vial”, “kit”, etc.)
* `price_total_usd` (numeric) — total for this line item (less ambiguous than price_per_unit)
* `expected_vials` (int nullable) — for “generate vials” UX
* `notes`

**vials**
* `substance_id` (FK)
* `formulation_id` (FK)
* `order_item_id` (FK nullable)
* `lot` (text nullable)
* `received_at` (timestamptz nullable)
* `opened_at` (timestamptz nullable)
* `closed_at` (timestamptz nullable)
* `status` (enum: planned, active, closed, discarded)
* **Contents & concentration**
  * `content_mass_value` (numeric)
  * `content_mass_unit` (text; mg/mcg/IU/etc)
  * `total_volume_value` (numeric nullable)
  * `total_volume_unit` (text nullable; mL etc)
  * `concentration_mg_per_ml` (numeric nullable; stored for speed, computed if mass+volume known)
* **Calibration overrides** (per-vial if needed)
  * `volume_ml_per_unit_override_dist_id` (FK → distributions; nullable)
* **Cost**
  * `cost_usd` (numeric nullable) — computed default from order_item allocation but overrideable
* `notes`

**Hard constraint (DB):** only one active vial per formulation per user:
* partial unique index on `(user_id, formulation_id)` where `status='active'` and `deleted_at is null`

---

### 4.5 Canonical event log (optimized for fast entry + recomputation)

**administration_events**
* `ts` (timestamptz) — source of truth timestamp
* `formulation_id` (FK) — required (quick-add can create formulation inline)
* `vial_id` (FK nullable; resolved to active vial if present)
* `cycle_instance_id` (FK nullable; normally auto-set)
* **User input (preserved)**
  * `input_text` (text) — e.g. `"0.3mL"`, `"2 sprays"`, `"250mcg"`
  * `input_value` (numeric nullable)
  * `input_unit` (text nullable)
  * `input_kind` (enum: mass, volume, device_units, IU, other)
* **Canonical computed**
  * `dose_volume_ml` (numeric nullable)
  * `dose_mass_mg` (numeric nullable)
* **Monte Carlo outputs (persisted summaries; recomputable)**
  * `eff_systemic_p05_mg`, `eff_systemic_p50_mg`, `eff_systemic_p95_mg` (numeric nullable)
  * `eff_cns_p05_mg`, `eff_cns_p50_mg`, `eff_cns_p95_mg` (numeric nullable)
  * `mc_n` (int nullable)
  * `mc_seed` (bigint nullable) — deterministic recomputation
  * `model_snapshot` (jsonb nullable) — selected distribution IDs + resolved params at log time
* **Cost attribution (optional but powerful)**
  * `cost_usd` (numeric nullable) — derived from vial cost × fraction used
* `tags` (text[])
* `notes`
* `deleted_at` (timestamptz nullable)

Why store percentiles? Because it makes dashboards fast, and you still retain recomputation via `model_snapshot + mc_seed`.

---

### 4.6 Cycles + breaks (automated, with manual override)

**cycle_rules** (per substance; user-editable; defaults from profile)
* `substance_id` (FK)
* `gap_days_to_suggest_new_cycle` (int; default 7)
* `auto_start_first_cycle` (bool; default true)
* `notes`

**cycle_instances**
* `substance_id` (FK) — derived from formulation at create time for convenience
* `cycle_number` (int)
* `start_ts` (timestamptz)
* `end_ts` (timestamptz nullable)
* `status` (enum: active, completed, abandoned)
* `goal` (text nullable)
* `notes`

**Breaks are computed** as the interval between `end_ts` of cycle N and `start_ts` of cycle N+1.
If you later want explicit “I’m on break now” tracking, add `break_instances`—but MVP can compute breaks deterministically.

---

### 4.7 Recommendations (manual now; AI later)

These tables exist so an LLM agent can fill them later, but the MVP works with manual entry.

**substance_recommendations**
* `substance_id` (FK)
* `category` (enum: cycle_length_days, break_length_days, dosing, frequency)
* `route_id` (FK nullable) — for route-specific recommendations
* `min_value` (numeric nullable)
* `max_value` (numeric nullable)
* `unit` (text; days, mg, mcg, IU, times_per_week, etc.)
* `notes`
* `evidence_source_id` (FK nullable)

**evidence_sources**
* `source_type` (enum: paper, label, clinical_guideline, vendor, anecdote, personal_note)
* `citation` (text; DOI/PMID/ISBN/URL/free-text)
* `notes`

---

### 4.8 Uncertainty engine primitives (shared by bioavailability + calibration)

Instead of hardcoding p1/p2/p3 everywhere, model uncertainty explicitly.

**distributions**
* `name` (text)
* `value_type` (enum: fraction, multiplier, volume_ml_per_unit, other)
* `dist_type` (enum: point, uniform, triangular, lognormal, beta_pert)
* `p1`, `p2`, `p3` (numeric nullable)
* `min_value` (numeric nullable)
* `max_value` (numeric nullable)
* `units` (text; for display)
* `quality_score` (int 0–5)
* `evidence_summary` (text)
* `created_at`, `updated_at`

**bioavailability_specs** (selectable “base fraction” per substance/route/compartment)
* `substance_id` (FK)
* `route_id` (FK)
* `compartment` (enum: systemic, cns)
* `base_fraction_dist_id` (FK → distributions) — **value_type=fraction**
* `notes`
* `evidence_source_id` (FK nullable)

**formulation_modifier_specs**
* `formulation_id` (FK)
* `compartment` (enum: systemic, cns, both)
* `multiplier_dist_id` (FK → distributions) — **value_type=multiplier**
* `notes`

**component_modifier_specs**
* `formulation_component_id` (FK)
* `compartment` (enum: systemic, cns, both)
* `multiplier_dist_id` (FK → distributions)
* `notes`

This structure matches how you actually think: base BA + modifiers. It’s also trivial to extend (add “absorption lag” later, add “half-life” later, etc.).

---

## 5) Monte Carlo (MVP, not “later”)

### 5.1 What we simulate

For each event, for each compartment:

1. Sample **BA_base ~ Dist(fraction)** in \[0,1]
2. Sample each **modifier M_i ~ Dist(multiplier)** in \[0,∞)
3. Compute **BA_total = clamp(BA_base × Π M_i, 0, 1)**
4. Compute **dose_eff = dose_admin_mg × BA_total**

Outputs stored:
* **p05/p50/p95** (and optionally mean/std later)
* `mc_seed`, `mc_n`
* `model_snapshot` that records which distributions were used and their resolved params

### 5.2 Distribution choices (simple + correct)

* Fractions in \[0,1\]: prefer **beta-PERT** (parameterized by min/mode/max).
* Multipliers ≥ 0: prefer **lognormal** (or triangular if you only know rough bounds).
* Uniform/range is allowed but should be visually flagged as low-quality evidence.

### 5.3 Determinism (so you can reproduce results)

* `mc_seed = hash(user_id, event_id, model_version_ids...)`
* Changing a model triggers optional “recompute affected events” action.

### 5.4 When to run MC

* On event save:
  * compute canonical dose (mg/mL)
  * run MC with `default_simulation_n` (e.g., 2048)
  * persist percentiles
* On dashboards:
  * aggregate using p50 for “central” and p05/p95 for bands
  * optionally run “day-level MC” later; MVP can do percentile aggregation conservatively:
    * day_p05 = sum(event_p05), day_p50 = sum(event_p50), day_p95 = sum(event_p95)
    * (not perfect statistically, but safe and monotone; you can add correlated sampling later)

---

## 6) Unit input parsing (so “0.3mL”, “20cc”, “250 mcg”, “2 sprays” just works)

### 6.1 Rules

* Always store the raw `input_text`.
* Parse to `(value, unit)` if possible; otherwise keep raw and block save with a clear error.

### 6.2 Canonicalization targets

* Mass → **mg**
* Volume → **mL**
* Device units (“spray”, “actuation”, “click”) → **unit_count**, then convert to volume via calibration dist.

### 6.3 Supported synonyms (MVP)

* Volume: `ml`, `mL`, `cc` (1 cc = 1 mL), `uL`/`µL` (→ mL)
* Mass: `mg`, `mcg`/`µg`/`ug` (→ mg), `g` (→ mg)
* IU: `IU` / `[iU]` (store as IU; conversion to mg is substance-specific so do **not** auto-convert)
* Device units: `spray`, `actuation`, `pump`, `click` (user-configurable labels)

### 6.4 Implementation approach

* Use a small parser + lookup table (regex + normalization) for MVP.
* If you want more expressive unit strings later (UCUM-style), integrate a UCUM parser (e.g. ucum.js) to canonicalize unit expressions to base units, then map to mg/mL where appropriate ([UCUM], [ucum.js]).

---

## 7) User flows (updated to match your feedback)

### Global interaction primitives (do these early)

* **Command palette** (⌘K / Ctrl+K): “Log”, “New substance”, “New formulation”, “Open today log”, “Jump to substance analytics”.
* **Spreadsheet grids** (bulk edit): arrow keys, Enter to advance, Shift+Enter reverse, paste multi-cell, undo.
* **Mobile quick add**: bottom-sheet, big tap targets, one-hand reachable primary actions.

---

### Flow A — First-time setup (bulk-first, not clicky)

Entry: first login → “Setup Wizard”

**Step A1: Preferences**
* Set timezone, default units, default MC N, default cycle gap days.

**Step A2: Bulk add substances**
Actions (all must exist):
* Add single substance
* Bulk add in grid (paste from CSV/clipboard)
* Add aliases (optional)
* Retire/restore

**Step A3: Bulk add routes (seeded defaults + editable)**
Actions:
* Select from seeded list (subq, intranasal, oral, IM, IV, buccal, transdermal, etc.)
* Add custom route
* Set default input kind/unit per route

**Step A4: Bulk add formulations**
Actions:
* Grid entry with columns: substance, route, name, device, is_default
* Inline “+ create substance/route/device” without leaving the grid

**Step A5: Bulk add vials (or generate from orders)**
Actions:
* Create vials in a grid (formulation, mass, volume, received_at, cost)
* Set “active” vial per formulation with one keystroke

**Step A6: Add base BA + modifiers (manual now)**
Actions:
* For each substance+route+compartment, enter base BA distribution
* For each formulation/component, enter modifier distribution
* Link evidence sources (optional but supported)

**Definition of done:** you can open “Today Log” and enter multiple lines rapidly with computed effective-dose percentiles.

---

### Flow B — Logging (primary flow; optimized for 5–10+ per day)

Entry: “Today Log” (default landing page after setup)

**UI shape:** a table where each row is one event. Minimal columns visible; advanced fields in a drawer.

Required actions (row-level):
1. Timestamp defaults to “now”, but the table is day-scoped; only time-of-day is typically edited.
2. Choose **formulation** via:
   * typing (autocomplete)
   * command palette insert
3. Input dose using `input_text` (e.g. `0.3mL`, `2 sprays`, `250mcg`)
4. Hit Enter:
   * app resolves vial (active vial default)
   * computes canonical dose (mg/mL)
   * runs MC → stores percentiles
   * auto-assigns cycle (with new-cycle suggestion if needed)
   * immediately adds a new blank row, focused in the formulation cell

**Quick actions (post-row-save):**
* “Add another” (default; keeps you in the grid)
* “Duplicate row” (rarely useful as the default, but still available)
* “Open details” (tags, notes, vial override, evidence snapshot)

**Cycle automation (inline while logging):**
* On save, find last event for the same substance:
  * if none and `auto_start_first_cycle=true` → create cycle #1 and assign
  * else compute gap days; if gap ≥ rule threshold:
    * prompt: “New cycle?” with default = yes
    * if yes: create new cycle, assign event
    * if no: assign to existing active/most recent cycle

**Multi-substance days:**
* The table supports 5–10+ rows quickly with minimal modal interruptions.
* Mobile version uses the same concept, but as stacked “cards” with one tap to add a new card.

---

### Flow C — Vials (including generation from orders)

Entry: Inventory

Actions:
* Create vial (single)
* Bulk create vials (grid)
* Generate vials from an order item:
  * choose order item → “Generate N vials” → creates planned vials linked to `order_item_id`
  * optionally prompt for shared defaults (mass/volume/cost) to apply across generated vials
* Set active vial (one click / hotkey)
* Close/discard vial (prompt if events still expected)

System behaviors:
* Concentration auto-computed if mass+volume known.
* Cost auto-computed if order item has `price_total_usd` and `expected_vials` (allocation per vial).

---

### Flow D — Cycles + breaks (mostly automatic)

Entry: Cycles

Actions:
* View per-substance timeline: cycles and computed breaks.
* Manually create a cycle (rare, but needed for corrections):
  * choose substance → app checks last event gap and suggests start_ts
  * on confirm, auto-assign eligible events (optional)
* End a cycle:
  * set end_ts
  * show computed break clock starting immediately
* Fix missed new-cycle selection:
  * “Split cycle here” action: pick an event → create new cycle starting at that event → reassign events after it

Comparisons shown in cycle detail:
* actual cycle length vs **recommended cycle length**
* actual break length vs **recommended break length**
* total dose vs **recommended dose range** (by route, where possible)

---

### Flow E — Recommendations (manual now, AI later)

Entry: Recommendations (or within Substance detail)

Actions:
* Add cycle length recommendation (min/max days)
* Add break length recommendation (min/max days)
* Add dosing recommendation by route (min/max, units)
* Add frequency recommendation (e.g. times/week)
* Attach evidence source links/notes

The UI must make it obvious these are “user-entered reference ranges,” not medical advice.

---

### Flow F — Analytics (including spend)

Entry: Dashboard

Must-have views (v1):
1. **Today summary**
   * administered mg by substance
   * effective systemic/CNS p50 (with p05–p95 band)
   * alerts: missing base BA for substance+route, missing calibration for device units
2. **Calendar**
   * day rows × substance columns (admin and effective views toggle)
3. **Trends**
   * 7/30/90 day rolling totals (admin and effective p50)
   * uncertainty ribbons (p05–p95)
4. **Cycles & breaks**
   * cycle length distribution across history
   * days on vs days off
5. **Inventory**
   * remaining mass/volume per active vial (estimated)
   * “runway” = remaining / recent average daily usage
6. **Spend**
   * USD/day, USD/week, USD/month (based on cost attribution)
   * cost per administered mg and per effective mg (p50)
   * per-substance spend share

---

### Flow G — Import/export (and “bulk add” is just import with a nicer UI)

Entry: Settings → Data

Actions:
* Export all tables (CSV bundle)
* Import CSV templates with:
  * dry-run validation
  * id mapping + dedupe by unique keys
* Clipboard paste import for quick setup (substances/formulations/vials)

---

## 8) Implementation modules (concrete boundaries, easy to extend)

### 8.1 Domain modules (pure logic; no DB/React)

* **units/**
  * `parseQuantity(input_text) -> {kind, value, unit}`
  * `toCanonicalMassMg(...)`
  * `toCanonicalVolumeMl(...)`
* **dose/**
  * `resolveVial(formulationId, explicitVialId?)`
  * `computeDose({input, vial, calibration}) -> {dose_mass_mg, dose_volume_ml}`
* **uncertainty/**
  * `sample(dist, rng)`
  * `simulateEffectiveDose({dose_mg, dists}, n, seed) -> percentiles`
  * `composeBioavailability({baseFraction, multipliers}) -> fraction`
* **cycles/**
  * `suggestCycleAction({substanceId, ts, gapDaysRule}) -> {createNew?: boolean}`
  * `splitCycleAtEvent(eventId)`
* **cost/**
  * `allocateVialCost(orderItem, expectedVials) -> cost_per_vial`
  * `eventCostFromVial(eventDoseMg, vialContentMg, vialCostUsd)`

### 8.2 Data access modules (thin wrappers, all typed)

* `substancesRepo`, `routesRepo`, `formulationsRepo`, `vialsRepo`, `eventsRepo`, `cyclesRepo`, `recsRepo`, `distsRepo`

### 8.3 SQL views (make dashboards cheap)

* `v_event_enriched` (join event → formulation → substance/route → vial)
* `v_daily_totals_admin`
* `v_daily_totals_effective_systemic` (p05/p50/p95 sums)
* `v_daily_totals_effective_cns`
* `v_cycle_summary` (length, totals, adherence to recs)
* `v_spend_daily_weekly_monthly`
* `v_inventory_status` (used/remaining/runway)
* `v_model_coverage` (missing BA/calibration/modifiers)
* `v_order_item_vial_counts` (vials created/active/closed per order item; remaining/used)

---

## 9) Required pages (routes) — updated

### `/today` (default)

* Spreadsheet-like grid (add many events fast)
* Inline cycle prompt when needed
* Inline “missing model/calibration” warnings without blocking save (unless dose can’t be computed)

### `/substances`

* List + bulk add
* Substance detail:
  * formulations
  * base BA specs per route/compartment
  * recommendations
  * analytics quick links

### `/formulations`

* List + bulk add
* Formulation detail:
  * components + modifier dists
  * default vial/device settings

### `/inventory`

* Vials grouped by formulation
* “Generate from order item”
* Remaining/runway + event timeline per vial

### `/cycles`

* Per-substance cycles + computed breaks
* Split/merge tools for corrections

### `/orders`

* Orders, items, shipping events
* Cost allocation preview
* Generate vials

### `/analytics`

* Calendar + trends + uncertainty bands
* Spend analytics

### `/settings`

* Profile, units, default MC N, cycle defaults
* Data import/export
* Danger zone: delete/export first, then delete

---

## 10) Nonfunctional requirements (treat as features)

### Security & privacy

* **RLS** on all user-owned tables.
* No public read/write.
* Optional: require re-auth to view/export (UI-level).
* Consider encrypting especially sensitive free-text notes if you ever add multi-user sharing (not MVP).

### Correctness

* Canonical units (mg/mL) internally; preserve raw input.
* IU never auto-converted to mg without a substance-specific rule (future).
* MC determinism with stored seed + snapshot.
* Clear compartment semantics: systemic vs CNS are separate outputs.

### Performance

* Index `(user_id, ts desc)` on events.
* Partial index for active vial uniqueness.
* Use views/materialized views for daily aggregates once history grows.

---

## 11) “LLM agent research readiness” — what you must store now

To enable a future agent to fetch real-world values, you need these fields/tables today:

* Substance identity: canonical name + aliases (searchability).
* Route + device context (because BA depends on them).
* Base BA distributions per substance+route+compartment (with evidence links).
* Modifier distributions per formulation/component/device calibration (with evidence links).
* Recommendations (dose/cycle/break/frequency) with evidence links.
* Explicit “unknown” status so the UI can highlight gaps (coverage views).

This is why **distributions + specs** are separate tables: the agent fills specs; the app consumes them.

---

## 12) Practical “definition of done” checklist (MVP)

The MVP is done when:

* Bulk add works (paste/grid) for substances, formulations, vials.
* “Today Log” lets you enter 10 rows in ~1 minute on desktop without fighting the UI.
* Each saved event has:
  * parsed input stored as text + structured fields
  * canonical dose mg (when possible)
  * MC percentiles for systemic (and CNS if configured)
  * cycle auto-assigned, with gap-based new-cycle suggestion
* Cycles page can split a cycle at an event (fix missed new cycle).
* Recommendations can be entered and compared vs actual cycle/break lengths.
* Orders → generate vials works, and order items show vials remaining/used.
* Analytics shows:
  * administered totals
  * effective p50 with p05–p95 bands
  * spend USD/day/week/month
* Export/import round-trip succeeds.
* RLS prevents cross-user access by construction.

---

## References (no tracking params)

[Next.js 16]: https://nextjs.org/blog/next-16
[Next.js upgrade v16]: https://nextjs.org/docs/app/guides/upgrading/version-16
[Supabase SSR migration]: https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers
[Supabase Auth Helpers deprecated]: https://github.com/supabase/auth-helpers
[Prisma ORM 7 announcement]: https://www.prisma.io/blog/announcing-prisma-orm-7-0-0
[UCUM]: https://ucum.org/ucum
[ucum.js]: https://github.com/jmandel/ucum.js/

