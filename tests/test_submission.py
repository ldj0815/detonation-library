from pathlib import Path

from case_schema import CASE_FIELDS
from helpers import valid_fields
from submission import SUBMISSION_COLUMNS, parse_submission, read_text, template_text

REPO_ROOT = Path(__file__).resolve().parent.parent


def line(**overrides) -> str:
    """One submission data line; cells must not contain commas or quotes."""
    fields = valid_fields(**overrides)
    return ",".join(str(fields.get(column, "")) for column in SUBMISSION_COLUMNS)


def submission(*data_lines: str, header: str | None = None) -> str:
    return "\n".join([header or ",".join(SUBMISSION_COLUMNS), *data_lines]) + "\n"


def test_template_is_the_header_row():
    assert template_text() == ",".join(CASE_FIELDS) + "\n"


def test_template_file_matches_the_format():
    assert (REPO_ROOT / "data" / "TEMPLATE.csv").read_text(encoding="utf-8") == template_text()


def test_valid_rows_become_cases():
    cases, errors = parse_submission(submission(
        line(equivalence_ratio=1, cell_width_mm=14),
        line(title="Run 2", setup="rde"),
    ))
    assert errors == []
    assert [c.title for c in cases] == ["Run 1", "Run 2"]
    assert cases[0].cell_width_mm == 14.0
    assert cases[0].notes is None
    assert cases[1].setup.value == "rde"


def test_errors_carry_the_file_line_number():
    cases, errors = parse_submission(submission(
        line(),
        line(equivalence_ratio=500),
        line(fuel=""),
    ))
    assert [c.title for c in cases] == ["Run 1"]
    assert errors == [
        "row 3: equivalence_ratio: Value error, equivalence_ratio must be between 0.01 and 100.0",
        "row 4: fuel: Value error, fuel must not be empty",
    ]


def test_comment_lines_above_the_header_are_ignored_and_counted():
    text = "# Template notes\n# more notes\n\n" + submission(line(), line(setup="bogus"))
    cases, errors = parse_submission(text)
    assert len(cases) == 1
    assert errors == ["row 6: setup: Input should be 'detonation' or 'rde'"]


def test_a_data_row_starting_with_hash_is_data():
    cases, errors = parse_submission(submission(line(title="#1 shot")))
    assert errors == []
    assert cases[0].title == "#1 shot"


def test_line_breaks_inside_a_quoted_cell_are_kept():
    header = ",".join(SUBMISSION_COLUMNS)
    first = line().rsplit(",", 1)[0] + ',"first line\nsecond line"'
    cases, errors = parse_submission(f"{header}\n{first}\n{line(fuel='')}\n")
    assert cases[0].notes == "first line\nsecond line"
    assert errors == ["row 4: fuel: Value error, fuel must not be empty"]


def test_missing_and_unknown_columns_are_reported():
    header = ",".join(c for c in SUBMISSION_COLUMNS if c != "fuel") + ",colour"
    cases, errors = parse_submission(submission(line(), header=header))
    assert cases == []
    assert errors == [
        "header: missing columns: fuel",
        "header: unknown columns: colour",
    ]


def test_short_row_reports_its_missing_required_cells():
    cases, errors = parse_submission(submission("Run 1,detonation,round tube,H2"))
    assert cases == []
    assert "row 2: oxidizer: Value error, oxidizer must not be empty" in errors


def test_row_with_too_many_cells():
    _, errors = parse_submission(submission(line() + ",extra"))
    assert errors == ["row 2: too many cells"]


def test_empty_and_header_only_files():
    assert parse_submission("") == ([], ["file has no header row"])
    assert parse_submission(submission()) == ([], ["file has no data rows"])


def test_read_text_handles_excel_bom_and_windows_encoding(tmp_path):
    bom = tmp_path / "bom.csv"
    bom.write_bytes(b"\xef\xbb\xbftitle,setup\n")
    assert read_text(bom) == "title,setup\n"

    windows = tmp_path / "windows.csv"
    windows.write_bytes("Vasil’ev".encode("cp1252"))
    assert read_text(windows) == "Vasil’ev"
