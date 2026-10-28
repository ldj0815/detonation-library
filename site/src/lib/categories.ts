import type { CaseListParams } from '../data/query'
import { HIDDEN_MEASUREMENTS } from '../config'

export type BrowseMode = 'all' | 'cell-size' | 'critical-hd' | 'min-hd' | 'critical-energy' | 'rde'

export interface Category {
  mode: BrowseMode
  path: string
  label: string
  /** One-line meaning for the landing page cards. */
  description: string
  /** Query parameters that select this category on the list endpoint. */
  filter: Partial<CaseListParams>
  /** Measurement column this category is about, if any. */
  field?: 'cell_width_mm' | 'critical_hydraulic_diameter_mm' | 'minimum_hydraulic_diameter_mm' | 'critical_energy_j'
  unit?: string
  /** Listed before it has any data, to invite contributions. */
  placeholder?: boolean
  /** What one entry is called: "cases" unless set. */
  noun?: string
}

const ALL_CATEGORIES: Category[] = [
  {
    mode: 'all',
    path: '/cases',
    label: 'All cases',
    description: 'Every case in the library.',
    filter: {},
  },
  {
    mode: 'cell-size',
    path: '/browse/cell-size',
    label: 'Cell size',
    description: 'Detonation cell width and length measured on soot foils. The cell width λ is the basic length scale of a detonable mixture.',
    filter: { has_cell_size: true },
    field: 'cell_width_mm',
    unit: 'mm',
  },
  {
    mode: 'critical-hd',
    path: '/browse/critical-hd',
    label: 'Critical diameter',
    description: 'Smallest tube diameter from which a detonation survives the transition into an unconfined volume.',
    filter: { has_critical_hd: true },
    field: 'critical_hydraulic_diameter_mm',
    unit: 'mm',
  },
  {
    mode: 'min-hd',
    path: '/browse/min-hd',
    label: 'Minimum diameter',
    description: 'Smallest tube diameter in which a detonation still propagates.',
    filter: { has_min_hd: true },
    field: 'minimum_hydraulic_diameter_mm',
    unit: 'mm',
  },
  {
    mode: 'critical-energy',
    path: '/browse/critical-energy',
    label: 'Critical energy',
    description: 'Minimum source energy for direct initiation of a detonation.',
    filter: { has_critical_energy: true },
    field: 'critical_energy_j',
    unit: 'J',
  },
  {
    mode: 'rde',
    path: '/browse/rde',
    label: 'RDE',
    description: 'Rotating detonation engine operating points from published experiments: flow conditions, combustor geometry, wave modes and speeds, thrust and specific impulse.',
    filter: { setup: 'rde' },
    noun: 'operating points',
  },
]

const measured = ALL_CATEGORIES.filter(c => c.field && !HIDDEN_MEASUREMENTS.has(c.field))
const unmeasured = ALL_CATEGORIES.filter(c => !c.field && c.mode !== 'all')

/** The categories the site shows. "All cases" only earns a place when there is
 *  more than one kind of measurement to combine. */
export const CATEGORIES: Category[] = measured.length > 1
  ? [ALL_CATEGORIES[0], ...measured, ...unmeasured]
  : [...measured, ...unmeasured]

/** Where /cases and /search land. */
export const DEFAULT_CATEGORY = CATEGORIES[0]

export function categoryFor(mode: BrowseMode): Category {
  return CATEGORIES.find(c => c.mode === mode) ?? DEFAULT_CATEGORY
}
