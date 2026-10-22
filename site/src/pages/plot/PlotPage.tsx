import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useAllCases } from '../../data/hooks'
import PageHeader from '../../components/PageHeader'
import FacetRail from '../../components/FacetRail'
import ActiveFilters from '../../components/ActiveFilters'
import Skeleton from '../../components/Skeleton'
import ErrorMessage from '../../components/ErrorMessage'
import EmptyState from '../../components/EmptyState'
import LazyPlotlyChart from '../../components/LazyPlotlyChart'
import Icon from '../../components/Icon'
import { countActiveFilters, listValues, numberParam } from '../../components/filters'
import { downloadCasesCsv } from '../../lib/csv'
import { fmtCount } from '../../lib/format'
import type { CaseListItem } from '../../types/case'
import { HIDDEN_MEASUREMENTS } from '../../config'

const AXIS_OPTIONS = [
  { value: 'initial_pressure_kpa', label: 'Initial pressure (kPa)' },
  { value: 'initial_temperature_k', label: 'Initial temperature (K)' },
  { value: 'equivalence_ratio', label: 'Equivalence ratio' },
  { value: 'cell_width_mm', label: 'Cell width (mm)' },
  { value: 'cell_length_mm', label: 'Cell length (mm)' },
  { value: 'primary_diluent_percentage', label: 'Diluent (%)' },
  { value: 'primary_dopant_ppm', label: 'Dopant (ppm)' },
  { value: 'critical_hydraulic_diameter_mm', label: 'Critical tube diameter (mm)' },
  { value: 'minimum_hydraulic_diameter_mm', label: 'Minimum tube diameter (mm)' },
  { value: 'critical_energy_j', label: 'Critical energy (J)' },
].filter(o => !HIDDEN_MEASUREMENTS.has(o.value))

const GROUP_OPTIONS = [
  { value: '', label: 'Nothing' },
  { value: 'title', label: 'Series (title)' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'oxidizer', label: 'Oxidizer' },
  { value: 'setup', label: 'Setup' },
  { value: 'geometry', label: 'Geometry' },
  { value: 'primary_diluent_name', label: 'Diluent' },
  { value: 'primary_dopant_name', label: 'Dopant' },
]

const MARKER_SYMBOLS = [
  'circle', 'square', 'diamond', 'cross', 'x', 'triangle-up', 'triangle-down',
  'triangle-left', 'triangle-right', 'pentagon', 'hexagon', 'star', 'hexagram',
  'star-triangle-up', 'star-diamond', 'hourglass', 'bowtie',
]

const UNCERTAINTY_MAP: Record<string, string> = {
  cell_width_mm: 'cell_width_uncertainty_mm',
  cell_length_mm: 'cell_length_uncertainty_mm',
}

function axisLabel(field: string): string {
  return AXIS_OPTIONS.find(o => o.value === field)?.label ?? field
}

function getVal(item: CaseListItem, field: string): number | null {
  const v = (item as unknown as Record<string, unknown>)[field]
  return typeof v === 'number' ? v : null
}

function getUncertainty(item: CaseListItem, field: string): number | null {
  const uField = UNCERTAINTY_MAP[field]
  if (!uField) return null
  const v = (item as unknown as Record<string, unknown>)[uField]
  return typeof v === 'number' ? v : null
}

// Plotly expects log-axis ranges as log10 exponents; bounds <= 0 or non-finite
// are dropped (undefined) so Plotly auto-fits that side.
function toAxisRange(range: (number | undefined)[] | undefined, log: boolean): (number | undefined)[] | undefined {
  if (!range) return undefined
  if (!log) return range
  return range.map(v => (v != null && Number.isFinite(v) && v > 0 ? Math.log10(v) : undefined))
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

export default function PlotPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [xAxis, setXAxis] = useState('initial_pressure_kpa')
  const [yAxis, setYAxis] = useState('cell_width_mm')
  const [colorBy, setColorBy] = useState('fuel')
  const [shapeBy, setShapeBy] = useState('')
  const [xMin, setXMin] = useState('')
  const [xMax, setXMax] = useState('')
  const [yMin, setYMin] = useState('')
  const [yMax, setYMax] = useState('')
  const [xLog, setXLog] = useState(true)
  const [yLog, setYLog] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const queryParams = {
    q: params.get('q')?.trim() || undefined,
    fuel: listValues(params, 'fuel').join(',') || undefined,
    oxidizer: listValues(params, 'oxidizer').join(',') || undefined,
    setup: listValues(params, 'setup').join(',') || undefined,
    geometry: listValues(params, 'geometry').join(',') || undefined,
    primary_diluent_name: listValues(params, 'primary_diluent_name').join(',') || undefined,
    primary_dopant_name: listValues(params, 'primary_dopant_name').join(',') || undefined,
    equivalence_ratio_min: numberParam(params, 'equivalence_ratio_min'),
    equivalence_ratio_max: numberParam(params, 'equivalence_ratio_max'),
    pressure_min: numberParam(params, 'pressure_min'),
    pressure_max: numberParam(params, 'pressure_max'),
    temperature_min: numberParam(params, 'temperature_min'),
    temperature_max: numberParam(params, 'temperature_max'),
  }

  const { data, isLoading, isError, refetch } = useAllCases(queryParams)
  const activeCount = countActiveFilters(params)

  const validItems = useMemo(
    () => (data?.items ?? []).filter(
      item => getVal(item, xAxis) !== null && getVal(item, yAxis) !== null
    ),
    [data, xAxis, yAxis]
  )

  const xRange = xMin || xMax ? [xMin ? Number(xMin) : undefined, xMax ? Number(xMax) : undefined] : undefined
  const yRange = yMin || yMax ? [yMin ? Number(yMin) : undefined, yMax ? Number(yMax) : undefined] : undefined

  const traces = useMemo(() => {
    const buildErrorBar = (field: string, items: CaseListItem[]) => {
      if (!UNCERTAINTY_MAP[field]) return undefined
      const arr = items.map(i => getUncertainty(i, field) ?? 0)
      if (arr.every(v => v === 0)) return undefined
      return { type: 'data' as const, array: arr, visible: true }
    }
    const hover = (i: CaseListItem) => `${i.title}<br>${i.fuel} / ${i.oxidizer}`

    if (!colorBy && !shapeBy) {
      return [{
        x: validItems.map(i => getVal(i, xAxis)),
        y: validItems.map(i => getVal(i, yAxis)),
        text: validItems.map(hover),
        customdata: validItems.map(i => i.id),
        type: 'scatter' as const,
        mode: 'markers' as const,
        marker: { size: 7, opacity: 0.85 },
        error_x: buildErrorBar(xAxis, validItems),
        error_y: buildErrorBar(yAxis, validItems),
      }]
    }

    const getField = (item: CaseListItem, field: string) =>
      String((item as unknown as Record<string, unknown>)[field] ?? 'none')

    const shapeValues = shapeBy ? [...new Set(validItems.map(i => getField(i, shapeBy)))] : ['']
    const shapeMap = new Map(shapeValues.map((v, i) => [v, MARKER_SYMBOLS[i % MARKER_SYMBOLS.length]]))

    const groups = new Map<string, { items: CaseListItem[]; colorKey: string; shapeKey: string }>()
    for (const item of validItems) {
      const cKey = colorBy ? getField(item, colorBy) : ''
      const sKey = shapeBy ? getField(item, shapeBy) : ''
      const groupKey = `${cKey}|||${sKey}`
      if (!groups.has(groupKey)) groups.set(groupKey, { items: [], colorKey: cKey, shapeKey: sKey })
      groups.get(groupKey)!.items.push(item)
    }

    return Array.from(groups.values()).map(({ items, colorKey, shapeKey }) => {
      const parts = []
      if (colorBy && colorKey) parts.push(colorKey)
      if (shapeBy && shapeKey) parts.push(shapeKey)
      const name = parts.join(' / ') || 'All'
      return {
        x: items.map(i => getVal(i, xAxis)),
        y: items.map(i => getVal(i, yAxis)),
        text: items.map(hover),
        customdata: items.map(i => i.id),
        name,
        type: 'scatter' as const,
        mode: 'markers' as const,
        marker: { size: 7, opacity: 0.85, symbol: shapeBy ? shapeMap.get(shapeKey) : 'circle' },
        error_x: buildErrorBar(xAxis, items),
        error_y: buildErrorBar(yAxis, items),
      }
    })
  }, [validItems, colorBy, shapeBy, xAxis, yAxis])

  const handlePointClick = useCallback(({ customdata }: { customdata?: unknown }) => {
    if (typeof customdata === 'number') {
      navigate(`/cases/${customdata}`, { state: { backTo: location.pathname + location.search } })
    }
  }, [navigate, location])

  const plotLayout = useMemo(() => ({
    xaxis: {
      title: { text: axisLabel(xAxis) },
      type: (xLog ? 'log' : 'linear') as 'log' | 'linear',
      ...(xRange ? { range: toAxisRange(xRange, xLog) } : {}),
    },
    yaxis: {
      title: { text: axisLabel(yAxis) },
      type: (yLog ? 'log' : 'linear') as 'log' | 'linear',
      ...(yRange ? { range: toAxisRange(yRange, yLog) } : {}),
    },
    showlegend: !!(colorBy || shapeBy),
    hovermode: 'closest' as const,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [xAxis, yAxis, xLog, yLog, xMin, xMax, yMin, yMax, colorBy, shapeBy])

  return (
    <div>
      <PageHeader
        title="Plot"
        description="Compare any two measured or set quantities across the cases that match the filters. Click a point to open its case."
      />

      <div className="container-x py-5 md:py-6 grid gap-6 md:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="md:sticky md:top-[72px] md:self-start md:max-h-[calc(100vh-88px)] md:overflow-y-auto md:pr-1">
          <button
            type="button"
            onClick={() => setFiltersOpen(o => !o)}
            className="btn btn-secondary w-full justify-between md:hidden"
            aria-expanded={filtersOpen}
          >
            <span className="inline-flex items-center gap-2"><Icon name="filter" size={15} /> Filters{activeCount > 0 ? ` (${activeCount})` : ''}</span>
            <Icon name="chevronDown" size={14} className={filtersOpen ? 'rotate-180' : ''} />
          </button>
          <div className={`${filtersOpen ? 'block mt-3 panel p-4' : 'hidden'} md:block md:mt-0 md:p-0 md:border-0 md:bg-transparent`}>
            <FacetRail />
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="panel p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="X axis">
              <select value={xAxis} onChange={e => setXAxis(e.target.value)} className="select">
                {AXIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Y axis">
              <select value={yAxis} onChange={e => setYAxis(e.target.value)} className="select">
                {AXIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Colour by">
              <select value={colorBy} onChange={e => setColorBy(e.target.value)} className="select">
                {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Marker shape by">
              <select value={shapeBy} onChange={e => setShapeBy(e.target.value)} className="select">
                {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-line">
              <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 whitespace-nowrap">
                <input type="checkbox" checked={xLog} onChange={e => setXLog(e.target.checked)} className="accent-[var(--accent)]" /> Log x
              </label>
              <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 whitespace-nowrap">
                <input type="checkbox" checked={yLog} onChange={e => setYLog(e.target.checked)} className="accent-[var(--accent)]" /> Log y
              </label>
              <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[12.5px] text-ink-2">X range</span>
                <input type="number" step="any" value={xMin} onChange={e => setXMin(e.target.value)} placeholder="min" aria-label="X minimum" className="input input-sm num w-20" />
                <span className="text-ink-3">–</span>
                <input type="number" step="any" value={xMax} onChange={e => setXMax(e.target.value)} placeholder="max" aria-label="X maximum" className="input input-sm num w-20" />
              </div>
              <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[12.5px] text-ink-2">Y range</span>
                <input type="number" step="any" value={yMin} onChange={e => setYMin(e.target.value)} placeholder="min" aria-label="Y minimum" className="input input-sm num w-20" />
                <span className="text-ink-3">–</span>
                <input type="number" step="any" value={yMax} onChange={e => setYMax(e.target.value)} placeholder="max" aria-label="Y maximum" className="input input-sm num w-20" />
              </div>
              {(xMin || xMax || yMin || yMax) && (
                <button type="button" onClick={() => { setXMin(''); setXMax(''); setYMin(''); setYMax('') }} className="btn btn-ghost btn-sm">Reset ranges</button>
              )}
            </div>
          </div>

          {activeCount > 0 && <ActiveFilters />}

          {isLoading && <div className="panel p-6"><Skeleton rows={8} /></div>}
          {isError && <ErrorMessage message="The cases could not be loaded." onRetry={refetch} />}
          {data && validItems.length === 0 && (
            <EmptyState title="Nothing to plot">
              No matching case has both <em>{axisLabel(xAxis)}</em> and <em>{axisLabel(yAxis)}</em>. Pick other axes or loosen the filters.
            </EmptyState>
          )}
          {data && validItems.length > 0 && (
            <div className="panel p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
                <p className="text-[13px] text-ink-2">
                  <span className="num text-ink font-medium">{fmtCount(validItems.length)}</span> {validItems.length === 1 ? 'case' : 'cases'} plotted
                  {data.items.length > validItems.length && <span> of {fmtCount(data.items.length)} matching</span>}
                </p>
                <button type="button" onClick={() => downloadCasesCsv(validItems, 'plotted_cases.csv')} className="btn btn-secondary btn-sm">
                  <Icon name="download" size={14} /> Download plotted cases
                </button>
              </div>
              <LazyPlotlyChart data={traces} layout={plotLayout} onPointClick={handlePointClick} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
