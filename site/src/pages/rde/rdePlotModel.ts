import type { EngineCode, RdeNumericKey, RdeOperatingPoint, RdePublication } from '../../types/rde'
import { NOT_REPORTED, RDE_FACETS, type RdeFacet } from '../../data/rde'
import {
  ENGINE_LABELS,
  RDE_FIELDS,
  RDE_GROUP_LABELS,
  codeLabel,
  fmtRdeMeasure,
  isRdeNumericKey,
  rdeAxisTitle,
  rdeField,
  rdeUncertainty,
  rdeValue,
  waveMode,
  type RdeField,
  type RdeFieldGroup,
} from '../../lib/rdeFields'

// The plot view's state lives in the URL next to the filters: x, y, color,
// logx and logy. Everything here is pure so it can be tested without a DOM.

export type RdeColorBy = 'engine' | 'fuel' | 'oxidizer' | 'mixture' | 'publication' | 'waves' | 'combustor'

export const RDE_COLOR_BYS: RdeColorBy[] = ['engine', 'fuel', 'oxidizer', 'mixture', 'publication', 'waves', 'combustor']

export function isRdeColorBy(v: string | null | undefined): v is RdeColorBy {
  return v != null && (RDE_COLOR_BYS as string[]).includes(v)
}

function facetFor(param: string): RdeFacet {
  const f = RDE_FACETS.find(x => x.param === param)
  if (!f) throw new Error(`No RDE facet for ${param}`)
  return f
}

const OXIDIZER = facetFor('oxidizer')

/** "H2 / Air", "C2H4 / O₂". */
export function mixtureName(p: RdeOperatingPoint): string {
  return `${p.fuel} / ${OXIDIZER.display(p.oxidizer, new Map())}`
}

/** How a colour-by splits the points: a facet, or the fuel and oxidizer
 *  together, since the wave speed depends on the mixture, not the fuel alone. */
interface RdeGrouping {
  label: string
  value: (p: RdeOperatingPoint) => string
  display: (value: string, pubs: Map<number, RdePublication>) => string
}

const GROUPINGS: Record<RdeColorBy, RdeGrouping> = {
  engine: facetFor('engine'),
  fuel: facetFor('fuel'),
  oxidizer: OXIDIZER,
  mixture: { label: 'Mixture', value: mixtureName, display: v => v },
  publication: facetFor('publication'),
  waves: facetFor('waves'),
  combustor: facetFor('combustor'),
}

/** "Engine class", "Waves (primary direction)": the facet's own label. */
export function colorByLabel(color: RdeColorBy): string {
  return GROUPINGS[color].label
}

export interface RdePlotState {
  x: RdeNumericKey
  y: RdeNumericKey
  color: RdeColorBy
  logx: boolean
  logy: boolean
}

export const RDE_PLOT_DEFAULT: RdePlotState = {
  x: 'equivalence_ratio',
  y: 'wave_speed_m_s',
  color: 'engine',
  logx: false,
  logy: false,
}

export function readPlotState(params: URLSearchParams): RdePlotState {
  const x = params.get('x')
  const y = params.get('y')
  const color = params.get('color')
  return {
    x: isRdeNumericKey(x) ? x : RDE_PLOT_DEFAULT.x,
    y: isRdeNumericKey(y) ? y : RDE_PLOT_DEFAULT.y,
    color: isRdeColorBy(color) ? color : RDE_PLOT_DEFAULT.color,
    logx: params.get('logx') === '1',
    logy: params.get('logy') === '1',
  }
}

/** A copy of the params carrying the plot state; every other param is kept and
 *  defaults are left out of the URL. */
export function writePlotState(params: URLSearchParams, s: RdePlotState): URLSearchParams {
  const next = new URLSearchParams(params)
  const put = (key: string, value: string, fallback: string) => {
    if (value === fallback) next.delete(key)
    else next.set(key, value)
  }
  put('x', s.x, RDE_PLOT_DEFAULT.x)
  put('y', s.y, RDE_PLOT_DEFAULT.y)
  put('color', s.color, RDE_PLOT_DEFAULT.color)
  put('logx', s.logx ? '1' : '', '')
  put('logy', s.logy ? '1' : '', '')
  return next
}

/** A new axis field comes with its usual scale. */
export function withAxis(s: RdePlotState, axis: 'x' | 'y', key: RdeNumericKey): RdePlotState {
  const log = rdeField(key).log ?? false
  return axis === 'x' ? { ...s, x: key, logx: log } : { ...s, y: key, logy: log }
}

export function swapAxes(s: RdePlotState): RdePlotState {
  return { ...s, x: s.y, y: s.x, logx: s.logy, logy: s.logx }
}

// Presets ---------------------------------------------------------------------

export interface RdePlotPreset {
  id: string
  label: string
  state: RdePlotState
}

export const RDE_PLOT_PRESETS: RdePlotPreset[] = [
  {
    id: 'wave-speed-phi',
    label: 'Wave speed vs φ',
    state: { x: 'equivalence_ratio', y: 'wave_speed_m_s', color: 'mixture', logx: false, logy: false },
  },
  {
    id: 'waves-throat-flux',
    label: 'Number of waves vs throat mass flux',
    state: { x: 'mass_flux_throat_kg_m2_s', y: 'wave_count', color: 'publication', logx: true, logy: false },
  },
  {
    id: 'frequency-diameter',
    label: 'Frequency vs chamber diameter',
    state: { x: 'chamber_outer_diameter_mm', y: 'frequency_khz', color: 'mixture', logx: false, logy: false },
  },
  {
    // Isp is only comparable within an engine class, so this one must colour by class.
    id: 'isp-throat-flux',
    label: 'Isp vs throat mass flux',
    state: { x: 'mass_flux_throat_kg_m2_s', y: 'specific_impulse_s', color: 'engine', logx: true, logy: false },
  },
  {
    id: 'thrust-mdot',
    label: 'Thrust vs total mass flow',
    state: { x: 'mdot_total_kg_s', y: 'thrust_n', color: 'engine', logx: true, logy: true },
  },
  {
    id: 'gain-mdot',
    label: 'Pressure gain vs total mass flow',
    state: { x: 'mdot_total_kg_s', y: 'pressure_gain_percent', color: 'publication', logx: false, logy: false },
  },
]

export function samePlotState(a: RdePlotState, b: RdePlotState): boolean {
  return a.x === b.x && a.y === b.y && a.color === b.color && a.logx === b.logx && a.logy === b.logy
}

/** The preset the state shows exactly, if any. */
export function activePreset(s: RdePlotState): RdePlotPreset | undefined {
  return RDE_PLOT_PRESETS.find(p => samePlotState(p.state, s))
}

// Axis menus ------------------------------------------------------------------

/** Points with a value, per numeric field. */
export function valueCounts(points: RdeOperatingPoint[]): Map<RdeNumericKey, number> {
  const counts = new Map<RdeNumericKey, number>(RDE_FIELDS.map(f => [f.key, 0]))
  for (const p of points) {
    for (const f of RDE_FIELDS) {
      if (rdeValue(p, f.key) != null) counts.set(f.key, (counts.get(f.key) ?? 0) + 1)
    }
  }
  return counts
}

export interface RdeFieldGroupOptions {
  group: RdeFieldGroup
  label: string
  fields: RdeField[]
}

/** The numeric fields grouped as the menus show them, in RDE_FIELDS order. */
export function fieldGroups(): RdeFieldGroupOptions[] {
  const groups: RdeFieldGroupOptions[] = []
  for (const f of RDE_FIELDS) {
    let g = groups.find(x => x.group === f.group)
    if (!g) {
      g = { group: f.group, label: RDE_GROUP_LABELS[f.group], fields: [] }
      groups.push(g)
    }
    g.fields.push(f)
  }
  return groups
}

/** "Wave speed (m/s) · 294". */
export function axisOptionLabel(f: RdeField, count: number): string {
  return `${rdeAxisTitle(f)} · ${count.toLocaleString('en-US')}`
}

// Colour groups ---------------------------------------------------------------

/** Fixed per class, so a class keeps its colour whatever the filters leave.
 *  Okabe–Ito hues that keep 3:1 against both the light and the dark surface. */
export const ENGINE_COLORS: Record<EngineCode, string> = {
  R: '#D55E00',
  AB: '#0072B2',
  AAB: '#009E73',
  unknown: '#8C8C8C',
}

/** For groups with no value, so a gap in the data does not read as a category.
 *  No other group gets it. */
export const MISSING_COLOR = '#8C8C8C'

/** PlotlyChart's colorway without its grey. The first entry is the light
 *  theme's accent; the plot swaps in the current one (rdePalette). */
export const RDE_PALETTE = ['#0064A4', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#7A5195']

export function rdePalette(accent?: string): string[] {
  return accent ? [accent, ...RDE_PALETTE.slice(1)] : RDE_PALETTE
}

const ENGINE_ORDER: EngineCode[] = ['R', 'AB', 'AAB', 'unknown']

// Once the palette repeats, groups change marker shape so they stay distinct.
const SYMBOLS = ['circle', 'square', 'diamond', 'triangle-up']

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

export interface RdeSeries {
  key: string
  name: string
  color: string
  symbol: string
  points: RdeOperatingPoint[]
}

function isMissingKey(color: RdeColorBy, key: string): boolean {
  return (color === 'waves' && key === NOT_REPORTED)
    || (color === 'combustor' && key === 'unspecified')
    || (color === 'engine' && key === 'unknown')
}

/**
 * Each group's place in the palette and the legend. It is worked out over the
 * whole release (every publication, every point), not over what the filters
 * and axes leave, so a group keeps its colour from one plot to the next:
 * publications by year, label and id; wave counts by value; the rest by how
 * many points the release has, then by name. Groups with no value are not ranked.
 */
export function colorRanks(
  all: RdeOperatingPoint[],
  pubs: Map<number, RdePublication>,
  color: RdeColorBy,
): Map<string, number> {
  const g = GROUPINGS[color]
  let keys: string[]
  if (color === 'engine') {
    keys = ENGINE_ORDER
  } else if (color === 'publication') {
    keys = [...pubs.values()]
      .sort((a, b) => a.year - b.year || collator.compare(a.label, b.label) || a.id - b.id)
      .map(p => String(p.id))
  } else if (color === 'waves') {
    keys = [...new Set(all.map(g.value))].sort((a, b) => Number(a) - Number(b))
  } else {
    const counts = new Map<string, number>()
    for (const p of all) {
      const k = g.value(p)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    keys = Array.from(counts)
      .sort((a, b) => b[1] - a[1] || collator.compare(g.display(a[0], pubs), g.display(b[0], pubs)))
      .map(([k]) => k)
  }
  return new Map(keys.filter(k => !isMissingKey(color, k)).map((k, i) => [k, i]))
}

/** Points split into colour groups, in legend order. `all` is every point in
 *  the release, which the colours are ranked over (colorRanks). */
export function groupPoints(
  points: RdeOperatingPoint[],
  pubs: Map<number, RdePublication>,
  color: RdeColorBy,
  all: RdeOperatingPoint[],
  palette: string[] = RDE_PALETTE,
): RdeSeries[] {
  const g = GROUPINGS[color]
  const ranks = colorRanks(all, pubs, color)
  const byKey = new Map<string, RdeOperatingPoint[]>()
  for (const p of points) {
    const key = g.value(p)
    const list = byKey.get(key)
    if (list) list.push(p)
    else byKey.set(key, [p])
  }
  const groups = Array.from(byKey, ([key, list]) => ({
    key,
    name: g.display(key, pubs),
    missing: isMissingKey(color, key),
    rank: ranks.get(key),
    points: list,
  }))
  // A group `all` does not have follows the ranked ones, by name.
  groups
    .filter(x => x.rank == null && !x.missing)
    .sort((a, b) => collator.compare(a.name, b.name))
    .forEach((x, i) => { x.rank = ranks.size + i })
  groups.sort((a, b) => Number(a.missing) - Number(b.missing) || (a.rank ?? 0) - (b.rank ?? 0))
  return groups.map(x => {
    const base = { key: x.key, name: x.name, points: x.points }
    if (color === 'engine') return { ...base, color: ENGINE_COLORS[x.key as EngineCode] ?? MISSING_COLOR, symbol: SYMBOLS[0] }
    if (x.missing || x.rank == null) return { ...base, color: MISSING_COLOR, symbol: SYMBOLS[0] }
    return {
      ...base,
      color: palette[x.rank % palette.length],
      symbol: SYMBOLS[Math.floor(x.rank / palette.length) % SYMBOLS.length],
    }
  })
}

// What can be plotted -----------------------------------------------------------

export interface RdePlotData {
  series: RdeSeries[]
  /** Points handed to the plot (those passing the page's filters). */
  total: number
  plotted: number
  /** Left out: a y value but no x value. */
  noX: number
  /** Left out: an x value but no y value. */
  noY: number
  /** Left out: neither value. */
  noBoth: number
  /** Left out: both values, but x is not positive and the x axis is logarithmic.
   *  A point not positive on both log axes counts here and in nonPositiveY. */
  nonPositiveX: number
  /** Left out: both values, but y is not positive and the y axis is logarithmic. */
  nonPositiveY: number
  /** Plotted points the release does not mark as steady. */
  notSteady: number
}

/** `all` is every point in the release, for the colours (groupPoints). */
export function buildPlotData(
  points: RdeOperatingPoint[],
  pubs: Map<number, RdePublication>,
  s: RdePlotState,
  all: RdeOperatingPoint[],
  palette: string[] = RDE_PALETTE,
): RdePlotData {
  let noX = 0, noY = 0, noBoth = 0, nonPositiveX = 0, nonPositiveY = 0, notSteady = 0
  const kept: RdeOperatingPoint[] = []
  for (const p of points) {
    const x = rdeValue(p, s.x)
    const y = rdeValue(p, s.y)
    if (x == null && y == null) noBoth++
    else if (x == null) noX++
    else if (y == null) noY++
    else {
      const badX = s.logx && x <= 0
      const badY = s.logy && y <= 0
      if (badX) nonPositiveX++
      if (badY) nonPositiveY++
      if (!badX && !badY) {
        kept.push(p)
        if (p.operating_point_type !== 'steady') notSteady++
      }
    }
  }
  return {
    series: groupPoints(kept, pubs, s.color, all, palette),
    total: points.length,
    plotted: kept.length,
    noX,
    noY,
    noBoth,
    nonPositiveX,
    nonPositiveY,
    notSteady,
  }
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** Why points were left out, one clause per reason:
 *  ["280 with no wave speed", "48 with neither", …]. */
export function exclusionReasons(d: RdePlotData, s: RdePlotState): string[] {
  const xl = lowerFirst(rdeField(s.x).label)
  const yl = lowerFirst(rdeField(s.y).label)
  const n = (v: number) => v.toLocaleString('en-US')
  const reasons: string[] = []
  if (s.x === s.y) {
    // One field on both axes: a point either has it or not.
    if (d.noBoth) reasons.push(`${n(d.noBoth)} with no ${xl}`)
  } else {
    if (d.noY) reasons.push(`${n(d.noY)} with no ${yl}`)
    if (d.noX) reasons.push(`${n(d.noX)} with no ${xl}`)
    if (d.noBoth) reasons.push(`${n(d.noBoth)} with neither`)
  }
  if (s.x === s.y && d.nonPositiveX && d.nonPositiveY) {
    reasons.push(`${n(d.nonPositiveX)} with ${xl} ≤ 0, which the log axes cannot show`)
  } else {
    if (d.nonPositiveX) reasons.push(`${n(d.nonPositiveX)} with ${xl} ≤ 0, which the log x axis cannot show`)
    if (d.nonPositiveY) reasons.push(`${n(d.nonPositiveY)} with ${yl} ≤ 0, which the log y axis cannot show`)
  }
  return reasons
}

/** The state with every log axis that leaves points out made linear. */
export function linearWhereDropped(s: RdePlotState, d: RdePlotData): RdePlotState {
  return { ...s, logx: s.logx && d.nonPositiveX === 0, logy: s.logy && d.nonPositiveY === 0 }
}

const pointNoun = (n: number) => (n === 1 ? 'operating point' : 'operating points')

/** What the plot shows, in one sentence, for the status line a screen reader
 *  hears after every change. */
export function plotSummary(d: RdePlotData, s: RdePlotState): string {
  const n = (v: number) => v.toLocaleString('en-US')
  const reasons = exclusionReasons(d, s)
  if (d.total === 0) return 'Nothing to plot: no operating points match the filters.'
  if (d.plotted === 0) {
    const why = reasons.length > 0 ? `: ${reasons.join(', ')}` : ''
    return `Nothing to plot: none of the ${n(d.total)} ${pointNoun(d.total)} can be drawn with these axes${why}.`
  }
  const why = reasons.length > 0 ? `. Not plotted: ${reasons.join(', ')}` : ''
  return `Plotting ${n(d.plotted)} of ${n(d.total)} ${pointNoun(d.total)}${why}.`
}

// Plotly traces and layout ----------------------------------------------------

export interface RdeTrace {
  type: 'scatter'
  mode: 'markers'
  name: string
  x: number[]
  y: number[]
  /** Operating point ids, for the click-through. */
  customdata: number[]
  text: string[]
  hovertemplate: string
  hoverlabel: { align: 'left' }
  marker: {
    size: number
    opacity: number
    symbol: string
    color: string
    line: { width: number; color: string }
  }
}

/** "Wave speed: 1,500 m/s". The wave count gives the mode: "Waves: 1 + 1". */
function measureLine(p: RdeOperatingPoint, key: RdeNumericKey): string {
  const f = rdeField(key)
  const mode = key === 'wave_count' ? waveMode(p) : null
  return `${f.short}: ${mode ?? fmtRdeMeasure(rdeValue(p, key), rdeUncertainty(p, key), f.unit)}`
}

/** The hover label of one point, lines joined with <br>. */
export function hoverText(p: RdeOperatingPoint, pubs: Map<number, RdePublication>, s: RdePlotState): string {
  const pub = pubs.get(p.publication_id)
  const onAxis = (key: RdeNumericKey) => s.x === key || s.y === key
  const lines = [
    `${pub?.label ?? `Publication ${p.publication_id}`} · #${p.id}`,
    `${mixtureName(p)} · ${ENGINE_LABELS[p.engine_code] ?? p.engine_code}`,
  ]
  if (p.equivalence_ratio != null && !onAxis('equivalence_ratio')) lines.push(measureLine(p, 'equivalence_ratio'))
  lines.push(measureLine(p, s.x))
  if (s.y !== s.x) lines.push(measureLine(p, s.y))
  if (p.wave_count != null && !onAxis('wave_count')) lines.push(measureLine(p, 'wave_count'))
  lines.push(`Operating point: ${codeLabel(p.operating_point_type)}`)
  return lines.join('<br>')
}

/** One scatter trace per colour group. `outline` is the chart surface colour,
 *  drawn as a thin ring so overlapping markers stay readable. */
export function buildTraces(
  d: RdePlotData,
  pubs: Map<number, RdePublication>,
  s: RdePlotState,
  outline: string,
): RdeTrace[] {
  return d.series.map(g => ({
    type: 'scatter',
    mode: 'markers',
    name: g.name,
    x: g.points.map(p => rdeValue(p, s.x) as number),
    y: g.points.map(p => rdeValue(p, s.y) as number),
    customdata: g.points.map(p => p.id),
    text: g.points.map(p => hoverText(p, pubs, s)),
    hovertemplate: '%{text}<extra></extra>',
    hoverlabel: { align: 'left' },
    marker: {
      size: 8,
      opacity: 0.85,
      symbol: g.symbol,
      color: g.color,
      line: { width: 1, color: outline },
    },
  }))
}

export function axisLayout(key: RdeNumericKey, log: boolean) {
  const f = rdeField(key)
  return {
    title: { text: rdeAxisTitle(f) },
    type: log ? ('log' as const) : ('linear' as const),
    automargin: true,
    // Whole numbers only: no 1.5 waves on the ticks.
    ...(f.integer && !log ? { dtick: 1 } : {}),
  }
}

/** `narrow`: phone width, where the legend goes in two columns so it does not
 *  take one row per entry and squeeze the plot. */
export function buildLayout(s: RdePlotState, narrow = false) {
  return {
    xaxis: axisLayout(s.x, s.logx),
    yaxis: axisLayout(s.y, s.logy),
    hovermode: 'closest' as const,
    showlegend: true,
    // Above the plot rather than beside it, which would take half a phone screen.
    legend: {
      orientation: 'h' as const,
      x: 0,
      xanchor: 'left' as const,
      y: 1.02,
      yanchor: 'bottom' as const,
      bgcolor: 'rgba(0,0,0,0)',
      title: { text: colorByLabel(s.color), side: 'top' as const },
      ...(narrow ? { entrywidth: 0.5, entrywidthmode: 'fraction' as const, font: { size: 11 } } : {}),
    },
  }
}

// Notes -------------------------------------------------------------------------

export interface RdeAxisNote {
  key: RdeNumericKey
  label: string
  note: string
  /** Specific impulse: shown with an info icon. */
  emphasis: boolean
}

/** The fields' caveats for the fields on the axes, x first. */
export function axisNotes(s: RdePlotState): RdeAxisNote[] {
  const keys = s.x === s.y ? [s.x] : [s.x, s.y]
  return keys.flatMap(key => {
    const f = rdeField(key)
    return f.note ? [{ key, label: f.label, note: f.note, emphasis: key === 'specific_impulse_s' }] : []
  })
}

export function ispOnAxis(s: RdePlotState): boolean {
  return s.x === 'specific_impulse_s' || s.y === 'specific_impulse_s'
}
