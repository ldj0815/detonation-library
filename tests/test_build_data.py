import csv
import json

from build_data import build, build_rde, internal_release_allowed
from case_schema import STORED_COLUMNS
from csv_io import read_cases, write_cases
from helpers import stored
from rde_data import (
    CHAMBER_PRESSURE_COLUMNS,
    DOWNLOAD_COLUMNS,
    OPERATING_POINT_COLUMNS,
    PUBLICATION_COLUMNS,
    write_rows,
)


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


RDE_RELEASE = {"release_version": "1.0.0", "release_date": "2026-10-23", "internal_use_only": True,
               "database": "rde_database_2026-10-23.sqlite", "database_sha256": "0" * 64, "views": []}


def write_rde_subset(folder, points=None):
    folder.mkdir(parents=True)
    write_rows(folder / "publications.csv", PUBLICATION_COLUMNS, [
        dict(id=1, label="Smith (2021)", title="Rotating detonation rocket engines", year=2021,
             doi="10.2514/1.b37959", engine_code="R"),
    ])
    write_rows(folder / "operating_points.csv", OPERATING_POINT_COLUMNS, points or [
        dict(id=1, publication_id=1, test_run_id=1, operating_point_type="steady", engine_code="R",
             fuel="H2", fuel_reported="Hydrogen", oxidizer="O2", oxidizer_reported="Oxygen", wave_count=2),
        dict(id=2, publication_id=1, test_run_id=2, operating_point_type="steady", engine_code="R",
             fuel="CH4", fuel_reported="Methane", oxidizer="O2", oxidizer_reported="O2", thrust_n=1200.5),
    ])
    write_rows(folder / "chamber_pressures.csv", CHAMBER_PRESSURE_COLUMNS, [
        dict(id=1, operating_point_id=2, pressure_kpa=310.5, pressure_kpa_method="reported_table"),
    ])
    (folder / "release.json").write_text(json.dumps(RDE_RELEASE), encoding="utf-8")
    return folder


def test_build_rde_writes_json_and_a_csv_download(tmp_path):
    rde_dir = write_rde_subset(tmp_path / "rde_subset")
    out = tmp_path / "public"

    count, errors = build_rde(rde_dir, out)

    assert (count, errors) == (2, [])
    payload = json.loads((out / "rde.json").read_text(encoding="utf-8"))
    assert list(payload) == ["release", "publications", "operating_points"]
    assert payload["release"] == RDE_RELEASE
    assert payload["publications"][0]["label"] == "Smith (2021)"
    assert payload["publications"][0]["operating_points"] == 2
    first, second = payload["operating_points"]
    assert first["wave_count"] == 2
    assert "thrust_n" not in first
    assert "chamber_pressures" not in first
    assert second["chamber_pressures"] == [{"id": 1, "pressure_kpa": 310.5, "pressure_kpa_method": "reported_table"}]
    with (out / "rde.csv").open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    assert list(rows[0]) == DOWNLOAD_COLUMNS
    assert [(r["id"], r["publication"], r["doi"], r["thrust_n"]) for r in rows] == [
        ("1", "Smith (2021)", "10.2514/1.b37959", ""),
        ("2", "Smith (2021)", "10.2514/1.b37959", "1200.5"),
    ]


def test_build_rde_without_a_subset_writes_empty_files(tmp_path):
    out = tmp_path / "public"

    count, errors = build_rde(tmp_path / "rde_subset", out)

    assert (count, errors) == (0, [])
    payload = json.loads((out / "rde.json").read_text(encoding="utf-8"))
    assert payload == {"release": None, "publications": [], "operating_points": []}
    assert (out / "rde.csv").read_text(encoding="utf-8") == ",".join(DOWNLOAD_COLUMNS) + "\n"
    assert (out / "rde_chamber_pressures.csv").read_text(encoding="utf-8").count("\n") == 1


def test_build_rde_reports_problems_and_writes_nothing(tmp_path):
    rde_dir = write_rde_subset(tmp_path / "rde_subset", points=[
        dict(id=1, publication_id=7, test_run_id=1, operating_point_type="steady", engine_code="R",
             fuel="H2", oxidizer="O2"),
    ])
    out = tmp_path / "public"

    count, errors = build_rde(rde_dir, out)

    assert count == 0
    assert errors == [
        "operating_points.csv row 2: publication_id 7 is not in publications.csv",
        "chamber_pressures.csv row 2: operating_point_id 2 is not in operating_points.csv",
    ]
    assert not out.exists()


def test_build_rde_writes_the_chamber_pressures_download(tmp_path):
    rde_dir = write_rde_subset(tmp_path / "rde_subset")
    out = tmp_path / "public"

    build_rde(rde_dir, out)

    with (out / "rde_chamber_pressures.csv").open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    assert [(r["operating_point_id"], r["publication"], r["release_version"], r["pressure_kpa"]) for r in rows] == [
        ("2", "Smith (2021)", "1.0.0", "310.5"),
    ]
    with (out / "rde.csv").open(encoding="utf-8", newline="") as f:
        points = list(csv.DictReader(f))
    assert [r["chamber_pressures_kpa"] for r in points] == ["", "310.5"]


def test_build_rde_refuses_an_internal_release_where_it_would_be_published(tmp_path):
    rde_dir = write_rde_subset(tmp_path / "rde_subset")
    out = tmp_path / "public"

    count, errors = build_rde(rde_dir, out, allow_internal=False)

    assert count == 0
    assert len(errors) == 1 and "marked internal use only" in errors[0] and "RDE_ALLOW_INTERNAL=1" in errors[0]
    assert not out.exists()


def test_build_rde_builds_a_cleared_release_anywhere(tmp_path):
    rde_dir = write_rde_subset(tmp_path / "rde_subset")
    (rde_dir / "release.json").write_text(json.dumps({**RDE_RELEASE, "internal_use_only": False}), encoding="utf-8")

    count, errors = build_rde(rde_dir, tmp_path / "public", allow_internal=False)

    assert (count, errors) == (2, [])


def test_internal_releases_build_locally_and_in_ci_only_on_request(monkeypatch):
    monkeypatch.delenv("CI", raising=False)
    monkeypatch.delenv("RDE_ALLOW_INTERNAL", raising=False)
    assert internal_release_allowed()
    monkeypatch.setenv("CI", "true")
    assert not internal_release_allowed()
    monkeypatch.setenv("RDE_ALLOW_INTERNAL", "1")
    assert internal_release_allowed()
