"""Check data/cases.csv and produce the files the site serves.

    python scripts/build_data.py

Writes site/public/cases.json (what the pages read) and site/public/cases.csv
(the "Download full dataset" file). On any invalid row it prints every problem
and writes nothing.

While HIDDEN_FIELDS is not empty, the site is a cell-size library: those
columns are published empty and a case that carries nothing but hidden values
is left out of both files. data/cases.csv is never changed by this.
"""
import json
import sys
from pathlib import Path

from case_schema import STORED_COLUMNS, StoredCase
from csv_io import format_timestamp, read_cases, write_cases

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "cases.csv"
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
    """A case stays published if it has a shown measurement or no hidden one."""
    has_shown = any(getattr(case, field) is not None for field in SHOWN_FIELDS)
    has_hidden = any(getattr(case, field) is not None for field in HIDDEN_FIELDS)
    return has_shown or not has_hidden


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


def main() -> int:
    count, errors = build()
    if errors:
        for line in errors:
            print(line, file=sys.stderr)
        print(f"{len(errors)} problem(s) in {DATA_PATH}; nothing written", file=sys.stderr)
        return 1
    print(f"wrote {count} cases to {OUT_DIR / 'cases.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
