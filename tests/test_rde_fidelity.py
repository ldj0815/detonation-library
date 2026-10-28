"""Every value the export publishes, checked against the release's viz_ views.

The column mapping below is written out by hand, apart from scripts/rde_data.py,
so a wrong pairing in the export spec (fuel flow from the oxidizer column, a
primary-direction value from the secondary one) fails here. It needs the raw
release under data/RDE/, which is not in the repository, and is skipped
without it.
"""
import math
import sqlite3
from pathlib import Path

import pytest

from export_rde import export
from rde_data import read_release

ROOT = Path(__file__).resolve().parent.parent
DATABASE = ROOT / "data" / "RDE" / "rde_database_2026-10-23" / "rde_database_2026-10-23.sqlite"

pytestmark = pytest.mark.skipif(not DATABASE.exists(), reason="the raw RDE release is not in this checkout")

# published name -> (view, source column). o: operating points, m: modal
# properties, p: propulsive performance, g: power-generation performance.
SAME = ("o", None)
NAMES = {
    "id": ("o", "operating_point_id"), "publication_id": SAME, "test_run_id": SAME,
    "sequence_index": ("o", "operating_point_sequence_index"), "operating_point_type": SAME,
    "window_start_s": SAME, "window_end_s": SAME, "engine_code": SAME,
    "fuel_reported": ("o", "fuel_species"), "fuel_phase": SAME,
    "oxidizer_reported": ("o", "oxidizer_species"), "oxidizer_phase": SAME,
    "diluent": ("o", "diluent_dopant_species"),
    "stoich_fuel_oxidizer_mass_ratio": ("o", "stoich_fuel_to_oxidizer_mass_ratio"),
    "back_pressure_environment": ("o", "back_pressure_env"), "ignition_type": SAME, "geometry_id": SAME,
    "combustor_type": SAME, "exit_geometry_type": SAME,
    "center_body_termination": ("o", "center_body_termination_condition_type"),
    "cooling_strategy": ("o", "primary_cooling_strategy"),
    "modal_detection_method": ("m", "average_modal_properties_detection_method"),
    "wave_count": ("m", "primary_direction_wave_count"),
    "wave_count_method": ("m", "primary_direction_wave_count_extraction_method"),
    "secondary_wave_count": ("m", "secondary_direction_wave_count"),
    "secondary_wave_count_method": ("m", "secondary_direction_wave_count_extraction_method"),
    "thrust_type": ("p", "thrust_type"),
}
# Measured quantities: published stem -> (view, source stem, unit suffix).
MEASURED = {
    "mdot_total_kg_s": ("o", "mdot_total", "_kg_s"),
    "equivalence_ratio": ("o", "global_equivalence_ratio", ""),
    "mdot_fuel_kg_s": ("o", "mdot_fuel", "_kg_s"),
    "mdot_oxidizer_kg_s": ("o", "mdot_oxidizer", "_kg_s"),
    "mass_flux_chamber_kg_m2_s": ("o", "mass_flux_chamber", "_kg_m2_s"),
    "mass_flux_throat_kg_m2_s": ("o", "mass_flux_throat", "_kg_m2_s"),
    "fuel_manifold_pressure_kpa": ("o", "fuel_manifold_stagnation_pressure", "_kPa"),
    "oxidizer_manifold_pressure_kpa": ("o", "oxidizer_manifold_stagnation_pressure", "_kPa"),
    "fuel_manifold_temperature_k": ("o", "fuel_manifold_stagnation_temperature", "_K"),
    "oxidizer_manifold_temperature_k": ("o", "oxidizer_manifold_stagnation_temperature", "_K"),
    "back_pressure_pa": ("o", "back_pressure", "_Pa"),
    "burn_time_s": ("o", "burn_time", "_s"),
    "chamber_outer_diameter_mm": ("o", "chamber_outer_diameter", "_mm"),
    "chamber_inner_diameter_mm": ("o", "chamber_inner_diameter", "_mm"),
    "chamber_gap_mm": ("o", "chamber_annular_width", "_mm"),
    "chamber_length_mm": ("o", "chamber_length", "_mm"),
    "total_length_mm": ("o", "total_length", "_mm"),
    "throat_outer_diameter_mm": ("o", "throat_outer_diameter", "_mm"),
    "throat_inner_diameter_mm": ("o", "throat_inner_diameter", "_mm"),
    "exit_outer_diameter_mm": ("o", "exit_outer_diameter", "_mm"),
    "exit_inner_diameter_mm": ("o", "exit_inner_diameter", "_mm"),
    "chamber_area_m2": ("o", "chamber_area", "_m2"),
    "throat_area_m2": ("o", "throat_area", "_m2"),
    "exit_area_m2": ("o", "exit_area", "_m2"),
    "contraction_ratio": ("o", "chamber_to_throat_area_ratio", ""),
    "expansion_ratio": ("o", "exit_to_throat_area_ratio", ""),
    "fuel_injection_area_m2": ("o", "fuel_injection_area", "_m2"),
    "oxidizer_injection_area_m2": ("o", "oxidizer_injection_area", "_m2"),
    "total_injection_area_m2": ("o", "total_injection_area", "_m2"),
    "injector_to_throat_area_ratio": ("o", "injector_to_throat_area_ratio", ""),
    "injector_to_chamber_area_ratio": ("o", "injector_to_chamber_area_ratio", ""),
    "wave_speed_m_s": ("m", "primary_direction_wave_speed", "_m_s"),
    "frequency_khz": ("m", "primary_direction_operating_frequency", "_kHz"),
    "wave_speed_reference_diameter_mm": ("m", "wave_speed_reference_diameter", "_mm"),
    "secondary_wave_speed_m_s": ("m", "secondary_direction_wave_speed", "_m_s"),
    "secondary_frequency_khz": ("m", "secondary_direction_operating_frequency", "_kHz"),
    "thrust_n": ("p", "thrust", "_N"),
    "specific_impulse_s": ("p", "specific_impulse", "_s"),
    "pressure_gain_percent": ("g", "stagnation_pressure_gain_percent", ""),
}
for stem, (view, base, unit) in MEASURED.items():
    NAMES[stem] = (view, f"{base}_value{unit}")
    NAMES[f"{stem}_uncertainty"] = (view, f"{base}_uncertainty{unit}")
    NAMES[f"{stem}_method"] = (view, f"{base}_extraction_method")
VIEWS = {"o": "viz_operating_points", "m": "viz_average_modal_properties",
         "p": "viz_propulsive_performance", "g": "viz_power_gen_performance"}
FUELS = {"H2": {"h2", "hydrogen"}, "CH4": {"ch4", "methane"}, "C2H4": {"c2h4", "ethlyene", "ethylene"}, "C2H6": {"c2h6", "ethane"}}
OXIDIZERS = {"Air": {"air"}, "O2": {"o2", "oxygen"}}


def by_point(connection, view):
    return {r["operating_point_id"]: dict(r) for r in connection.execute(f"SELECT * FROM {view}")}


def expected(name, record):
    view, column = NAMES[name]
    value = record.get(column or name)
    if isinstance(value, str):
        value = value.strip() or None
    if name == "diluent" and value is not None and value.lower() in {"n/a", "not_applicable"}:
        return None
    if name in ("pressure_gain_percent", "pressure_gain_percent_uncertainty") and value is not None:
        return value * 100
    return value


@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    out = tmp_path_factory.mktemp("rde_subset")
    export(DATABASE, out)
    data, errors = read_release(out)
    assert errors == []
    connection = sqlite3.connect(DATABASE.resolve().as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        views = {key: by_point(connection, view) for key, view in VIEWS.items()}
        publications = {r["publication_id"]: dict(r) for r in connection.execute("SELECT * FROM viz_publications")}
        pressures = {}
        for r in connection.execute("SELECT * FROM viz_chamber_pressure"):
            pressures.setdefault(r["operating_point_id"], []).append(dict(r))
    finally:
        connection.close()
    return data, views, publications, pressures


def published(data):
    return [c for c in data["operating_points"][0] if c not in ("fuel", "oxidizer")]


def test_every_published_column_is_mapped_by_hand(exported):
    data, *_ = exported
    # Some measured quantities have no uncertainty in the release; NAMES may
    # list those, but every published column must be in it.
    assert set(published(data)) - set(NAMES) == set()


def test_every_value_matches_the_views(exported):
    data, views, _, _ = exported
    assert len(data["operating_points"]) == len(views["o"])
    mismatches = []
    for point in data["operating_points"]:
        records = {key: rows.get(point["id"], {}) for key, rows in views.items()}
        for name in published(data):
            want = expected(name, records[NAMES[name][0]])
            got = point[name]
            same = math.isclose(got, want, rel_tol=1e-12, abs_tol=1e-15) if isinstance(got, float) and isinstance(want, float) else got == want
            if not same:
                mismatches.append(f"point {point['id']} {name}: {got!r} != {want!r}")
    assert mismatches == []


def test_normalised_names_keep_the_species(exported):
    data, *_ = exported
    for point in data["operating_points"]:
        fuel, oxidizer = point["fuel_reported"].lower(), point["oxidizer_reported"].lower()
        assert fuel in FUELS.get(point["fuel"], set()) or (point["fuel"] == "Kerosene" and fuel.startswith("kerosene"))
        assert oxidizer in OXIDIZERS.get(point["oxidizer"], set()) or (point["oxidizer"] == "O2-enriched air" and oxidizer.startswith("o2-enriched air"))


def test_publications_and_chamber_pressures_match(exported):
    data, views, publications, pressures = exported
    for paper in data["publications"]:
        source = publications[paper["id"]]
        assert source["publication_label"].startswith(paper["label"] + " - ") or source["publication_label"] == paper["label"]
        assert (paper["title"], paper["year"], paper["doi"], paper["engine_code"], paper["authors"]) == (
            source["title"], source["year"], source["doi"], source["engine_code"], source["authorship_list"])
    got = sorted((p["operating_point_id"], p["id"], p["pressure_kpa"], p["representative_upstream"]) for p in data["chamber_pressures"])
    want = sorted((r["operating_point_id"], r["chamber_pressure_id"], r["chamber_pressure_value_kPa"], r["is_representative_at_upstream_side"])
                  for rows in pressures.values() for r in rows)
    assert got == want
