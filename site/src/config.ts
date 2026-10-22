// Where the data and the site's source live. Change these if the repo moves.
export const REPO_URL = 'https://github.com/ldj0815/detonation-library'
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new/choose`
export const SUBMIT_ISSUE_URL = `${REPO_URL}/issues/new?template=submit-data.yml`
export const TEMPLATE_URL = `${REPO_URL}/raw/main/data/TEMPLATE.csv`

// Measurements the site does not show for now. scripts/build_data.py keeps the
// same list (HIDDEN_FIELDS) and publishes those columns empty, so the data
// files, tabs, columns, plot axes and exports agree. Empty both lists to show
// everything in data/cases.csv again.
export const HIDDEN_MEASUREMENTS: ReadonlySet<string> = new Set([
  'critical_hydraulic_diameter_mm',
  'minimum_hydraulic_diameter_mm',
  'critical_energy_j',
])
