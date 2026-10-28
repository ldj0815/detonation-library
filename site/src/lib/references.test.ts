import { describe, expect, it } from 'vitest'
import type { CaseListItem } from '../types/case'
import { GALCIT_REFERENCES_URL } from './format'
import { NO_REFERENCE_LABEL, groupByReference, referenceYear } from './references'

type Case = Pick<CaseListItem,
  'title' | 'doi_reference' | 'fuel' | 'oxidizer' | 'initial_pressure_kpa' | 'equivalence_ratio' |
  'cell_width_mm' | 'cell_length_mm'>

function galcit(key: string, ref: string, over: Partial<Case> = {}): Case {
  return {
    title: `${key} [${ref}]`,
    doi_reference: ref,
    fuel: 'H2',
    oxidizer: 'O2',
    initial_pressure_kpa: 101.3,
    equivalence_ratio: 1,
    cell_width_mm: 1.5,
    cell_length_mm: null,
    ...over,
  }
}

function contributed(title: string, doi: string | null, over: Partial<Case> = {}): Case {
  return { ...galcit('x', 'x'), title, doi_reference: doi, ...over }
}

describe('referenceYear', () => {
  it('reads the year in brackets', () => {
    expect(referenceYear('Bull (1982)')).toBe(1982)
    expect(referenceYear('Smith (2003b)')).toBe(2003)
    expect(referenceYear('EDL (unpublished)')).toBeNull()
    expect(referenceYear('10.1016/j.combustflame.2020.01.001')).toBeNull()
  })
})

describe('groupByReference', () => {
  it('keeps two papers with the same label apart', () => {
    const cases = [galcit('a', '22, Bull (1982)'), galcit('b', '27, Bull (1982)'), galcit('c', '27, Bull (1982)')]
    const groups = groupByReference(cases, cases)
    expect(groups.map(g => [g.reference, g.index, g.label, g.matching])).toEqual([
      ['22, Bull (1982)', 22, 'Bull (1982)', 1],
      ['27, Bull (1982)', 27, 'Bull (1982)', 2],
    ])
  })

  it('counts matching cases against all cases of the paper', () => {
    const all = [
      galcit('a', '56, Knystautas (1982)'),
      galcit('b', '56, Knystautas (1982)'),
      galcit('c', '56, Knystautas (1982)'),
      galcit('d', '3, Akbar (1997)'),
    ]
    const groups = groupByReference([all[0], all[2]], all)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ reference: '56, Knystautas (1982)', matching: 2, total: 3, year: 1982 })
  })

  it('links GALCIT papers to their entry in the reference list, and DOIs to doi.org', () => {
    const cases = [galcit('a', '3, Akbar (1997)'), contributed('Run 4', '10.1016/j.cf.2020.01.001')]
    const [akbar, doi] = groupByReference(cases, cases)
    expect(akbar).toMatchObject({ kind: 'galcit', url: `${GALCIT_REFERENCES_URL}#3` })
    expect(doi).toMatchObject({ kind: 'doi', index: null, url: 'https://doi.org/10.1016/j.cf.2020.01.001' })
  })

  it('tallies mixtures, fuels and oxidizers, most common first', () => {
    const cases = [
      galcit('a', '9, Barthel (1974)', { fuel: 'C2H4' }),
      galcit('b', '9, Barthel (1974)'),
      galcit('c', '9, Barthel (1974)'),
      galcit('d', '9, Barthel (1974)', { fuel: 'C2H4', oxidizer: 'Air' }),
    ]
    const [g] = groupByReference(cases, cases)
    expect(g.mixtures).toEqual([
      { value: 'H2 / O2', count: 2 },
      { value: 'C2H4 / Air', count: 1 },
      { value: 'C2H4 / O2', count: 1 },
    ])
    expect(g.fuels).toEqual([{ value: 'C2H4', count: 2 }, { value: 'H2', count: 2 }])
    expect(g.oxidizers).toEqual([{ value: 'O2', count: 3 }, { value: 'Air', count: 1 }])
  })

  it('takes ranges over the matching cases and ignores cases without a value', () => {
    const cases = [
      galcit('a', '61, Kumar (1990)', { initial_pressure_kpa: 10, equivalence_ratio: null }),
      galcit('b', '61, Kumar (1990)', { initial_pressure_kpa: null, equivalence_ratio: 0.5 }),
      galcit('c', '61, Kumar (1990)', { initial_pressure_kpa: 101.3, equivalence_ratio: 2 }),
      galcit('d', '61, Kumar (1990)', { initial_pressure_kpa: 500, equivalence_ratio: 4 }),
    ]
    const [g] = groupByReference(cases.slice(0, 3), cases)
    expect(g.pressureKpa).toEqual({ min: 10, max: 101.3 })
    expect(g.equivalenceRatio).toEqual({ min: 0.5, max: 2 })
  })

  it('gives no range when no matching case has a value', () => {
    const cases = [galcit('a', '61, Kumar (1990)', { equivalence_ratio: null })]
    expect(groupByReference(cases, cases)[0].equivalenceRatio).toBeNull()
  })

  it('counts the cases that give a cell width and a cell length', () => {
    const cases = [
      galcit('a', '27, Bull (1982)', { cell_width_mm: 2, cell_length_mm: 3 }),
      galcit('b', '27, Bull (1982)', { cell_width_mm: 2 }),
      galcit('c', '27, Bull (1982)', { cell_width_mm: null, cell_length_mm: 4 }),
    ]
    const [g] = groupByReference(cases, cases)
    expect(g.cellWidth).toBe(2)
    expect(g.cellLength).toBe(2)
  })

  it('puts cases without a reference in one group at the end', () => {
    const cases = [
      contributed('Run 1', null),
      galcit('a', '3, Akbar (1997)'),
      contributed('Run 2', '  '),
    ]
    const groups = groupByReference(cases, cases)
    expect(groups.map(g => g.label)).toEqual(['Akbar (1997)', NO_REFERENCE_LABEL])
    expect(groups[1]).toMatchObject({ reference: null, index: null, url: null, matching: 2, total: 2 })
  })

  it('sorts by year, then label, then reference number, undated papers last', () => {
    const cases = [
      galcit('a', '39, EDL (unpublished)'),
      galcit('b', '111, Strehlow (1969)'),
      galcit('c', '27, Bull (1982)'),
      galcit('d', '108, Strehlow (1969)'),
      galcit('e', '22, Bull (1982)'),
      galcit('f', '110, Strehlow (1967)'),
      galcit('g', '56, Knystautas (1982)'),
    ]
    expect(groupByReference(cases, cases).map(g => g.reference)).toEqual([
      '110, Strehlow (1967)',
      '108, Strehlow (1969)',
      '111, Strehlow (1969)',
      '22, Bull (1982)',
      '27, Bull (1982)',
      '56, Knystautas (1982)',
      '39, EDL (unpublished)',
    ])
  })

  it('leaves out papers with no matching case', () => {
    const all = [galcit('a', '3, Akbar (1997)'), galcit('b', '27, Bull (1982)')]
    expect(groupByReference([all[1]], all).map(g => g.reference)).toEqual(['27, Bull (1982)'])
  })
})
