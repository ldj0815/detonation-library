# Detonation Science and Technology Library

A curated, open collection of gaseous detonation data, starting with detonation
cell sizes. Browse, search, plot and download it here:

**https://ldj0815.github.io/detonation-library/**

The whole database is one file, [`data/cases.csv`](data/cases.csv).

### What the site publishes for now

The site currently shows cell widths and lengths, plus an empty category for
rotating detonation engine runs. `data/cases.csv` also holds critical tube
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
| `setup` | `detonation` or `rde` |
| `geometry` | Test-section geometry, for example `round tube` |
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
.venv/bin/python scripts/build_data.py   # writes site/public/cases.json and cases.csv
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
| `scripts/case_schema.py` | The rules every case must pass |
| `scripts/csv_io.py` | Reads and writes `data/cases.csv` |
| `scripts/build_data.py` | Checks the data and writes the files the site serves |
| `scripts/submission.py` | The submission format: its columns and how a row becomes a case |
| `scripts/add_submission.py` | Adds a contributor's CSV to the database |
| `tests/` | Tests for the scripts |
| `site/` | The website (React, built with Vite) |
| `.github/workflows/deploy.yml` | Runs the checks and publishes the site |
