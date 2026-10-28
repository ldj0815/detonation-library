import { describe, expect, it } from 'vitest'
import type { CaseDetail } from '../../types/case'
import { HIDDEN_MEASUREMENTS } from '../../config'
import {
  CASE_AXES,
  CASE_PALETTE,
  CASE_PLOT_DEFAULT,
  MARKER_SYMBOLS,
  MISSING_COLOR,
  MISSING_SYMBOL,
  axisLayout,
  traceUid,
  axisRange,
  buildLayout,
  buildPlotData,
  buildTraces,
  casePalette,
  exclusionReasons,
  groupCases,
  hasErrorBars,
  hoverText,
  isCaseAxisKey,
  linearWhereDropped,
  plotSummary,
  readPlotState,
  referenceName,
  swapAxes,
  valueCounts,
  withAxis,
  writePlotState,
  type CasePlotState,
  type CaseSeries,
} from './casePlotModel'

function make(id: number, over: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id,
    title: `t${id} [3, Akbar (1997)]`,
    setup: 'detonation',
    geometry: 'not stated',
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
    cell_width_mm: 10,
    cell_width_uncertainty_mm: null,
    cell_length_mm: null,
    cell_length_uncertainty_mm: null,
    critical_hydraulic_diameter_mm: null,
    minimum_hydraulic_diameter_mm: null,
    critical_energy_j: null,
    tube_radius_mm: null,
    chamber_width_mm: null,
    chamber_height_mm: null,
    contributor_name: 'GALCIT',
    contributor_institution: 'Caltech',
    contributor_email: '',
    doi_reference: null,
    sharing_link: null,
    notes: null,
    created_at: '2026-04-08T06:30:50Z',
    ...over,
  }
}

const state = (over: Partial<CasePlotState> = {}): CasePlotState => ({ ...CASE_PLOT_DEFAULT, ...over })
const colourOf = (series: CaseSeries[], name: string) => series.find(g => g.name === name)?.color

describe('URL state', () => {
  it('defaults to cell width against pressure, coloured by fuel, on log axes', () => {
    expect(readPlotState(new URLSearchParams())).toEqual({
      x: 'initial_pressure_kpa',
      y: 'cell_width_mm',
      color: 'fuel',
      shape: '',
      logx: true,
      logy: true,
      xmin: '',
      xmax: '',
      ymin: '',
      ymax: '',
    })
  })

  it('falls back to the defaults for unknown values', () => {
    expect(readPlotState(new URLSearchParams('x=nope&y=&color=colour&shape=size&xmin=abc&ymax=1e'))).toEqual(CASE_PLOT_DEFAULT)
  })

  it('rejects hidden measurements as axes', () => {
    for (const key of HIDDEN_MEASUREMENTS) {
      expect(isCaseAxisKey(key)).toBe(false)
      expect(CASE_AXES.some(a => a.key === key)).toBe(false)
      const s = readPlotState(new URLSearchParams({ x: key, y: key }))
      expect([s.x, s.y]).toEqual([CASE_PLOT_DEFAULT.x, CASE_PLOT_DEFAULT.y])
    }
  })

  it('round-trips and keeps the other params', () => {
    const s = state({
      x: 'equivalence_ratio',
      y: 'cell_length_mm',
      color: 'publication',
      shape: 'primary_diluent_name',
      logx: false,
      xmin: '0.5',
      ymax: '200',
    })
    const next = writePlotState(new URLSearchParams('view=plot&fuel=H2,C2H2&ref=27, Bull (1982)&sort_by=fuel'), s)
    expect(next.get('view')).toBe('plot')
    expect(next.get('fuel')).toBe('H2,C2H2')
    expect(next.get('ref')).toBe('27, Bull (1982)')
    expect(next.get('sort_by')).toBe('fuel')
    expect(readPlotState(next)).toEqual(s)
  })

  it('leaves defaults out of the URL', () => {
    const full = new URLSearchParams('x=equivalence_ratio&y=cell_length_mm&color=oxidizer&shape=fuel&logx=0&logy=0&xmin=1&xmax=2&ymin=3&ymax=4')
    expect(writePlotState(full, CASE_PLOT_DEFAULT).toString()).toBe('')
    expect(writePlotState(new URLSearchParams('view=plot'), CASE_PLOT_DEFAULT).toString()).toBe('view=plot')
  })

  it('writes a linear axis as 0 and leaves a log axis out', () => {
    const linear = writePlotState(new URLSearchParams(), state({ logx: false, logy: false }))
    expect(linear.get('logx')).toBe('0')
    expect(linear.get('logy')).toBe('0')
    expect(readPlotState(linear)).toMatchObject({ logx: false, logy: false })
    const onlyX = writePlotState(linear, state({ logy: false }))
    expect(onlyX.has('logx')).toBe(false)
    expect(onlyX.get('logy')).toBe('0')
    expect(readPlotState(new URLSearchParams('logx=1&logy=yes'))).toMatchObject({ logx: true, logy: true })
  })

  it('writes no colour as none, since an empty colour is the default', () => {
    const next = writePlotState(new URLSearchParams(), state({ color: '' }))
    expect(next.get('color')).toBe('none')
    expect(readPlotState(next).color).toBe('')
    expect(readPlotState(new URLSearchParams('color=')).color).toBe('')
    expect(readPlotState(new URLSearchParams('shape=none')).shape).toBe('')
  })

  it('drops an axis range when its field changes and swaps ranges with the axes', () => {
    const s = state({ xmin: '10', xmax: '100', ymin: '1' })
    expect(withAxis(s, 'x', 'initial_pressure_kpa')).toBe(s)
    expect(withAxis(s, 'x', 'equivalence_ratio')).toMatchObject({ x: 'equivalence_ratio', xmin: '', xmax: '', ymin: '1' })
    expect(withAxis(s, 'y', 'cell_length_mm')).toMatchObject({ y: 'cell_length_mm', xmin: '10', ymin: '' })
    expect(swapAxes(state({ logx: false, xmin: '10' }))).toMatchObject({
      x: 'cell_width_mm', y: 'initial_pressure_kpa', logx: true, logy: false, xmin: '', ymin: '10',
    })
  })
})

describe('colour and shape groups', () => {
  const all = [
    make(1, { fuel: 'H2' }),
    make(2, { fuel: 'H2' }),
    make(3, { fuel: 'H2' }),
    make(4, { fuel: 'C2H2' }),
    make(5, { fuel: 'C2H2' }),
    make(6, { fuel: 'CH4' }),
  ]

  it('ranks fuels by how many cases the category has', () => {
    const series = groupCases(all, state(), all)
    expect(series.map(g => g.name)).toEqual(['H2', 'C2H2', 'CH4'])
    expect(series.map(g => g.color)).toEqual(CASE_PALETTE.slice(0, 3))
  })

  it('keeps a group\'s colour whatever the filters leave', () => {
    const full = groupCases(all, state(), all)
    const onlyCh4 = groupCases(all.filter(c => c.fuel === 'CH4'), state(), all)
    expect(onlyCh4).toHaveLength(1)
    expect(colourOf(onlyCh4, 'CH4')).toBe(colourOf(full, 'CH4'))
    expect(colourOf(onlyCh4, 'CH4')).toBe(CASE_PALETTE[2])
    // Through buildPlotData too, where the axes drop cases as well.
    const d = buildPlotData([make(7, { fuel: 'CH4' }), make(8, { fuel: 'H2', cell_width_mm: null })], state(), all)
    expect(d.series.map(g => [g.name, g.color])).toEqual([['CH4', CASE_PALETTE[2]]])
  })

  it('gives a group the category does not have a place after the ranked ones', () => {
    const series = groupCases([make(9, { fuel: 'NH3' }), make(1)], state(), all)
    expect(series.map(g => [g.name, g.color])).toEqual([['H2', CASE_PALETTE[0]], ['NH3', CASE_PALETTE[3]]])
  })

  it('greys only the cases with no value, and lists them last', () => {
    const items = [make(1), make(2, { primary_diluent_name: 'Ar' }), make(3, { primary_diluent_name: 'N2' }), make(4, { primary_diluent_name: 'Ar' })]
    const series = groupCases(items, state({ color: 'primary_diluent_name' }), items)
    expect(series.map(g => g.name)).toEqual(['Ar', 'N2', 'No diluent'])
    expect(series.map(g => g.color)).toEqual([CASE_PALETTE[0], CASE_PALETTE[1], MISSING_COLOR])
    expect(CASE_PALETTE).toHaveLength(7)
    expect(CASE_PALETTE).not.toContain(MISSING_COLOR)
  })

  it('changes marker shape once the palette repeats', () => {
    const many = Array.from({ length: 10 }, (_, i) => make(i + 1, { fuel: `F${i}` }))
    const series = groupCases(many, state(), many)
    expect(series.some(g => g.color === MISSING_COLOR)).toBe(false)
    expect(series.slice(0, 7).every(g => g.symbol === 'circle')).toBe(true)
    expect(series[7]).toMatchObject({ color: series[0].color, symbol: 'square' })
  })

  it('puts the theme accent first in the palette', () => {
    expect(groupCases([make(1)], state(), [make(1)], casePalette('#7fbff0'))[0].color).toBe('#7fbff0')
    expect(casePalette()).toEqual(CASE_PALETTE)
  })

  it('keeps two papers with the same label apart, by year, with their GALCIT numbers', () => {
    const items = [
      make(1, { title: 'a [27, Bull (1982)]' }),
      make(2, { title: 'b [22, Bull (1982)]' }),
      make(3, { title: 'c [108, Strehlow (1969)]' }),
      make(4, { title: 'd [39, EDL (unpublished)]' }),
      make(5, { title: 'contributed', doi_reference: '10.1016/j.combustflame.2020.01.001' }),
      make(6, { title: 'no reference' }),
    ]
    const series = groupCases(items, state({ color: 'publication' }), items)
    expect(series.map(g => g.name)).toEqual([
      'Strehlow (1969), ref. 108',
      'Bull (1982), ref. 22',
      'Bull (1982), ref. 27',
      '10.1016/j.combustflame.2020.01.001',
      'EDL (unpublished), ref. 39',
      'No reference',
    ])
    expect(series.at(-1)).toMatchObject({ color: MISSING_COLOR })
    expect(new Set(series.slice(0, -1).map(g => g.color)).size).toBe(series.length - 1)
    expect(referenceName('10.1016/x')).toBe('10.1016/x')
  })

  it('shapes by a second grouping, ranked over the category, with no value open', () => {
    const items = [
      make(1, { fuel: 'H2', primary_diluent_name: 'Ar' }),
      make(2, { fuel: 'H2', primary_diluent_name: 'N2' }),
      make(3, { fuel: 'H2' }),
      make(4, { fuel: 'C2H2', primary_diluent_name: 'Ar' }),
      make(5, { fuel: 'C2H2', primary_diluent_name: 'Ar' }),
    ]
    const s = state({ shape: 'primary_diluent_name' })
    const series = groupCases(items, s, items)
    expect(series.map(g => [g.name, g.color, g.symbol])).toEqual([
      ['H2 · Ar', CASE_PALETTE[0], MARKER_SYMBOLS[0]],
      ['H2 · N2', CASE_PALETTE[0], MARKER_SYMBOLS[1]],
      ['H2 · No diluent', CASE_PALETTE[0], MISSING_SYMBOL],
      ['C2H2 · Ar', CASE_PALETTE[1], MARKER_SYMBOLS[0]],
    ])
    // N2 keeps its shape when the filters leave only it.
    expect(groupCases([items[1]], s, items)[0].symbol).toBe(MARKER_SYMBOLS[1])
    // Shape alone: every series in the accent.
    const shapes = groupCases(items, state({ color: '', shape: 'primary_diluent_name' }), items)
    expect(shapes.map(g => [g.name, g.color])).toEqual([['Ar', CASE_PALETTE[0]], ['N2', CASE_PALETTE[0]], ['No diluent', CASE_PALETTE[0]]])
  })

  it('draws one series for all cases when nothing groups them', () => {
    const series = groupCases(all, state({ color: '' }), all)
    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({ name: 'All cases', color: CASE_PALETTE[0], symbol: 'circle' })
    const traces = buildTraces(buildPlotData(all, state({ color: '' }), all), state({ color: '' }), '#fff')
    expect(traces[0].showlegend).toBe(false)
    expect(buildLayout(state({ color: '' })).showlegend).toBe(false)
  })
})

describe('what is plotted', () => {
  const items = [
    make(1, { initial_pressure_kpa: 100, cell_width_mm: 10 }),
    make(2, { initial_pressure_kpa: 50, cell_width_mm: null }),
    make(3, { initial_pressure_kpa: null, cell_width_mm: 5 }),
    make(4, { initial_pressure_kpa: null, cell_width_mm: null }),
    make(5, { initial_pressure_kpa: 20, cell_width_mm: 30 }),
  ]

  it('leaves out cases missing either value and says which', () => {
    const d = buildPlotData(items, state(), items)
    expect(d).toMatchObject({ total: 5, plotted: 2, noX: 1, noY: 1, noBoth: 1, nonPositiveX: 0, nonPositiveY: 0 })
    expect(d.plottedItems.map(c => c.id)).toEqual([1, 5])
    expect(exclusionReasons(d, state())).toEqual(['1 with no initial pressure', '1 with no cell width', '1 with neither'])
    expect(plotSummary(d, state())).toBe(
      'Plotting 2 of 5 cases. Not plotted: 1 with no initial pressure, 1 with no cell width, 1 with neither.',
    )
  })

  it('treats zero as a value, which a log axis cannot show', () => {
    const zero = [make(1, { primary_diluent_percentage: 0 }), make(2, { primary_diluent_percentage: 40 }), make(3)]
    const linear = state({ x: 'primary_diluent_percentage', logx: false })
    expect(buildPlotData(zero, linear, zero)).toMatchObject({ plotted: 2, noX: 1 })
    const log = { ...linear, logx: true }
    const d = buildPlotData(zero, log, zero)
    expect(d).toMatchObject({ plotted: 1, noX: 1, nonPositiveX: 1 })
    expect(exclusionReasons(d, log)).toEqual(['1 with no diluent percentage', '1 with diluent percentage ≤ 0, which the log x axis cannot show'])
  })

  it('counts a case not positive on both log axes against both', () => {
    const pts = [
      make(1, { primary_diluent_percentage: 0, primary_dopant_ppm: -1 }),
      make(2, { primary_diluent_percentage: 0, primary_dopant_ppm: 10 }),
      make(3, { primary_diluent_percentage: 5, primary_dopant_ppm: 10 }),
    ]
    const s = state({ x: 'primary_diluent_percentage', y: 'primary_dopant_ppm' })
    const d = buildPlotData(pts, s, pts)
    expect(d).toMatchObject({ plotted: 1, nonPositiveX: 2, nonPositiveY: 1 })
    expect(exclusionReasons(d, s)).toEqual([
      '2 with diluent percentage ≤ 0, which the log x axis cannot show',
      '1 with dopant concentration ≤ 0, which the log y axis cannot show',
    ])
    // One click makes every axis that drops cases linear, and only those.
    expect(linearWhereDropped(s, d)).toMatchObject({ logx: false, logy: false })
    const onlyX = buildPlotData(pts.slice(1), s, pts)
    expect(onlyX).toMatchObject({ nonPositiveX: 1, nonPositiveY: 0 })
    expect(linearWhereDropped(s, onlyX)).toMatchObject({ logx: false, logy: true })
    const onlyY = buildPlotData([pts[0]], { ...s, logx: false }, pts)
    expect(onlyY).toMatchObject({ plotted: 0, nonPositiveX: 0, nonPositiveY: 1 })
    expect(linearWhereDropped({ ...s, logx: false }, onlyY)).toMatchObject({ logx: false, logy: false })
    expect(plotSummary(onlyY, { ...s, logx: false })).toBe(
      'Nothing to plot: none of the 1 case can be drawn with these axes: 1 with dopant concentration ≤ 0, which the log y axis cannot show.',
    )
  })

  it('gives one clause when the same field is on both log axes', () => {
    const pts = [make(1, { primary_diluent_percentage: 0 }), make(2, { primary_diluent_percentage: 5 }), make(3)]
    const s = state({ x: 'primary_diluent_percentage', y: 'primary_diluent_percentage' })
    const d = buildPlotData(pts, s, pts)
    expect(d).toMatchObject({ plotted: 1, nonPositiveX: 1, nonPositiveY: 1, noBoth: 1 })
    expect(exclusionReasons(d, s)).toEqual([
      '1 with no diluent percentage',
      '1 with diluent percentage ≤ 0, which the log axes cannot show',
    ])
  })

  it('says when no case matches the filters', () => {
    expect(plotSummary(buildPlotData([], state(), items), state())).toBe('Nothing to plot: no cases match the filters.')
  })

  it('counts values per axis field', () => {
    const counts = valueCounts(items)
    expect(counts.get('initial_pressure_kpa')).toBe(3)
    expect(counts.get('cell_width_mm')).toBe(3)
    expect(counts.get('cell_length_mm')).toBe(0)
  })
})

describe('traces and layout', () => {
  it('builds traces with ids, colours and hover text', () => {
    const items = [make(1, { title: 'ja5d [3, Akbar (1997)]', primary_diluent_name: 'N2', primary_diluent_percentage: 50, cell_width_mm: 14, cell_width_uncertainty_mm: 1 })]
    const d = buildPlotData(items, state(), items)
    const [trace] = buildTraces(d, state(), '#ffffff')
    expect(trace).toMatchObject({ name: 'H2', x: [100], y: [14], customdata: [1], showlegend: true })
    expect(trace.marker).toMatchObject({ color: CASE_PALETTE[0], symbol: 'circle', line: { color: '#ffffff' } })
    expect(trace.text[0]).toBe('ja5d [3, Akbar (1997)]<br>H2 / O2, φ = 1, 293 K, 50 % N2<br>Pressure: 100 kPa<br>Cell width: 14 ± 1 mm')
    expect(hoverText(items[0], { x: 'primary_diluent_percentage', y: 'primary_diluent_percentage' })).toBe(
      'ja5d [3, Akbar (1997)]<br>H2 / O2, φ = 1, 100 kPa, 293 K, N2 diluent<br>Diluent: 50 %',
    )
  })

  it('draws error bars only where a series reports an uncertainty', () => {
    const items = [
      make(1, { fuel: 'H2', cell_width_uncertainty_mm: 2 }),
      make(2, { fuel: 'H2' }),
      make(3, { fuel: 'CH4' }),
    ]
    const traces = buildTraces(buildPlotData(items, state(), items), state(), '#fff')
    expect(traces[0].error_y).toMatchObject({ type: 'data', array: [2, 0], visible: true, color: CASE_PALETTE[0] })
    expect(traces[0].error_x).toBeUndefined()
    expect(traces[1].error_y).toBeUndefined()
    expect(hasErrorBars(traces)).toBe(true)
    expect(hasErrorBars(traces.slice(1))).toBe(false)
  })

  it('gives a log axis its range as exponents and leaves an open end to Plotly', () => {
    expect(axisRange('', '', true)).toBeUndefined()
    expect(axisRange('10', '1000', true)).toEqual([1, 3])
    expect(axisRange('0', '100', true)).toEqual([null, 2])
    expect(axisRange('-1', '', true)).toBeUndefined()
    expect(axisRange('-1', '', false)).toEqual([-1, null])
    expect(axisLayout('cell_width_mm', true, '1', '')).toMatchObject({ type: 'log', range: [0, null], title: { text: 'Cell width (mm)' } })
    expect(axisLayout('equivalence_ratio', false)).not.toHaveProperty('range')
  })

  it('titles the legend after the groupings', () => {
    expect(buildLayout(state({ shape: 'publication' })).legend.title.text).toBe('Fuel · Publication')
    expect(buildLayout(state(), true).legend).toMatchObject({ entrywidth: 0.5, entrywidthmode: 'fraction' })
  })
})

describe('traceUid', () => {
  it('gives a CSS-safe id, distinct for distinct keys', () => {
    const keys = ['["H2",null]', '["H2","O2"]', '[null,null]', '["27, Bull (1982)",null]', '["22, Bull (1982)",null]']
    const uids = keys.map(traceUid)
    for (const uid of uids) expect(uid).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/)
    expect(new Set(uids).size).toBe(keys.length)
  })
})
