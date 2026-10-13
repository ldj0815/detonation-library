import pytest

from case_schema import STORED_COLUMNS
from csv_io import format_number, format_timestamp, read_cases, write_cases
from helpers import stored


@pytest.mark.parametrize("value, text", [
    (100.0, "100"),
    (52.3832, "52.3832"),
    (0.5, "0.5"),
    (-3.0, "-3"),
    (1e-05, "1e-05"),
    (2.5e20, "2.5e+20"),
])
def test_format_number_is_shortest_form(value, text):
    assert format_number(value) == text


def test_format_timestamp_is_utc_with_z():
    assert format_timestamp(stored().created_at) == "2026-04-08T06:30:50.843939Z"


def test_round_trip_keeps_every_value(tmp_path):
    cases = [
        stored(1, title="ja5d [3, Akbar (1997)]", equivalence_ratio=1,
               initial_pressure_kpa=52.3832, primary_diluent_name="N2",
               notes="line one\nline two", doi_reference='says "hello"'),
        stored(5, setup="rde", cell_width_mm=14),
    ]
    path = tmp_path / "cases.csv"
    write_cases(path, cases)

    again, errors = read_cases(path)

    assert errors == []
    assert again == cases


def test_written_file_layout(tmp_path):
    path = tmp_path / "cases.csv"
    write_cases(path, [stored(3, equivalence_ratio=1, initial_pressure_kpa=52.3832)])
    text = path.read_text(encoding="utf-8")
    header, row = text.splitlines()
    assert header == ",".join(STORED_COLUMNS)
    assert row.startswith("3,Run 1,detonation,round tube,H2,O2,1,52.3832,,")
    assert row.endswith(",2026-04-08T06:30:50.843939Z")
    assert "\r" not in text


def test_writing_what_was_read_gives_the_same_bytes(tmp_path):
    path = tmp_path / "cases.csv"
    write_cases(path, [stored(1, notes="a,b\nc", cell_width_mm=0.25), stored(2)])
    before = path.read_bytes()
    cases, _ = read_cases(path)
    write_cases(path, cases)
    assert path.read_bytes() == before


def test_wrong_header_is_reported(tmp_path):
    path = tmp_path / "cases.csv"
    path.write_text("id,title\n1,Run 1\n", encoding="utf-8")
    cases, errors = read_cases(path)
    assert cases == []
    assert len(errors) == 1 and errors[0].startswith("header: expected columns id,title,setup,")


def test_bad_rows_are_reported_by_row_number(tmp_path):
    path = tmp_path / "cases.csv"
    write_cases(path, [stored(1), stored(2), stored(3)])
    lines = path.read_text(encoding="utf-8").splitlines()
    lines[2] = lines[2].replace("detonation", "shock_tube")   # row 3: bad setup
    lines[3] = lines[3].replace(",H2,", ",,")                   # row 4: fuel blank
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    cases, errors = read_cases(path)

    assert [c.id for c in cases] == [1]
    assert errors == [
        "row 3: setup: Input should be 'detonation' or 'rde'",
        "row 4: fuel: Value error, fuel must not be empty",
    ]


def test_duplicate_id_is_reported(tmp_path):
    path = tmp_path / "cases.csv"
    write_cases(path, [stored(4), stored(4, title="Run 2")])
    cases, errors = read_cases(path)
    assert [c.title for c in cases] == ["Run 1"]
    assert errors == ["row 3: duplicate id 4"]


def test_row_with_too_many_cells_is_reported(tmp_path):
    path = tmp_path / "cases.csv"
    write_cases(path, [stored(1)])
    with open(path, "a", encoding="utf-8") as handle:
        handle.write("2,Run 2,detonation" + "," * 40 + "\n")
    _, errors = read_cases(path)
    assert errors == ["row 3: too many cells"]
