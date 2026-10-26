import json

from build_data import build
from case_schema import STORED_COLUMNS
from csv_io import read_cases, write_cases
from helpers import stored


def test_build_writes_typed_json_and_a_csv_copy(tmp_path):
    data = tmp_path / "cases.csv"
    out = tmp_path / "public"
    write_cases(data, [
        stored(7, equivalence_ratio=1, cell_width_mm=14.5, primary_diluent_name="N2"),
        stored(9, setup="rde", notes="Vasil’ev"),
    ])

    count, errors = build(data, out)

    assert (count, errors) == (2, [])
    records = json.loads((out / "cases.json").read_text(encoding="utf-8"))
    first = records[0]
    assert list(first) == list(STORED_COLUMNS)
    assert first["id"] == 7
    assert first["equivalence_ratio"] == 1
    assert first["cell_width_mm"] == 14.5
    assert first["primary_diluent_name"] == "N2"
    assert first["primary_dopant_name"] is None
    assert first["setup"] == "detonation"
    assert first["created_at"] == "2026-04-08T06:30:50.843939Z"
    assert records[1]["setup"] == "rde"
    assert records[1]["notes"] == "Vasil’ev"
    copied, copy_errors = read_cases(out / "cases.csv")
    assert copy_errors == []
    assert [case.id for case in copied] == [7, 9]
    assert copied[0].cell_width_mm == 14.5


def test_build_leaves_out_the_hidden_measurements(tmp_path):
    """While HIDDEN_FIELDS is set, cases that carry only hidden values, and
    detonation cases with no measurement at all, are left out; the hidden
    columns are published empty; data/cases.csv is untouched."""
    data = tmp_path / "cases.csv"
    out = tmp_path / "public"
    write_cases(data, [
        stored(1, cell_width_mm=10),
        stored(2, critical_energy_j=5),
        stored(3, cell_length_mm=30, critical_hydraulic_diameter_mm=20),
        stored(4, setup="rde", sharing_link="https://example.org/run-4"),
        stored(5, notes="Critical energy 62.7944 J/cm (cylindrical initiation)."),
    ])
    before = data.read_bytes()

    count, errors = build(data, out)

    assert (count, errors) == (3, [])
    records = json.loads((out / "cases.json").read_text(encoding="utf-8"))
    assert [r["id"] for r in records] == [1, 3, 4]
    assert records[1]["cell_length_mm"] == 30
    assert records[1]["critical_hydraulic_diameter_mm"] is None
    assert list(records[1]) == list(STORED_COLUMNS)
    copied, copy_errors = read_cases(out / "cases.csv")
    assert copy_errors == []
    assert [case.id for case in copied] == [1, 3, 4]
    assert copied[1].critical_hydraulic_diameter_mm is None
    assert data.read_bytes() == before


def test_build_reports_problems_and_writes_nothing(tmp_path):
    data = tmp_path / "cases.csv"
    out = tmp_path / "public"
    write_cases(data, [stored(1)])
    data.write_text(
        data.read_text(encoding="utf-8").replace("detonation", "shock_tube"),
        encoding="utf-8",
    )

    count, errors = build(data, out)

    assert count == 0
    assert errors == ["row 2: setup: Input should be 'detonation' or 'rde'"]
    assert not out.exists()
