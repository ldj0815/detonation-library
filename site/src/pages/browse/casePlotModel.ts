import type { CaseListItem } from '../../types/case'
import { HIDDEN_MEASUREMENTS } from '../../config'
import { caseReference, fmtMeasure, mixtureLine, parseReference } from '../../lib/format'

// The cell-size plot's state lives in the URL next to the filters: x, y, color,
// shape, logx, logy, xmin, xmax, ymin and ymax. Everything here is pure so it
// can be tested without a DOM.

export type CaseAxisKey =
  | 'initial_pressure_kpa'
  | 'initial_temperature_k'
  | 'equivalence_ratio'
  | 'cell_width_mm'
  | 'cell_length_mm'
  | 'primary_diluent_percentage'
  | 'primary_dopant_ppm'
  | 'critical_hydraulic_diameter_mm'
  | 'minimum_hydraulic_diameter_mm'
  | 'critical_energy_j'

export interface CaseAxis {
  key: CaseAxisKey
  /** Axis title and menu entry: "Cell width (mm)". */
  label: string
  /** In sentences: "12 with no cell width". */
  name: string
  /** In the hover label: "Cell width: 14 ± 1 mm". */
  short: string
  unit: string
  /** The uncertainty the error bars draw. */
  uncertainty?: 'cell_width_uncertainty_mm' | 'cell_length_uncertainty_mm'
}

const ALL_AXES: CaseAxis[] = [
  { key: 'initial_pressure_kpa', label: 'Initial pressure (kPa)', name: 'initial pressure', short: 'Pressure', unit: 'kPa' },
  { key: 'initial_temperature_k', label: 'Initial temperature (K)', name: 'initial temperature', short: 'Temperature', unit: 'K' },
  { key: 'equivalence_ratio', label: 'Equivalence ratio', name: 'equivalence ratio', short: 'φ', unit: '' },
  { key: 'cell_width_mm', label: 'Cell width (mm)', name: 'cell width', short: 'Cell width', unit: 'mm', uncertainty: 'cell_width_uncertainty_mm' },
  { key: 'cell_length_mm', label: 'Cell length (mm)', name: 'cell length', short: 'Cell length', unit: 'mm', uncertainty: 'cell_length_uncertainty_mm' },
  { key: 'primary_diluent_percentage', label: 'Diluent (%)', name: 'diluent percentage', short: 'Diluent', unit: '%' },
  { key: 'primary_dopant_ppm', label: 'Dopant (ppm)', name: 'dopant concentration', short: 'Dopant', unit: 'ppm' },
  { key: 'critical_hydraulic_diameter_mm', label: 'Critical tube diameter (mm)', name: 'critical tube diameter', short: 'Critical diameter', unit: 'mm' },
  { key: 'minimum_hydraulic_diameter_mm', label: 'Minimum tube diameter (mm)', name: 'minimum tube diameter', short: 'Minimum diameter', unit: 'mm' },
  { key: 'critical_energy_j', label: 'Critical energy (J)', name: 'critical energy', short: 'Critical energy', unit: 'J' },
]

/** The axis menu: every numeric field the site shows. */
export const CASE_AXES: CaseAxis[] = ALL_AXES.filter(a => !HIDDEN_MEASUREMENTS.has(a.key))

export function isCaseAxisKey(v: string | null | undefined): v is CaseAxisKey {
  return v != null && CASE_AXES.some(a => a.key === v)
}

export function caseAxis(key: CaseAxisKey): CaseAxis {
  return ALL_AXES.find(a => a.key === key) as CaseAxis
}

function axisValue(c: CaseListItem, key: CaseAxisKey): number | null {
  const v = c[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Cases with a value, per axis field. */
export function valueCounts(items: CaseListItem[]): Map<CaseAxisKey, number> {
  const counts = new Map<CaseAxisKey, number>(CASE_AXES.map(a => [a.key, 0]))
  for (const c of items) {
    for (const a of CASE_AXES) {
      if (axisValue(c, a.key) != null) counts.set(a.key, (counts.get(a.key) ?? 0) + 1)
    }
  }
  return counts
}

/** "Cell width (mm) · 1,654". */
export function axisOptionLabel(a: CaseAxis, count: number): string {
  return `${a.label} · ${count.toLocaleString('en-US')}`
}

// Groupings ---------------------------------------------------------------------

export type CaseGroupBy =
  | ''
  | 'fuel'
  | 'oxidizer'
  | 'primary_diluent_name'
  | 'primary_dopant_name'
  | 'publication'
  | 'title'
  | 'setup'
  | 'geometry'

type GroupField = Exclude<CaseGroupBy, ''>

export const CASE_GROUP_BYS: { value: CaseGroupBy; label: string }[] = [
  { value: '', label: 'Nothing' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'oxidizer', label: 'Oxidizer' },
  { value: 'primary_diluent_name', label: 'Diluent' },
  { value: 'primary_dopant_name', label: 'Dopant' },
  { value: 'publication', label: 'Publication' },
  { value: 'title', label: 'Series (title)' },
  { value: 'setup', label: 'Setup' },
  { value: 'geometry', label: 'Geometry' },
]

export function isCaseGroupBy(v: string | null | undefined): v is CaseGroupBy {
  return v != null && CASE_GROUP_BYS.some(g => g.value === v)
}

export function groupByLabel(by: CaseGroupBy): string {
  return CASE_GROUP_BYS.find(g => g.value === by)?.label ?? by
}

/** "Bull (1982), ref. 22": the label two papers can share, with the GALCIT
 *  number that tells them apart. Other references as given. */
export function referenceName(ref: string): string {
  const p = parseReference(ref)
  return p?.index != null ? `${p.label}, ref. ${p.index}` : ref
}

interface Grouping {
  /** The group a case falls in; null when it has no value. */
  value: (c: CaseListItem) => string | null
  display: (key: string) => string
  /** Legend name of the cases with no value. */
  missing: string
}

const text = (v: string | null | undefined) => (v?.trim() ? v : null)
const same = (v: string) => v

const GROUPINGS: Record<GroupField, Grouping> = {
  fuel: { value: c => text(c.fuel), display: same, missing: 'Not stated' },
  oxidizer: { value: c => text(c.oxidizer), display: same, missing: 'Not stated' },
  primary_diluent_name: { value: c => text(c.primary_diluent_name), display: same, missing: 'No diluent' },
  primary_dopant_name: { value: c => text(c.primary_dopant_name), display: same, missing: 'No dopant' },
  publication: { value: c => caseReference(c), display: referenceName, missing: 'No reference' },
  title: { value: c => text(c.title), display: same, missing: 'No title' },
  setup: { value: c => text(c.setup), display: same, missing: 'Not stated' },
  geometry: { value: c => (c.geometry === 'not stated' ? null : text(c.geometry)), display: same, missing: 'Not stated' },
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

function referenceYear(label: string): number | null {
  const m = /\((\d{4})[a-z]?\)/.exec(label)
  return m ? Number(m[1]) : null
}

// Earliest first, as the Publications view lists them; undated ones after the
// dated, then by label and GALCIT number.
function comparePublications(a: string, b: string): number {
  const pa = parseReference(a)
  const pb = parseReference(b)
  const ya = pa ? referenceYear(pa.label) : null
  const yb = pb ? referenceYear(pb.label) : null
  if (ya !== yb) {
    if (ya == null) return 1
    if (yb == null) return -1
    return ya - yb
  }
  return collator.compare(pa?.label ?? a, pb?.label ?? b)
    || (pa?.index ?? Infinity) - (pb?.index ?? Infinity)
    || collator.compare(a, b)
}

/**
 * Each group's place in the palette and the legend, worked out over every case
 * of the category rather than over what the filters and axes leave, so a group
 * keeps its colour and shape from one plot to the next: publications by year,
 * the rest by how many cases they have, then by name. Cases with no value are
 * not ranked.
 */
export function groupRanks(all: CaseListItem[], by: GroupField): Map<string, number> {
  const g = GROUPINGS[by]
  const counts = new Map<string, number>()
  for (const c of all) {
    const k = g.value(c)
    if (k != null) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const keys = Array.from(counts.keys())
  if (by === 'publication') keys.sort(comparePublications)
  else keys.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || collator.compare(g.display(a), g.display(b)))
  return new Map(keys.map((k, i) => [k, i]))
}

// Colours and shapes ------------------------------------------------------------

/** PlotlyChart's colorway without its grey, as in the RDE plot. The first entry
 *  is the light theme's accent; the plot swaps in the current one (casePalette). */
export const CASE_PALETTE = ['#0064A4', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#7A5195']

/** For cases with no value, so a gap in the data does not read as a category.
 *  No other group gets it. */
export const MISSING_COLOR = '#8C8C8C'

export function casePalette(accent?: string): string[] {
  return accent ? [accent, ...CASE_PALETTE.slice(1)] : CASE_PALETTE
}

export const MARKER_SYMBOLS = [
  'circle', 'square', 'diamond', 'cross', 'x', 'triangle-up', 'triangle-down',
  'triangle-left', 'triangle-right', 'pentagon', 'hexagon', 'star', 'hexagram',
  'star-triangle-up', 'star-diamond', 'hourglass', 'bowtie',
]

/** The shape of cases with no value for the shape grouping. */
export const MISSING_SYMBOL = 'circle-open'

interface Slot {
  key: string | null
  name: string
  /** Null for cases with no value. */
  rank: number | null
}

/** A case's group under `by`. A group `all` does not have follows the ranked
 *  ones, by name. */
function slotter(items: CaseListItem[], by: GroupField, all: CaseListItem[]): (c: CaseListItem) => Slot {
  const g = GROUPINGS[by]
  const ranks = groupRanks(all, by)
  const base = ranks.size
  const unranked = Array.from(new Set(items.map(g.value)))
    .filter((k): k is string => k != null && !ranks.has(k))
    .sort((a, b) => collator.compare(g.display(a), g.display(b)))
  unranked.forEach((k, i) => ranks.set(k, base + i))
  return c => {
    const key = g.value(c)
    return key == null ? { key: null, name: g.missing, rank: null } : { key, name: g.display(key), rank: ranks.get(key) ?? null }
  }
}

export interface CaseSeries {
  key: string
  name: string
  color: string
  symbol: string
  items: CaseListItem[]
}

const byRank = (a: Slot | undefined, b: Slot | undefined) =>
  Number(a?.rank == null && a != null) - Number(b?.rank == null && b != null) || (a?.rank ?? 0) - (b?.rank ?? 0)

/**
 * The cases split into series, in legend order: one per colour group, or one
 * per colour and shape pair. Colours repeat after seven groups; with no shape
 * grouping the marker then changes shape so the groups stay apart. `all` is
 * every case of the category, which the groups are ranked over (groupRanks).
 */
export function groupCases(
  items: CaseListItem[],
  s: Pick<CasePlotState, 'color' | 'shape'>,
  all: CaseListItem[],
  palette: string[] = CASE_PALETTE,
): CaseSeries[] {
  const colourOf = s.color ? slotter(items, s.color, all) : null
  const shapeOf = s.shape ? slotter(items, s.shape, all) : null
  const groups = new Map<string, { colour?: Slot; shape?: Slot; items: CaseListItem[] }>()
  for (const c of items) {
    const colour = colourOf?.(c)
    const shape = shapeOf?.(c)
    const key = JSON.stringify([colour?.key ?? null, shape?.key ?? null])
    const group = groups.get(key)
    if (group) group.items.push(c)
    else groups.set(key, { colour, shape, items: [c] })
  }
  return Array.from(groups, ([key, g]) => ({ key, ...g }))
    .sort((a, b) => byRank(a.colour, b.colour) || byRank(a.shape, b.shape))
    .map(({ key, colour, shape, items }) => {
      const rank = colour?.rank
      const color = !colour ? palette[0] : rank == null ? MISSING_COLOR : palette[rank % palette.length]
      let symbol = MARKER_SYMBOLS[0]
      if (shape) symbol = shape.rank == null ? MISSING_SYMBOL : MARKER_SYMBOLS[shape.rank % MARKER_SYMBOLS.length]
      else if (rank != null) symbol = MARKER_SYMBOLS[Math.floor(rank / palette.length) % MARKER_SYMBOLS.length]
      const name = [colour?.name, shape?.name].filter(Boolean).join(' · ') || 'All cases'
      return { key, name, color, symbol, items }
    })
}

// URL state -----------------------------------------------------------------------

export interface CasePlotState {
  x: CaseAxisKey
  y: CaseAxisKey
  color: CaseGroupBy
  shape: CaseGroupBy
  logx: boolean
  logy: boolean
  /** Axis ranges as typed; '' leaves that end to Plotly. */
  xmin: string
  xmax: string
  ymin: string
  ymax: string
}

export const CASE_PLOT_DEFAULT: CasePlotState = {
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
}

// "Nothing" in the URL, where an empty colour would read as the default.
const NONE = 'none'

function groupParam(params: URLSearchParams, key: string, fallback: CaseGroupBy): CaseGroupBy {
  const v = params.get(key)
  if (v == null) return fallback
  if (v === NONE) return ''
  return isCaseGroupBy(v) ? v : fallback
}

function rangeParam(params: URLSearchParams, key: string): string {
  const v = params.get(key)?.trim() ?? ''
  return v !== '' && Number.isFinite(Number(v)) ? v : ''
}

export function readPlotState(params: URLSearchParams): CasePlotState {
  const x = params.get('x')
  const y = params.get('y')
  return {
    x: isCaseAxisKey(x) ? x : CASE_PLOT_DEFAULT.x,
    y: isCaseAxisKey(y) ? y : CASE_PLOT_DEFAULT.y,
    color: groupParam(params, 'color', CASE_PLOT_DEFAULT.color),
    shape: groupParam(params, 'shape', CASE_PLOT_DEFAULT.shape),
    // Both axes are logarithmic unless the URL says otherwise.
    logx: params.get('logx') !== '0',
    logy: params.get('logy') !== '0',
    xmin: rangeParam(params, 'xmin'),
    xmax: rangeParam(params, 'xmax'),
    ymin: rangeParam(params, 'ymin'),
    ymax: rangeParam(params, 'ymax'),
  }
}

/** A copy of the params carrying the plot state; every other param is kept and
 *  defaults are left out of the URL. */
export function writePlotState(params: URLSearchParams, s: CasePlotState): URLSearchParams {
  const next = new URLSearchParams(params)
  const put = (key: string, value: string, fallback: string) => {
    if (value === fallback) next.delete(key)
    else next.set(key, value)
  }
  put('x', s.x, CASE_PLOT_DEFAULT.x)
  put('y', s.y, CASE_PLOT_DEFAULT.y)
  put('color', s.color || NONE, CASE_PLOT_DEFAULT.color || NONE)
  put('shape', s.shape || NONE, CASE_PLOT_DEFAULT.shape || NONE)
  put('logx', s.logx ? '' : '0', '')
  put('logy', s.logy ? '' : '0', '')
  put('xmin', s.xmin.trim(), '')
  put('xmax', s.xmax.trim(), '')
  put('ymin', s.ymin.trim(), '')
  put('ymax', s.ymax.trim(), '')
  return next
}

/** A new field on an axis drops that axis's range, which was in other units. */
export function withAxis(s: CasePlotState, axis: 'x' | 'y', key: CaseAxisKey): CasePlotState {
  if (s[axis] === key) return s
  return axis === 'x' ? { ...s, x: key, xmin: '', xmax: '' } : { ...s, y: key, ymin: '', ymax: '' }
}

export function swapAxes(s: CasePlotState): CasePlotState {
  return {
    ...s,
    x: s.y,
    y: s.x,
    logx: s.logy,
    logy: s.logx,
    xmin: s.ymin,
    xmax: s.ymax,
    ymin: s.xmin,
    ymax: s.xmax,
  }
}

export function hasRanges(s: CasePlotState): boolean {
  return Boolean(s.xmin || s.xmax || s.ymin || s.ymax)
}

export function withoutRanges(s: CasePlotState): CasePlotState {
  return { ...s, xmin: '', xmax: '', ymin: '', ymax: '' }
}

// What can be plotted ---------------------------------------------------------------

export interface CasePlotData {
  series: CaseSeries[]
  /** The plotted cases, in the order they were given. */
  plottedItems: CaseListItem[]
  /** Cases handed to the plot (those passing the page's filters). */
  total: number
  plotted: number
  /** Left out: a y value but no x value. */
  noX: number
  /** Left out: an x value but no y value. */
  noY: number
  /** Left out: neither value. */
  noBoth: number
  /** Left out: both values, but x is not positive and the x axis is logarithmic.
   *  A case not positive on both log axes counts here and in nonPositiveY. */
  nonPositiveX: number
  /** Left out: both values, but y is not positive and the y axis is logarithmic. */
  nonPositiveY: number
}

/** `all` is every case of the category, for the colours (groupCases). */
export function buildPlotData(
  items: CaseListItem[],
  s: CasePlotState,
  all: CaseListItem[],
  palette: string[] = CASE_PALETTE,
): CasePlotData {
  let noX = 0, noY = 0, noBoth = 0, nonPositiveX = 0, nonPositiveY = 0
  const kept: CaseListItem[] = []
  for (const c of items) {
    const x = axisValue(c, s.x)
    const y = axisValue(c, s.y)
    if (x == null && y == null) noBoth++
    else if (x == null) noX++
    else if (y == null) noY++
    else {
      const badX = s.logx && x <= 0
      const badY = s.logy && y <= 0
      if (badX) nonPositiveX++
      if (badY) nonPositiveY++
      if (!badX && !badY) kept.push(c)
    }
  }
  return {
    series: groupCases(kept, s, all, palette),
    plottedItems: kept,
    total: items.length,
    plotted: kept.length,
    noX,
    noY,
    noBoth,
    nonPositiveX,
    nonPositiveY,
  }
}

const count = (v: number) => v.toLocaleString('en-US')

/** Why cases were left out, one clause per reason:
 *  ["212 with no cell width", "3 with neither", …]. */
export function exclusionReasons(d: CasePlotData, s: CasePlotState): string[] {
  const xl = caseAxis(s.x).name
  const yl = caseAxis(s.y).name
  const reasons: string[] = []
  if (s.x === s.y) {
    // One field on both axes: a case either has it or not.
    if (d.noBoth) reasons.push(`${count(d.noBoth)} with no ${xl}`)
  } else {
    if (d.noX) reasons.push(`${count(d.noX)} with no ${xl}`)
    if (d.noY) reasons.push(`${count(d.noY)} with no ${yl}`)
    if (d.noBoth) reasons.push(`${count(d.noBoth)} with neither`)
  }
  if (s.x === s.y && d.nonPositiveX && d.nonPositiveY) {
    reasons.push(`${count(d.nonPositiveX)} with ${xl} ≤ 0, which the log axes cannot show`)
  } else {
    if (d.nonPositiveX) reasons.push(`${count(d.nonPositiveX)} with ${xl} ≤ 0, which the log x axis cannot show`)
    if (d.nonPositiveY) reasons.push(`${count(d.nonPositiveY)} with ${yl} ≤ 0, which the log y axis cannot show`)
  }
  return reasons
}

/** The state with every log axis that leaves cases out made linear. */
export function linearWhereDropped(s: CasePlotState, d: CasePlotData): CasePlotState {
  return { ...s, logx: s.logx && d.nonPositiveX === 0, logy: s.logy && d.nonPositiveY === 0 }
}

const caseNoun = (n: number) => (n === 1 ? 'case' : 'cases')

/** What the plot shows, in one sentence, for the status line a screen reader
 *  hears after every change. */
export function plotSummary(d: CasePlotData, s: CasePlotState): string {
  const reasons = exclusionReasons(d, s)
  if (d.total === 0) return 'Nothing to plot: no cases match the filters.'
  if (d.plotted === 0) {
    const why = reasons.length > 0 ? `: ${reasons.join(', ')}` : ''
    return `Nothing to plot: none of the ${count(d.total)} ${caseNoun(d.total)} can be drawn with these axes${why}.`
  }
  const why = reasons.length > 0 ? `. Not plotted: ${reasons.join(', ')}` : ''
  return `Plotting ${count(d.plotted)} of ${count(d.total)} ${caseNoun(d.total)}${why}.`
}

// Plotly traces and layout ------------------------------------------------------

interface ErrorBar {
  type: 'data'
  array: number[]
  visible: true
  color: string
  thickness: number
}

export interface CaseTrace {
  type: 'scatter'
  mode: 'markers'
  /** The series key: with the layout's uirevision, Plotly keeps a series the
   *  reader hid in the legend hidden when the traces are rebuilt. */
  uid: string
  name: string
  x: number[]
  y: number[]
  /** Case ids, for the click-through. */
  customdata: number[]
  text: string[]
  hovertemplate: string
  hoverlabel: { align: 'left' }
  showlegend: boolean
  marker: {
    size: number
    opacity: number
    symbol: string
    color: string
    line: { width: number; color: string }
  }
  error_x?: ErrorBar
  error_y?: ErrorBar
}

/** "Cell width: 14 ± 1 mm". */
function measureLine(c: CaseListItem, key: CaseAxisKey): string {
  const a = caseAxis(key)
  const unc = a.uncertainty ? c[a.uncertainty] : null
  return `${a.short}: ${fmtMeasure(axisValue(c, key), unc, a.unit)}`
}

/** The hover label of one case, lines joined with <br>: its title (which
 *  carries the reference), the mixture without the axis fields, then the
 *  values on the axes. */
export function hoverText(c: CaseListItem, s: Pick<CasePlotState, 'x' | 'y'>): string {
  const lines = [c.title, mixtureLine({ ...c, [s.x]: null, [s.y]: null }), measureLine(c, s.x)]
  if (s.y !== s.x) lines.push(measureLine(c, s.y))
  return lines.join('<br>')
}

/** Error bars for the field's reported uncertainty; none when no case of the
 *  series reports one. */
function errorBar(items: CaseListItem[], key: CaseAxisKey, color: string): ErrorBar | undefined {
  const field = caseAxis(key).uncertainty
  if (!field) return undefined
  const array = items.map(c => c[field] ?? 0)
  if (!array.some(v => v > 0)) return undefined
  return { type: 'data', array, visible: true, color, thickness: 1 }
}

/** One scatter trace per series. `outline` is the chart surface colour, drawn
 *  as a thin ring so overlapping markers stay readable. */
/** A series key as a trace uid. Plotly puts the uid in CSS selectors, so
 *  every character outside [A-Za-z0-9_-] is spelled out, which keeps distinct
 *  keys distinct. */
export function traceUid(key: string): string {
  return 's' + key.replace(/[^A-Za-z0-9_-]/g, c => `_${c.charCodeAt(0).toString(16)}_`)
}

export function buildTraces(d: CasePlotData, s: CasePlotState, outline: string): CaseTrace[] {
  const legend = Boolean(s.color || s.shape)
  return d.series.map(g => {
    const errorX = errorBar(g.items, s.x, g.color)
    const errorY = errorBar(g.items, s.y, g.color)
    return {
      type: 'scatter',
      mode: 'markers',
      uid: traceUid(g.key),
      name: g.name,
      x: g.items.map(c => axisValue(c, s.x) as number),
      y: g.items.map(c => axisValue(c, s.y) as number),
      customdata: g.items.map(c => c.id),
      text: g.items.map(c => hoverText(c, s)),
      hovertemplate: '%{text}<extra></extra>',
      hoverlabel: { align: 'left' },
      showlegend: legend,
      marker: {
        size: 7,
        opacity: 0.85,
        symbol: g.symbol,
        color: g.color,
        // An open marker is drawn with its line, in the marker colour.
        line: { width: g.symbol.endsWith('-open') ? 1.5 : 1, color: outline },
      },
      ...(errorX ? { error_x: errorX } : {}),
      ...(errorY ? { error_y: errorY } : {}),
    }
  })
}

export function hasErrorBars(traces: CaseTrace[]): boolean {
  return traces.some(t => t.error_x || t.error_y)
}

function bound(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Plotly's range for the typed bounds: log10 exponents on a log axis, where a
 *  bound ≤ 0 is dropped. A null end is left to Plotly; no range when both are. */
export function axisRange(min: string, max: string, log: boolean): [number | null, number | null] | undefined {
  const toAxis = (v: number | null) => (v == null ? null : !log ? v : v > 0 ? Math.log10(v) : null)
  const range: [number | null, number | null] = [toAxis(bound(min)), toAxis(bound(max))]
  return range[0] == null && range[1] == null ? undefined : range
}

export function axisLayout(key: CaseAxisKey, log: boolean, min = '', max = '') {
  const range = axisRange(min, max, log)
  return {
    title: { text: caseAxis(key).label },
    type: log ? ('log' as const) : ('linear' as const),
    automargin: true,
    ...(range ? { range } : {}),
  }
}

export function legendTitle(s: Pick<CasePlotState, 'color' | 'shape'>): string {
  return [s.color, s.shape].filter(Boolean).map(by => groupByLabel(by)).join(' · ')
}

/** `narrow`: phone width, where the legend goes in two columns so it does not
 *  take one row per entry and squeeze the plot. */
export function buildLayout(s: CasePlotState, narrow = false) {
  return {
    // Legend clicks and zoom survive redraws until the axes or the grouping change.
    uirevision: `${s.x}|${s.y}|${s.color}|${s.shape}`,
    xaxis: axisLayout(s.x, s.logx, s.xmin, s.xmax),
    yaxis: axisLayout(s.y, s.logy, s.ymin, s.ymax),
    hovermode: 'closest' as const,
    showlegend: Boolean(s.color || s.shape),
    // Above the plot rather than beside it, which would take half a phone
    // screen, and scrolling past a third of the chart's height: a grouping
    // such as the publications has dozens of entries.
    legend: {
      orientation: 'h' as const,
      x: 0,
      xanchor: 'left' as const,
      y: 1.02,
      yanchor: 'bottom' as const,
      bgcolor: 'rgba(0,0,0,0)',
      maxheight: 0.3,
      title: { text: legendTitle(s), side: 'top' as const },
      ...(narrow ? { entrywidth: 0.5, entrywidthmode: 'fraction' as const, font: { size: 11 } } : {}),
    },
  }
}
