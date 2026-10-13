import json

from build_data import build
from case_schema import STORED_COLUMNS
from csv_io import write_cases
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
    assert (out / "cases.csv").read_bytes() == data.read_bytes()


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
