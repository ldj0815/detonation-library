/**
 * The URL-parameter contract shared by the facet rail, the active-filter chips
 * and the list queries. Parameter names match the API's query parameters.
 */
export const LIST_PARAMS = ['fuel', 'oxidizer', 'geometry', 'setup', 'primary_diluent_name', 'primary_dopant_name'] as const
export type ListParam = typeof LIST_PARAMS[number]

export const RANGE_PARAMS = [
  { key: 'equivalence_ratio', label: 'φ', unit: '' },
  { key: 'pressure', label: 'P', unit: 'kPa' },
  { key: 'temperature', label: 'T', unit: 'K' },
] as const

export const LIST_LABELS: Record<ListParam, string> = {
  fuel: 'Fuel',
  oxidizer: 'Oxidizer',
  geometry: 'Geometry',
  setup: 'Setup',
  primary_diluent_name: 'Diluent',
  primary_dopant_name: 'Dopant',
}

/** One publication, whole: a reference such as "27, Bull (1982)" has a comma,
 *  so this parameter is not a comma-separated list. */
export const REFERENCE_PARAM = 'ref'

export function listValues(params: URLSearchParams, key: string): string[] {
  return (params.get(key) ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

export function numberParam(params: URLSearchParams, key: string): number | undefined {
  const v = params.get(key)
  if (v == null || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

// URL parameters that belong to one category: its sorting and paging, its
// paper filter, and its plot settings. The view (table, plot, publications)
// exists in every category and carries over.
const CATEGORY_ONLY = [
  'offset', 'sort_by', 'sort_dir', REFERENCE_PARAM, 'publication',
  'x', 'y', 'color', 'shape', 'logx', 'logy', 'xmin', 'xmax', 'ymin', 'ymax',
]

/** The params to take along when switching category. */
export function categorySwitchParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of CATEGORY_ONLY) next.delete(key)
  return next
}

/** Number of active user filters (not counting sort, paging or the category). */
export function countActiveFilters(params: URLSearchParams): number {
  let n = 0
  for (const key of LIST_PARAMS) n += listValues(params, key).length
  for (const r of RANGE_PARAMS) {
    if (params.get(`${r.key}_min`)) n += 1
    if (params.get(`${r.key}_max`)) n += 1
  }
  if (params.get('q')?.trim()) n += 1
  if (params.get(REFERENCE_PARAM)?.trim()) n += 1
  return n
}

/** A copy of the params with every user filter removed (sort and page size kept). */
export function clearFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of LIST_PARAMS) next.delete(key)
  for (const r of RANGE_PARAMS) {
    next.delete(`${r.key}_min`)
    next.delete(`${r.key}_max`)
  }
  next.delete('q')
  next.delete(REFERENCE_PARAM)
  next.delete('offset')
  return next
}
