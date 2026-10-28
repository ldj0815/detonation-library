import type { CaseListItem } from '../types/case'

export const GALCIT_REFERENCES_URL = 'https://shepherd.caltech.edu/detn_db/html/references.html'
export const GALCIT_DB_URL = 'https://shepherd.caltech.edu/detn_db/html/'
export const GALCIT_REPORT_DOI = 'https://doi.org/10.7907/g3gs-4y69'

/** Numbers are shown as stored, with thousands grouping and at most four decimals. */
export function fmtNum(v: number | null | undefined, maxDecimals = 4): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (Number.isInteger(v)) return v.toLocaleString('en-US')
  const rounded = Number(v.toFixed(maxDecimals))
  return rounded.toLocaleString('en-US', { maximumFractionDigits: maxDecimals })
}

/** "14 ± 1 mm", "14 mm" or "—". */
export function fmtMeasure(v: number | null | undefined, unc: number | null | undefined, unit: string): string {
  if (v == null) return '—'
  const base = fmtNum(v)
  const u = unc != null ? ` ± ${fmtNum(unc)}` : ''
  return `${base}${u} ${unit}`.trim()
}

/** Count with grouping: 2,111. */
export function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US')
}

/**
 * GALCIT titles look like "at93b [22, Bull (1982)]": a dataset key followed by
 * the reference in brackets. Contributed data may use any title.
 */
export function parseTitle(title: string): { key: string | null; reference: string | null; plain: string } {
  const m = /^([A-Za-z0-9_.-]+)\s*\[(.+)\]\s*$/.exec(title.trim())
  if (m) return { key: m[1], reference: m[2].trim(), plain: title }
  return { key: null, reference: null, plain: title }
}

export interface ParsedReference {
  /** Index into the GALCIT reference list when the field is "N, Author (year)". */
  index: number | null
  /** Human label: "Akbar (1997)" or the raw string. */
  label: string
  /** Link target when the field is a DOI or URL, or a GALCIT reference index. */
  url: string | null
  kind: 'galcit' | 'doi' | 'url' | 'text'
}

export function parseReference(ref: string | null | undefined): ParsedReference | null {
  if (!ref) return null
  const s = ref.trim()
  if (!s) return null
  const galcit = /^(\d+)\s*,\s*(.+)$/.exec(s)
  if (galcit) {
    return { index: Number(galcit[1]), label: galcit[2].trim(), url: GALCIT_REFERENCES_URL, kind: 'galcit' }
  }
  if (/^https?:\/\//i.test(s)) return { index: null, label: s, url: s, kind: 'url' }
  const doi = /(10\.\d{4,9}\/\S+)/i.exec(s)
  if (doi) {
    const d = doi[1].replace(/[.,;)]+$/, '')
    return { index: null, label: s, url: `https://doi.org/${d}`, kind: 'doi' }
  }
  return { index: null, label: s, url: null, kind: 'text' }
}

/** "H2 / N2O, φ = 1, 100 kPa, 293 K, 50 % N2" */
export function mixtureLine(c: Pick<CaseListItem,
  'fuel' | 'oxidizer' | 'equivalence_ratio' | 'initial_pressure_kpa' | 'initial_temperature_k' |
  'primary_diluent_name' | 'primary_diluent_percentage' | 'primary_dopant_name' | 'primary_dopant_ppm'>): string {
  const parts: string[] = [`${c.fuel} / ${c.oxidizer}`]
  if (c.equivalence_ratio != null) parts.push(`φ = ${fmtNum(c.equivalence_ratio)}`)
  if (c.initial_pressure_kpa != null) parts.push(`${fmtNum(c.initial_pressure_kpa)} kPa`)
  if (c.initial_temperature_k != null) parts.push(`${fmtNum(c.initial_temperature_k)} K`)
  if (c.primary_diluent_name) {
    parts.push(c.primary_diluent_percentage != null
      ? `${fmtNum(c.primary_diluent_percentage)} % ${c.primary_diluent_name}`
      : `${c.primary_diluent_name} diluent`)
  }
  if (c.primary_dopant_name) {
    parts.push(c.primary_dopant_ppm != null
      ? `${fmtNum(c.primary_dopant_ppm)} ppm ${c.primary_dopant_name}`
      : `${c.primary_dopant_name} dopant`)
  }
  return parts.join(', ')
}

/** Which measurements a case carries, for badges and tiles. */
export function measurementsOf(c: Pick<CaseListItem,
  'cell_width_mm' | 'cell_length_mm' | 'critical_hydraulic_diameter_mm' | 'minimum_hydraulic_diameter_mm' | 'critical_energy_j'>): string[] {
  const out: string[] = []
  if (c.cell_width_mm != null || c.cell_length_mm != null) out.push('cell size')
  if (c.critical_hydraulic_diameter_mm != null) out.push('critical diameter')
  if (c.minimum_hydraulic_diameter_mm != null) out.push('minimum diameter')
  if (c.critical_energy_j != null) out.push('critical energy')
  return out
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  // A bare YYYY-MM-DD is a calendar date: read it in local time, not as UTC
  // midnight, which shows the day before west of UTC.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
