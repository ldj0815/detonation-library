import { useState, useEffect } from 'react'

export interface ColumnDef {
  key: string
  label: string
  defaultVisible: boolean
}

const STORAGE_KEY = 'visible_columns'

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'title', label: 'Title', defaultVisible: true },
  { key: 'setup', label: 'Setup', defaultVisible: true },
  { key: 'geometry', label: 'Geometry', defaultVisible: false },
  { key: 'fuel', label: 'Fuel', defaultVisible: true },
  { key: 'oxidizer', label: 'Oxidizer', defaultVisible: true },
  { key: 'equivalence_ratio', label: 'φ', defaultVisible: true },
  { key: 'initial_pressure_kpa', label: 'P (kPa)', defaultVisible: true },
  { key: 'initial_temperature_k', label: 'T (K)', defaultVisible: true },
  { key: 'primary_diluent_name', label: 'Primary Diluent', defaultVisible: true },
  { key: 'primary_diluent_percentage', label: 'Diluent %', defaultVisible: false },
  { key: 'additional_diluents', label: 'Add. Diluents', defaultVisible: false },
  { key: 'primary_dopant_name', label: 'Primary Dopant', defaultVisible: true },
  { key: 'primary_dopant_ppm', label: 'Dopant (ppm)', defaultVisible: false },
  { key: 'additional_dopants', label: 'Add. Dopants', defaultVisible: false },
  { key: 'cell_width_mm', label: 'Cell W (mm)', defaultVisible: true },
  { key: 'cell_width_uncertainty_mm', label: 'Cell W ± (mm)', defaultVisible: true },
  { key: 'cell_length_mm', label: 'Cell L (mm)', defaultVisible: false },
  { key: 'cell_length_uncertainty_mm', label: 'Cell L ± (mm)', defaultVisible: false },
  { key: 'critical_hydraulic_diameter_mm', label: 'Crit. HD (mm)', defaultVisible: false },
  { key: 'minimum_hydraulic_diameter_mm', label: 'Min. HD (mm)', defaultVisible: false },
  { key: 'critical_energy_j', label: 'Crit. Energy (J)', defaultVisible: false },
  { key: 'tube_radius_mm', label: 'Tube R (mm)', defaultVisible: false },
  { key: 'chamber_width_mm', label: 'Chamber W (mm)', defaultVisible: false },
  { key: 'chamber_height_mm', label: 'Chamber H (mm)', defaultVisible: false },
  { key: 'contributor_name', label: 'Contributor', defaultVisible: false },
  { key: 'doi_reference', label: 'DOI', defaultVisible: false },
  { key: 'sharing_link', label: 'Sharing Link', defaultVisible: false },
  { key: 'created_at', label: 'Date', defaultVisible: true },
]

function loadVisible(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return new Set(JSON.parse(stored))
  } catch {}
  return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
}

export function useVisibleColumns() {
  const [visible, setVisible] = useState<Set<string>>(loadVisible)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visible)))
  }, [visible])

  const toggle = (key: string) => {
    if (key === 'title') return
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return { visible, toggle }
}

interface Props {
  visible: Set<string>
  onToggle: (key: string) => void
}

export default function ColumnSelector({ visible, onToggle }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
      >
        Columns ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 max-h-80 overflow-y-auto">
            {ALL_COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-2 py-0.5 text-sm cursor-pointer hover:bg-gray-50 px-1 rounded">
                <input
                  type="checkbox"
                  checked={visible.has(col.key)}
                  onChange={() => onToggle(col.key)}
                  disabled={col.key === 'title'}
                />
                {col.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
