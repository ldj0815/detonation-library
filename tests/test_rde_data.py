import json
import re
from pathlib import Path

import pytest

from rde_data import (
    CHAMBER_PRESSURE_COLUMNS,
    CHAMBER_PRESSURE_DOWNLOAD_COLUMNS,
    CHAMBER_PRESSURE_KINDS,
    DOWNLOAD_COLUMNS,
    FLOAT,
    INT,
    METHOD,
    OPERATING_POINT_COLUMNS,
    OPERATING_POINT_KINDS,
    PUBLICATION_COLUMNS,
    PUBLICATION_KINDS,
    TEXT,
    chamber_pressure_download_rows,
    clean_diluent,
    consistency_notes,
    download_rows,
    format_value,
    normalize_fuel,
    normalize_oxidizer,
    parse_value,
    read_release,
    read_rows,
    short_label,
    site_json,
    write_rows,
)

REPO_ROOT = Path(__file__).resolve().parent.parent

RELEASE = {
    "release_version": "1.0.0",
    "release_date": "2026-10-23",
    "schema_version": "reviewed_ingestion_v1",
    "internal_use_only": True,
    "database": "rde_database_2026-10-23.sqlite",
    "database_sha256": "0" * 64,
    "views": ["viz_publications", "viz_operating_points"],
}


def publication(pub_id=1, **overrides):
    row = dict(
        id=pub_id,
        label=f"Smith ({2020 + pub_id})",
        title="Experimental investigation of a rotating detonation rocket engine",
        year=2020 + pub_id,
        venue="Journal of Propulsion and Power",
        authors="Richard D. Smith; Steven B. Stanley",
        doi=f"10.2514/1.b{pub_id:05d}",
        country="United States of America",
        engine_code="R",
    )
    row.update(overrides)
    return row


def point(point_id=1, publication_id=1, **overrides):
    row = dict(
        id=point_id,
        publication_id=publication_id,
        test_run_id=point_id,
        operating_point_type="steady",
        engine_code="R",
        fuel="H2",
        fuel_reported="Hydrogen",
        oxidizer="O2",
        oxidizer_reported="Oxygen",
    )
    row.update(overrides)
    return row


def pressure(pressure_id=1, operating_point_id=1, **overrides):
    row = dict(id=pressure_id, operating_point_id=operating_point_id, pressure_kpa=250.0, pressure_kpa_method="reported_table")
    row.update(overrides)
    return row


def write_release(folder, publications, points, pressures, release=RELEASE):
    folder.mkdir(parents=True, exist_ok=True)
    write_rows(folder / "publications.csv", PUBLICATION_COLUMNS, publications)
    write_rows(folder / "operating_points.csv", OPERATING_POINT_COLUMNS, points)
    write_rows(folder / "chamber_pressures.csv", CHAMBER_PRESSURE_COLUMNS, pressures)
    (folder / "release.json").write_text(json.dumps(release), encoding="utf-8")
    return folder


def valid_release(folder):
    return write_release(
        folder,
        [publication(1), publication(2, engine_code="AB")],
        [point(1), point(2, wave_count=2, wave_speed_m_s=1520.5), point(3, 2, engine_code="AB", oxidizer="Air")],
        [pressure(1, 1), pressure(2, 1, pressure_kpa=310.5)],
    )


# Names ------------------------------------------------------------------------

@pytest.mark.parametrize("reported, name", [
    ("H2", "H2"),
    ("Hydrogen", "H2"),
    ("CH4", "CH4"),
    ("Methane", "CH4"),
    ("C2H4", "C2H4"),
    ("Ethlyene", "C2H4"),
    ("Ethylene", "C2H4"),
    ("Ethane", "C2H6"),
    ("kerosene (liquid; grade not stated)", "Kerosene"),
    ("kerosene (grade not stated)", "Kerosene"),
    (" hydrogen ", "H2"),
    ("NH3", "NH3"),
    (None, None),
])
def test_normalize_fuel(reported, name):
    assert normalize_fuel(reported) == name


@pytest.mark.parametrize("reported, name", [
    ("air", "Air"),
    ("Air", "Air"),
    ("O2", "O2"),
    ("Oxygen", "O2"),
    ("O2-enriched air (30 wt% O2)", "O2-enriched air"),
    ("O2-enriched air, 28.5 % O2 (basis not stated; taken as mass fraction)", "O2-enriched air"),
    ("N2O", "N2O"),
    (None, None),
])
def test_normalize_oxidizer(reported, name):
    assert normalize_oxidizer(reported) == name


@pytest.mark.parametrize("reported", ["N/A", "n/a", "not_applicable", "None", None])
def test_clean_diluent_drops_no_diluent_markers(reported):
    assert clean_diluent(reported) is None


@pytest.mark.parametrize("reported", ["", "   "])
def test_clean_diluent_treats_blank_as_none(reported):
    assert clean_diluent(reported) is None


def test_clean_diluent_keeps_a_real_diluent():
    assert clean_diluent(" C2H2 and O2 (optical tracers, unquantified) ") == "C2H2 and O2 (optical tracers, unquantified)"


@pytest.mark.parametrize("label, short", [
    ("Smith (2021) - Experimental Investigation of Rotating Detonation Rocket Engines", "Smith (2021)"),
    ("Huang (2023) - Experimental Investigation on Rotating Detonation Engine with Full/Half Inner…", "Huang (2023)"),
    ("Kang (2024) - Inlet blockage - part 2", "Kang (2024)"),
    ("Smith (2021)", "Smith (2021)"),
    ("Wolański-Kowalski (2013) - Title", "Wolański-Kowalski (2013)"),
])
def test_short_label(label, short):
    assert short_label(label) == short


# Cells ------------------------------------------------------------------------

@pytest.mark.parametrize("text, kind, value", [
    ("3", INT, 3),
    ("3.0", INT, 3),
    (" 3 ", INT, 3),
    ("-12.9", FLOAT, -12.9),
    ("1e-05", FLOAT, 1e-05),
    ("0", FLOAT, 0.0),
    ("", FLOAT, None),
    ("  ", INT, None),
    ("axial_annular", TEXT, "axial_annular"),
    ("digitized_from_figure", METHOD, "digitized_from_figure"),
    ("", METHOD, None),
])
def test_parse_value(text, kind, value):
    parsed = parse_value(text, kind)
    assert parsed == value
    assert type(parsed) is type(value)


@pytest.mark.parametrize("text, kind", [
    ("3.5", INT),
    ("three", INT),
    ("nan", INT),
    ("inf", FLOAT),
    ("-inf", FLOAT),
    ("nan", FLOAT),
    ("1e400", FLOAT),
    ("fast", FLOAT),
    ("table", METHOD),
    ("Reported_Table", METHOD),
])
def test_parse_value_rejects(text, kind):
    with pytest.raises(ValueError):
        parse_value(text, kind)


@pytest.mark.parametrize("text", ["inf", "-inf", "1e400"])
def test_parse_value_rejects_infinite_whole_numbers(text):
    with pytest.raises(ValueError):
        parse_value(text, INT)


@pytest.mark.parametrize("value, text", [
    (None, ""),
    (3, "3"),
    (3.0, "3"),
    (-12.9, "-12.9"),
    (0.0, "0"),
    (1e-05, "1e-05"),
    (2.5e20, "2.5e+20"),
    ("steady", "steady"),
])
def test_format_value(value, text):
    assert format_value(value) == text


def test_write_rows_and_read_rows_round_trip(tmp_path):
    path = tmp_path / "publications.csv"
    rows = [
        publication(1, title='Thrust, "Isp" and\nmodes', authors="F. A. Bykovskii, E. F. Vedernikov, and S. V. Polozov"),
        publication(2, venue=None, doi=None, country="Česko"),
    ]
    write_rows(path, PUBLICATION_COLUMNS, rows)

    again, errors = read_rows(path, PUBLICATION_COLUMNS, PUBLICATION_KINDS)

    assert errors == []
    assert again == [{c: row.get(c) for c in PUBLICATION_COLUMNS} for row in rows]
    assert path.read_text(encoding="utf-8").splitlines()[0] == ",".join(PUBLICATION_COLUMNS)


def test_round_trip_keeps_zero_apart_from_empty(tmp_path):
    path = tmp_path / "operating_points.csv"
    write_rows(path, OPERATING_POINT_COLUMNS, [point(1, window_start_s=0.0, pressure_gain_percent=-12.9, wave_count=3)])

    [again], errors = read_rows(path, OPERATING_POINT_COLUMNS, OPERATING_POINT_KINDS)

    assert errors == []
    assert again["window_start_s"] == 0.0
    assert again["window_end_s"] is None
    assert again["pressure_gain_percent"] == -12.9
    assert again["wave_count"] == 3
    assert again["secondary_wave_count"] is None


def test_read_rows_reports_bad_cells_by_row_and_column(tmp_path):
    path = tmp_path / "chamber_pressures.csv"
    write_rows(path, CHAMBER_PRESSURE_COLUMNS, [
        pressure(1, 1),
        pressure(2, 1, pressure_kpa="high", pressure_kpa_method="guessed"),
    ])
    with path.open("a", encoding="utf-8") as f:
        f.write("3,1\n")

    rows, errors = read_rows(path, CHAMBER_PRESSURE_COLUMNS, CHAMBER_PRESSURE_KINDS)

    assert [r["id"] for r in rows] == [1, 2]
    assert errors == [
        "chamber_pressures.csv row 3, pressure_kpa: could not convert string to float: 'high'",
        "chamber_pressures.csv row 3, pressure_kpa_method: unknown extraction method 'guessed'",
        f"chamber_pressures.csv row 4: expected {len(CHAMBER_PRESSURE_COLUMNS)} cells, got 2",
    ]


def test_read_rows_rejects_a_changed_header(tmp_path):
    path = tmp_path / "publications.csv"
    columns = [c if c != "doi" else "doi_reference" for c in PUBLICATION_COLUMNS]
    write_rows(path, columns, [publication(1)])

    assert read_rows(path, PUBLICATION_COLUMNS, PUBLICATION_KINDS) == (
        [], ["publications.csv: header does not match (missing doi; unexpected doi_reference)"],
    )


def test_read_rows_rejects_reordered_columns(tmp_path):
    path = tmp_path / "publications.csv"
    write_rows(path, list(reversed(PUBLICATION_COLUMNS)), [publication(1)])

    assert read_rows(path, PUBLICATION_COLUMNS, PUBLICATION_KINDS) == (
        [], ["publications.csv: header does not match (columns out of order)"],
    )


# The checked release ------------------------------------------------------------

def test_read_release_without_a_folder_is_empty(tmp_path):
    assert read_release(tmp_path / "rde_subset") == (None, [])


def test_read_release_returns_typed_tables(tmp_path):
    folder = valid_release(tmp_path / "rde_subset")

    data, errors = read_release(folder)

    assert errors == []
    assert data["release"] == RELEASE
    assert [p["id"] for p in data["publications"]] == [1, 2]
    assert [p["id"] for p in data["operating_points"]] == [1, 2, 3]
    assert data["operating_points"][1]["wave_count"] == 2
    assert data["operating_points"][1]["wave_speed_m_s"] == 1520.5
    assert data["operating_points"][0]["wave_count"] is None
    assert [p["pressure_kpa"] for p in data["chamber_pressures"]] == [250.0, 310.5]


@pytest.mark.parametrize("name", ["publications.csv", "operating_points.csv", "chamber_pressures.csv", "release.json"])
def test_read_release_reports_a_missing_file(tmp_path, name):
    folder = valid_release(tmp_path / "rde_subset")
    (folder / name).unlink()

    assert read_release(folder) == (None, [f"{name}: missing from {folder}"])


@pytest.mark.parametrize("text, problem", [
    ('{"release_version": NaN}', "NaN is not allowed"),
    ("[1, 2]", "expected an object"),
    ('{"release_version": 1}', "release_version must be text"),
])
def test_read_release_checks_the_shape_of_release_json(tmp_path, text, problem):
    folder = write_release(tmp_path / "rde_subset", [publication(1)], [point(1)], [])
    (folder / "release.json").write_text(text, encoding="utf-8")

    data, errors = read_release(folder)

    assert data is None
    assert any(problem in e for e in errors), errors


def test_read_release_reports_a_csv_that_is_not_utf8(tmp_path):
    folder = write_release(tmp_path / "rde_subset", [publication(1, title="Détonation")], [point(1)], [])
    path = folder / "publications.csv"
    path.write_bytes(path.read_text(encoding="utf-8").encode("latin-1"))

    data, errors = read_release(folder)

    assert data is None
    assert errors == [errors[0]] and errors[0].startswith("publications.csv: cannot be read as UTF-8 CSV")


def test_read_release_reports_unreadable_release_json(tmp_path):
    folder = valid_release(tmp_path / "rde_subset")
    (folder / "release.json").write_text("{not json", encoding="utf-8")

    data, errors = read_release(folder)

    assert data is None
    assert len(errors) == 1 and errors[0].startswith("release.json: ")


def test_read_release_reports_a_header_mismatch(tmp_path):
    folder = valid_release(tmp_path / "rde_subset")
    write_rows(folder / "operating_points.csv", OPERATING_POINT_COLUMNS[:-1], [point(1)])

    assert read_release(folder) == (None, [
        "operating_points.csv: header does not match (missing pressure_gain_percent_method)",
    ])


def test_read_release_reports_a_duplicate_id(tmp_path):
    folder = write_release(tmp_path / "rde_subset", [publication(1)], [point(1), point(1)], [])

    assert read_release(folder) == (None, ["operating_points.csv row 3: id 1 appears twice"])


def test_read_release_reports_an_empty_id(tmp_path):
    folder = write_release(tmp_path / "rde_subset", [publication(1)], [point(1)], [pressure(None, 1)])

    assert read_release(folder) == (None, ["chamber_pressures.csv row 2: id is empty"])


def test_read_release_reports_an_unknown_publication(tmp_path):
    folder = write_release(tmp_path / "rde_subset", [publication(1)], [point(1), point(2, publication_id=9)], [])

    assert read_release(folder) == (None, [
        "operating_points.csv row 3: publication_id 9 is not in publications.csv",
    ])


def test_read_release_reports_a_bad_engine_code(tmp_path):
    folder = write_release(tmp_path / "rde_subset", [publication(1, engine_code="rocket")], [point(1, engine_code="")], [])

    assert read_release(folder) == (None, [
        "publications.csv row 2: engine_code must be one of R, AB, AAB, unknown",
        "operating_points.csv row 2: engine_code must be one of R, AB, AAB, unknown",
    ])


def test_read_release_requires_fuel_and_oxidizer(tmp_path):
    folder = write_release(tmp_path / "rde_subset", [publication(1)], [point(1, fuel=None, oxidizer=None)], [])

    assert read_release(folder) == (None, [
        "operating_points.csv row 2: fuel is empty",
        "operating_points.csv row 2: oxidizer is empty",
    ])


def test_read_release_reports_a_pressure_for_a_missing_point(tmp_path):
    folder = write_release(tmp_path / "rde_subset", [publication(1)], [point(1)], [pressure(1, 1), pressure(2, 5)])

    assert read_release(folder) == (None, [
        "chamber_pressures.csv row 3: operating_point_id 5 is not in operating_points.csv",
    ])


def test_read_release_reports_bad_cells(tmp_path):
    folder = valid_release(tmp_path / "rde_subset")
    write_rows(folder / "operating_points.csv", OPERATING_POINT_COLUMNS, [point(1, wave_count=2.5)])

    assert read_release(folder) == (None, [
        "operating_points.csv row 2, wave_count: expected a whole number, got '2.5'",
    ])


# The files the site serves --------------------------------------------------------

def test_site_json_without_a_release_is_empty():
    assert site_json(None) == {"release": None, "publications": [], "operating_points": []}


def test_site_json_leaves_out_empty_values_but_keeps_zero(tmp_path):
    folder = write_release(tmp_path / "rde_subset", [publication(1, venue=None)], [point(1, window_start_s=0.0, wave_count=1)], [])
    data, errors = read_release(folder)
    assert errors == []

    payload = site_json(data)

    [record] = payload["operating_points"]
    assert record == {**point(1), "window_start_s": 0.0, "wave_count": 1}
    assert "chamber_pressures" not in record
    # Publications keep every column, with null for an empty one.
    assert payload["publications"][0]["venue"] is None


def test_site_json_embeds_chamber_pressures_and_counts_points(tmp_path):
    folder = write_release(
        tmp_path / "rde_subset",
        [publication(1), publication(2), publication(3)],
        [point(1), point(2), point(3, 2)],
        [pressure(10, 2, pressure_kpa=180.0, representative_upstream=1), pressure(11, 2, pressure_kpa=120.0), pressure(12, 3)],
    )
    data, errors = read_release(folder)
    assert errors == []

    payload = site_json(data)

    assert payload["release"] == RELEASE
    assert [(p["id"], p["operating_points"]) for p in payload["publications"]] == [(1, 2), (2, 1), (3, 0)]
    points = {p["id"]: p for p in payload["operating_points"]}
    assert "chamber_pressures" not in points[1]
    assert points[2]["chamber_pressures"] == [
        {"id": 10, "pressure_kpa": 180.0, "pressure_kpa_method": "reported_table", "representative_upstream": 1},
        {"id": 11, "pressure_kpa": 120.0, "pressure_kpa_method": "reported_table"},
    ]
    assert points[3]["chamber_pressures"] == [{"id": 12, "pressure_kpa": 250.0, "pressure_kpa_method": "reported_table"}]
    json.dumps(payload)


def test_download_columns_name_the_paper_and_release_on_every_row():
    assert OPERATING_POINT_COLUMNS[:2] == ["id", "publication_id"]
    assert DOWNLOAD_COLUMNS == [
        "id", "publication_id", "publication", "doi", "release_version",
        *OPERATING_POINT_COLUMNS[2:], "chamber_pressures_kpa",
    ]
    assert len(DOWNLOAD_COLUMNS) == len(set(DOWNLOAD_COLUMNS))
    assert CHAMBER_PRESSURE_DOWNLOAD_COLUMNS[:5] == ["id", "operating_point_id", "publication", "doi", "release_version"]


def test_download_rows(tmp_path):
    folder = write_release(
        tmp_path / "rde_subset",
        [publication(1, label="Smith (2021)"), publication(2, label="Bykovskii (2006)", doi=None)],
        [point(1), point(2, 2)],
        [],
    )
    data, _ = read_release(folder)

    rows = download_rows(data)

    assert [(r["id"], r["publication"], r["doi"], r["release_version"]) for r in rows] == [
        (1, "Smith (2021)", "10.2514/1.b00001", "1.0.0"),
        (2, "Bykovskii (2006)", None, "1.0.0"),
    ]
    assert rows[0]["fuel"] == "H2"
    assert rows[0]["chamber_pressures_kpa"] is None
    assert download_rows(None) == []


def test_download_rows_join_a_points_chamber_pressures(tmp_path):
    folder = write_release(
        tmp_path / "rde_subset",
        [publication(1, label="Smith (2021)")],
        [point(1), point(2)],
        [
            dict(id=7, operating_point_id=2, pressure_kpa=432.301282281656, representative_upstream=1),
            dict(id=8, operating_point_id=2, pressure_kpa=120.0),
            dict(id=9, operating_point_id=2, pressure_kpa=None),
        ],
    )
    data, errors = read_release(folder)
    assert errors == []

    rows = download_rows(data)
    pressures = chamber_pressure_download_rows(data)

    assert [r["chamber_pressures_kpa"] for r in rows] == [None, "432.301282281656;120"]
    assert [(r["id"], r["operating_point_id"], r["publication"], r["release_version"]) for r in pressures] == [
        (7, 2, "Smith (2021)", "1.0.0"), (8, 2, "Smith (2021)", "1.0.0"), (9, 2, "Smith (2021)", "1.0.0"),
    ]
    assert chamber_pressure_download_rows(None) == []


def test_consistency_notes_name_the_paper_and_count(tmp_path):
    folder = write_release(
        tmp_path / "rde_subset",
        [publication(1, label="Smith (2021)"), publication(2, label="Anand (2016)")],
        [
            # (0.04 / 0.36) / 0.42 = 0.2646, against a stoichiometric 0.2507: off by 5.5 %
            point(1, mdot_fuel_kg_s=0.04, mdot_oxidizer_kg_s=0.36, equivalence_ratio=0.42, stoich_fuel_oxidizer_mass_ratio=0.2507),
            point(2, mdot_fuel_kg_s=0.04, mdot_oxidizer_kg_s=0.36, equivalence_ratio=0.4432, stoich_fuel_oxidizer_mass_ratio=0.2507),
            point(3, 2, exit_geometry_type="converging_only", throat_area_m2=0.003452, exit_area_m2=0.000407),
            point(4, 2, exit_geometry_type="converging_only", throat_area_m2=0.00076, exit_area_m2=0.00076),
        ],
        [],
    )
    data, _ = read_release(folder)

    notes = consistency_notes(data)

    assert len(notes) == 2
    assert notes[0].startswith("Smith (2021): 1 operating point(s) where fuel/oxidizer flow")
    assert notes[1].startswith("Anand (2016): 1 operating point(s) with a converging exit")
    assert consistency_notes(None) == []


def test_every_operating_point_column_has_a_kind():
    assert len(OPERATING_POINT_COLUMNS) == len(set(OPERATING_POINT_COLUMNS))
    assert set(OPERATING_POINT_KINDS) == set(OPERATING_POINT_COLUMNS)
    for column in OPERATING_POINT_COLUMNS:
        # modal_detection_method is the instrument (text), not an extraction method.
        if column.endswith("_method") and column != "modal_detection_method":
            assert OPERATING_POINT_KINDS[column] == METHOD, column
        if column.endswith("_uncertainty"):
            assert OPERATING_POINT_KINDS[column] == FLOAT, column


# The site's copy of the column lists ------------------------------------------------

def ts_strings(text: str) -> list[str]:
    return re.findall(r"'([a-z0-9_]+)'", text)


def test_site_csv_columns_match_the_download():
    source = (REPO_ROOT / "site" / "src" / "data" / "rde.ts").read_text(encoding="utf-8")
    block = re.search(r"RDE_CSV_COLUMNS = \[(.*?)\] as const", source, re.S)
    assert block, "RDE_CSV_COLUMNS not found in site/src/data/rde.ts"
    assert ts_strings(block.group(1)) == DOWNLOAD_COLUMNS


def test_site_numeric_keys_match_the_numeric_columns():
    """RdeNumericKey in site/src/types/rde.ts lists every measured or numeric
    column but the identifiers, the averaging window and uncertainties."""
    source = (REPO_ROOT / "site" / "src" / "types" / "rde.ts").read_text(encoding="utf-8")
    block = re.search(r"export type RdeNumericKey =((?:\s*\|\s*'[a-z0-9_]+')+)", source)
    assert block, "RdeNumericKey not found in site/src/types/rde.ts"
    identifiers = {"id", "publication_id", "test_run_id", "sequence_index", "geometry_id", "window_start_s", "window_end_s"}
    numeric = [
        c for c in OPERATING_POINT_COLUMNS
        if OPERATING_POINT_KINDS[c] in (INT, FLOAT) and c not in identifiers and not c.endswith("_uncertainty")
    ]
    assert sorted(ts_strings(block.group(1))) == sorted(numeric)
