import { describe, expect, it } from 'vitest'
import type { RdeOperatingPoint, RdePublication } from '../../types/rde'
import { NO_VALUE } from '../../lib/rdeFields'
import {
  ENGINE_COLORS,
  MISSING_COLOR,
  RDE_PALETTE,
  RDE_PLOT_DEFAULT,
  RDE_PLOT_PRESETS,
  activePreset,
  axisLayout,
  axisNotes,
  buildPlotData,
  buildTraces,
  exclusionReasons,
  groupPoints,
  hoverText,
  linearWhereDropped,
  plotSummary,
  rdePalette,
  readPlotState,
  swapAxes,
  valueCounts,
  withAxis,
  writePlotState,
  type RdePlotState,
} from './rdePlotModel'

function point(id: number, over: Partial<RdeOperatingPoint> = {}): RdeOperatingPoint {
  return {
    id,
    publication_id: 1,
    test_run_id: id,
    operating_point_type: 'steady',
    engine_code: 'AB',
    fuel: 'H2',
    oxidizer: 'Air',
    ...over,
  }
}

function pub(id: number, year: number, label: string): RdePublication {
  return { id, label, title: label, year, engine_code: 'AB', operating_points: 0 }
}

const pubs = new Map([
  [1, pub(1, 2021, 'Smith (2021)')],
  [2, pub(2, 2006, 'Bykovskii (2006)')],
  [3, pub(3, 2016, 'Anand (2016)')],
])

const state = (over: Partial<RdePlotState> = {}): RdePlotState => ({ ...RDE_PLOT_DEFAULT, ...over })

describe('URL state', () => {
  it('falls back to the defaults for missing or unknown values', () => {
    expect(readPlotState(new URLSearchParams('x=nope&color=colour'))).toEqual(RDE_PLOT_DEFAULT)
  })

  it('round-trips and keeps the other params', () => {
    const s = state({ x: 'thrust_n', y: 'wave_count', color: 'publication', logx: true })
    const next = writePlotState(new URLSearchParams('view=plot&fuel=H2&logy=1'), s)
    expect(next.get('view')).toBe('plot')
    expect(next.get('fuel')).toBe('H2')
    expect(next.get('logy')).toBeNull()
    expect(readPlotState(next)).toEqual(s)
  })

  it('leaves defaults out of the URL', () => {
    expect(writePlotState(new URLSearchParams('x=thrust_n&logx=1'), RDE_PLOT_DEFAULT).toString()).toBe('')
  })

  it('takes the log default of a newly picked field and swaps scales with the axes', () => {
    const s = withAxis(state(), 'x', 'mdot_total_kg_s')
    expect(s.logx).toBe(true)
    expect(withAxis(s, 'x', 'equivalence_ratio').logx).toBe(false)
    expect(swapAxes(s)).toMatchObject({ x: 'wave_speed_m_s', y: 'mdot_total_kg_s', logx: false, logy: true })
  })
})

describe('presets', () => {
  it('matches only an exact state', () => {
    const preset = RDE_PLOT_PRESETS.find(p => p.id === 'thrust-mdot')!
    expect(activePreset({ ...preset.state })).toBe(preset)
    expect(activePreset({ ...preset.state, logy: false })).toBeUndefined()
    expect(activePreset(RDE_PLOT_DEFAULT)).toBeUndefined()
  })

  it('colours every Isp preset by engine class', () => {
    const isp = RDE_PLOT_PRESETS.filter(p => p.state.x === 'specific_impulse_s' || p.state.y === 'specific_impulse_s')
    expect(isp.length).toBeGreaterThan(0)
    for (const p of isp) expect(p.state.color).toBe('engine')
  })
})

describe('colour groups', () => {
  it('orders engine classes R, AB, AAB with fixed colours', () => {
    const pts = [point(1, { engine_code: 'AAB' }), point(2, { engine_code: 'AB' }), point(3, { engine_code: 'R' })]
    const groups = groupPoints(pts, pubs, 'engine', pts)
    expect(groups.map(g => g.key)).toEqual(['R', 'AB', 'AAB'])
    expect(groups.map(g => g.color)).toEqual([ENGINE_COLORS.R, ENGINE_COLORS.AB, ENGINE_COLORS.AAB])
    expect(groups[2].name).toBe('O₂-augmented air-breathing')
  })

  it('orders wave counts numerically with no value last, in grey', () => {
    const pts = [point(1), point(2, { wave_count: 10 }), point(3, { wave_count: 2 }), point(4, { wave_count: 1 })]
    const groups = groupPoints(pts, pubs, 'waves', pts)
    expect(groups.map(g => g.name)).toEqual(['1', '2', '10', NO_VALUE])
    expect(groups[3].color).toBe(MISSING_COLOR)
    expect(groups.slice(0, 3).map(g => g.color)).toEqual(RDE_PALETTE.slice(0, 3))
  })

  it('groups waves by the primary count and gives the mode on hover', () => {
    const pts = [point(1, { wave_count: 1, wave_speed_m_s: 1500 }), point(2, { wave_count: 1, secondary_wave_count: 1, wave_speed_m_s: 1400 })]
    const groups = groupPoints(pts, pubs, 'waves', pts)
    expect(groups.map(g => [g.name, g.points.length])).toEqual([['1', 2]])
    const s = state({ y: 'wave_count' })
    expect(hoverText(pts[1], pubs, s)).toContain('<br>Waves: 1 + 1<br>')
    expect(hoverText(pts[1], pubs, state())).toContain('<br>Waves: 1 + 1<br>')
    expect(hoverText(pts[0], pubs, s)).toContain('<br>Waves: 1<br>')
  })

  it('orders publications by year and fuels by count', () => {
    const pts = [
      point(1, { publication_id: 1, fuel: 'CH4' }),
      point(2, { publication_id: 3, fuel: 'H2' }),
      point(3, { publication_id: 2, fuel: 'H2' }),
    ]
    expect(groupPoints(pts, pubs, 'publication', pts).map(g => g.name)).toEqual(['Bykovskii (2006)', 'Anand (2016)', 'Smith (2021)'])
    expect(groupPoints(pts, pubs, 'fuel', pts).map(g => g.key)).toEqual(['H2', 'CH4'])
  })

  it('writes O₂ in oxidizer names', () => {
    const pts = [point(1, { oxidizer: 'O2-enriched air' })]
    expect(groupPoints(pts, pubs, 'oxidizer', pts)[0].name).toBe('O₂-enriched air')
  })

  it('groups by mixture, which the fuel alone does not separate', () => {
    const pts = [
      point(1, { fuel: 'C2H4', oxidizer: 'Air' }),
      point(2, { fuel: 'C2H4', oxidizer: 'O2' }),
      point(3, { fuel: 'H2', oxidizer: 'Air' }),
      point(4, { fuel: 'H2', oxidizer: 'Air' }),
    ]
    expect(groupPoints(pts, pubs, 'fuel', pts).map(g => g.name)).toEqual(['C2H4', 'H2'])
    const mixtures = groupPoints(pts, pubs, 'mixture', pts)
    expect(mixtures.map(g => [g.name, g.points.length])).toEqual([['H2 / Air', 2], ['C2H4 / Air', 1], ['C2H4 / O₂', 1]])
    expect(new Set(mixtures.map(g => g.color)).size).toBe(3)
  })

  it('colours the wave speed and frequency presets by mixture', () => {
    for (const id of ['wave-speed-phi', 'frequency-diameter']) {
      expect(RDE_PLOT_PRESETS.find(p => p.id === id)?.state.color).toBe('mixture')
    }
  })

  it('keeps a group\'s colour whatever the filters leave', () => {
    const many = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, pub(i + 1, 2000 + i, `Author${i + 1} (${2000 + i})`)]))
    const all = Array.from({ length: 10 }, (_, i) => point(i + 1, { publication_id: i + 1, fuel: i < 6 ? 'H2' : 'CH4' }))
    const colourOf = (groups: ReturnType<typeof groupPoints>, key: string) => groups.find(g => g.key === key)?.color
    const full = groupPoints(all, many, 'publication', all)
    const filtered = groupPoints(all.filter(p => p.publication_id === 9), many, 'publication', all)
    expect(filtered).toHaveLength(1)
    expect(colourOf(filtered, '9')).toBe(colourOf(full, '9'))
    // Ranked over the whole publication map, not the points: the same with no points at all.
    expect(colourOf(groupPoints(all.slice(8, 9), many, 'publication', []), '9')).toBe(colourOf(full, '9'))
    const ch4 = groupPoints(all.filter(p => p.fuel === 'CH4'), many, 'fuel', all)
    expect(colourOf(ch4, 'CH4')).toBe(colourOf(groupPoints(all, many, 'fuel', all), 'CH4'))
    expect(colourOf(ch4, 'CH4')).toBe(RDE_PALETTE[1])
  })

  it('never gives the missing grey to a group with a value, and changes shape once the palette repeats', () => {
    const many = Array.from({ length: 10 }, (_, i) => point(i + 1, { fuel: `F${i}` }))
    const groups = groupPoints(many, pubs, 'fuel', many)
    expect(groups.some(g => g.color === MISSING_COLOR)).toBe(false)
    expect(RDE_PALETTE).toHaveLength(7)
    expect(RDE_PALETTE).not.toContain(MISSING_COLOR)
    expect(groups.slice(0, 7).every(g => g.symbol === 'circle')).toBe(true)
    expect(groups[7]).toMatchObject({ color: groups[0].color, symbol: 'square' })
  })

  it('puts the theme accent first in the palette', () => {
    const pts = [point(1)]
    expect(groupPoints(pts, pubs, 'fuel', pts, rdePalette('#7fbff0'))[0].color).toBe('#7fbff0')
    expect(rdePalette()).toEqual(RDE_PALETTE)
  })
})

describe('what is plotted', () => {
  const pts = [
    point(1, { equivalence_ratio: 1, wave_speed_m_s: 1500 }),
    point(2, { equivalence_ratio: 0.8 }),
    point(3, { wave_speed_m_s: 1200 }),
    point(4),
    point(5, { equivalence_ratio: 1.1, wave_speed_m_s: 1400, operating_point_type: 'transient_blowdown' }),
  ]

  it('leaves out points missing either value and says which', () => {
    const d = buildPlotData(pts, pubs, state(), pts)
    expect(d).toMatchObject({ total: 5, plotted: 2, noX: 1, noY: 1, noBoth: 1, notSteady: 1 })
    expect(exclusionReasons(d, state())).toEqual(['1 with no wave speed', '1 with no global equivalence ratio', '1 with neither'])
    expect(plotSummary(d, state())).toBe(
      'Plotting 2 of 5 operating points. Not plotted: 1 with no wave speed, 1 with no global equivalence ratio, 1 with neither.',
    )
  })

  it('treats a missing value as missing, not zero', () => {
    const pts = [point(1, { thrust_n: 0, mdot_total_kg_s: 1 }), point(2, { mdot_total_kg_s: 2 })]
    const d = buildPlotData(pts, pubs, state({ x: 'mdot_total_kg_s', y: 'thrust_n' }), pts)
    expect(d.plotted).toBe(1)
    expect(d.noY).toBe(1)
  })

  it('drops non-positive values on a log axis only', () => {
    const neg = [point(1, { mdot_total_kg_s: 1, pressure_gain_percent: -20 }), point(2, { mdot_total_kg_s: 2, pressure_gain_percent: -10 })]
    const linear = state({ x: 'mdot_total_kg_s', y: 'pressure_gain_percent' })
    expect(buildPlotData(neg, pubs, linear, neg).plotted).toBe(2)
    const log = { ...linear, logy: true }
    const d = buildPlotData(neg, pubs, log, neg)
    expect(d.plotted).toBe(0)
    expect(d.nonPositiveY).toBe(2)
    expect(exclusionReasons(d, log)).toEqual(['2 with stagnation pressure gain ≤ 0, which the log y axis cannot show'])
    expect(plotSummary(d, log)).toBe(
      'Nothing to plot: none of the 2 operating points can be drawn with these axes: 2 with stagnation pressure gain ≤ 0, which the log y axis cannot show.',
    )
  })

  it('counts a point not positive on both log axes against both', () => {
    const pts = [
      point(1, { pressure_gain_percent: -5, specific_impulse_s: 0 }),
      point(2, { pressure_gain_percent: -5, specific_impulse_s: 100 }),
      point(3, { pressure_gain_percent: 5, specific_impulse_s: 100 }),
    ]
    const s = state({ x: 'pressure_gain_percent', y: 'specific_impulse_s', logx: true, logy: true })
    const d = buildPlotData(pts, pubs, s, pts)
    expect(d).toMatchObject({ plotted: 1, nonPositiveX: 2, nonPositiveY: 1 })
    expect(exclusionReasons(d, s)).toEqual([
      '2 with stagnation pressure gain ≤ 0, which the log x axis cannot show',
      '1 with specific impulse ≤ 0, which the log y axis cannot show',
    ])
    // One click makes every axis that drops points linear.
    expect(linearWhereDropped(s, d)).toMatchObject({ logx: false, logy: false })
    const onlyY = buildPlotData(pts.slice(0, 1), pubs, { ...s, logx: false }, pts)
    expect(linearWhereDropped({ ...s, logx: false }, onlyY)).toMatchObject({ logx: false, logy: false })
    const onlyX = buildPlotData(pts.slice(1), pubs, s, pts)
    expect(linearWhereDropped(s, onlyX)).toMatchObject({ logx: false, logy: true })
  })

  it('gives one clause when the same field is on both log axes', () => {
    const pts = [point(1, { pressure_gain_percent: -5 }), point(2, { pressure_gain_percent: 5 })]
    const s = state({ x: 'pressure_gain_percent', y: 'pressure_gain_percent', logx: true, logy: true })
    const d = buildPlotData(pts, pubs, s, pts)
    expect(d).toMatchObject({ plotted: 1, nonPositiveX: 1, nonPositiveY: 1 })
    expect(exclusionReasons(d, s)).toEqual(['1 with stagnation pressure gain ≤ 0, which the log axes cannot show'])
  })

  it('builds one trace per group with ids and formatted hover text', () => {
    const d = buildPlotData(pts, pubs, state(), pts)
    const traces = buildTraces(d, pubs, state(), '#ffffff')
    expect(traces).toHaveLength(1)
    expect(traces[0].customdata).toEqual([1, 5])
    expect(traces[0].x).toEqual([1, 1.1])
    expect(traces[0].marker.color).toBe(ENGINE_COLORS.AB)
    expect(traces[0].marker.line.color).toBe('#ffffff')
    expect(traces[0].text[0]).toBe('Smith (2021) · #1<br>H2 / Air · Air-breathing<br>φ: 1<br>Wave speed: 1,500 m/s<br>Operating point: Steady')
  })

  it('counts values per field', () => {
    const counts = valueCounts(pts)
    expect(counts.get('equivalence_ratio')).toBe(3)
    expect(counts.get('thrust_n')).toBe(0)
  })
})

describe('axes and notes', () => {
  it('uses whole-number ticks for wave counts on a linear axis', () => {
    expect(axisLayout('wave_count', false)).toMatchObject({ type: 'linear', dtick: 1, title: { text: 'Number of waves (primary direction)' } })
    expect(axisLayout('wave_count', true)).not.toHaveProperty('dtick')
    expect(axisLayout('wave_speed_m_s', false).title.text).toBe('Wave speed (m/s)')
  })

  it('emphasises the specific impulse note', () => {
    const notes = axisNotes(state({ x: 'mass_flux_throat_kg_m2_s', y: 'specific_impulse_s' }))
    expect(notes.map(n => [n.key, n.emphasis])).toEqual([['mass_flux_throat_kg_m2_s', false], ['specific_impulse_s', true]])
  })
})
