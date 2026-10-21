import type { CaseListParams } from '../data/query'

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
}

export const CATEGORIES: Category[] = [
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
    description: 'Rotating detonation engine runs.',
    filter: { setup: 'rde' },
  },
]

export function categoryFor(mode: BrowseMode): Category {
  return CATEGORIES.find(c => c.mode === mode) ?? CATEGORIES[0]
}
