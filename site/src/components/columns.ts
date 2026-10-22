import { useState, useCallback } from 'react'
import { HIDDEN_MEASUREMENTS } from '../config'

export interface ColumnDef {
  key: string
  label: string
  defaultVisible: boolean
  numeric?: boolean
  /** Uncertainty column shown inline as "value ± u". */
  uncertaintyKey?: string
}

// New storage key so the refreshed defaults apply even where the old
// selection was saved.
const STORAGE_KEY = 'visible_columns_v2'

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'title', label: 'Case', defaultVisible: true },
  { key: 'fuel', label: 'Fuel', defaultVisible: true },
  { key: 'oxidizer', label: 'Oxidizer', defaultVisible: true },
  { key: 'equivalence_ratio', label: 'φ', defaultVisible: true, numeric: true },
  { key: 'initial_pressure_kpa', label: 'P (kPa)', defaultVisible: true, numeric: true },
  { key: 'initial_temperature_k', label: 'T (K)', defaultVisible: true, numeric: true },
  { key: 'primary_diluent_name', label: 'Diluent', defaultVisible: true },
  { key: 'primary_diluent_percentage', label: 'Diluent (%)', defaultVisible: false, numeric: true },
  { key: 'additional_diluents', label: 'Other diluents', defaultVisible: false },
  { key: 'primary_dopant_name', label: 'Dopant', defaultVisible: false },
  { key: 'primary_dopant_ppm', label: 'Dopant (ppm)', defaultVisible: false, numeric: true },
  { key: 'additional_dopants', label: 'Other dopants', defaultVisible: false },
  { key: 'cell_width_mm', label: 'Cell width (mm)', defaultVisible: true, numeric: true, uncertaintyKey: 'cell_width_uncertainty_mm' },
  { key: 'cell_length_mm', label: 'Cell length (mm)', defaultVisible: false, numeric: true, uncertaintyKey: 'cell_length_uncertainty_mm' },
  { key: 'critical_hydraulic_diameter_mm', label: 'Critical dia. (mm)', defaultVisible: true, numeric: true },
  { key: 'minimum_hydraulic_diameter_mm', label: 'Minimum dia. (mm)', defaultVisible: false, numeric: true },
  { key: 'critical_energy_j', label: 'Critical energy (J)', defaultVisible: true, numeric: true },
  { key: 'doi_reference', label: 'Reference', defaultVisible: true },
  { key: 'setup', label: 'Setup', defaultVisible: false },
  { key: 'geometry', label: 'Geometry', defaultVisible: false },
  { key: 'tube_radius_mm', label: 'Tube radius (mm)', defaultVisible: false, numeric: true },
  { key: 'chamber_width_mm', label: 'Chamber width (mm)', defaultVisible: false, numeric: true },
  { key: 'chamber_height_mm', label: 'Chamber height (mm)', defaultVisible: false, numeric: true },
  { key: 'contributor_name', label: 'Contributor', defaultVisible: false },
  { key: 'sharing_link', label: 'Link', defaultVisible: false },
  { key: 'created_at', label: 'Added', defaultVisible: false },
].filter(c => !HIDDEN_MEASUREMENTS.has(c.key))

export const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))

function loadVisible(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const keys = (JSON.parse(stored) as string[]).filter(k => ALL_COLUMNS.some(c => c.key === k))
      return new Set(['title', ...keys])
    }
  } catch {
    // Storage unavailable or corrupt: fall through to the defaults.
  }
  return new Set(DEFAULT_VISIBLE)
}

function saveVisible(keys: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(keys)))
  } catch {
    // Storage unavailable: the selection just will not persist.
  }
}

export function useVisibleColumns() {
  const [visible, setVisible] = useState<Set<string>>(loadVisible)

  const toggle = useCallback((key: string) => {
    if (key === 'title') return
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveVisible(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const next = new Set(DEFAULT_VISIBLE)
    saveVisible(next)
    setVisible(next)
  }, [])

  return { visible, toggle, reset }
}
