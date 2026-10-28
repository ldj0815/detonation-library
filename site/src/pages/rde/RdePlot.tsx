import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { RdeNumericKey, RdeOperatingPoint, RdePublication } from '../../types/rde'
import EmptyState from '../../components/EmptyState'
import LazyPlotlyChart from '../../components/LazyPlotlyChart'
import Icon from '../../components/Icon'
import { downloadRdeCsv, useRde } from '../../data/rde'
import { isRdeNumericKey } from '../../lib/rdeFields'
import { fmtCount } from '../../lib/format'
import {
  RDE_COLOR_BYS,
  RDE_PALETTE,
  RDE_PLOT_PRESETS,
  activePreset,
  axisNotes,
  axisOptionLabel,
  buildLayout,
  buildPlotData,
  buildTraces,
  colorByLabel,
  exclusionReasons,
  fieldGroups,
  isRdeColorBy,
  ispOnAxis,
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

export interface RdePlotProps {
  /** The operating points that pass the page's filters. */
  points: RdeOperatingPoint[]
  pubs: Map<number, RdePublication>
}

const FIELD_GROUPS = fieldGroups()

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
const accentColor = () => cssVar('--accent', RDE_PALETTE[0])

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
  value: RdeNumericKey
  counts: Map<RdeNumericKey, number>
  onChange: (key: RdeNumericKey) => void
}) {
  return (
    <select value={value} onChange={e => { if (isRdeNumericKey(e.target.value)) onChange(e.target.value) }} className="select">
      {FIELD_GROUPS.map(g => (
        <optgroup key={g.group} label={g.label}>
          {g.fields.map(f => <option key={f.key} value={f.key}>{axisOptionLabel(f, counts.get(f.key) ?? 0)}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

export default function RdePlot({ points, pubs }: RdePlotProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const outline = useSyncExternalStore(subscribeTheme, surfaceColor, () => '#ffffff')
  const accent = useSyncExternalStore(subscribeTheme, accentColor, () => RDE_PALETTE[0])
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false)

  const state = useMemo(() => readPlotState(params), [params])
  const update = (next: RdePlotState) => setParams(writePlotState(params, next), { replace: true })

  // The whole release (cached), which the colours are ranked over so they do
  // not change with the filters.
  const rde = useRde()
  const all = rde.data?.operating_points ?? points
  const release = rde.data?.release ?? null
  const palette = useMemo(() => rdePalette(accent), [accent])

  const counts = useMemo(() => valueCounts(points), [points])
  const plot = useMemo(() => buildPlotData(points, pubs, state, all, palette), [points, pubs, state, all, palette])
  const traces = useMemo(() => buildTraces(plot, pubs, state, outline), [plot, pubs, state, outline])
  const layout = useMemo(() => buildLayout(state, narrow), [state, narrow])

  // Presets that would draw something, for the empty state.
  const fallbacks = useMemo(
    () => RDE_PLOT_PRESETS
      .map(p => ({ preset: p, plotted: buildPlotData(points, pubs, p.state, all).plotted }))
      .filter(f => f.plotted > 0),
    [points, pubs, all],
  )

  const onPointClick = useCallback(({ customdata }: { customdata?: unknown }) => {
    if (typeof customdata === 'number') navigate(`/browse/rde/${customdata}`, { state: { from: location.search } })
  }, [navigate, location.search])

  const preset = activePreset(state)
  const reasons = exclusionReasons(plot, state)
  const summary = plotSummary(plot, state)
  const notes = axisNotes(state)
  const plottedPoints = plot.series.flatMap(s => s.points)
  const logDropped = plot.nonPositiveX + plot.nonPositiveY > 0
  const noun = (n: number) => (n === 1 ? 'operating point' : 'operating points')

  return (
    <div className="space-y-4">
      {/* Always mounted, so a change that empties the plot is announced too. */}
      <p role="status" aria-live="polite" className="sr-only">{summary}</p>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Preset plots">
        <span className="text-[12.5px] text-ink-2 mr-1">Presets</span>
        {RDE_PLOT_PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            aria-pressed={preset?.id === p.id}
            onClick={() => update(p.state)}
            className={`btn btn-sm ${preset?.id === p.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="panel p-4 grid gap-3 sm:grid-cols-3">
        <Field label="X axis">
          <AxisSelect value={state.x} counts={counts} onChange={key => update(withAxis(state, 'x', key))} />
        </Field>
        <Field label="Y axis">
          <AxisSelect value={state.y} counts={counts} onChange={key => update(withAxis(state, 'y', key))} />
        </Field>
        <Field label="Colour by">
          <select
            value={state.color}
            onChange={e => { if (isRdeColorBy(e.target.value)) update({ ...state, color: e.target.value }) }}
            className="select"
          >
            {RDE_COLOR_BYS.map(c => <option key={c} value={c}>{colorByLabel(c)}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-3 flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-line">
          <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 whitespace-nowrap">
            <input type="checkbox" checked={state.logx} onChange={e => update({ ...state, logx: e.target.checked })} className="accent-[var(--accent)]" /> Log x
          </label>
          <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 whitespace-nowrap">
            <input type="checkbox" checked={state.logy} onChange={e => update({ ...state, logy: e.target.checked })} className="accent-[var(--accent)]" /> Log y
          </label>
          <button type="button" onClick={() => update(swapAxes(state))} className="btn btn-ghost btn-sm">
            <Icon name="sort" size={14} className="rotate-90" /> Swap axes
          </button>
        </div>
      </div>

      {ispOnAxis(state) && state.color !== 'engine' && (
        <div role="note" className="rounded-panel bg-warn-soft text-warn px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Icon name="alert" size={16} className="shrink-0" />
          <p className="text-[13px] flex-1 min-w-[16ch]">
            Specific impulse is not comparable across engine classes: each class divides by a different flow.
          </p>
          <button type="button" onClick={() => update({ ...state, color: 'engine' })} className="btn btn-secondary btn-sm">
            Colour by engine class
          </button>
        </div>
      )}

      {plot.plotted === 0 ? (
        points.length === 0 ? (
          <EmptyState title="No operating points match the filters">Loosen the filters to plot RDE data.</EmptyState>
        ) : (
          <EmptyState
            title="Nothing to plot"
            action={(logDropped || fallbacks.length > 0) && (
              <div className="flex flex-wrap justify-center gap-2 max-w-full">
                {logDropped && (
                  <button
                    type="button"
                    onClick={() => update(linearWhereDropped(state, plot))}
                    className="btn btn-primary btn-sm"
                  >
                    Use a linear scale
                  </button>
                )}
                {fallbacks.slice(0, 3).map(f => (
                  <button key={f.preset.id} type="button" onClick={() => update(f.preset.state)} className="btn btn-secondary btn-sm">
                    {f.preset.label}
                  </button>
                ))}
              </div>
            )}
          >
            None of the {fmtCount(points.length)} {noun(points.length)} can be drawn with these axes
            {reasons.length > 0 ? `: ${reasons.join(', ')}.` : '.'}
            {fallbacks.length > 0 ? ' Try another pair of fields or one of these presets.' : ' Try another pair of fields or loosen the filters.'}
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
              {plot.notSteady > 0 && (
                <p className="mt-0.5 text-ink-3">
                  {fmtCount(plot.notSteady)} of the plotted points {plot.notSteady === 1 ? 'is' : 'are'} not marked steady (transients and other types); the hover label gives each point's type.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => downloadRdeCsv(plottedPoints, pubs, release, `rde_plotted_${new Date().toISOString().slice(0, 10)}.csv`)}
              className="btn btn-secondary btn-sm"
            >
              <Icon name="download" size={14} /> Download plotted points
            </button>
          </div>
          <LazyPlotlyChart data={traces} layout={layout} onPointClick={onPointClick} />
          <p className="px-1 pt-1 text-[12.5px] text-ink-3">
            Click a point to open it. When you use a value, cite the original paper given there.
          </p>
        </div>
      )}

      {notes.length > 0 && (
        <ul className="space-y-1.5 text-[13px] text-ink-2">
          {notes.map(n => (
            <li key={n.key} className={n.emphasis ? 'flex gap-2 text-ink' : undefined}>
              {n.emphasis && <Icon name="info" size={15} className="mt-0.5 shrink-0 text-accent" />}
              <span><span className="font-medium text-ink">{n.label}.</span> {n.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
