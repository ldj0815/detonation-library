import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { CaseDetail } from '../../types/case'
import EmptyState from '../../components/EmptyState'
import LazyPlotlyChart from '../../components/LazyPlotlyChart'
import Icon from '../../components/Icon'
import { downloadCasesCsv } from '../../lib/csv'
import { fmtCount } from '../../lib/format'
import {
  CASE_AXES,
  CASE_GROUP_BYS,
  CASE_PALETTE,
  CASE_PLOT_DEFAULT,
  axisOptionLabel,
  buildLayout,
  buildPlotData,
  buildTraces,
  caseAxis,
  casePalette,
  exclusionReasons,
  hasErrorBars,
  hasRanges,
  isCaseAxisKey,
  isCaseGroupBy,
  linearWhereDropped,
  plotSummary,
  readPlotState,
  swapAxes,
  valueCounts,
  withAxis,
  withoutRanges,
  writePlotState,
  type CaseAxisKey,
  type CaseGroupBy,
  type CasePlotState,
} from './casePlotModel'

export interface CasePlotProps {
  /** The cases that pass the page's filters, unpaged and sorted. */
  items: CaseDetail[]
  /** Every case of the category, which the colours are ranked over. */
  allItems: CaseDetail[]
}

// The marker outline is the chart surface and the first colour the accent,
// both of which change with the theme.
function subscribeTheme(onChange: () => void) {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  return () => { mo.disconnect(); mq.removeEventListener('change', onChange) }
}

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

const surfaceColor = () => cssVar('--surface', '#ffffff')
const accentColor = () => cssVar('--accent', CASE_PALETTE[0])

const NARROW = '(max-width: 639px)'

function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia(NARROW)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

const isNarrow = () => window.matchMedia(NARROW).matches

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

function AxisSelect({ value, counts, onChange }: {
  value: CaseAxisKey
  counts: Map<CaseAxisKey, number>
  onChange: (key: CaseAxisKey) => void
}) {
  return (
    <select value={value} onChange={e => { if (isCaseAxisKey(e.target.value)) onChange(e.target.value) }} className="select">
      {CASE_AXES.map(a => <option key={a.key} value={a.key}>{axisOptionLabel(a, counts.get(a.key) ?? 0)}</option>)}
    </select>
  )
}

function GroupSelect({ value, onChange }: { value: CaseGroupBy; onChange: (by: CaseGroupBy) => void }) {
  return (
    <select value={value} onChange={e => { if (isCaseGroupBy(e.target.value)) onChange(e.target.value) }} className="select">
      {CASE_GROUP_BYS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
    </select>
  )
}

// A bound is typed into a draft and goes into the URL on Enter or on leaving
// the field. Writing every keystroke to the URL would lose keystrokes: the
// router applies URL changes as a transition, after React has put the input
// back to the value it last rendered. Keyed on the URL value by its parent,
// so a reset or a new axis shows through.
function BoundInput({ value, label, placeholder, onCommit }: {
  value: string
  label: string
  placeholder: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const commit = () => { if (draft.trim() !== value) onCommit(draft.trim()) }
  return (
    <input
      type="number" step="any" value={draft} placeholder={placeholder} aria-label={label}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit() }}
      className="input input-sm num w-20"
    />
  )
}

function RangeInputs({ axis, min, max, onChange }: {
  axis: 'X' | 'Y'
  min: string
  max: string
  onChange: (min: string, max: string) => void
}) {
  return (
    <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[12.5px] text-ink-2">{axis} range</span>
      <BoundInput key={`min-${min}`} value={min} placeholder="min" label={`${axis} minimum`} onCommit={v => onChange(v, max)} />
      <span className="text-ink-3">–</span>
      <BoundInput key={`max-${max}`} value={max} placeholder="max" label={`${axis} maximum`} onCommit={v => onChange(min, v)} />
    </div>
  )
}

/** The cell-size plot view: any two measured or set quantities of the cases
 *  that pass the page's filters. Its settings live in the URL. */
export default function CasePlot({ items, allItems }: CasePlotProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const outline = useSyncExternalStore(subscribeTheme, surfaceColor, () => '#ffffff')
  const accent = useSyncExternalStore(subscribeTheme, accentColor, () => CASE_PALETTE[0])
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false)

  const state = useMemo(() => readPlotState(params), [params])
  const update = (next: CasePlotState) => setParams(writePlotState(params, next), { replace: true })

  const palette = useMemo(() => casePalette(accent), [accent])
  const counts = useMemo(() => valueCounts(items), [items])
  // The traces do not depend on the axis ranges, which only move the axes:
  // typing a range redraws the layout, not 1,866 points and their labels.
  const { x, y, color, shape, logx, logy } = state
  const pointState = useMemo(() => ({ ...CASE_PLOT_DEFAULT, x, y, color, shape, logx, logy }), [x, y, color, shape, logx, logy])
  const plot = useMemo(() => buildPlotData(items, pointState, allItems, palette), [items, pointState, allItems, palette])
  const traces = useMemo(() => buildTraces(plot, pointState, outline), [plot, pointState, outline])
  const layout = useMemo(() => buildLayout(state, narrow), [state, narrow])

  // The usual axes, offered when these draw nothing and those would.
  const offDefault = state.x !== CASE_PLOT_DEFAULT.x || state.y !== CASE_PLOT_DEFAULT.y || !state.logx || !state.logy
  const defaultPlots = useMemo(
    () => buildPlotData(items, { ...CASE_PLOT_DEFAULT, color: '' }, []).plotted > 0,
    [items],
  )
  const toDefaultAxes = () => update(withoutRanges({ ...state, x: CASE_PLOT_DEFAULT.x, y: CASE_PLOT_DEFAULT.y, logx: true, logy: true }))

  const onPointClick = useCallback(({ customdata }: { customdata?: unknown }) => {
    if (typeof customdata === 'number') {
      navigate(`/cases/${customdata}`, { state: { backTo: location.pathname + location.search } })
    }
  }, [navigate, location.pathname, location.search])

  const reasons = exclusionReasons(plot, state)
  const summary = plotSummary(plot, state)
  const logDropped = plot.nonPositiveX + plot.nonPositiveY > 0
  const errorBars = hasErrorBars(traces)
  const noun = (n: number) => (n === 1 ? 'case' : 'cases')
  const toLinear = () => update(linearWhereDropped(state, plot))

  return (
    <div className="space-y-4">
      {/* Always mounted, so a change that empties the plot is announced too. */}
      <p role="status" aria-live="polite" className="sr-only">{summary}</p>

      <div className="panel p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="X axis">
          <AxisSelect value={state.x} counts={counts} onChange={key => update(withAxis(state, 'x', key))} />
        </Field>
        <Field label="Y axis">
          <AxisSelect value={state.y} counts={counts} onChange={key => update(withAxis(state, 'y', key))} />
        </Field>
        <Field label="Colour by">
          <GroupSelect value={state.color} onChange={by => update({ ...state, color: by })} />
        </Field>
        <Field label="Marker shape by">
          <GroupSelect value={state.shape} onChange={by => update({ ...state, shape: by })} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-line">
          <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 whitespace-nowrap">
            <input type="checkbox" checked={state.logx} onChange={e => update({ ...state, logx: e.target.checked })} className="accent-[var(--accent)]" /> Log x
          </label>
          <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 whitespace-nowrap">
            <input type="checkbox" checked={state.logy} onChange={e => update({ ...state, logy: e.target.checked })} className="accent-[var(--accent)]" /> Log y
          </label>
          <RangeInputs axis="X" min={state.xmin} max={state.xmax} onChange={(xmin, xmax) => update({ ...state, xmin, xmax })} />
          <RangeInputs axis="Y" min={state.ymin} max={state.ymax} onChange={(ymin, ymax) => update({ ...state, ymin, ymax })} />
          {hasRanges(state) && (
            <button type="button" onClick={() => update(withoutRanges(state))} className="btn btn-ghost btn-sm">Reset ranges</button>
          )}
          <button type="button" onClick={() => update(swapAxes(state))} className="btn btn-ghost btn-sm">
            <Icon name="sort" size={14} className="rotate-90" /> Swap axes
          </button>
        </div>
      </div>

      {plot.plotted === 0 ? (
        items.length === 0 ? (
          <EmptyState title="No cases match the filters">Loosen the filters to plot cell sizes.</EmptyState>
        ) : (
          <EmptyState
            title="Nothing to plot"
            action={(logDropped || (offDefault && defaultPlots)) && (
              <div className="flex flex-wrap justify-center gap-2 max-w-full">
                {logDropped && (
                  <button type="button" onClick={toLinear} className="btn btn-primary btn-sm">Use a linear scale</button>
                )}
                {offDefault && defaultPlots && (
                  <button type="button" onClick={toDefaultAxes} className="btn btn-secondary btn-sm">
                    Plot {caseAxis(CASE_PLOT_DEFAULT.y).name} against {caseAxis(CASE_PLOT_DEFAULT.x).name}
                  </button>
                )}
              </div>
            )}
          >
            None of the {fmtCount(items.length)} {noun(items.length)} can be drawn with these axes
            {reasons.length > 0 ? `: ${reasons.join(', ')}.` : '.'} Try another pair of axes or loosen the filters.
          </EmptyState>
        )
      ) : (
        <div className="panel p-3">
          <div className="flex flex-wrap items-start justify-between gap-2 px-1 pb-2">
            <div className="min-w-0 flex-[1_1_16rem] text-[13px] text-ink-2">
              <p>
                Plotting <span className="num text-ink font-medium">{fmtCount(plot.plotted)}</span> of{' '}
                <span className="num">{fmtCount(plot.total)}</span> {noun(plot.total)}
                {reasons.length > 0 ? <>. Not plotted: {reasons.join(', ')}.</> : '.'}
              </p>
              {logDropped && (
                <button type="button" onClick={toLinear} className="btn btn-secondary btn-sm mt-2">Use a linear scale</button>
              )}
            </div>
            <button
              type="button"
              onClick={() => downloadCasesCsv(plot.plottedItems, `cell_size_plotted_${new Date().toISOString().slice(0, 10)}.csv`)}
              className="btn btn-secondary btn-sm"
            >
              <Icon name="download" size={14} /> Download plotted cases
            </button>
          </div>
          <LazyPlotlyChart data={traces} layout={layout} onPointClick={onPointClick} />
          <p className="px-1 pt-1 text-[12.5px] text-ink-3">
            Click a point to open its case.
            {errorBars && ' Error bars show the uncertainty the source reports for the cell width or length.'}
          </p>
        </div>
      )}
    </div>
  )
}
