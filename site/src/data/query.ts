import type { CaseDetail, FilterOption, FilterOptions } from '../types/case'
import type { PaginatedResponse } from '../types/common'
import { caseReference } from '../lib/format'

export interface CaseListParams {
  q?: string
  fuel?: string
  oxidizer?: string
  geometry?: string
  setup?: string
  primary_diluent_name?: string
  primary_dopant_name?: string
  /** One publication, as caseReference() gives it ("27, Bull (1982)"). */
  reference?: string
  equivalence_ratio_min?: number
  equivalence_ratio_max?: number
  pressure_min?: number
  pressure_max?: number
  temperature_min?: number
  temperature_max?: number
  has_cell_size?: boolean
  has_critical_hd?: boolean
  has_min_hd?: boolean
  has_critical_energy?: boolean
  sort_by?: string
  sort_dir?: string
  limit?: number
  offset?: number
}

// Text columns the search box looks in.
const SEARCH_FIELDS = [
  'title', 'fuel', 'oxidizer', 'geometry', 'contributor_name',
  'primary_diluent_name', 'primary_dopant_name', 'notes',
] as const satisfies readonly (keyof CaseDetail)[]

const SORTABLE_COLUMNS: ReadonlySet<string> = new Set([
  'created_at', 'id', 'title', 'setup', 'geometry', 'fuel', 'oxidizer',
  'equivalence_ratio', 'initial_pressure_kpa', 'initial_temperature_k',
  'primary_diluent_name', 'primary_diluent_percentage', 'additional_diluents',
  'primary_dopant_name', 'primary_dopant_ppm', 'additional_dopants',
  'cell_width_mm', 'cell_width_uncertainty_mm',
  'cell_length_mm', 'cell_length_uncertainty_mm',
  'critical_hydraulic_diameter_mm', 'minimum_hydraulic_diameter_mm',
  'critical_energy_j', 'tube_radius_mm', 'chamber_width_mm',
  'chamber_height_mm', 'doi_reference', 'sharing_link', 'contributor_name',
])

const DEFAULT_LIMIT = 20

const collator = new Intl.Collator('en')

function splitList(param: string): string[] {
  return param.split(',').map(value => value.trim())
}

function inList(value: string, param: string | undefined): boolean {
  return !param || splitList(param).includes(value)
}

// In the diluent and dopant filters the literal "None" stands for "no value".
function inNullableList(value: string | null, param: string | undefined): boolean {
  if (!param) return true
  const wanted = splitList(param)
  if (value === null) return wanted.includes('None')
  return wanted.some(w => w !== 'None' && w === value)
}

// Bounds are inclusive. A row with no value never satisfies a bound.
function inRange(value: number | null, min: number | undefined, max: number | undefined): boolean {
  if (min === undefined && max === undefined) return true
  if (value === null) return false
  return (min === undefined || value >= min) && (max === undefined || value <= max)
}

export function filterCases(cases: CaseDetail[], params: CaseListParams): CaseDetail[] {
  const needle = params.q ? params.q.toLowerCase() : ''
  return cases.filter(c =>
    (!needle || SEARCH_FIELDS.some(field => (c[field] ?? '').toLowerCase().includes(needle))) &&
    inList(c.fuel, params.fuel) &&
    inList(c.oxidizer, params.oxidizer) &&
    inList(c.geometry, params.geometry) &&
    inList(c.setup, params.setup) &&
    inNullableList(c.primary_diluent_name, params.primary_diluent_name) &&
    inNullableList(c.primary_dopant_name, params.primary_dopant_name) &&
    (!params.reference || caseReference(c) === params.reference) &&
    inRange(c.equivalence_ratio, params.equivalence_ratio_min, params.equivalence_ratio_max) &&
    inRange(c.initial_pressure_kpa, params.pressure_min, params.pressure_max) &&
    inRange(c.initial_temperature_k, params.temperature_min, params.temperature_max) &&
    (params.has_cell_size !== true || c.cell_width_mm !== null || c.cell_length_mm !== null) &&
    (params.has_critical_hd !== true || c.critical_hydraulic_diameter_mm !== null) &&
    (params.has_min_hd !== true || c.minimum_hydraulic_diameter_mm !== null) &&
    (params.has_critical_energy !== true || c.critical_energy_j !== null)
  )
}

// Empty values sort last in both directions, so a sparse column shows its real
// values first. Rows that compare equal fall back to newest id first, which
// keeps the order stable from page to page. An unknown column or direction
// falls back to the default: newest first.
export function sortCases(cases: CaseDetail[], sortBy?: string, sortDir?: string): CaseDetail[] {
  const key = (sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : 'created_at') as keyof CaseDetail
  const sign = sortDir === 'asc' ? 1 : -1
  return [...cases].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av === null || bv === null) {
      if (av !== null) return -1
      if (bv !== null) return 1
      return b.id - a.id
    }
    let order: number
    if (typeof av === 'number' && typeof bv === 'number') order = av - bv
    else if (key === 'created_at') order = av < bv ? -1 : av > bv ? 1 : 0
    else order = collator.compare(String(av), String(bv))
    return order !== 0 ? sign * order : b.id - a.id
  })
}

export function paginate<T>(items: T[], limit: number, offset: number): T[] {
  return items.slice(offset, offset + limit)
}

export function queryCases(cases: CaseDetail[], params: CaseListParams): PaginatedResponse<CaseDetail> {
  const limit = params.limit ?? DEFAULT_LIMIT
  const offset = params.offset ?? 0
  const matched = sortCases(filterCases(cases, params), params.sort_by, params.sort_dir)
  return { items: paginate(matched, limit, offset), total: matched.length, limit, offset }
}

function countValues(values: (string | null)[], withNone: boolean): FilterOption[] {
  const counts = new Map<string, number>()
  let missing = 0
  for (const value of values) {
    if (value === null) missing += 1
    else counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  const options = [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || collator.compare(a.value, b.value))
  if (withNone && missing > 0) options.unshift({ value: 'None', count: missing })
  return options
}

export function filterOptions(cases: CaseDetail[]): FilterOptions {
  return {
    fuels: countValues(cases.map(c => c.fuel), false),
    oxidizers: countValues(cases.map(c => c.oxidizer), false),
    geometries: countValues(cases.map(c => c.geometry), false),
    primary_diluent_names: countValues(cases.map(c => c.primary_diluent_name), true),
    primary_dopant_names: countValues(cases.map(c => c.primary_dopant_name), true),
    setups: countValues(cases.map(c => c.setup), false),
  }
}
