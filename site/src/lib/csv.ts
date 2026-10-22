import type { CaseListItem } from '../types/case'
import { HIDDEN_MEASUREMENTS } from '../config'

export const CASE_CSV_COLUMNS = [
  'id', 'title', 'setup', 'geometry', 'fuel', 'oxidizer',
  'equivalence_ratio', 'initial_pressure_kpa', 'initial_temperature_k',
  'primary_diluent_name', 'primary_diluent_percentage', 'additional_diluents',
  'primary_dopant_name', 'primary_dopant_ppm', 'additional_dopants',
  'cell_width_mm', 'cell_width_uncertainty_mm', 'cell_length_mm', 'cell_length_uncertainty_mm',
  'critical_hydraulic_diameter_mm', 'minimum_hydraulic_diameter_mm', 'critical_energy_j',
  'tube_radius_mm', 'chamber_width_mm', 'chamber_height_mm',
  'contributor_name', 'doi_reference', 'sharing_link', 'created_at',
].filter(c => !HIDDEN_MEASUREMENTS.has(c))

function escapeCsv(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = rows.map(row =>
    columns.map(h => {
      const v = row[h]
      return escapeCsv(v == null ? '' : String(v))
    }).join(',')
  )
  return [columns.map(escapeCsv).join(','), ...lines].join('\n') + '\n'
}

export function downloadText(content: string, filename: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCasesCsv(items: CaseListItem[], filename = 'detonation_cases.csv') {
  downloadText(toCsv(items as unknown as Record<string, unknown>[], CASE_CSV_COLUMNS), filename, 'text/csv')
}
