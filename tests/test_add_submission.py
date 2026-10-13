from datetime import datetime, timezone

from add_submission import add_submission, main, merge
from case_schema import Case
from csv_io import read_cases, write_cases
from helpers import stored, valid_fields
from submission import SUBMISSION_COLUMNS

NOW = datetime(2026, 10, 12, 18, 0, 0, tzinfo=timezone.utc)


def new(**overrides) -> Case:
    return Case(**valid_fields(**overrides))


def test_new_cases_are_appended_with_the_next_ids():
    existing = [stored(1), stored(40, title="Run 40")]
    merged, counts = merge(existing, [new(title="A"), new(title="B")], NOW)
    assert counts == {"created": 2, "updated": 0, "skipped": 0}
    assert [c.id for c in merged] == [1, 40, 41, 42]
    assert merged[2].title == "A" and merged[2].created_at == NOW
    assert merged[:2] == existing


def test_first_case_in_an_empty_file_gets_id_1():
    merged, _ = merge([], [new()], NOW)
    assert merged[0].id == 1


def test_identical_case_is_skipped():
    merged, counts = merge([stored(1, cell_width_mm=14)], [new(cell_width_mm=14)], NOW)
    assert counts == {"created": 0, "updated": 0, "skipped": 1}
    assert len(merged) == 1


def test_repeated_case_fills_only_empty_fields():
    existing = [stored(1, cell_width_mm=14, notes="original note")]
    submitted = [new(cell_width_mm=14, cell_width_uncertainty_mm=0.5,
                     notes="new note", doi_reference="10.1000/xyz")]
    merged, counts = merge(existing, submitted, NOW)
    assert counts == {"created": 0, "updated": 1, "skipped": 0}
    assert merged[0].id == 1
    assert merged[0].cell_width_uncertainty_mm == 0.5
    assert merged[0].doi_reference == "10.1000/xyz"
    assert merged[0].notes == "original note"
    assert merged[0].created_at == existing[0].created_at


def test_a_different_measured_value_makes_a_new_case():
    merged, counts = merge([stored(1, cell_width_mm=14)], [new(cell_width_mm=15)], NOW)
    assert counts["created"] == 1
    assert len(merged) == 2


def test_a_row_repeated_inside_one_file_is_added_once():
    merged, counts = merge([], [new(title="A"), new(title="A")], NOW)
    assert counts == {"created": 1, "updated": 0, "skipped": 1}
    assert len(merged) == 1


def write_submission(path, *cases_fields):
    lines = [",".join(SUBMISSION_COLUMNS)]
    for fields in cases_fields:
        lines.append(",".join(str(fields.get(column, "")) for column in SUBMISSION_COLUMNS))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_add_submission_updates_the_data_file(tmp_path):
    data = tmp_path / "cases.csv"
    write_cases(data, [stored(1)])
    upload = tmp_path / "upload.csv"
    write_submission(upload, valid_fields(title="Run 2", fuel="CH4"), valid_fields())

    counts, errors = add_submission(upload, data)

    assert errors == []
    assert counts == {"created": 1, "updated": 0, "skipped": 1}
    cases, read_errors = read_cases(data)
    assert read_errors == []
    assert [(c.id, c.title, c.fuel) for c in cases] == [(1, "Run 1", "H2"), (2, "Run 2", "CH4")]
    assert cases[1].created_at.microsecond == 0


def test_add_submission_changes_nothing_when_a_row_is_invalid(tmp_path):
    data = tmp_path / "cases.csv"
    write_cases(data, [stored(1)])
    before = data.read_bytes()
    upload = tmp_path / "upload.csv"
    write_submission(upload, valid_fields(title="Run 2"), valid_fields(title="Run 3", setup="bogus"))

    counts, errors = add_submission(upload, data)

    assert counts == {}
    assert errors == ["row 3: setup: Input should be 'detonation' or 'rde'"]
    assert data.read_bytes() == before


def test_add_submission_refuses_a_broken_data_file(tmp_path):
    data = tmp_path / "cases.csv"
    data.write_text("id,title\n1,Run 1\n", encoding="utf-8")
    upload = tmp_path / "upload.csv"
    write_submission(upload, valid_fields())
    _, errors = add_submission(upload, data)
    assert errors[0].startswith("cases.csv: header: expected columns")


def test_main_needs_exactly_one_path(capsys):
    assert main([]) == 2
    assert "usage:" in capsys.readouterr().err
