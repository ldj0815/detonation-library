"""Check a contributor's CSV and add its rows to data/cases.csv.

    python scripts/add_submission.py path/to/submission.csv

If any row is invalid, every problem is printed and nothing is changed.
Otherwise new cases are appended, and a row that repeats an existing case only
fills in fields that are still empty on that case.
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

from case_schema import Case, StoredCase
from csv_io import read_cases, write_cases
from submission import parse_submission, read_text

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "cases.csv"

# Two rows describe the same case when all of these are equal.
MATCH_FIELDS = (
    "title", "fuel", "oxidizer", "equivalence_ratio", "initial_pressure_kpa",
    "initial_temperature_k", "primary_diluent_name", "primary_diluent_percentage",
    "primary_dopant_name", "primary_dopant_ppm", "cell_width_mm", "cell_length_mm",
    "critical_hydraulic_diameter_mm", "minimum_hydraulic_diameter_mm", "critical_energy_j",
)

# On a repeated case, these are filled in when empty on the existing row.
FILL_FIELDS = (
    "cell_width_uncertainty_mm", "cell_length_uncertainty_mm",
    "tube_radius_mm", "chamber_width_mm", "chamber_height_mm",
    "geometry", "setup", "contributor_name", "contributor_institution", "contributor_email",
    "doi_reference", "sharing_link", "notes",
)


def match_key(case: Case) -> tuple:
    return tuple(getattr(case, field) for field in MATCH_FIELDS)


def merge(
    existing: list[StoredCase], submitted: list[Case], now: datetime
) -> tuple[list[StoredCase], dict[str, int]]:
    """Return (all cases after the merge, counts of created/updated/skipped)."""
    cases = list(existing)
    position: dict[tuple, int] = {}
    for index, case in enumerate(cases):
        position.setdefault(match_key(case), index)
    next_id = max((case.id for case in cases), default=0) + 1
    counts = {"created": 0, "updated": 0, "skipped": 0}

    for new in submitted:
        key = match_key(new)
        if key in position:
            current = cases[position[key]]
            fills = {
                field: getattr(new, field)
                for field in FILL_FIELDS
                if getattr(current, field) is None and getattr(new, field) is not None
            }
            if fills:
                cases[position[key]] = current.model_copy(update=fills)
                counts["updated"] += 1
            else:
                counts["skipped"] += 1
            continue
        cases.append(StoredCase(id=next_id, created_at=now, **new.model_dump()))
        position[key] = len(cases) - 1
        next_id += 1
        counts["created"] += 1
    return cases, counts


def add_submission(submission_path: Path, data_path: Path = DATA_PATH) -> tuple[dict[str, int], list[str]]:
    """Return (counts, errors). The data file is only written when errors is empty."""
    existing, errors = read_cases(data_path)
    if errors:
        return {}, [f"{data_path.name}: {line}" for line in errors]
    submitted, errors = parse_submission(read_text(submission_path))
    if errors:
        return {}, errors
    now = datetime.now(timezone.utc).replace(microsecond=0)
    merged, counts = merge(existing, submitted, now)
    write_cases(data_path, merged)
    return counts, []


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: python scripts/add_submission.py path/to/submission.csv", file=sys.stderr)
        return 2
    counts, errors = add_submission(Path(argv[0]))
    if errors:
        for line in errors:
            print(line, file=sys.stderr)
        print(f"{len(errors)} problem(s); no changes made", file=sys.stderr)
        return 1
    print(f"{counts['created']} created, {counts['updated']} updated, {counts['skipped']} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
