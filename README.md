# Detonation Science and Technology Library

A curated, open collection of gaseous detonation data, starting with detonation
cell sizes. Browse, search, plot and download it here:

**https://ldj0815.github.io/detonation-library/**

The whole database is one file, [`data/cases.csv`](data/cases.csv).

### What the site publishes for now

The site currently shows cell widths and lengths, and rotating detonation
engine operating points from a release of the RDE database (see
[RDE operating points](#rde-operating-points); the published site's RDE
category stays empty until that subset is cleared and committed). `data/cases.csv` also holds critical tube
diameters, minimum tube diameters and critical initiation energies; those are
kept in the file but not published yet. The switch is one list in two places:
`HIDDEN_FIELDS` in [`scripts/build_data.py`](scripts/build_data.py), which
leaves those columns empty in the published files and drops cases that carry
nothing else, and `HIDDEN_MEASUREMENTS` in [`site/src/config.ts`](site/src/config.ts),
which hides the matching tabs, columns, plot axes and export columns. Empty
both lists to publish everything.

## The landing-page banner

The banner plays a schlieren film of a detonation in 2H2 + O2 + 17Ar at 13 kPa,
taken at 500,000 frames per second with a Shimadzu HPV-X3, and continues its
front across the page with drawn transverse waves that leave fading tracks, as
triple points do on a soot foil. The original recording is in [`animation/`](animation/);
the processed clips in `site/public/banner/` are decorative, not measurement
data. The standalone study the site's banner was built from, with the script
that renders the clips, is in [`animation/banner/`](animation/banner/README.md).

## Data source

The cases in this library were transcribed from the GALCIT Detonation Database:

> M. Kaneshige and J.E. Shepherd. *Detonation Database*. Technical Report FM97-8,
> GALCIT, California Institute of Technology, July 1997.
> https://doi.org/10.7907/g3gs-4y69.
> Online version: https://shepherd.caltech.edu/detn_db/html/

As the database authors ask, when you use specific data please cite the original
publication listed in each case's reference field (`doi_reference`).

## Contributing data

1. Fill in [`data/TEMPLATE.csv`](data/TEMPLATE.csv), one row per case. Keep the
   header row as it is.
2. Open a [data submission](https://github.com/ldj0815/detonation-library/issues/new?template=submit-data.yml)
   and attach the file.

Everything you submit, including your name and email address, is public.

## The data file

`data/cases.csv` has one row per case. An empty cell means there is no value.

| Column | Meaning |
|---|---|
| `id` | Permanent case number, used in the site's case links |
| `title` | Short label for the case |
| `setup` | `detonation` (`rde` is accepted, but the RDE category shows only the RDE database's operating points) |
| `geometry` | Test-section geometry, for example `round tube`. GALCIT cases carry only what the report states: the initiation geometry for critical energies (for example `spherical, high explosive`), `round, confined` for minimum tube diameters, and `not stated` for cell sizes and critical tube diameters |
| `fuel`, `oxidizer` | Mixture components |
| `equivalence_ratio` | Equivalence ratio of the mixture |
| `initial_pressure_kpa`, `initial_temperature_k` | Initial conditions |
| `primary_diluent_name`, `primary_diluent_percentage` | Main diluent and its percentage |
| `additional_diluents` | Further diluents, as `name:percentage` pairs separated by commas |
| `primary_dopant_name`, `primary_dopant_ppm` | Main dopant and its concentration |
| `additional_dopants` | Further dopants, as `name:ppm` pairs separated by commas |
| `cell_width_mm`, `cell_width_uncertainty_mm` | Detonation cell width and its uncertainty |
| `cell_length_mm`, `cell_length_uncertainty_mm` | Detonation cell length and its uncertainty |
| `critical_hydraulic_diameter_mm` | Critical hydraulic diameter |
| `minimum_hydraulic_diameter_mm` | Minimum hydraulic diameter |
| `critical_energy_j` | Critical initiation energy |
| `tube_radius_mm`, `chamber_width_mm`, `chamber_height_mm` | Facility dimensions |
| `contributor_name`, `contributor_institution`, `contributor_email` | Who supplied the case |
| `doi_reference` | Original publication for the data |
| `sharing_link` | Link to further material |
| `notes` | Free text |
| `created_at` | When the case was added (UTC) |

## RDE operating points

The RDE category shows operating points of rotating detonation engines from a
release of a separate RDE database: one row per operating point, with its
propellants, flow, combustor geometry, wave modes and, where the paper gives
them, thrust, specific impulse, chamber pressures and pressure gain. When you
use a value, cite the original paper; its DOI is on every row.

Read the values with the release's caveats in mind:

- An empty value means the release has no value; the release does not record
  why. It is never a zero: a missing secondary wave count does not mean there
  are no secondary waves.
- Specific impulse uses a different flow for each engine class: total
  propellant for rockets, fuel for air-breathing engines, and fuel plus carried
  oxygen for oxygen-augmented air-breathing engines. Compare it within one class.
- Wave speed is taken at each paper's reference diameter, which is not always
  the chamber outer diameter.
- Throat mass flux is the total chamber flow divided by the throat area, not a
  fuel-only flux.
- The release's pressure-gain "percent" column holds a fraction; the export
  multiplies it by 100. The absolute gain in kPa is left out, because the
  release flags a known source issue with it.
- The points are not screened: steady, transient and other operating points
  are all included, and many carry only some of the quantities.
- Operating point and publication numbers are local to one release; the next
  release can number them differently. Every download row names its release.

To update the subset:

1. Put the release folder in `data/RDE/<release>/`, for example
   `data/RDE/rde_database_2026-10-23/`. The raw releases are not part of the
   published data; do not commit them. The database file holds restricted
   source information besides what the site shows.
2. Run `.venv/bin/python scripts/export_rde.py [path/to/release.sqlite]`.
   Without a path it takes the newest release under `data/RDE/`. It opens the
   database read-only, reads its `viz_` views, which leave out restricted
   injector design fields and free-text notes, plus four named keys of its
   release metadata (version, date, schema version, internal-use flag), and
   writes `data/rde_subset/`:
   `publications.csv`, `operating_points.csv`, `chamber_pressures.csv` and
   `release.json` (which release the subset came from).
3. Run `.venv/bin/python scripts/build_data.py`. It checks `data/rde_subset/`
   and writes `site/public/rde.json`, `rde.csv` and `rde_chamber_pressures.csv`;
   on any problem it lists each one and writes nothing. Without the folder the
   RDE category shows as empty. It also prints a `note:` line for patterns that
   look like problems in the release itself (for example a fuel/oxidizer split
   that does not match the equivalence ratio); these change nothing and are
   worth reporting to the database's maintainers.

The full column list, and the release column each one is read from, is in
[`scripts/rde_data.py`](scripts/rde_data.py). Never edit `data/rde_subset/` by
hand; export it again instead. With the raw release present,
`tests/test_rde_fidelity.py` checks every exported value against the release's
views.

Release 1.0.0 is an internal development release: its authors mark it
internal-use-only and keep some review items open. Until it is cleared for
public distribution:

- `data/rde_subset/` is in `.gitignore`, so it is not committed by accident.
  Committing and pushing it publishes it.
- In CI (where the `CI` variable is set, as on GitHub Actions) `build_data.py`
  refuses a release marked internal-use-only, so a deploy cannot publish it.

Once the release is cleared, remove `data/rde_subset/` from `.gitignore`, set
`RDE_ALLOW_INTERNAL: "1"` on the build step in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (the flag stays
set in release 1.0.0 itself), and commit the folder.

## For maintainers

You need Python 3.12 or newer and Node.js 22 or newer. Set up once:

```bash
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
(cd site && npm ci)
```

### Adding a submission

1. Download the CSV attached to the issue.
2. Run `.venv/bin/python scripts/add_submission.py path/to/file.csv`.
   Every row is checked. If any row has a problem, each one is listed by row
   number and nothing is changed. Otherwise the script reports how many cases
   were created, updated and skipped. A row that repeats an existing case is
   not added twice; it only fills in fields that are still empty on that case.
3. Review the change with `git diff data/cases.csv`, then commit and push.
   The site rebuilds itself within a few minutes.
4. Close the issue.

### Correcting data

Edit `data/cases.csv` directly and leave the `id` values alone. Run
`.venv/bin/python scripts/build_data.py` to check the file, then commit and
push. Git history is the record of every change.

### Running the site on your computer

```bash
.venv/bin/python scripts/build_data.py   # writes the cases.* and rde.* files in site/public/
cd site && npm run dev
```

### Checks

```bash
.venv/bin/pytest
(cd site && npm run lint && npm test && npm run build)
```

The same checks run on every push. A push to `main` also publishes the site.

### Layout

| Path | What it is |
|---|---|
| `data/cases.csv` | The database |
| `data/TEMPLATE.csv` | Blank template for contributors |
| `data/rde_subset/` | The RDE operating points the site shows, exported from a release of the RDE database (git-ignored while the release is internal) |
| `scripts/case_schema.py` | The rules every case must pass |
| `scripts/csv_io.py` | Reads and writes `data/cases.csv` |
| `scripts/build_data.py` | Checks the data and writes the files the site serves |
| `scripts/rde_data.py` | The RDE subset's columns, how it is checked, and the RDE files the site serves |
| `scripts/export_rde.py` | Exports the RDE subset from a release of the RDE database |
| `scripts/submission.py` | The submission format: its columns and how a row becomes a case |
| `scripts/add_submission.py` | Adds a contributor's CSV to the database |
| `tests/` | Tests for the scripts |
| `site/` | The website (React, built with Vite) |
| `.github/workflows/deploy.yml` | Runs the checks and publishes the site |
