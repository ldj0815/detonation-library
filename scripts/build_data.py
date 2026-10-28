"""Check data/cases.csv and produce the files the site serves.

    python scripts/build_data.py

Writes site/public/cases.json (what the pages read) and site/public/cases.csv
(the "Download full dataset" file). On any invalid row it prints every problem
and writes nothing.

It also checks the RDE subset in data/rde_subset/ (written by export_rde.py)
and writes site/public/rde.json, rde.csv and rde_chamber_pressures.csv.
Without that folder the RDE files are written empty, and the site shows RDE as
a category still to be filled. A release marked internal-use-only is refused
in CI (where the CI variable is set, as on GitHub Actions) unless
RDE_ALLOW_INTERNAL=1: deploying the site from CI publishes it.

While HIDDEN_FIELDS is not empty, the site is a cell-size library: those
columns are published empty and a case that carries nothing but hidden values,
or a detonation case with no measurement at all, is left out of both files.
data/cases.csv is never changed by this.
"""
import json
import os
import sys
from pathlib import Path

from case_schema import STORED_COLUMNS, SetupType, StoredCase
from csv_io import format_timestamp, read_cases, write_cases
from rde_data import (
    CHAMBER_PRESSURE_DOWNLOAD_COLUMNS,
    DOWNLOAD_COLUMNS,
    chamber_pressure_download_rows,
    consistency_notes,
    download_rows,
    read_release,
    site_json,
    write_rows,
)

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "cases.csv"
RDE_DIR = ROOT / "data" / "rde_subset"
OUT_DIR = ROOT / "site" / "public"

# Measurements the site does not show for now. The same list is in
# site/src/config.ts (HIDDEN_MEASUREMENTS); empty both to publish everything.
HIDDEN_FIELDS = (
    "critical_hydraulic_diameter_mm",
    "minimum_hydraulic_diameter_mm",
    "critical_energy_j",
)
SHOWN_FIELDS = ("cell_width_mm", "cell_length_mm")


def is_published(case: StoredCase) -> bool:
    """A case stays published if it has a shown measurement. Without one, only
    an RDE run with no hidden value stays: a detonation case then has nothing
    the site shows (for example a critical energy in J/cm, kept in its notes)."""
    has_shown = any(getattr(case, field) is not None for field in SHOWN_FIELDS)
    has_hidden = any(getattr(case, field) is not None for field in HIDDEN_FIELDS)
    return has_shown or (not has_hidden and case.setup == SetupType.rde)


def published_cases(cases: list[StoredCase]) -> list[StoredCase]:
    blank = {field: None for field in HIDDEN_FIELDS}
    return [case.model_copy(update=blank) for case in cases if is_published(case)]


def to_record(case: StoredCase) -> dict:
    """One case as a JSON object: numbers as numbers, empty values as null."""
    record = case.model_dump(mode="json")
    record["created_at"] = format_timestamp(case.created_at)
    return {column: record[column] for column in STORED_COLUMNS}


def build(data_path: Path = DATA_PATH, out_dir: Path = OUT_DIR) -> tuple[int, list[str]]:
    """Return (number of cases written, errors). Nothing is written on error."""
    cases, errors = read_cases(data_path)
    if errors:
        return 0, errors
    out_dir.mkdir(parents=True, exist_ok=True)
    published = published_cases(cases)
    records = [to_record(case) for case in published]
    text = json.dumps(records, ensure_ascii=False, separators=(",", ":"))
    (out_dir / "cases.json").write_text(text + "\n", encoding="utf-8")
    write_cases(out_dir / "cases.csv", published)
    return len(records), []


def internal_release_allowed() -> bool:
    """Internal releases build on a maintainer's computer; in CI, whose build
    is deployed, only with RDE_ALLOW_INTERNAL=1."""
    return os.environ.get("RDE_ALLOW_INTERNAL") == "1" or not os.environ.get("CI")


def build_rde(rde_dir: Path = RDE_DIR, out_dir: Path = OUT_DIR, allow_internal: bool = True) -> tuple[int, list[str]]:
    """Return (number of RDE operating points written, errors). Nothing is
    written on error."""
    data, errors = read_release(rde_dir)
    if errors:
        return 0, errors
    if data and data["release"].get("internal_use_only") and not allow_internal:
        return 0, [
            f"{rde_dir}: release {data['release']['release_version']} is marked internal use only and this build "
            "would be published; set RDE_ALLOW_INTERNAL=1 once the release is cleared for public distribution"
        ]
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = site_json(data)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    (out_dir / "rde.json").write_text(text + "\n", encoding="utf-8")
    write_rows(out_dir / "rde.csv", DOWNLOAD_COLUMNS, download_rows(data))
    write_rows(out_dir / "rde_chamber_pressures.csv", CHAMBER_PRESSURE_DOWNLOAD_COLUMNS, chamber_pressure_download_rows(data))
    return len(payload["operating_points"]), []


def main() -> int:
    count, errors = build()
    if errors:
        for line in errors:
            print(line, file=sys.stderr)
        print(f"{len(errors)} problem(s) in {DATA_PATH}; nothing written", file=sys.stderr)
        return 1
    print(f"wrote {count} cases to {OUT_DIR / 'cases.json'}")
    rde_count, rde_errors = build_rde(allow_internal=internal_release_allowed())
    if rde_errors:
        for line in rde_errors:
            print(line, file=sys.stderr)
        print(f"{len(rde_errors)} problem(s) in {RDE_DIR}; RDE files not written", file=sys.stderr)
        return 1
    print(f"wrote {rde_count} RDE operating points to {OUT_DIR / 'rde.json'}")
    data, _ = read_release(RDE_DIR)
    for note in consistency_notes(data):
        print(f"note: {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
