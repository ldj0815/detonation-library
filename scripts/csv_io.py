"""Read and write data/cases.csv."""
import csv
from datetime import datetime, timezone
from pathlib import Path

from pydantic import ValidationError

from case_schema import NUMERIC_FIELDS, STORED_COLUMNS, StoredCase, clean_row, error_lines


def format_number(value: float) -> str:
    """Shortest text for a number: 100.0 -> '100', 52.3832 -> '52.3832'."""
    if value == int(value) and abs(value) < 1e15:
        return str(int(value))
    return repr(value)


def format_timestamp(value: datetime) -> str:
    """UTC ISO 8601 with a trailing Z, e.g. '2026-04-08T06:30:50.843939Z'."""
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def to_row(case: StoredCase) -> list[str]:
    row = []
    for column in STORED_COLUMNS:
        value = getattr(case, column)
        if value is None:
            row.append("")
        elif column == "created_at":
            row.append(format_timestamp(value))
        elif column == "setup":
            row.append(value.value)
        elif column in NUMERIC_FIELDS:
            row.append(format_number(value))
        else:
            row.append(str(value))
    return row


def write_cases(path: Path, cases: list[StoredCase]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(STORED_COLUMNS)
        writer.writerows(to_row(case) for case in cases)


def read_cases(path: Path) -> tuple[list[StoredCase], list[str]]:
    """Return (cases, errors).

    Errors read 'row N: ...', where N counts records and the header is row 1,
    matching what a spreadsheet shows. Cells may contain line breaks, so the
    file is parsed as CSV rather than split into lines first.
    """
    cases: list[StoredCase] = []
    errors: list[str] = []
    seen_ids: set[int] = set()
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if tuple(reader.fieldnames or ()) != STORED_COLUMNS:
            return [], ["header: expected columns " + ",".join(STORED_COLUMNS)]
        for row_num, row in enumerate(reader, start=2):
            if None in row:
                errors.append(f"row {row_num}: too many cells")
                continue
            try:
                case = StoredCase(**clean_row(row))
            except ValidationError as exc:
                errors.extend(f"row {row_num}: {line}" for line in error_lines(exc))
                continue
            if case.id in seen_ids:
                errors.append(f"row {row_num}: duplicate id {case.id}")
                continue
            seen_ids.add(case.id)
            cases.append(case)
    return cases, errors
