"""The submission format: what a contributor's CSV looks like and how one of
its rows becomes a case.

Everything about that format lives in this file so it can be reworked without
touching the stored data, the build, or the site. Today it is the 30-column
upload template of the old site.

    python scripts/submission.py     # rewrite data/TEMPLATE.csv
"""
import csv
import io
from pathlib import Path

from pydantic import ValidationError

from case_schema import CASE_FIELDS, Case, clean_row, error_lines

SUBMISSION_COLUMNS: tuple[str, ...] = CASE_FIELDS

TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "data" / "TEMPLATE.csv"


def template_text() -> str:
    return ",".join(SUBMISSION_COLUMNS) + "\n"


def read_text(path: Path) -> str:
    """Decode a contributor's file: UTF-8 (with or without an Excel byte-order
    mark), falling back to Windows-1252."""
    raw = Path(path).read_bytes()
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp1252")


def to_case(row: dict[str, str | None]) -> Case:
    """Turn one submitted row into a case. Raises pydantic.ValidationError."""
    return Case(**clean_row(row))


def parse_submission(text: str) -> tuple[list[Case], list[str]]:
    """Return (cases, errors). Errors read 'row N: ...', where N is the line of
    the file on which that record starts."""
    lines = text.splitlines(keepends=True)
    # Blank lines and '#' comment lines are allowed above the header only.
    skipped = 0
    while skipped < len(lines) and (
        not lines[skipped].strip() or lines[skipped].lstrip().startswith("#")
    ):
        skipped += 1
    reader = csv.DictReader(io.StringIO("".join(lines[skipped:]), newline=""))
    header = tuple(reader.fieldnames or ())
    if not header:
        return [], ["file has no header row"]
    problems = []
    missing = [c for c in SUBMISSION_COLUMNS if c not in header]
    unknown = [c for c in header if c not in SUBMISSION_COLUMNS]
    if missing:
        problems.append("header: missing columns: " + ", ".join(missing))
    if unknown:
        problems.append("header: unknown columns: " + ", ".join(unknown))
    if problems:
        return [], problems

    cases: list[Case] = []
    errors: list[str] = []
    previous_line = reader.line_num
    for row in reader:
        row_num = skipped + previous_line + 1
        previous_line = reader.line_num
        if None in row:
            errors.append(f"row {row_num}: too many cells")
            continue
        try:
            cases.append(to_case(row))
        except ValidationError as exc:
            errors.extend(f"row {row_num}: {line}" for line in error_lines(exc))
    if not cases and not errors:
        errors.append("file has no data rows")
    return cases, errors


if __name__ == "__main__":
    TEMPLATE_PATH.write_text(template_text(), encoding="utf-8")
    print(f"wrote {TEMPLATE_PATH}")
