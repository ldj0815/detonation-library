import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useAllCases } from '../../api/cases'
import FilterBar from '../../components/FilterBar'
import Skeleton from '../../components/Skeleton'
import ErrorMessage from '../../components/ErrorMessage'
import LazyPlotlyChart from '../../components/LazyPlotlyChart'
import type { CaseListItem } from '../../types/case'

function downloadCsv(items: CaseListItem[]) {
  const headers = [
    'id', 'title', 'setup', 'geometry', 'fuel', 'oxidizer',
    'equivalence_ratio', 'initial_pressure_kpa', 'initial_temperature_k',
    'primary_diluent_name', 'primary_diluent_percentage',
    'primary_dopant_name', 'primary_dopant_ppm',
    'cell_width_mm', 'cell_width_uncertainty_mm', 'cell_length_mm', 'cell_length_uncertainty_mm',
    'critical_hydraulic_diameter_mm', 'minimum_hydraulic_diameter_mm', 'critical_energy_j',
    'contributor_name', 'doi_reference', 'created_at',
  ]
  const escapeCsv = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  const rows = items.map(item =>
    headers.map(h => {
      const v = (item as unknown as Record<string, unknown>)[h]
      return escapeCsv(v == null ? '' : String(v))
    }).join(',')
  )
  const csv = [headers.map(escapeCsv).join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plotted_cases.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const AXIS_OPTIONS = [
  { value: 'initial_pressure_kpa', label: 'Initial Pressure (kPa)' },
  { value: 'initial_temperature_k', label: 'Initial Temperature (K)' },
  { value: 'equivalence_ratio', label: 'Equivalence Ratio' },
  { value: 'cell_width_mm', label: 'Cell Width (mm)' },
  { value: 'cell_length_mm', label: 'Cell Length (mm)' },
  { value: 'primary_diluent_percentage', label: 'Diluent (%)' },
  { value: 'primary_dopant_ppm', label: 'Dopant (ppm)' },
  { value: 'critical_hydraulic_diameter_mm', label: 'Crit. Hydraulic Diameter (mm)' },
  { value: 'minimum_hydraulic_diameter_mm', label: 'Min. Hydraulic Diameter (mm)' },
  { value: 'critical_energy_j', label: 'Critical Energy (J)' },
]

const GROUP_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'title', label: 'Title' },
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

export default function PlotPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [xAxis, setXAxis] = useState('initial_pressure_kpa')
  const [yAxis, setYAxis] = useState('equivalence_ratio')
  const [colorBy, setColorBy] = useState('')
  const [shapeBy, setShapeBy] = useState('')
  const [xMin, setXMin] = useState('')
  const [xMax, setXMax] = useState('')
  const [yMin, setYMin] = useState('')
  const [yMax, setYMax] = useState('')
  const [xLog, setXLog] = useState(false)
  const [yLog, setYLog] = useState(false)

  const queryParams = {
    fuel: params.get('fuel') ?? undefined,
    oxidizer: params.get('oxidizer') ?? undefined,
    setup: params.get('setup') ?? undefined,
    geometry: params.get('geometry') ?? undefined,
    primary_diluent_name: params.get('primary_diluent_name') ?? undefined,
    primary_dopant_name: params.get('primary_dopant_name') ?? undefined,
    equivalence_ratio_min: params.get('equivalence_ratio_min') ? Number(params.get('equivalence_ratio_min')) : undefined,
    equivalence_ratio_max: params.get('equivalence_ratio_max') ? Number(params.get('equivalence_ratio_max')) : undefined,
    pressure_min: params.get('pressure_min') ? Number(params.get('pressure_min')) : undefined,
    pressure_max: params.get('pressure_max') ? Number(params.get('pressure_max')) : undefined,
    temperature_min: params.get('temperature_min') ? Number(params.get('temperature_min')) : undefined,
    temperature_max: params.get('temperature_max') ? Number(params.get('temperature_max')) : undefined,
  }

  const { data, isLoading, isError, refetch } = useAllCases(queryParams)

  const validItems = useMemo(
    () => (data?.items ?? []).filter(
      item => getVal(item, xAxis) !== null && getVal(item, yAxis) !== null
    ),
    [data, xAxis, yAxis]
  )

  const xRange = xMin || xMax ? [xMin ? Number(xMin) : undefined, xMax ? Number(xMax) : undefined] : undefined
  const yRange = yMin || yMax ? [yMin ? Number(yMin) : undefined, yMax ? Number(yMax) : undefined] : undefined

  function buildErrorBar(field: string, items: CaseListItem[]) {
    if (!UNCERTAINTY_MAP[field]) return undefined
    const arr = items.map(i => getUncertainty(i, field) ?? 0)
    if (arr.every(v => v === 0)) return undefined
    return { type: 'data' as const, array: arr, visible: true }
  }

  function buildTraces() {
    if (!colorBy && !shapeBy) {
      return [{
        x: validItems.map(i => getVal(i, xAxis)),
        y: validItems.map(i => getVal(i, yAxis)),
        text: validItems.map(i => `${i.title}<br>${i.fuel}/${i.oxidizer}`),
        customdata: validItems.map(i => i.id),
        type: 'scatter' as const,
        mode: 'markers' as const,
        marker: { size: 8, color: '#0064A4' },
        error_x: buildErrorBar(xAxis, validItems),
        error_y: buildErrorBar(yAxis, validItems),
      }]
    }

    // Build a combined grouping key from color and/or shape
    const getField = (item: CaseListItem, field: string) =>
      String((item as unknown as Record<string, unknown>)[field] ?? 'N/A')

    // Collect unique values for shape assignment
    const shapeValues = shapeBy ? [...new Set(validItems.map(i => getField(i, shapeBy)))] : ['']
    const shapeMap = new Map(shapeValues.map((v, i) => [v, MARKER_SYMBOLS[i % MARKER_SYMBOLS.length]]))

    // Group by combined key
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
        text: items.map(i => `${i.title}<br>${i.fuel}/${i.oxidizer}`),
        customdata: items.map(i => i.id),
        name,
        type: 'scatter' as const,
        mode: 'markers' as const,
        marker: {
          size: 8,
          symbol: shapeBy ? shapeMap.get(shapeKey) : 'circle',
        },
        error_x: buildErrorBar(xAxis, items),
        error_y: buildErrorBar(yAxis, items),
      }
    })
  }

  const handlePointClick = useCallback(({ customdata }: { customdata?: unknown }) => {
    if (typeof customdata === 'number') {
      navigate(`/cases/${customdata}`, { state: { backTo: location.pathname + location.search } })
    }
  }, [navigate, location])

  // Memoized so PlotlyChart's props keep a stable identity across unrelated
  // re-renders and it can update in place instead of rebuilding.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const traces = useMemo(() => buildTraces(), [validItems, colorBy, shapeBy, xAxis, yAxis])
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
      <div className="px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-uci-dark-blue mb-1">Plot</h1>
        <p className="text-sm text-gray-500">Compare case properties across datasets</p>
      </div>

      <FilterBar />

      <div className="px-8 py-4">
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            X-axis
            <select value={xAxis} onChange={e => setXAxis(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50">
              {AXIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Y-axis
            <select value={yAxis} onChange={e => setYAxis(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50">
              {AXIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 self-end pb-1">
            <input type="checkbox" checked={xLog} onChange={e => setXLog(e.target.checked)} />
            Log X
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 self-end pb-1">
            <input type="checkbox" checked={yLog} onChange={e => setYLog(e.target.checked)} />
            Log Y
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Color by
            <select value={colorBy} onChange={e => setColorBy(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50">
              {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Shape by
            <select value={shapeBy} onChange={e => setShapeBy(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50">
              {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-4 items-end mb-6">
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            X min
            <input type="number" step="any" value={xMin} onChange={e => setXMin(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 w-24 font-mono" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            X max
            <input type="number" step="any" value={xMax} onChange={e => setXMax(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 w-24 font-mono" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Y min
            <input type="number" step="any" value={yMin} onChange={e => setYMin(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 w-24 font-mono" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Y max
            <input type="number" step="any" value={yMax} onChange={e => setYMax(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 w-24 font-mono" />
          </label>
          <button
            onClick={() => { setXMin(''); setXMax(''); setYMin(''); setYMax('') }}
            className="text-xs text-uci-blue underline hover:no-underline self-end pb-1"
          >
            Reset range
          </button>
        </div>

        {isLoading && <Skeleton rows={8} />}
        {isError && <ErrorMessage message="Failed to load data." onRetry={refetch} />}
        {data && data.truncated && (
          <p className="text-yellow-700 text-xs mb-2">Showing the first {data.items.length.toLocaleString()} matching cases — narrow the filters to plot all matches.</p>
        )}
        {data && validItems.length === 0 && (
          <p className="text-gray-500 py-8 text-center">No data to plot. Adjust filters or select different axes.</p>
        )}
        {data && validItems.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-xs text-gray-400">{validItems.length} case{validItems.length !== 1 ? 's' : ''} plotted</p>
              <button
                onClick={() => downloadCsv(validItems)}
                className="text-xs text-uci-blue underline hover:no-underline"
              >
                Download CSV
              </button>
            </div>
            <LazyPlotlyChart
              data={traces}
              layout={plotLayout}
              onPointClick={handlePointClick}
            />
          </>
        )}
      </div>
    </div>
  )
}
