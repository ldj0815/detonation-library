import { describe, expect, it } from 'vitest'
import {
  NOT_REPORTED,
  RDE_CSV_COLUMNS,
  RDE_FACETS,
  clearRdeFilters,
  countRdeFilters,
  facetOptions,
  filterRde,
  matchesRde,
  measureOptions,
  parseRdeFilters,
  publicationIndex,
  rdeCsv,
  sortRde,
} from './rde'
import type { RdeDataset, RdeOperatingPoint, RdePublication, RdeRelease } from '../types/rde'

function pub(id: number, over: Partial<RdePublication> = {}): RdePublication {
  return {
    id,
    label: `Author ${id}`,
    title: `Paper ${id}`,
    year: 2020,
    engine_code: 'R',
    operating_points: 0,
    ...over,
  }
}

function point(id: number, publication_id: number, over: Partial<RdeOperatingPoint> = {}): RdeOperatingPoint {
  return {
    id,
    publication_id,
    test_run_id: id,
    operating_point_type: 'steady',
    engine_code: 'R',
    fuel: 'H2',
    oxidizer: 'O2',
    ...over,
  }
}

// Publication order is by year: Bykovskii (2006), Smith (2021), Kang (2024).
const data: RdeDataset = {
  release: null,
  publications: [
    pub(1, {
      label: 'Smith (2021)', year: 2021, engine_code: 'R', operating_points: 3,
      title: 'Experimental Investigation of Rotating Detonation Rocket Engines',
      authors: 'Richard D. Smith; Steven B. Stanley', doi: '10.2514/1.b37959',
    }),
    pub(2, {
      label: 'Bykovskii (2006)', year: 2006, engine_code: 'AB', operating_points: 2,
      title: 'Noise and Vibrations in a Combustor with Continuous Spin Detonation of the Fuel',
      authors: 'F. A. Bykovskii, E. F. Vedernikov', doi: '10.1007/s10573-006-0090-y',
    }),
    pub(3, { label: 'Kang (2024)', year: 2024, engine_code: 'AAB', operating_points: 1, title: 'Suppression of inlet blockage' }),
  ],
  operating_points: [
    point(1, 1, {
      sequence_index: 1, fuel_reported: 'Hydrogen', wave_count: 2, wave_speed_m_s: 1500, equivalence_ratio: 1,
      mdot_total_kg_s: 0.3, chamber_outer_diameter_mm: 76, thrust_n: 1200, specific_impulse_s: 210,
      combustor_type: 'axial_annular', chamber_pressures: [{ id: 1, pressure_kpa: 250 }],
    }),
    point(2, 1, {
      sequence_index: 2, fuel: 'CH4', wave_count: 1, wave_speed_m_s: 1800, equivalence_ratio: 0.8,
      mdot_total_kg_s: 0.5, chamber_outer_diameter_mm: 76, combustor_type: 'axial_annular',
    }),
    point(3, 1, {
      sequence_index: 3, operating_point_type: 'transient_blowdown', equivalence_ratio: 1.2, mdot_total_kg_s: 0.4,
      thrust_n: 900, combustor_type: 'axial_cylindrical',
    }),
    point(4, 2, {
      sequence_index: 1, engine_code: 'AB', oxidizer: 'Air', fuel_reported: 'Hydrogen', oxidizer_reported: 'air',
      wave_count: 1, wave_speed_m_s: 1600, frequency_khz: 1.7, mdot_total_kg_s: 2.09, chamber_outer_diameter_mm: 306,
      combustor_type: 'axial_annular', pressure_gain_percent: -12.9,
    }),
    point(5, 2, {
      sequence_index: 2, engine_code: 'AB', fuel: 'C2H4', oxidizer: 'Air', wave_count: 12, equivalence_ratio: 0.9,
      chamber_outer_diameter_mm: 306,
    }),
    point(6, 3, {
      engine_code: 'AAB', fuel: 'CH4', oxidizer: 'O2-enriched air', operating_point_type: 'other_please_specify',
      equivalence_ratio: 1, specific_impulse_s: 1500, mdot_total_kg_s: 1, chamber_outer_diameter_mm: 150,
      combustor_type: 'axial_annular',
    }),
  ],
}
const pubs = publicationIndex(data)
const RELEASE: RdeRelease = {
  release_version: '1.0.0', release_date: '2026-10-23', internal_use_only: true,
  database: 'rde_database_2026-10-23.sqlite', database_sha256: '0'.repeat(64), views: [],
}

const ids = (points: RdeOperatingPoint[]) => points.map(p => p.id)
const filters = (qs: string) => parseRdeFilters(new URLSearchParams(qs))
const match = (qs: string) => ids(filterRde(data, filters(qs)))
const facet = (param: string) => {
  const f = RDE_FACETS.find(x => x.param === param)
  if (!f) throw new Error(`no facet ${param}`)
  return f
}
const options = (param: string, qs = '') => facetOptions(data, filters(qs), facet(param))

describe('publicationIndex', () => {
  it('maps publication ids to publications', () => {
    expect(pubs.get(2)?.label).toBe('Bykovskii (2006)')
    expect(pubs.size).toBe(3)
  })
})

describe('parseRdeFilters', () => {
  it('reads nothing from an empty URL', () => {
    const f = filters('')
    expect(f.q).toBe('')
    expect(f.has).toEqual([])
    expect(f.ranges).toEqual({})
    expect(Object.keys(f.lists).sort()).toEqual(RDE_FACETS.map(x => x.param).sort())
    for (const values of Object.values(f.lists)) expect(values).toEqual([])
  })

  it('reads comma-separated lists for every facet', () => {
    const f = filters('fuel=H2,%20CH4&oxidizer=O2&waves=1,none&publication=2&engine=AB')
    expect(f.lists.fuel).toEqual(['H2', 'CH4'])
    expect(f.lists.oxidizer).toEqual(['O2'])
    expect(f.lists.waves).toEqual(['1', NOT_REPORTED])
    expect(f.lists.publication).toEqual(['2'])
    expect(f.lists.engine).toEqual(['AB'])
    expect(f.lists.combustor).toEqual([])
  })

  it('keeps only known measures in has', () => {
    expect(filters('has=thrust,bogus,isp').has).toEqual(['thrust', 'isp'])
    expect(filters('has=bogus').has).toEqual([])
  })

  it('reads ranges with a minimum only, a maximum only, or both', () => {
    const f = filters('equivalence_ratio_min=0.8&mdot_total_max=1&chamber_od_min=50&chamber_od_max=100')
    expect(f.ranges.equivalence_ratio).toEqual({ min: 0.8, max: undefined })
    expect(f.ranges.mdot_total).toEqual({ min: undefined, max: 1 })
    expect(f.ranges.chamber_od).toEqual({ min: 50, max: 100 })
  })

  it('ignores empty and non-numeric bounds', () => {
    expect(filters('equivalence_ratio_min=&mdot_total_max=lots').ranges).toEqual({})
  })

  it('trims the search text', () => {
    expect(filters('q=%20%20smith%20%20').q).toBe('smith')
    expect(filters('q=%20%20').q).toBe('')
  })
})

describe('matchesRde and filterRde', () => {
  it('keeps every point when no filter is set', () => {
    expect(match('')).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('searches publication label, title and authors, fuel and #id, without regard to case', () => {
    expect(match('q=smith')).toEqual([1, 2, 3])
    expect(match('q=NOISE')).toEqual([4, 5])
    expect(match('q=stanley')).toEqual([1, 2, 3])
    expect(match('q=ch4')).toEqual([2, 6])
    expect(match('q=hydrogen')).toEqual([1, 4])
    expect(match('q=%234')).toEqual([4])
    expect(match('q=no-such-text')).toEqual([])
  })

  it("finds '#N' as that operating point only, not every id starting with N", () => {
    const many: RdeDataset = { ...data, operating_points: [point(1, 1), point(12, 1), point(120, 1)] }
    expect(ids(filterRde(many, filters('q=%2312')))).toEqual([12])
    expect(ids(filterRde(many, filters('q=%231')))).toEqual([1])
  })

  it('matches the subscripted names the page shows', () => {
    expect(match('q=O%E2%82%82-enriched')).toEqual([6])
    expect(match('q=o%E2%82%82')).toEqual(match('q=o2'))
  })

  it('needs every search term to match', () => {
    expect(match('q=smith%20ch4')).toEqual([2])
    expect(match('q=bykovskii%20hydrogen')).toEqual([4])
    expect(match('q=kang%20h2')).toEqual([])
  })

  it('matches any ticked value within a facet and every facet across', () => {
    expect(match('fuel=H2')).toEqual([1, 3, 4])
    expect(match('fuel=H2,CH4')).toEqual([1, 2, 3, 4, 6])
    expect(match('fuel=H2&oxidizer=Air')).toEqual([4])
    expect(match('engine=AB')).toEqual([4, 5])
    expect(match('engine=R,AAB&fuel=CH4')).toEqual([2, 6])
    expect(match('publication=2')).toEqual([4, 5])
    expect(match('op_type=transient_blowdown')).toEqual([3])
    expect(match('combustor=unspecified')).toEqual([5])
  })

  it('selects points without a wave count with the "none" value', () => {
    expect(match('waves=none')).toEqual([3, 6])
    expect(match('waves=1')).toEqual([2, 4])
    expect(match('waves=1,none')).toEqual([2, 3, 4, 6])
  })

  it('needs every ticked measurement to be present', () => {
    expect(match('has=wave_speed')).toEqual([1, 2, 4])
    expect(match('has=thrust')).toEqual([1, 3])
    expect(match('has=wave_speed,thrust')).toEqual([1])
    expect(match('has=chamber_pressure')).toEqual([1])
    expect(match('has=pressure_gain')).toEqual([4])
    expect(match('has=isp,frequency')).toEqual([])
  })

  it('applies inclusive ranges and drops points without the value', () => {
    expect(match('equivalence_ratio_min=1')).toEqual([1, 3, 6])
    expect(match('equivalence_ratio_max=0.9')).toEqual([2, 5])
    expect(match('equivalence_ratio_min=0.8&equivalence_ratio_max=1')).toEqual([1, 2, 5, 6])
    expect(match('mdot_total_min=1')).toEqual([4, 6])
    expect(match('chamber_od_max=100')).toEqual([1, 2])
  })

  it('can leave one facet out, for counting its options', () => {
    const f = filters('fuel=CH4&engine=R')
    const p3 = data.operating_points[2]
    expect(matchesRde(p3, f, pubs)).toBe(false)
    expect(matchesRde(p3, f, pubs, 'fuel')).toBe(true)
    expect(matchesRde(p3, f, pubs, 'engine')).toBe(false)
  })
})

describe('facetOptions', () => {
  it('lists a selected value the data lacks, so it can be unticked', () => {
    const fuel = options('fuel', 'fuel=C2H2')
    expect(fuel).toContainEqual({ value: 'C2H2', label: 'C2H2', count: 0 })
    expect(match('fuel=C2H2')).toEqual([])
  })

  it('reads a repeated value once', () => {
    expect(filters('fuel=H2,H2,CH4').lists.fuel).toEqual(['H2', 'CH4'])
    expect(filters('has=thrust,thrust,unknown').has).toEqual(['thrust'])
  })

  it('counts each value, most common first', () => {
    expect(options('fuel')).toEqual([
      { value: 'H2', label: 'H2', count: 3 },
      { value: 'CH4', label: 'CH4', count: 2 },
      { value: 'C2H4', label: 'C2H4', count: 1 },
    ])
  })

  it('counts under the other filters, not the facet itself', () => {
    expect(options('fuel', 'fuel=H2&engine=R')).toEqual([
      { value: 'H2', label: 'H2', count: 2 },
      { value: 'CH4', label: 'CH4', count: 1 },
      { value: 'C2H4', label: 'C2H4', count: 0 },
    ])
    expect(options('engine', 'fuel=H2&engine=R')).toEqual([
      { value: 'R', label: 'Rocket', count: 2 },
      { value: 'AB', label: 'Air-breathing', count: 1 },
      { value: 'AAB', label: 'O₂-augmented air-breathing', count: 0 },
    ])
  })

  it('keeps a selected value listed at a count of zero', () => {
    const fuel = options('fuel', 'fuel=C2H4&engine=R')
    expect(fuel.find(o => o.value === 'C2H4')).toEqual({ value: 'C2H4', label: 'C2H4', count: 0 })
  })

  it('lists wave counts in numeric order, then "not reported"', () => {
    expect(options('waves')).toEqual([
      { value: '1', label: '1', count: 2 },
      { value: '2', label: '2', count: 1 },
      { value: '12', label: '12', count: 1 },
      { value: NOT_REPORTED, label: 'No value in the release', count: 2 },
    ])
  })

  it('lists publications by year', () => {
    expect(options('publication').map(o => [o.value, o.label, o.count])).toEqual([
      ['2', 'Bykovskii (2006)', 2],
      ['1', 'Smith (2021)', 3],
      ['3', 'Kang (2024)', 1],
    ])
  })

  it('shows readable labels for coded values', () => {
    expect(options('oxidizer').map(o => o.label)).toEqual(['O₂', 'Air', 'O₂-enriched air'])
    expect(options('combustor').map(o => [o.value, o.label])).toEqual([
      ['axial_annular', 'Annular'],
      ['axial_cylindrical', 'Hollow (cylindrical)'],
      ['unspecified', 'Not stated'],
    ])
  })
})

describe('measureOptions', () => {
  const counts = (qs: string) => Object.fromEntries(measureOptions(data, filters(qs)).map(o => [o.value, o.count]))

  it('counts points with each measurement', () => {
    expect(counts('')).toEqual({
      wave_count: 4, secondary_waves: 0, wave_speed: 3, frequency: 1, thrust: 2, isp: 2, chamber_pressure: 1, pressure_gain: 1,
    })
  })

  it('counts each measurement together with the other ticked ones', () => {
    expect(counts('has=thrust')).toEqual({
      wave_count: 1, secondary_waves: 0, wave_speed: 1, frequency: 0, thrust: 2, isp: 1, chamber_pressure: 1, pressure_gain: 0,
    })
  })

  it('applies the other filters', () => {
    expect(counts('fuel=H2&has=thrust').thrust).toBe(2)
    expect(counts('fuel=H2&has=thrust').wave_count).toBe(1)
    expect(counts('engine=AB').wave_speed).toBe(1)
  })

  it('keeps the labels', () => {
    expect(measureOptions(data, filters('')).map(o => o.label)).toContain('Specific impulse')
  })
})

describe('sortRde', () => {
  const points = data.operating_points
  const sorted = (by: string | null, dir: string | null) => ids(sortRde(points, pubs, by, dir))

  it('sorts by publication year, then paper, then the point order in its paper', () => {
    expect(sorted('publication', 'asc')).toEqual([4, 5, 1, 2, 3, 6])
    expect(sorted(null, null)).toEqual([4, 5, 1, 2, 3, 6])
    expect(sorted('publication', 'desc')).toEqual([6, 3, 2, 1, 5, 4])
  })

  it('falls back to publication order for an unknown key', () => {
    expect(sorted('fuel', 'asc')).toEqual([4, 5, 1, 2, 3, 6])
    expect(sorted('wave_speed', null)).toEqual([4, 5, 1, 2, 3, 6])
  })

  it('sorts numbers ascending with missing values last', () => {
    expect(sorted('wave_speed_m_s', 'asc')).toEqual([1, 4, 2, 5, 3, 6])
  })

  it('sorts numbers descending with missing values still last', () => {
    expect(sorted('wave_speed_m_s', 'desc')).toEqual([2, 4, 1, 5, 3, 6])
  })

  it('breaks ties by publication order in both directions', () => {
    expect(sorted('chamber_outer_diameter_mm', 'asc')).toEqual([1, 2, 6, 4, 5, 3])
    expect(sorted('chamber_outer_diameter_mm', 'desc')).toEqual([4, 5, 6, 1, 2, 3])
  })

  it('treats zero and negative values as values', () => {
    const gains = [point(10, 1), point(11, 1, { pressure_gain_percent: 0 }), point(12, 1, { pressure_gain_percent: -12.9 })]
    expect(ids(sortRde(gains, pubs, 'pressure_gain_percent', 'asc'))).toEqual([12, 11, 10])
    expect(ids(sortRde(gains, pubs, 'pressure_gain_percent', 'desc'))).toEqual([11, 12, 10])
  })

  it('leaves the input array untouched', () => {
    const before = ids(points)
    sortRde(points, pubs, 'wave_speed_m_s', 'desc')
    expect(ids(points)).toEqual(before)
  })
})

describe('countRdeFilters and clearRdeFilters', () => {
  const qs = 'q=smith&fuel=H2,CH4&waves=none&has=thrust,bogus&equivalence_ratio_min=0.8&equivalence_ratio_max=1'
    + '&chamber_od_min=50&view=plot&sort_by=wave_speed_m_s&sort_dir=desc&x=equivalence_ratio&y=wave_speed_m_s'
    + '&limit=50&offset=50'

  it('counts each search, ticked value and bound', () => {
    expect(countRdeFilters(new URLSearchParams(qs))).toBe(8)
    expect(countRdeFilters(new URLSearchParams(''))).toBe(0)
    expect(countRdeFilters(new URLSearchParams('q=%20&view=plot&sort_by=thrust_n'))).toBe(0)
  })

  it('removes every filter and the page offset, and keeps view, sort, plot axes and page size', () => {
    const next = clearRdeFilters(new URLSearchParams(qs))
    expect(Object.fromEntries(next)).toEqual({
      view: 'plot', sort_by: 'wave_speed_m_s', sort_dir: 'desc', x: 'equivalence_ratio', y: 'wave_speed_m_s', limit: '50',
    })
    expect(countRdeFilters(next)).toBe(0)
  })

  it('leaves its input untouched', () => {
    const params = new URLSearchParams(qs)
    clearRdeFilters(params)
    expect(params.toString()).toBe(new URLSearchParams(qs).toString())
  })
})

describe('rdeCsv', () => {
  const lines = (csv: string) => csv.trimEnd().split('\n')
  const row = (line: string) => Object.fromEntries(line.split(',').map((v, i) => [RDE_CSV_COLUMNS[i], v]))

  it('writes the download columns as its header', () => {
    expect(lines(rdeCsv([], pubs, null))).toEqual([RDE_CSV_COLUMNS.join(',')])
    expect(new Set(RDE_CSV_COLUMNS).size).toBe(RDE_CSV_COLUMNS.length)
  })

  it('names the publication and its DOI on every row, and leaves missing values empty', () => {
    const csv = rdeCsv([data.operating_points[0], data.operating_points[5]], pubs, RELEASE)
    expect(csv.endsWith('\n')).toBe(true)
    const [, first, second] = lines(csv)
    expect(row(first)).toMatchObject({
      id: '1', publication_id: '1', publication: 'Smith (2021)', doi: '10.2514/1.b37959', release_version: '1.0.0',
      fuel: 'H2', fuel_reported: 'Hydrogen', wave_count: '2', thrust_n: '1200', pressure_gain_percent: '',
      frequency_khz: '', wave_count_method: '', sequence_index: '1',
    })
    expect(row(second)).toMatchObject({ id: '6', publication: 'Kang (2024)', doi: '', wave_count: '', specific_impulse_s: '1500' })
    expect(first.split(',')).toHaveLength(RDE_CSV_COLUMNS.length)
  })

  it("joins a point's chamber pressures with ';' and never dumps the objects", () => {
    const withTwo = point(8, 1, { chamber_pressures: [{ id: 1, pressure_kpa: 432.301282281656 }, { id: 2 }, { id: 3, pressure_kpa: 120 }] })
    const csv = rdeCsv([data.operating_points[0], withTwo, data.operating_points[1]], pubs, RELEASE)
    expect(csv).not.toContain('[object Object]')
    const [, first, second, third] = lines(csv)
    expect(row(first).chamber_pressures_kpa).toBe('250')
    expect(row(second).chamber_pressures_kpa).toBe('432.301282281656;120')
    expect(row(third).chamber_pressures_kpa).toBe('')
  })

  it('quotes values with commas and quotes', () => {
    const odd = new Map([[9, pub(9, { label: 'Smith, "Jr." (2021)', doi: '10.1/x' })]])
    const csv = rdeCsv([point(9, 9, { diluent: 'C2H2 and O2 (optical tracers, unquantified)' })], odd, null)
    const [, line] = lines(csv)
    expect(line.startsWith('9,9,"Smith, ""Jr."" (2021)",10.1/x,,')).toBe(true)
    expect(line).toContain(',"C2H2 and O2 (optical tracers, unquantified)",')
  })

  it('leaves the publication empty when the paper is unknown', () => {
    const [, line] = lines(rdeCsv([point(7, 99)], pubs, null))
    expect(row(line)).toMatchObject({ id: '7', publication_id: '99', publication: '', doi: '' })
  })
})
