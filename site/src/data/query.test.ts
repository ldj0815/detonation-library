import { describe, expect, it } from 'vitest'
import { filterCases, filterOptions, paginate, queryCases, sortCases } from './query'
import type { CaseListParams } from './query'
import type { CaseDetail } from '../types/case'

function make(id: number, over: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id,
    title: `case ${id}`,
    setup: 'detonation',
    geometry: 'round tube',
    fuel: 'H2',
    oxidizer: 'O2',
    equivalence_ratio: 1,
    initial_pressure_kpa: 100,
    initial_temperature_k: 293,
    primary_diluent_name: null,
    primary_diluent_percentage: null,
    additional_diluents: null,
    primary_dopant_name: null,
    primary_dopant_ppm: null,
    additional_dopants: null,
    cell_width_mm: null,
    cell_width_uncertainty_mm: null,
    cell_length_mm: null,
    cell_length_uncertainty_mm: null,
    critical_hydraulic_diameter_mm: null,
    minimum_hydraulic_diameter_mm: null,
    critical_energy_j: null,
    tube_radius_mm: null,
    chamber_width_mm: null,
    chamber_height_mm: null,
    contributor_name: 'A. Researcher',
    contributor_institution: 'UCI',
    contributor_email: 'a.researcher@uci.edu',
    doi_reference: null,
    sharing_link: null,
    notes: null,
    created_at: '2026-04-08T06:30:50.843939Z',
    ...over,
  }
}

const ids = (cases: CaseDetail[]) => cases.map(c => c.id)

describe('filterCases', () => {
  const cases = [
    make(1, { fuel: 'H2', oxidizer: 'O2', primary_diluent_name: 'N2', equivalence_ratio: 1, cell_width_mm: 14 }),
    make(2, { fuel: 'CH4', oxidizer: 'Air', equivalence_ratio: 0.8, initial_pressure_kpa: 50, notes: 'Table 2 from GALCIT' }),
    make(3, { fuel: 'C2H2', oxidizer: 'O2', setup: 'rde', primary_diluent_name: 'Ar', equivalence_ratio: null, initial_temperature_k: 500, critical_energy_j: 3 }),
  ]
  const match = (params: CaseListParams) => ids(filterCases(cases, params))

  it('keeps everything when no filter is set', () => {
    expect(match({})).toEqual([1, 2, 3])
    expect(match({ q: '', fuel: '' })).toEqual([1, 2, 3])
  })

  it('searches text columns without regard to case', () => {
    expect(match({ q: 'ch4' })).toEqual([2])
    expect(match({ q: 'TABLE 2' })).toEqual([2])
    expect(match({ q: 'researcher' })).toEqual([1, 2, 3])
    expect(match({ q: 'no such text' })).toEqual([])
  })

  it('does not search the institution or email', () => {
    expect(match({ q: 'uci' })).toEqual([])
  })

  it('matches any value of a comma-separated list', () => {
    expect(match({ fuel: 'H2,CH4' })).toEqual([1, 2])
    expect(match({ fuel: 'H2, CH4' })).toEqual([1, 2])
    expect(match({ oxidizer: 'Air' })).toEqual([2])
    expect(match({ setup: 'rde' })).toEqual([3])
    expect(match({ geometry: 'annular' })).toEqual([])
  })

  it('treats None as "no value" for diluent and dopant', () => {
    expect(match({ primary_diluent_name: 'None' })).toEqual([2])
    expect(match({ primary_diluent_name: 'None,Ar' })).toEqual([2, 3])
    expect(match({ primary_diluent_name: 'N2' })).toEqual([1])
    expect(match({ primary_dopant_name: 'None' })).toEqual([1, 2, 3])
    expect(match({ primary_dopant_name: 'O3' })).toEqual([])
  })

  it('applies inclusive ranges and drops rows with no value', () => {
    expect(match({ equivalence_ratio_min: 0.8, equivalence_ratio_max: 1 })).toEqual([1, 2])
    expect(match({ equivalence_ratio_min: 0 })).toEqual([1, 2])
    expect(match({ equivalence_ratio_max: 0.9 })).toEqual([2])
    expect(match({ pressure_max: 50 })).toEqual([2])
    expect(match({ temperature_min: 500 })).toEqual([3])
  })

  it('keeps rows that have the requested measurement', () => {
    expect(match({ has_cell_size: true })).toEqual([1])
    expect(ids(filterCases([make(5, { cell_length_mm: 20 })], { has_cell_size: true }))).toEqual([5])
    expect(match({ has_critical_energy: true })).toEqual([3])
    expect(match({ has_critical_hd: true })).toEqual([])
    expect(match({ has_min_hd: true })).toEqual([])
    expect(match({ has_cell_size: false })).toEqual([1, 2, 3])
  })

  it('combines filters with AND', () => {
    expect(match({ oxidizer: 'O2', setup: 'detonation' })).toEqual([1])
  })
})

describe('sortCases', () => {
  const cases = [
    make(1, { cell_width_mm: 5, fuel: 'H2', created_at: '2026-04-08T06:00:00Z' }),
    make(2, { cell_width_mm: null, fuel: 'CH4', created_at: '2026-04-09T06:00:00Z' }),
    make(3, { cell_width_mm: 20, fuel: 'C2H2', created_at: '2026-04-08T06:00:00Z' }),
    make(4, { cell_width_mm: 5, fuel: 'NH3', created_at: '2026-04-07T06:00:00Z' }),
  ]

  it('defaults to newest first, with ties going to the higher id', () => {
    expect(ids(sortCases(cases))).toEqual([2, 3, 1, 4])
  })

  it('sorts numbers ascending with empty values last', () => {
    expect(ids(sortCases(cases, 'cell_width_mm', 'asc'))).toEqual([4, 1, 3, 2])
  })

  it('sorts numbers descending with empty values still last', () => {
    expect(ids(sortCases(cases, 'cell_width_mm', 'desc'))).toEqual([3, 4, 1, 2])
  })

  it('sorts text alphabetically', () => {
    expect(ids(sortCases(cases, 'fuel', 'asc'))).toEqual([3, 2, 1, 4])
    expect(ids(sortCases(cases, 'fuel', 'desc'))).toEqual([4, 1, 2, 3])
  })

  it('sorts by id', () => {
    expect(ids(sortCases(cases, 'id', 'asc'))).toEqual([1, 2, 3, 4])
  })

  it('puts rows with no value in id order when the whole column is empty', () => {
    expect(ids(sortCases(cases, 'critical_energy_j', 'asc'))).toEqual([4, 3, 2, 1])
  })

  it('falls back to the default for an unknown column', () => {
    expect(ids(sortCases(cases, 'contributor_email', 'desc'))).toEqual([2, 3, 1, 4])
  })

  it('leaves the input array untouched', () => {
    const before = ids(cases)
    sortCases(cases, 'fuel', 'asc')
    expect(ids(cases)).toEqual(before)
  })
})

describe('paginate and queryCases', () => {
  const cases = Array.from({ length: 25 }, (_, i) => make(i + 1, { fuel: i < 5 ? 'CH4' : 'H2' }))

  it('slices one page', () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4])
    expect(paginate([1, 2, 3], 2, 2)).toEqual([3])
    expect(paginate([1, 2, 3], 2, 4)).toEqual([])
  })

  it('returns one sorted page and the total before paging', () => {
    const result = queryCases(cases, { sort_by: 'id', sort_dir: 'asc', limit: 2, offset: 2 })
    expect(ids(result.items)).toEqual([3, 4])
    expect(result).toMatchObject({ total: 25, limit: 2, offset: 2 })
  })

  it('counts only the rows that match the filters', () => {
    const result = queryCases(cases, { fuel: 'CH4', limit: 3 })
    expect(result.total).toBe(5)
    expect(result.items).toHaveLength(3)
  })

  it('uses a page of 20 from the start by default', () => {
    const result = queryCases(cases, {})
    expect(result.items).toHaveLength(20)
    expect(result).toMatchObject({ limit: 20, offset: 0 })
    expect(result.items[0].id).toBe(25)
  })
})

describe('filterOptions', () => {
  const cases = [
    make(1, { fuel: 'H2', primary_diluent_name: 'N2', primary_dopant_name: 'O3' }),
    make(2, { fuel: 'H2', primary_diluent_name: 'Ar', primary_dopant_name: 'O3', setup: 'rde' }),
    make(3, { fuel: 'CH4', primary_diluent_name: 'N2', primary_dopant_name: 'O3' }),
    make(4, { fuel: 'C2H2', primary_diluent_name: null, primary_dopant_name: 'O3' }),
  ]
  const options = filterOptions(cases)

  it('counts each value, most common first, then alphabetically', () => {
    expect(options.fuels).toEqual([
      { value: 'H2', count: 2 },
      { value: 'C2H2', count: 1 },
      { value: 'CH4', count: 1 },
    ])
    expect(options.setups).toEqual([
      { value: 'detonation', count: 3 },
      { value: 'rde', count: 1 },
    ])
    expect(options.oxidizers).toEqual([{ value: 'O2', count: 4 }])
    expect(options.geometries).toEqual([{ value: 'round tube', count: 4 }])
  })

  it('lists None first when some rows have no diluent', () => {
    expect(options.primary_diluent_names).toEqual([
      { value: 'None', count: 1 },
      { value: 'N2', count: 2 },
      { value: 'Ar', count: 1 },
    ])
  })

  it('leaves None out when every row has a value', () => {
    expect(options.primary_dopant_names).toEqual([{ value: 'O3', count: 4 }])
  })
})
