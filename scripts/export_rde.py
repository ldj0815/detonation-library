"""Export the site's subset of an RDE database release into data/rde_subset/.

    python scripts/export_rde.py [path/to/rde_database_YYYY-MM-DD.sqlite]

Without a path, the newest release under data/RDE/ is used. The database is
opened read-only. Its viz_ views are read, plus the RELEASE_KEYS entries of its
database_release_metadata table. What is exported, and why, is described in
rde_data.py. Run build_data.py afterwards to refresh the site.
"""
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

from rde_data import (
    CHAMBER_PRESSURE_COLUMNS,
    CHAMBER_PRESSURE_SOURCE,
    FLOAT,
    INT,
    MODAL_SOURCE,
    OPERATING_POINT_COLUMNS,
    OPERATING_POINT_SOURCE,
    PERCENT_COLUMNS,
    PERFORMANCE_SOURCE,
    PRESSURE_GAIN_SOURCE,
    PUBLICATION_COLUMNS,
    PUBLICATION_SOURCE,
    clean_diluent,
    normalize_fuel,
    normalize_oxidizer,
    short_label,
    write_rows,
)

ROOT = Path(__file__).resolve().parent.parent
RELEASES_DIR = ROOT / "data" / "RDE"
OUT_DIR = ROOT / "data" / "rde_subset"

# Release metadata carried into release.json. Only these keys are read: the
# table also holds internal paths and review notes that must not be published.
RELEASE_KEYS = ("release_version", "release_date", "schema_version", "internal_use_only")


def newest_release(releases_dir: Path = RELEASES_DIR) -> Path:
    found = sorted(releases_dir.glob("rde_database_*/rde_database_*.sqlite"))
    if not found:
        raise FileNotFoundError(f"no rde_database_*.sqlite under {releases_dir}")
    return found[-1]


def connect(database: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only=ON")
    return connection


def typed(value, kind: str):
    """Text cells stripped (empty -> None); numbers as int or float."""
    if value is None:
        return None
    if kind == INT:
        return int(value)
    if kind == FLOAT:
        return float(value)
    text = str(value).strip()
    return text or None


def select(alias: str, source: list[tuple[str, str, str]]) -> list[str]:
    return [f'{alias}."{column}" AS "{name}"' for name, column, _ in source]


def operating_points(connection: sqlite3.Connection) -> list[dict]:
    columns = (
        select("o", OPERATING_POINT_SOURCE) + select("m", MODAL_SOURCE)
        + select("p", PERFORMANCE_SOURCE) + select("g", PRESSURE_GAIN_SOURCE)
    )
    # Each result view has at most one record per operating point (checked
    # below), so these joins keep one row per operating point.
    query = f"""
        SELECT {", ".join(columns)}
        FROM viz_operating_points o
        LEFT JOIN viz_average_modal_properties m ON m.operating_point_id = o.operating_point_id
        LEFT JOIN viz_propulsive_performance p ON p.operating_point_id = o.operating_point_id
        LEFT JOIN viz_power_gen_performance g ON g.operating_point_id = o.operating_point_id
        ORDER BY o.operating_point_id
    """
    kinds = {name: kind for name, _, kind in OPERATING_POINT_SOURCE + MODAL_SOURCE + PERFORMANCE_SOURCE + PRESSURE_GAIN_SOURCE}
    rows = []
    for record in connection.execute(query):
        row = {name: typed(record[name], kinds[name]) for name in OPERATING_POINT_COLUMNS}
        row["fuel"] = normalize_fuel(row["fuel_reported"])
        row["oxidizer"] = normalize_oxidizer(row["oxidizer_reported"])
        row["diluent"] = clean_diluent(row["diluent"])
        for name in PERCENT_COLUMNS:
            if row[name] is not None:
                row[name] = round(row[name] * 100, 10)
        rows.append(row)
    return rows


def check_one_per_point(connection: sqlite3.Connection) -> None:
    for view in ("viz_average_modal_properties", "viz_propulsive_performance", "viz_power_gen_performance"):
        repeated = connection.execute(
            f"SELECT COUNT(*) FROM (SELECT operating_point_id FROM {view} GROUP BY 1 HAVING COUNT(*) > 1)"
        ).fetchone()[0]
        if repeated:
            raise ValueError(f"{view} has {repeated} operating points with more than one record; the export expects one")


def publications(connection: sqlite3.Connection) -> list[dict]:
    query = f"SELECT {', '.join(select('v', PUBLICATION_SOURCE))} FROM viz_publications v ORDER BY v.publication_id"
    kinds = {name: kind for name, _, kind in PUBLICATION_SOURCE}
    rows = []
    for record in connection.execute(query):
        row = {name: typed(record[name], kinds[name]) for name in PUBLICATION_COLUMNS}
        row["label"] = short_label(row["label"])
        rows.append(row)
    return rows


def chamber_pressures(connection: sqlite3.Connection) -> list[dict]:
    query = f"""
        SELECT {", ".join(select("v", CHAMBER_PRESSURE_SOURCE))}
        FROM viz_chamber_pressure v ORDER BY v.operating_point_id, v.chamber_pressure_id
    """
    kinds = {name: kind for name, _, kind in CHAMBER_PRESSURE_SOURCE}
    return [{name: typed(record[name], kinds[name]) for name in CHAMBER_PRESSURE_COLUMNS} for record in connection.execute(query)]


def release_info(connection: sqlite3.Connection, database: Path) -> dict:
    marks = ", ".join("?" for _ in RELEASE_KEYS)
    metadata = {
        key: json.loads(value)
        for key, value in connection.execute(f"SELECT key, value_json FROM database_release_metadata WHERE key IN ({marks})", RELEASE_KEYS)
    }
    info = {key: metadata.get(key) for key in RELEASE_KEYS}
    info["database"] = database.name
    info["database_sha256"] = hashlib.sha256(database.read_bytes()).hexdigest()
    info["views"] = ["viz_publications", "viz_operating_points", "viz_average_modal_properties",
                     "viz_propulsive_performance", "viz_power_gen_performance", "viz_chamber_pressure"]
    info["metadata_keys"] = list(RELEASE_KEYS)
    return info


def export(database: Path, out_dir: Path = OUT_DIR) -> dict[str, int]:
    """Write the subset to out_dir and return the row count of each file."""
    connection = connect(database)
    try:
        check_one_per_point(connection)
        papers = publications(connection)
        points = operating_points(connection)
        pressures = chamber_pressures(connection)
        release = release_info(connection, database)
    finally:
        connection.close()
    out_dir.mkdir(parents=True, exist_ok=True)
    write_rows(out_dir / "publications.csv", PUBLICATION_COLUMNS, papers)
    write_rows(out_dir / "operating_points.csv", OPERATING_POINT_COLUMNS, points)
    write_rows(out_dir / "chamber_pressures.csv", CHAMBER_PRESSURE_COLUMNS, pressures)
    (out_dir / "release.json").write_text(json.dumps(release, indent=2) + "\n", encoding="utf-8")
    return {"publications": len(papers), "operating_points": len(points), "chamber_pressures": len(pressures)}


def main(argv: list[str]) -> int:
    database = Path(argv[1]) if len(argv) > 1 else newest_release()
    counts = export(database)
    print(f"exported {counts['operating_points']} operating points from {counts['publications']} publications "
          f"({counts['chamber_pressures']} chamber pressures) from {database.name} to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
