import type { CaseListItem } from '../types/case'
import { caseReference, parseReference, type ParsedReference } from './format'

export interface Tally {
  value: string
  count: number
}

export interface Range {
  min: number
  max: number
}

/** The cases of one publication: which of them pass the filters, and what they cover. */
export interface ReferenceGroup {
  /** The caseReference() string, which the reference filter takes; null for the "No reference" group. */
  reference: string | null
  /** Entry number in the GALCIT reference list, for GALCIT references. */
  index: number | null
  /** "Bull (1982)", the raw reference for other kinds, or "No reference". */
  label: string
  year: number | null
  kind: ParsedReference['kind'] | null
  /** The GALCIT reference list at this entry, or the DOI or URL link. */
  url: string | null
  /** Cases that pass the filters. */
  matching: number
  /** Cases of this publication in the whole category. */
  total: number
  /** "H2 / O2" pairs, most common first. */
  mixtures: Tally[]
  fuels: Tally[]
  oxidizers: Tally[]
  /** Over the matching cases, ignoring cases without a value. */
  pressureKpa: Range | null
  equivalenceRatio: Range | null
  /** Matching cases that give a cell width, and a cell length. */
  cellWidth: number
  cellLength: number
}

export const NO_REFERENCE_LABEL = 'No reference'

type Item = Pick<CaseListItem,
  'title' | 'doi_reference' | 'fuel' | 'oxidizer' | 'initial_pressure_kpa' | 'equivalence_ratio' |
  'cell_width_mm' | 'cell_length_mm'>

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/** The year in "Bull (1982)" or "Smith (2003b)"; null for "EDL (unpublished)". */
export function referenceYear(label: string): number | null {
  const m = /\((\d{4})[a-z]?\)/.exec(label)
  return m ? Number(m[1]) : null
}

function tally(values: string[]): Tally[] {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return Array.from(counts, ([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || collator.compare(a.value, b.value))
}

function range(values: (number | null)[]): Range | null {
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  return min <= max ? { min, max } : null
}

// Earliest first; undated papers after dated ones, then by label and number.
function compareGroups(a: ReferenceGroup, b: ReferenceGroup): number {
  if (a.reference === null) return b.reference === null ? 0 : 1
  if (b.reference === null) return -1
  if (a.year !== b.year) {
    if (a.year === null) return 1
    if (b.year === null) return -1
    return a.year - b.year
  }
  return collator.compare(a.label, b.label) || (a.index ?? Infinity) - (b.index ?? Infinity)
}

/**
 * One entry per publication with at least one case in `items`. Two papers with
 * the same label ("22, Bull (1982)" and "27, Bull (1982)") stay apart. Cases
 * with no reference form one "No reference" group at the end.
 */
export function groupByReference<T extends Item>(items: T[], allItems: T[]): ReferenceGroup[] {
  const totals = new Map<string | null, number>()
  for (const c of allItems) {
    const ref = caseReference(c)
    totals.set(ref, (totals.get(ref) ?? 0) + 1)
  }

  const byRef = new Map<string | null, T[]>()
  for (const c of items) {
    const ref = caseReference(c)
    const list = byRef.get(ref)
    if (list) list.push(c)
    else byRef.set(ref, [c])
  }

  return Array.from(byRef, ([reference, cases]): ReferenceGroup => {
    const parsed = parseReference(reference)
    const label = parsed?.label ?? NO_REFERENCE_LABEL
    return {
      reference,
      index: parsed?.index ?? null,
      label,
      year: parsed ? referenceYear(label) : null,
      kind: parsed?.kind ?? null,
      url: parsed?.kind === 'galcit' ? `${parsed.url}#${parsed.index}` : parsed?.url ?? null,
      matching: cases.length,
      total: Math.max(totals.get(reference) ?? 0, cases.length),
      mixtures: tally(cases.map(c => `${c.fuel} / ${c.oxidizer}`)),
      fuels: tally(cases.map(c => c.fuel)),
      oxidizers: tally(cases.map(c => c.oxidizer)),
      pressureKpa: range(cases.map(c => c.initial_pressure_kpa)),
      equivalenceRatio: range(cases.map(c => c.equivalence_ratio)),
      cellWidth: cases.filter(c => c.cell_width_mm != null).length,
      cellLength: cases.filter(c => c.cell_length_mm != null).length,
    }
  }).sort(compareGroups)
}
