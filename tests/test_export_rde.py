import csv
import hashlib
import json
import sqlite3
from pathlib import Path

import pytest

from export_rde import check_one_per_point, connect, export, newest_release
from rde_data import (
    CHAMBER_PRESSURE_COLUMNS,
    CHAMBER_PRESSURE_SOURCE,
    MODAL_SOURCE,
    OPERATING_POINT_COLUMNS,
    OPERATING_POINT_SOURCE,
    PERFORMANCE_SOURCE,
    PRESSURE_GAIN_SOURCE,
    PUBLICATION_COLUMNS,
    PUBLICATION_SOURCE,
    read_release,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
REAL_RELEASE = REPO_ROOT / "data" / "RDE" / "rde_database_2026-10-23" / "rde_database_2026-10-23.sqlite"
SUBSET_DIR = REPO_ROOT / "data" / "rde_subset"


def source_columns(source, *extra):
    columns = list(extra)
    for _, column, _ in source:
        if column not in columns:
            columns.append(column)
    return columns


# Tables named like the release's views, with exactly the columns the export reads.
TABLES = {
    "viz_publications": source_columns(PUBLICATION_SOURCE),
    "viz_operating_points": source_columns(OPERATING_POINT_SOURCE),
    "viz_average_modal_properties": source_columns(MODAL_SOURCE, "operating_point_id"),
    "viz_propulsive_performance": source_columns(PERFORMANCE_SOURCE, "operating_point_id"),
    "viz_power_gen_performance": source_columns(PRESSURE_GAIN_SOURCE, "operating_point_id"),
    "viz_chamber_pressure": source_columns(CHAMBER_PRESSURE_SOURCE),
}

METADATA = {
    "release_version": "1.0.0",
    "release_date": "2026-10-23",
    "schema_version": "reviewed_ingestion_v1",
    "internal_use_only": True,
    "template_source_folder": "C:\\Users\\someone\\workbooks",
}


def insert(connection, table, **values):
    unknown = set(values) - set(TABLES[table])
    assert not unknown, f"{table} has no column {unknown}"
    names = ", ".join(f'"{c}"' for c in values)
    marks = ", ".join("?" for _ in values)
    connection.execute(f"INSERT INTO {table} ({names}) VALUES ({marks})", list(values.values()))


def fill(connection):
    for key, value in METADATA.items():
        connection.execute("INSERT INTO database_release_metadata VALUES (?, ?)", (key, json.dumps(value)))

    insert(connection, "viz_publications", publication_id=1,
           publication_label="Smith (2021) - Experimental Investigation of Rotating Detonation Rocket Engines for…",
           title="Experimental Investigation of Rotating Detonation Rocket Engines for Space Propulsion",
           year=2021, venue="Journal of Propulsion and Power", authorship_list="Richard D. Smith; Steven B. Stanley",
           doi="10.2514/1.b37959", reporting_country="United States of America", engine_code="R")
    insert(connection, "viz_publications", publication_id=2, publication_label="Bykovskii (2006)",
           title="Noise and Vibrations in a Combustor with Continuous Spin Detonation of the Fuel",
           year=2006, venue="Combustion, Explosion, and Shock Waves", authorship_list="F. A. Bykovskii, E. F. Vedernikov",
           doi="10.1007/s10573-006-0090-y", reporting_country="Russian Federation", engine_code="AB")

    insert(connection, "viz_operating_points", operating_point_id=1, publication_id=1, test_run_id=1,
           operating_point_sequence_index=1, operating_point_type="steady", engine_code="R",
           fuel_species="Hydrogen", fuel_phase="gas", oxidizer_species="Oxygen", oxidizer_phase="gas",
           diluent_dopant_species="N/A", mdot_total_value_kg_s=0.25, mdot_total_extraction_method="reported_table",
           global_equivalence_ratio_value=1.1, global_equivalence_ratio_uncertainty=0.05,
           global_equivalence_ratio_extraction_method="calculated", combustor_type=" axial_annular ",
           chamber_outer_diameter_value_mm=76.2, chamber_outer_diameter_extraction_method="reported_text",
           throat_area_value_m2=0.000123)
    insert(connection, "viz_operating_points", operating_point_id=3, publication_id=2, test_run_id=3,
           operating_point_type="steady", engine_code="AB", fuel_species="Ethlyene", oxidizer_species="Air",
           diluent_dopant_species="", combustor_type="")
    insert(connection, "viz_operating_points", operating_point_id=2, publication_id=2, test_run_id=2,
           operating_point_type="transient_blowdown", engine_code="AB",
           fuel_species="kerosene (liquid; grade not stated)", fuel_phase="liquid", oxidizer_species="air",
           diluent_dopant_species="C2H2 and O2 (optical tracers, unquantified)", window_start_s=0.0)

    # Result rows inserted out of point order; point 3 has none.
    insert(connection, "viz_average_modal_properties", operating_point_id=2,
           primary_direction_wave_count=1, primary_direction_wave_count_extraction_method="reported_table")
    insert(connection, "viz_average_modal_properties", operating_point_id=1,
           average_modal_properties_detection_method="high speed camera_side",
           primary_direction_wave_count=2, primary_direction_wave_count_extraction_method="digitized_from_figure",
           primary_direction_wave_speed_value_m_s=1520.5, primary_direction_wave_speed_uncertainty_m_s=30,
           primary_direction_wave_speed_extraction_method="calculated",
           primary_direction_operating_frequency_value_kHz=6.35,
           wave_speed_reference_diameter_value_mm=76.2)
    insert(connection, "viz_propulsive_performance", operating_point_id=1, thrust_value_N=1200,
           thrust_extraction_method="reported_table", thrust_type="uncorrected",
           specific_impulse_value_s=210.5, specific_impulse_extraction_method="calculated")
    insert(connection, "viz_power_gen_performance", operating_point_id=2,
           stagnation_pressure_gain_percent_value=-0.129, stagnation_pressure_gain_percent_uncertainty=0.004,
           stagnation_pressure_gain_percent_extraction_method="calculated")

    insert(connection, "viz_chamber_pressure", chamber_pressure_id=11, operating_point_id=1,
           chamber_pressure_value_kPa=310.5, chamber_pressure_extraction_method="digitized_from_figure",
           is_representative_at_upstream_side=0)
    insert(connection, "viz_chamber_pressure", chamber_pressure_id=10, operating_point_id=1,
           chamber_pressure_value_kPa=250, chamber_pressure_extraction_method="reported_table",
           is_representative_at_upstream_side=1)


def make_database(path, extra=None):
    connection = sqlite3.connect(path)
    for table, columns in TABLES.items():
        quoted = ", ".join(f'"{c}"' for c in columns)
        connection.execute(f"CREATE TABLE {table} ({quoted})")
    connection.execute("CREATE TABLE database_release_metadata (key TEXT, value_json TEXT)")
    fill(connection)
    if extra:
        extra(connection)
    connection.commit()
    connection.close()
    return path


@pytest.fixture
def database(tmp_path):
    return make_database(tmp_path / "rde_database_2026-10-23.sqlite")


def by_id(rows):
    return {row["id"]: row for row in rows}


def test_export_writes_one_row_per_operating_point(database, tmp_path):
    out = tmp_path / "rde_subset"

    counts = export(database, out)

    assert counts == {"publications": 2, "operating_points": 3, "chamber_pressures": 2}
    with (out / "operating_points.csv").open(encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    assert rows[0] == OPERATING_POINT_COLUMNS
    assert [row[0] for row in rows[1:]] == ["1", "2", "3"]
    data, errors = read_release(out)
    assert errors == []
    assert len(data["operating_points"]) == 3


def test_export_normalises_names_and_keeps_the_reported_wording(database, tmp_path):
    out = tmp_path / "rde_subset"
    export(database, out)
    points = by_id(read_release(out)[0]["operating_points"])

    assert [(points[i]["fuel"], points[i]["fuel_reported"]) for i in (1, 2, 3)] == [
        ("H2", "Hydrogen"),
        ("Kerosene", "kerosene (liquid; grade not stated)"),
        ("C2H4", "Ethlyene"),
    ]
    assert [(points[i]["oxidizer"], points[i]["oxidizer_reported"]) for i in (1, 2, 3)] == [
        ("O2", "Oxygen"),
        ("Air", "air"),
        ("Air", "Air"),
    ]
    assert points[1]["diluent"] is None
    assert points[2]["diluent"] == "C2H2 and O2 (optical tracers, unquantified)"
    assert points[3]["diluent"] is None
    assert points[1]["combustor_type"] == "axial_annular"
    assert points[3]["combustor_type"] is None


def test_export_turns_the_pressure_gain_fraction_into_percent(database, tmp_path):
    out = tmp_path / "rde_subset"
    export(database, out)
    points = by_id(read_release(out)[0]["operating_points"])

    assert points[2]["pressure_gain_percent"] == -12.9
    assert points[2]["pressure_gain_percent_uncertainty"] == 0.4
    assert points[2]["pressure_gain_percent_method"] == "calculated"
    assert points[1]["pressure_gain_percent"] is None
    with (out / "operating_points.csv").open(encoding="utf-8", newline="") as f:
        row = next(r for r in csv.DictReader(f) if r["id"] == "2")
    assert row["pressure_gain_percent"] == "-12.9"


def test_export_joins_results_to_the_right_point(database, tmp_path):
    out = tmp_path / "rde_subset"
    export(database, out)
    points = by_id(read_release(out)[0]["operating_points"])

    one, two, three = points[1], points[2], points[3]
    assert one["wave_count"] == 2
    assert one["wave_count_method"] == "digitized_from_figure"
    assert (one["wave_speed_m_s"], one["wave_speed_m_s_uncertainty"], one["wave_speed_m_s_method"]) == (1520.5, 30, "calculated")
    assert one["frequency_khz"] == 6.35
    assert one["wave_speed_reference_diameter_mm"] == 76.2
    assert one["modal_detection_method"] == "high speed camera_side"
    assert (one["thrust_n"], one["thrust_type"], one["specific_impulse_s"]) == (1200, "uncorrected", 210.5)
    assert one["equivalence_ratio"] == 1.1 and one["equivalence_ratio_uncertainty"] == 0.05
    assert one["throat_area_m2"] == 0.000123
    assert two["wave_count"] == 1
    assert two["wave_speed_m_s"] is None
    assert two["thrust_n"] is None
    assert two["window_start_s"] == 0.0
    for column in OPERATING_POINT_COLUMNS[OPERATING_POINT_COLUMNS.index("modal_detection_method"):]:
        assert three[column] is None, column
    assert three["secondary_wave_count"] is None


def test_export_shortens_publication_labels(database, tmp_path):
    out = tmp_path / "rde_subset"
    export(database, out)
    publications = read_release(out)[0]["publications"]

    assert [(p["id"], p["label"], p["year"], p["engine_code"]) for p in publications] == [
        (1, "Smith (2021)", 2021, "R"),
        (2, "Bykovskii (2006)", 2006, "AB"),
    ]
    assert publications[0]["authors"] == "Richard D. Smith; Steven B. Stanley"
    assert publications[0]["doi"] == "10.2514/1.b37959"
    header = (out / "publications.csv").read_text(encoding="utf-8").splitlines()[0]
    assert header == ",".join(PUBLICATION_COLUMNS)


def test_export_writes_every_chamber_pressure(database, tmp_path):
    out = tmp_path / "rde_subset"
    export(database, out)
    pressures = read_release(out)[0]["chamber_pressures"]

    header = (out / "chamber_pressures.csv").read_text(encoding="utf-8").splitlines()[0]
    assert header == ",".join(CHAMBER_PRESSURE_COLUMNS)
    assert [(p["id"], p["operating_point_id"], p["pressure_kpa"], p["pressure_kpa_method"], p["representative_upstream"])
            for p in pressures] == [
        (10, 1, 250, "reported_table", 1),
        (11, 1, 310.5, "digitized_from_figure", 0),
    ]


def test_export_records_which_release_it_came_from(database, tmp_path):
    out = tmp_path / "rde_subset"
    export(database, out)

    release = json.loads((out / "release.json").read_text(encoding="utf-8"))

    assert release["release_version"] == "1.0.0"
    assert release["release_date"] == "2026-10-23"
    assert release["schema_version"] == "reviewed_ingestion_v1"
    assert release["internal_use_only"] is True
    assert release["database"] == "rde_database_2026-10-23.sqlite"
    assert release["database_sha256"] == hashlib.sha256(database.read_bytes()).hexdigest()
    assert release["views"] == list(TABLES)
    # Other metadata, such as the authors' local paths, stays behind.
    assert "template_source_folder" not in release


def test_export_leaves_the_database_unchanged(database, tmp_path):
    before = database.read_bytes()

    export(database, tmp_path / "rde_subset")

    assert database.read_bytes() == before
    assert sorted(p.name for p in database.parent.iterdir() if p.is_file()) == [database.name]


def test_connect_is_read_only(database):
    connection = connect(database)
    try:
        with pytest.raises(sqlite3.OperationalError):
            connection.execute("DELETE FROM viz_publications")
    finally:
        connection.close()


@pytest.mark.parametrize("table", ["viz_average_modal_properties", "viz_propulsive_performance", "viz_power_gen_performance"])
def test_check_one_per_point_rejects_a_repeated_result(tmp_path, table):
    def repeat(connection):
        insert(connection, table, operating_point_id=1)
        insert(connection, table, operating_point_id=1)

    database = make_database(tmp_path / "rde_database_2026-10-23.sqlite", repeat)
    connection = connect(database)
    try:
        with pytest.raises(ValueError, match=f"{table} has 1 operating points with more than one record"):
            check_one_per_point(connection)
    finally:
        connection.close()

    out = tmp_path / "rde_subset"
    with pytest.raises(ValueError):
        export(database, out)
    assert not out.exists()


def test_newest_release_picks_the_latest_date(tmp_path):
    for date in ("2026-10-23", "2026-01-05"):
        folder = tmp_path / f"rde_database_{date}"
        folder.mkdir()
        (folder / f"rde_database_{date}.sqlite").write_bytes(b"")

    assert newest_release(tmp_path) == tmp_path / "rde_database_2026-10-23" / "rde_database_2026-10-23.sqlite"


def test_newest_release_without_one(tmp_path):
    with pytest.raises(FileNotFoundError):
        newest_release(tmp_path)


@pytest.mark.skipif(not REAL_RELEASE.exists(), reason=f"{REAL_RELEASE.relative_to(REPO_ROOT)} is not on this computer")
def test_export_of_the_real_release(tmp_path):
    out = tmp_path / "rde_subset"

    counts = export(REAL_RELEASE, out)

    assert counts == {"publications": 11, "operating_points": 611, "chamber_pressures": 148}
    data, errors = read_release(out)
    assert errors == []
    points = data["operating_points"]
    assert len(points) == 611
    assert len(data["publications"]) == 11
    assert len(data["chamber_pressures"]) == 148
    assert {p["engine_code"] for p in points} == {"R", "AB", "AAB"}
    assert {p["engine_code"] for p in data["publications"]} <= {"R", "AB", "AAB"}
    assert {code: sum(p["engine_code"] == code for p in points) for code in ("R", "AB", "AAB")} == {"R": 171, "AB": 295, "AAB": 145}
    assert {p["fuel"] for p in points} == {"H2", "CH4", "Kerosene", "C2H4", "C2H6"}
    assert {p["oxidizer"] for p in points} == {"Air", "O2", "O2-enriched air"}
    gains = [p["pressure_gain_percent"] for p in points if p["pressure_gain_percent"] is not None]
    assert len(gains) == 54
    assert all(-100 < g < 0 for g in gains)
    assert data["release"]["internal_use_only"] is True
    manifest = REAL_RELEASE.parent / "release_manifest.json"
    if manifest.exists():
        expected = json.loads(manifest.read_text(encoding="utf-8"))["database_sha256"]
        assert data["release"]["database_sha256"] == expected


def subset_release_name():
    try:
        return json.loads((SUBSET_DIR / "release.json").read_text(encoding="utf-8")).get("database")
    except FileNotFoundError:
        return None


@pytest.mark.skipif(
    not REAL_RELEASE.exists() or subset_release_name() != REAL_RELEASE.name,
    reason="needs the real release and a data/rde_subset exported from it",
)
def test_data_rde_subset_is_a_fresh_export(tmp_path):
    """data/rde_subset is only ever written by export_rde.py, never edited by hand."""
    out = tmp_path / "rde_subset"
    export(REAL_RELEASE, out)

    for name in ("publications.csv", "operating_points.csv", "chamber_pressures.csv", "release.json"):
        assert (SUBSET_DIR / name).read_bytes() == (out / name).read_bytes(), (
            f"data/rde_subset/{name} differs from a fresh export; run scripts/export_rde.py"
        )
