#!/usr/bin/env python3
"""
Convert the user's "2025 Peptide Protocol - Doses(1).csv" spreadsheet export into
Peptaide's "Simple import: events CSV" format.

This script is intentionally strict: if it sees ambiguous cells (unit-only "mcg",
missing dose while liquid is present, non-numeric vial labels, etc), it prints a
small, concrete question list and exits non-zero so the user can confirm how to
correct the data before generating an import CSV.

Usage (from repo root):

  python3 ops/scripts/convert_peptide_protocol_spreadsheet.py \
    --doses-csv "spreadsheetdata/2025 Peptide Protocol - Doses(1).csv" \
    --out-csv "spreadsheetdata/peptaide_simple_events.csv"

After ambiguities are resolved, rerun with:

  --allow-backfill-missing-doses
  --treat-unit-only-mcg-as-empty
  --ss31-dmso-vial2

The output CSV is suitable for:
  /settings -> Data -> Simple import: events CSV
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


SUBSTANCES = ["BPC-157", "TB-500", "Semax", "GHK-CU", "SS-31", "MOTS-c", "Epithalon"]

# Header row layout in the spreadsheet:
# 0: Date
# 1-7: liquid (mL) for substances in SUBSTANCES
# 8-14: dose (mcg) for substances in SUBSTANCES
# 15-21: vial for substances in SUBSTANCES
# 22-27: cycle columns (BPC+TB, Semax, GHK-CU, SS-31, MOTS-c, Epithalon)
# 28: Notes


@dataclass(frozen=True)
class Concentrations:
  mg_per_ml: Dict[str, Dict[int, float]]  # substance -> vial -> mg/mL


@dataclass(frozen=True)
class EventRow:
  substance: str
  date_iso: str  # YYYY-MM-DD
  dose_text: str  # e.g. "333 mcg"
  route: str
  notes: str
  tags: str  # semicolon-separated


RE_ML = re.compile(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*mL\s*$", re.IGNORECASE)
RE_DOSE_MCG = re.compile(r"^\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*mcg\s*$", re.IGNORECASE)


def die(msg: str) -> None:
  print(msg, file=sys.stderr)
  raise SystemExit(2)


def parse_us_date(raw: str) -> Optional[str]:
  s = (raw or "").strip()
  if not s:
    return None
  # Accept M/D/YYYY or MM/DD/YYYY
  m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
  if not m:
    return None
  month = int(m.group(1))
  day = int(m.group(2))
  year = int(m.group(3))
  try:
    d = dt.date(year, month, day)
  except ValueError:
    return None
  return d.isoformat()


def parse_ml(raw: str) -> Optional[float]:
  s = (raw or "").strip()
  if not s:
    return None
  m = RE_ML.match(s)
  if not m:
    return None
  return float(m.group(1))


def parse_dose_mcg(raw: str) -> Optional[float]:
  s = (raw or "").strip()
  if not s:
    return None
  m = RE_DOSE_MCG.match(s)
  if not m:
    return None
  num = m.group(1).replace(",", "")
  return float(num)


def parse_vial_number(raw: str) -> Optional[int]:
  s = (raw or "").strip()
  if not s:
    return None
  m = re.match(r"^(\d+)$", s)
  if m:
    return int(m.group(1))
  # Allow values like "2-w/DMSO" by extracting a leading number.
  m2 = re.match(r"^(\d+)", s)
  if m2:
    return int(m2.group(1))
  return None


def parse_constants(rows: List[List[str]]) -> Concentrations:
  # The constants block is at the top of the sheet (rows[0..8]) with:
  # row[1] == ["", "Vial 1", ..., "Vial 6", ...]
  # rows[2..8] are substance rows with "Xmg/mL" cells.
  mg_per_ml: Dict[str, Dict[int, float]] = {}

  for r in rows[2:9]:
    if not r or not (r[0] or "").strip():
      continue
    sub = (r[0] or "").strip()
    for vial_idx, cell in enumerate(r[1:7], start=1):
      s = (cell or "").strip()
      if not s:
        continue
      m = re.match(r"^([0-9]+(?:\.[0-9]+)?)\s*mg/mL$", s, re.IGNORECASE)
      if not m:
        continue
      mg_per_ml.setdefault(sub, {})[vial_idx] = float(m.group(1))

  # User confirmed: BPC and TB are in the same vial; concentrations match BPC's.
  if "BPC-157" in mg_per_ml:
    mg_per_ml.setdefault("TB-500", {})
    for vial, val in mg_per_ml["BPC-157"].items():
      mg_per_ml["TB-500"].setdefault(vial, val)

  return Concentrations(mg_per_ml=mg_per_ml)


def compute_backfill_mcg(
  *,
  concentrations: Concentrations,
  substance: str,
  vial_label: str,
  liquid_cell: str,
) -> Optional[float]:
  ml = parse_ml(liquid_cell)
  if ml is None:
    return None
  vial = parse_vial_number(vial_label)
  if vial is None:
    return None
  mgml = concentrations.mg_per_ml.get(substance, {}).get(vial)
  if mgml is None:
    return None
  return ml * mgml * 1000.0


def format_mcg(mcg: float) -> str:
  # Spreadsheet appears to round to whole-mcg (e.g., 0.09 mL * 11.11 mg/mL = 999.9 -> "1,000mcg").
  n = int(round(mcg))
  return f"{n} mcg"


def build_tags(*parts: str) -> str:
  # Simple import accepts comma or semicolon separators; use semicolons for clarity.
  out: List[str] = []
  for p in parts:
    p = (p or "").strip()
    if not p:
      continue
    out.append(p)
  return ";".join(out)


def load_csv_rows(path: Path) -> List[List[str]]:
  with path.open(newline="") as f:
    return list(csv.reader(f))


def find_header_row_index(rows: List[List[str]]) -> int:
  for i, r in enumerate(rows):
    if r and (r[0] or "").strip().lower() == "date":
      return i
  die("Could not find header row starting with 'Date'.")
  raise AssertionError("unreachable")


def convert(
  *,
  doses_csv: Path,
  out_csv: Path,
  default_route: str,
  routes_json: Optional[Path],
  allow_backfill_missing_doses: bool,
  treat_unit_only_mcg_as_empty: bool,
  ss31_dmso_vial2: bool,
) -> None:
  rows = load_csv_rows(doses_csv)
  concentrations = parse_constants(rows)
  hdr_i = find_header_row_index(rows)

  ambiguous: List[str] = []
  events: List[EventRow] = []

  routes_by_substance: Dict[str, str] = {}
  if routes_json is not None:
    try:
      raw = json.loads(routes_json.read_text())
    except Exception as e:
      die(f"Failed to read routes JSON at {routes_json}: {e}")
    if not isinstance(raw, dict):
      die(f"Routes JSON at {routes_json} must be a JSON object mapping substance -> route.")
    for k, v in raw.items():
      if not isinstance(k, str) or not isinstance(v, str):
        die(f"Routes JSON at {routes_json} must be a string->string mapping.")
      routes_by_substance[k.strip().lower()] = v.strip()

  for row in rows[hdr_i + 1 :]:
    if not row:
      continue
    date_raw = (row[0] or "").strip()
    if not date_raw:
      continue

    date_iso = parse_us_date(date_raw)
    if date_iso is None:
      ambiguous.append(f"{date_raw}: invalid date format (expected M/D/YYYY)")
      continue

    notes = (row[28] or "").strip()

    # Cycle columns map (BPC+TB, Semax, GHK-CU, SS-31, MOTS-c, Epithalon)
    cycle_vals = {
      "BPC-157": (row[22] or "").strip(),
      "TB-500": (row[22] or "").strip(),
      "Semax": (row[23] or "").strip(),
      "GHK-CU": (row[24] or "").strip(),
      "SS-31": (row[25] or "").strip(),
      "MOTS-c": (row[26] or "").strip(),
      "Epithalon": (row[27] or "").strip(),
    }

    for j, sub in enumerate(SUBSTANCES):
      liq_cell = (row[1 + j] or "").strip()
      dose_cell = (row[8 + j] or "").strip()
      vial_cell = (row[15 + j] or "").strip()

      if sub == "TB-500":
        # User confirmed BPC + TB share the same vial/dose; the sheet sometimes leaves TB blank.
        if not liq_cell:
          liq_cell = (row[1 + 0] or "").strip()
        if not dose_cell:
          dose_cell = (row[8 + 0] or "").strip()
        if not vial_cell:
          vial_cell = (row[15 + 0] or "").strip()

      # Special-case: SS-31 vial label "2-w/DMSO" should be treated as vial 2, but only if the
      # user confirms ss31_dmso_vial2.
      vial_numeric = parse_vial_number(vial_cell)
      vial_is_weird = bool(vial_cell) and not re.match(r"^\d+$", vial_cell)
      if vial_is_weird and sub == "SS-31" and vial_cell.startswith("2") and not ss31_dmso_vial2:
        ambiguous.append(
          f"{date_iso} {sub}: vial label '{vial_cell}' is non-numeric. Confirm it should be treated as vial 2 (and optionally tagged w/DMSO)."
        )

      unit_only_mcg = False
      if dose_cell.lower() == "mcg":
        if treat_unit_only_mcg_as_empty:
          dose_cell = ""
        else:
          unit_only_mcg = True
          ambiguous.append(f"{date_iso} {sub}: dose cell is unit-only 'mcg' (no number). Is this an actual administration?")

      dose_mcg = parse_dose_mcg(dose_cell)
      if dose_mcg is None and dose_cell and not unit_only_mcg:
        ambiguous.append(f"{date_iso} {sub}: unparseable dose cell '{dose_cell}'")

      if dose_mcg is None and not dose_cell and liq_cell:
        # Missing calculated dose but liquid exists.
        if not allow_backfill_missing_doses:
          mcg_guess = compute_backfill_mcg(
            concentrations=concentrations, substance=sub, vial_label=vial_cell, liquid_cell=liq_cell
          )
          if mcg_guess is not None:
            ambiguous.append(
              f"{date_iso} {sub}: missing dose but liquid={liq_cell} vial={vial_cell}. I can backfill {format_mcg(mcg_guess)} (from mL * mg/mL). Confirm."
            )
          else:
            ambiguous.append(
              f"{date_iso} {sub}: missing dose but liquid={liq_cell} vial={vial_cell}. Cannot backfill (missing/unknown concentration)."
            )
          continue
        mcg_guess = compute_backfill_mcg(concentrations=concentrations, substance=sub, vial_label=vial_cell, liquid_cell=liq_cell)
        if mcg_guess is None:
          ambiguous.append(
            f"{date_iso} {sub}: missing dose but liquid={liq_cell} vial={vial_cell}. Cannot backfill (missing/unknown concentration)."
          )
          continue
        dose_mcg = mcg_guess

      # If we still have no dose, skip this substance for the date (no administration recorded).
      if dose_mcg is None:
        continue

      dose_text = format_mcg(dose_mcg)

      tags = []
      cyc = cycle_vals.get(sub, "")
      if cyc:
        tags.append(f"cycle_{cyc}")
      if vial_numeric is not None:
        tags.append(f"vial_{vial_numeric}")
      if sub == "SS-31" and vial_cell == "2-w/DMSO":
        tags.append("w_dmso")

      events.append(
        EventRow(
          substance=sub,
          date_iso=date_iso,
          dose_text=dose_text,
          route=routes_by_substance.get(sub.strip().lower(), default_route),
          notes=notes,
          tags=build_tags(*tags),
        )
      )

  if ambiguous:
    print("Ambiguities found; not generating import CSV yet.", file=sys.stderr)
    print("", file=sys.stderr)
    print("Please answer/confirm the following so I can correct the data:", file=sys.stderr)
    for q in ambiguous:
      print(f"- {q}", file=sys.stderr)
    raise SystemExit(1)

  out_csv.parent.mkdir(parents=True, exist_ok=True)
  with out_csv.open("w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["substance", "date", "dose", "route", "notes", "tags"])
    for e in events:
      w.writerow([e.substance, e.date_iso, e.dose_text, e.route, e.notes, e.tags])

  print(f"Wrote {out_csv} with {len(events)} events.")


def main(argv: Optional[List[str]] = None) -> None:
  p = argparse.ArgumentParser()
  p.add_argument("--doses-csv", type=Path, required=True)
  p.add_argument("--out-csv", type=Path, required=True)
  p.add_argument("--default-route", type=str, default="Unspecified")
  p.add_argument(
    "--routes-json",
    type=Path,
    default=None,
    help='Optional JSON mapping file: {"BPC-157":"SubQ","Semax":"IN"}; keys are case-insensitive.',
  )

  p.add_argument(
    "--allow-backfill-missing-doses",
    action="store_true",
    help="Backfill missing dose cells from liquid mL * concentration mg/mL (rounded to whole mcg).",
  )
  p.add_argument(
    "--treat-unit-only-mcg-as-empty",
    action="store_true",
    help="Treat a dose cell containing only 'mcg' as an empty cell (no administration).",
  )
  p.add_argument(
    "--ss31-dmso-vial2",
    action="store_true",
    help="Treat SS-31 vial label '2-w/DMSO' as vial 2 and tag it with w_dmso.",
  )

  args = p.parse_args(argv)
  convert(
    doses_csv=args.doses_csv,
    out_csv=args.out_csv,
    default_route=args.default_route,
    routes_json=args.routes_json,
    allow_backfill_missing_doses=args.allow_backfill_missing_doses,
    treat_unit_only_mcg_as_empty=args.treat_unit_only_mcg_as_empty,
    ss31_dmso_vial2=args.ss31_dmso_vial2,
  )


if __name__ == "__main__":
  main()
