"""Check data/cases.csv and produce the files the site serves.

    python scripts/build_data.py

Writes site/public/cases.json (what the pages read) and site/public/cases.csv
(the "Download full dataset" file). On any invalid row it prints every problem
and writes nothing.
"""
import json
import shutil
import sys
from pathlib import Path

from case_schema import STORED_COLUMNS, StoredCase
from csv_io import format_timestamp, read_cases

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "cases.csv"
OUT_DIR = ROOT / "site" / "public"


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
    records = [to_record(case) for case in cases]
    text = json.dumps(records, ensure_ascii=False, separators=(",", ":"))
    (out_dir / "cases.json").write_text(text + "\n", encoding="utf-8")
    shutil.copyfile(data_path, out_dir / "cases.csv")
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
