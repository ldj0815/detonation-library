"""The RDE operating points: the subset of an RDE database release the site
shows, and how it becomes the files the site serves.

The RDE database is a separate SQLite release, kept under data/RDE/.
export_rde.py reads its viz_ views, which leave out restricted injector design
fields and free-text notes, plus four allowlisted keys of its
database_release_metadata table (RELEASE_KEYS in export_rde.py), and writes
the subset below to data/rde_subset/ (its own folder: data/rde would be
data/RDE on macOS):

    publications.csv       one row per paper
    operating_points.csv   one row per operating point, with its wave-mode,
                           thrust and pressure-gain results
    chamber_pressures.csv  one row per chamber pressure measurement (an
                           operating point can have several)
    release.json           which release the subset came from

build_data.py checks those files and writes site/public/rde.json, rde.csv and
rde_chamber_pressures.csv. An empty cell means the release has no value; the
release does not record why. It is never a zero.
"""
import csv
import json
import math
from pathlib import Path

INT = "int"
FLOAT = "float"
TEXT = "text"
METHOD = "method"

ENGINE_CODES = ("R", "AB", "AAB", "unknown")

# How a value was obtained (the release's extraction_methods table).
METHODS = (
    "reported_table",
    "reported_text",
    "digitized_from_figure",
    "calculated",
    "inferred",
    "private_communication",
    "uploaded",
)


def measured(name: str, base: str, unit: str = "", uncertainty: bool = True) -> list[tuple[str, str, str]]:
    """A measured quantity: its value, its uncertainty when the release keeps
    one, and how it was obtained. `base` and `unit` spell the source columns,
    e.g. ("mdot_total", "kg_s") -> mdot_total_value_kg_s."""
    suffix = f"_{unit}" if unit else ""
    columns = [(name, f"{base}_value{suffix}", FLOAT)]
    if uncertainty:
        columns.append((f"{name}_uncertainty", f"{base}_uncertainty{suffix}", FLOAT))
    columns.append((f"{name}_method", f"{base}_extraction_method", METHOD))
    return columns


# (published column, source column, kind). Source columns are on
# viz_operating_points unless they appear in the modal, performance or
# pressure-gain lists further down.
OPERATING_POINT_SOURCE = [
    ("id", "operating_point_id", INT),
    ("publication_id", "publication_id", INT),
    ("test_run_id", "test_run_id", INT),
    ("sequence_index", "operating_point_sequence_index", INT),
    ("operating_point_type", "operating_point_type", TEXT),
    ("window_start_s", "window_start_s", FLOAT),
    ("window_end_s", "window_end_s", FLOAT),
    ("engine_code", "engine_code", TEXT),
    # Propellants. fuel and oxidizer are normalised names; the paper's own
    # wording stays in the *_reported columns.
    ("fuel", "fuel_species", TEXT),
    ("fuel_reported", "fuel_species", TEXT),
    ("fuel_phase", "fuel_phase", TEXT),
    ("oxidizer", "oxidizer_species", TEXT),
    ("oxidizer_reported", "oxidizer_species", TEXT),
    ("oxidizer_phase", "oxidizer_phase", TEXT),
    ("diluent", "diluent_dopant_species", TEXT),
    ("stoich_fuel_oxidizer_mass_ratio", "stoich_fuel_to_oxidizer_mass_ratio", FLOAT),
    # Flow
    *measured("mdot_total_kg_s", "mdot_total", "kg_s"),
    *measured("equivalence_ratio", "global_equivalence_ratio"),
    *measured("mdot_fuel_kg_s", "mdot_fuel", "kg_s"),
    *measured("mdot_oxidizer_kg_s", "mdot_oxidizer", "kg_s"),
    *measured("mass_flux_chamber_kg_m2_s", "mass_flux_chamber", "kg_m2_s"),
    *measured("mass_flux_throat_kg_m2_s", "mass_flux_throat", "kg_m2_s"),
    *measured("fuel_manifold_pressure_kpa", "fuel_manifold_stagnation_pressure", "kPa"),
    *measured("oxidizer_manifold_pressure_kpa", "oxidizer_manifold_stagnation_pressure", "kPa"),
    *measured("fuel_manifold_temperature_k", "fuel_manifold_stagnation_temperature", "K"),
    *measured("oxidizer_manifold_temperature_k", "oxidizer_manifold_stagnation_temperature", "K"),
    *measured("back_pressure_pa", "back_pressure", "Pa"),
    ("back_pressure_environment", "back_pressure_env", TEXT),
    *measured("burn_time_s", "burn_time", "s"),
    ("ignition_type", "ignition_type", TEXT),
    # Geometry
    ("geometry_id", "geometry_id", INT),
    ("combustor_type", "combustor_type", TEXT),
    ("exit_geometry_type", "exit_geometry_type", TEXT),
    ("center_body_termination", "center_body_termination_condition_type", TEXT),
    ("cooling_strategy", "primary_cooling_strategy", TEXT),
    *measured("chamber_outer_diameter_mm", "chamber_outer_diameter", "mm"),
    *measured("chamber_inner_diameter_mm", "chamber_inner_diameter", "mm"),
    *measured("chamber_gap_mm", "chamber_annular_width", "mm"),
    *measured("chamber_length_mm", "chamber_length", "mm"),
    *measured("total_length_mm", "total_length", "mm", uncertainty=False),
    *measured("throat_outer_diameter_mm", "throat_outer_diameter", "mm", uncertainty=False),
    *measured("throat_inner_diameter_mm", "throat_inner_diameter", "mm", uncertainty=False),
    *measured("exit_outer_diameter_mm", "exit_outer_diameter", "mm", uncertainty=False),
    *measured("exit_inner_diameter_mm", "exit_inner_diameter", "mm", uncertainty=False),
    *measured("chamber_area_m2", "chamber_area", "m2", uncertainty=False),
    *measured("throat_area_m2", "throat_area", "m2", uncertainty=False),
    *measured("exit_area_m2", "exit_area", "m2", uncertainty=False),
    *measured("contraction_ratio", "chamber_to_throat_area_ratio", uncertainty=False),
    *measured("expansion_ratio", "exit_to_throat_area_ratio", uncertainty=False),
    *measured("fuel_injection_area_m2", "fuel_injection_area", "m2", uncertainty=False),
    *measured("oxidizer_injection_area_m2", "oxidizer_injection_area", "m2", uncertainty=False),
    *measured("total_injection_area_m2", "total_injection_area", "m2", uncertainty=False),
    *measured("injector_to_throat_area_ratio", "injector_to_throat_area_ratio", uncertainty=False),
    *measured("injector_to_chamber_area_ratio", "injector_to_chamber_area_ratio", uncertainty=False),
]

# viz_average_modal_properties: at most one record per operating point.
MODAL_SOURCE = [
    ("modal_detection_method", "average_modal_properties_detection_method", TEXT),
    ("wave_count", "primary_direction_wave_count", INT),
    ("wave_count_method", "primary_direction_wave_count_extraction_method", METHOD),
    *measured("wave_speed_m_s", "primary_direction_wave_speed", "m_s"),
    *measured("frequency_khz", "primary_direction_operating_frequency", "kHz"),
    *measured("wave_speed_reference_diameter_mm", "wave_speed_reference_diameter", "mm"),
    ("secondary_wave_count", "secondary_direction_wave_count", INT),
    ("secondary_wave_count_method", "secondary_direction_wave_count_extraction_method", METHOD),
    *measured("secondary_wave_speed_m_s", "secondary_direction_wave_speed", "m_s", uncertainty=False),
    *measured("secondary_frequency_khz", "secondary_direction_operating_frequency", "kHz", uncertainty=False),
]

# viz_propulsive_performance: at most one record per operating point.
PERFORMANCE_SOURCE = [
    *measured("thrust_n", "thrust", "N"),
    ("thrust_type", "thrust_type", TEXT),
    *measured("specific_impulse_s", "specific_impulse", "s"),
]

# viz_power_gen_performance: at most one record per operating point. The
# release stores the gain as a fraction in a column named "percent"; the
# export multiplies by 100. Its absolute kPa gain is left out: the release
# notes a known source issue with it.
PRESSURE_GAIN_SOURCE = [
    *measured("pressure_gain_percent", "stagnation_pressure_gain_percent"),
]
PERCENT_COLUMNS = {"pressure_gain_percent", "pressure_gain_percent_uncertainty"}

OPERATING_POINT_COLUMNS = [c for c, _, _ in OPERATING_POINT_SOURCE + MODAL_SOURCE + PERFORMANCE_SOURCE + PRESSURE_GAIN_SOURCE]
OPERATING_POINT_KINDS = {c: k for c, _, k in OPERATING_POINT_SOURCE + MODAL_SOURCE + PERFORMANCE_SOURCE + PRESSURE_GAIN_SOURCE}

PUBLICATION_SOURCE = [
    ("id", "publication_id", INT),
    ("label", "publication_label", TEXT),
    ("title", "title", TEXT),
    ("year", "year", INT),
    ("venue", "venue", TEXT),
    ("authors", "authorship_list", TEXT),
    ("doi", "doi", TEXT),
    ("country", "reporting_country", TEXT),
    ("engine_code", "engine_code", TEXT),
]
PUBLICATION_COLUMNS = [c for c, _, _ in PUBLICATION_SOURCE]
PUBLICATION_KINDS = {c: k for c, _, k in PUBLICATION_SOURCE}

CHAMBER_PRESSURE_SOURCE = [
    ("id", "chamber_pressure_id", INT),
    ("operating_point_id", "operating_point_id", INT),
    *measured("pressure_kpa", "chamber_pressure", "kPa"),
    ("representative_upstream", "is_representative_at_upstream_side", INT),
    ("representative_downstream", "is_representative_at_downstream_side", INT),
]
CHAMBER_PRESSURE_COLUMNS = [c for c, _, _ in CHAMBER_PRESSURE_SOURCE]
CHAMBER_PRESSURE_KINDS = {c: k for c, _, k in CHAMBER_PRESSURE_SOURCE}

FILES = {
    "publications.csv": (PUBLICATION_COLUMNS, PUBLICATION_KINDS),
    "operating_points.csv": (OPERATING_POINT_COLUMNS, OPERATING_POINT_KINDS),
    "chamber_pressures.csv": (CHAMBER_PRESSURE_COLUMNS, CHAMBER_PRESSURE_KINDS),
}

# Papers name the same species differently ("H2", "Hydrogen"); the site
# filters on one name per species, matching the cell-size cases.
FUEL_NAMES = {
    "h2": "H2", "hydrogen": "H2",
    "ch4": "CH4", "methane": "CH4",
    "c2h4": "C2H4", "ethylene": "C2H4", "ethlyene": "C2H4",
    "c2h6": "C2H6", "ethane": "C2H6",
}
OXIDIZER_NAMES = {"air": "Air", "o2": "O2", "oxygen": "O2"}
NO_DILUENT = {"n/a", "na", "none", "not_applicable", "not applicable"}


def normalize_fuel(reported: str | None) -> str | None:
    if reported is None:
        return None
    key = reported.strip().lower()
    if key.startswith("kerosene"):
        return "Kerosene"
    return FUEL_NAMES.get(key, reported.strip())


def normalize_oxidizer(reported: str | None) -> str | None:
    if reported is None:
        return None
    key = reported.strip().lower()
    if key.startswith("o2-enriched air"):
        return "O2-enriched air"
    return OXIDIZER_NAMES.get(key, reported.strip())


def clean_diluent(reported: str | None) -> str | None:
    if reported is None or reported.strip().lower() in NO_DILUENT or not reported.strip():
        return None
    return reported.strip()


def short_label(label: str) -> str:
    """'Smith (2021) - Experimental Investigation…' -> 'Smith (2021)'."""
    return label.split(" - ", 1)[0].strip()


# Reading the CSV files back -------------------------------------------------

def format_value(value) -> str:
    """CSV text for a value: '' for none, shortest text for numbers."""
    if value is None:
        return ""
    if isinstance(value, float):
        if value == int(value) and abs(value) < 1e15:
            return str(int(value))
        return repr(value)
    return str(value)


def parse_value(text: str, kind: str):
    """The typed value of one CSV cell. Raises ValueError on bad input."""
    text = text.strip()
    if text == "":
        return None
    if kind == INT:
        number = float(text)
        if not math.isfinite(number) or number != int(number):
            raise ValueError(f"expected a whole number, got {text!r}")
        return int(number)
    if kind == FLOAT:
        number = float(text)
        if not math.isfinite(number):
            raise ValueError(f"expected a finite number, got {text!r}")
        return number
    if kind == METHOD and text not in METHODS:
        raise ValueError(f"unknown extraction method {text!r}")
    return text


def write_rows(path: Path, columns: list[str], rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(columns)
        for row in rows:
            writer.writerow([format_value(row.get(c)) for c in columns])


def read_rows(path: Path, columns: list[str], kinds: dict[str, str]) -> tuple[list[dict], list[str]]:
    """Typed rows from one of the data/rde_subset CSV files, and any problems."""
    try:
        return _read_rows(path, columns, kinds)
    except (UnicodeDecodeError, csv.Error) as e:
        return [], [f"{path.name}: cannot be read as UTF-8 CSV ({e})"]


def _read_rows(path: Path, columns: list[str], kinds: dict[str, str]) -> tuple[list[dict], list[str]]:
    errors: list[str] = []
    rows: list[dict] = []
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if header != columns:
            missing = [c for c in columns if c not in (header or [])]
            extra = [c for c in (header or []) if c not in columns]
            detail = "; ".join(filter(None, [
                f"missing {', '.join(missing)}" if missing else "",
                f"unexpected {', '.join(extra)}" if extra else "",
                "columns out of order" if not missing and not extra else "",
            ]))
            return [], [f"{path.name}: header does not match ({detail})"]
        for line, cells in enumerate(reader, start=2):
            if len(cells) != len(columns):
                errors.append(f"{path.name} row {line}: expected {len(columns)} cells, got {len(cells)}")
                continue
            row = {}
            for column, cell in zip(columns, cells):
                try:
                    row[column] = parse_value(cell, kinds[column])
                except ValueError as e:
                    errors.append(f"{path.name} row {line}, {column}: {e}")
            rows.append(row)
    return rows, errors


def read_release(rde_dir: Path) -> tuple[dict | None, list[str]]:
    """The checked contents of data/rde_subset, or (None, []) when there is none."""
    if not rde_dir.exists():
        return None, []
    errors: list[str] = []
    tables: dict[str, list[dict]] = {}
    for name, (columns, kinds) in FILES.items():
        path = rde_dir / name
        if not path.exists():
            errors.append(f"{name}: missing from {rde_dir}")
            continue
        rows, problems = read_rows(path, columns, kinds)
        tables[name] = rows
        errors.extend(problems)
    release_path = rde_dir / "release.json"
    release = None
    if release_path.exists():
        release, problems = read_release_info(release_path)
        errors.extend(problems)
    else:
        errors.append(f"release.json: missing from {rde_dir}")
    if errors:
        return None, errors

    publications = tables["publications.csv"]
    points = tables["operating_points.csv"]
    pressures = tables["chamber_pressures.csv"]
    errors.extend(check_ids("publications.csv", publications))
    errors.extend(check_ids("operating_points.csv", points))
    errors.extend(check_ids("chamber_pressures.csv", pressures))
    publication_ids = {p["id"] for p in publications}
    point_ids = {p["id"] for p in points}
    for table, rows in (("publications.csv", publications), ("operating_points.csv", points)):
        for line, row in enumerate(rows, start=2):
            if row["engine_code"] not in ENGINE_CODES:
                errors.append(f"{table} row {line}: engine_code must be one of {', '.join(ENGINE_CODES)}")
    for line, row in enumerate(points, start=2):
        if row["publication_id"] not in publication_ids:
            errors.append(f"operating_points.csv row {line}: publication_id {row['publication_id']} is not in publications.csv")
        for required in ("fuel", "oxidizer"):
            if row[required] is None:
                errors.append(f"operating_points.csv row {line}: {required} is empty")
    for line, row in enumerate(pressures, start=2):
        if row["operating_point_id"] not in point_ids:
            errors.append(f"chamber_pressures.csv row {line}: operating_point_id {row['operating_point_id']} is not in operating_points.csv")
    if errors:
        return None, errors
    return {"release": release, "publications": publications, "operating_points": points, "chamber_pressures": pressures}, []


RELEASE_TEXT_KEYS = ("release_version", "release_date", "database", "database_sha256")


def reject_constant(name: str):
    raise ValueError(f"{name} is not allowed")


def read_release_info(path: Path) -> tuple[dict | None, list[str]]:
    """release.json, checked: an object with the release's identity as text."""
    try:
        release = json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)
    except (UnicodeDecodeError, ValueError) as e:
        return None, [f"release.json: {e}"]
    if not isinstance(release, dict):
        return None, ["release.json: expected an object"]
    errors = [f"release.json: {key} must be text" for key in RELEASE_TEXT_KEYS if not isinstance(release.get(key), str)]
    if not isinstance(release.get("internal_use_only", False), bool):
        errors.append("release.json: internal_use_only must be true or false")
    return (None, errors) if errors else (release, [])


def check_ids(table: str, rows: list[dict]) -> list[str]:
    seen: set[int] = set()
    errors = []
    for line, row in enumerate(rows, start=2):
        if row["id"] is None:
            errors.append(f"{table} row {line}: id is empty")
        elif row["id"] in seen:
            errors.append(f"{table} row {line}: id {row['id']} appears twice")
        else:
            seen.add(row["id"])
    return errors


# The files the site serves --------------------------------------------------

def site_json(data: dict | None) -> dict:
    """rde.json: the release, its papers and its operating points. Empty values
    are left out of each operating point to keep the file small; a point's
    chamber pressures ride along with it."""
    if data is None:
        return {"release": None, "publications": [], "operating_points": []}
    pressures_by_point: dict[int, list[dict]] = {}
    for p in data["chamber_pressures"]:
        entry = {k: v for k, v in p.items() if k != "operating_point_id" and v is not None}
        pressures_by_point.setdefault(p["operating_point_id"], []).append(entry)
    counts: dict[int, int] = {}
    for point in data["operating_points"]:
        counts[point["publication_id"]] = counts.get(point["publication_id"], 0) + 1
    publications = [{**p, "operating_points": counts.get(p["id"], 0)} for p in data["publications"]]
    points = []
    for point in data["operating_points"]:
        record = {k: v for k, v in point.items() if v is not None}
        if point["id"] in pressures_by_point:
            record["chamber_pressures"] = pressures_by_point[point["id"]]
        points.append(record)
    return {"release": data["release"], "publications": publications, "operating_points": points}


# The downloads. Every row names its paper and the release: operating point
# numbers are local to a release. The same columns are in RDE_CSV_COLUMNS in
# site/src/data/rde.ts, for the site's filtered downloads.
DOWNLOAD_COLUMNS = [
    "id", "publication_id", "publication", "doi", "release_version",
    *OPERATING_POINT_COLUMNS[2:],
    # A point's chamber pressures, joined with ';' (rde_chamber_pressures.csv
    # has them in full).
    "chamber_pressures_kpa",
]
CHAMBER_PRESSURE_DOWNLOAD_COLUMNS = [
    "id", "operating_point_id", "publication", "doi", "release_version",
    *CHAMBER_PRESSURE_COLUMNS[2:],
]


def download_rows(data: dict | None) -> list[dict]:
    if data is None:
        return []
    papers = {p["id"]: p for p in data["publications"]}
    version = data["release"]["release_version"]
    pressures: dict[int, list[str]] = {}
    for p in data["chamber_pressures"]:
        if p["pressure_kpa"] is not None:
            pressures.setdefault(p["operating_point_id"], []).append(format_value(p["pressure_kpa"]))
    return [
        {
            **point,
            "publication": papers[point["publication_id"]]["label"],
            "doi": papers[point["publication_id"]]["doi"],
            "release_version": version,
            "chamber_pressures_kpa": ";".join(pressures[point["id"]]) if point["id"] in pressures else None,
        }
        for point in data["operating_points"]
    ]


def chamber_pressure_download_rows(data: dict | None) -> list[dict]:
    if data is None:
        return []
    papers = {p["id"]: p for p in data["publications"]}
    paper_of = {p["id"]: papers[p["publication_id"]] for p in data["operating_points"]}
    return [
        {
            **p,
            "publication": paper_of[p["operating_point_id"]]["label"],
            "doi": paper_of[p["operating_point_id"]]["doi"],
            "release_version": data["release"]["release_version"],
        }
        for p in data["chamber_pressures"]
    ]


# Consistency notes for curators ----------------------------------------------

def consistency_notes(data: dict | None) -> list[str]:
    """Patterns in the release that look like source problems, one line per
    paper. They are printed by build_data.py and change nothing: the site shows
    the release's values as they are."""
    if data is None:
        return []
    papers = {p["id"]: p["label"] for p in data["publications"]}
    split: dict[int, int] = {}
    exit_area: dict[int, int] = {}
    for p in data["operating_points"]:
        mf, mo, phi, stoich = (p.get(k) for k in ("mdot_fuel_kg_s", "mdot_oxidizer_kg_s", "equivalence_ratio", "stoich_fuel_oxidizer_mass_ratio"))
        if mf and mo and phi and stoich and abs(mf / mo / phi / stoich - 1) > 0.01:
            split[p["publication_id"]] = split.get(p["publication_id"], 0) + 1
        throat, exit_ = p.get("throat_area_m2"), p.get("exit_area_m2")
        if p.get("exit_geometry_type") == "converging_only" and throat and exit_ and exit_ < throat:
            exit_area[p["publication_id"]] = exit_area.get(p["publication_id"], 0) + 1
    notes = [
        f"{papers[pid]}: {n} operating point(s) where fuel/oxidizer flow divided by the equivalence ratio "
        f"differs from the stoichiometric ratio by more than 1%"
        for pid, n in sorted(split.items())
    ]
    notes += [
        f"{papers[pid]}: {n} operating point(s) with a converging exit whose exit area is smaller than the throat area"
        for pid, n in sorted(exit_area.items())
    ]
    return notes
