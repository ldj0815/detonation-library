import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useCaseList, useAllCases, useCategoryCounts } from '../../data/hooks'
import type { CaseListParams } from '../../data/query'
import PageHeader from '../../components/PageHeader'
import CategoryTabs from '../../components/CategoryTabs'
import FacetRail from '../../components/FacetRail'
import ActiveFilters from '../../components/ActiveFilters'
import DataTable from '../../components/DataTable'
import ColumnSelector from '../../components/ColumnSelector'
import { useVisibleColumns } from '../../components/columns'
import Pagination from '../../components/Pagination'
import Skeleton from '../../components/Skeleton'
import ErrorMessage from '../../components/ErrorMessage'
import EmptyState from '../../components/EmptyState'
import Icon from '../../components/Icon'
import { countActiveFilters, clearFilters, listValues, numberParam } from '../../components/filters'
import { categoryFor, type BrowseMode } from '../../lib/categories'
import { downloadCasesCsv } from '../../lib/csv'
import { fmtCount } from '../../lib/format'
import { HIDDEN_MEASUREMENTS } from '../../config'

const PAGE_SIZES = [25, 50, 100]

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest added' },
  { value: 'title:asc', label: 'Case key A–Z' },
  { value: 'fuel:asc', label: 'Fuel A–Z' },
  { value: 'equivalence_ratio:asc', label: 'φ, low to high' },
  { value: 'initial_pressure_kpa:asc', label: 'Pressure, low to high' },
  { value: 'initial_pressure_kpa:desc', label: 'Pressure, high to low' },
  { value: 'initial_temperature_k:asc', label: 'Temperature, low to high' },
  { value: 'cell_width_mm:asc', label: 'Cell width, small to large' },
  { value: 'cell_width_mm:desc', label: 'Cell width, large to small' },
  { value: 'critical_hydraulic_diameter_mm:asc', label: 'Critical diameter, small to large' },
  { value: 'critical_energy_j:asc', label: 'Critical energy, low to high' },
].filter(o => !HIDDEN_MEASUREMENTS.has(o.value.split(':')[0]))

interface BrowsePageProps {
  mode: BrowseMode
  focusSearch?: boolean
}

export default function BrowsePage({ mode, focusSearch = false }: BrowsePageProps) {
  const category = categoryFor(mode)
  const [params, setParams] = useSearchParams()
  const { visible, toggle, reset } = useVisibleColumns()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const counts = useCategoryCounts()

  const limit = PAGE_SIZES.includes(Number(params.get('limit'))) ? Number(params.get('limit')) : PAGE_SIZES[0]
  const offset = Number(params.get('offset') ?? 0)
  const sortBy = params.get('sort_by') ?? 'created_at'
  const sortDir = params.get('sort_dir') ?? 'desc'

  const filterParams: CaseListParams = {
    q: params.get('q')?.trim() || undefined,
    fuel: listValues(params, 'fuel').join(',') || undefined,
    oxidizer: listValues(params, 'oxidizer').join(',') || undefined,
    geometry: listValues(params, 'geometry').join(',') || undefined,
    primary_diluent_name: listValues(params, 'primary_diluent_name').join(',') || undefined,
    primary_dopant_name: listValues(params, 'primary_dopant_name').join(',') || undefined,
    equivalence_ratio_min: numberParam(params, 'equivalence_ratio_min'),
    equivalence_ratio_max: numberParam(params, 'equivalence_ratio_max'),
    pressure_min: numberParam(params, 'pressure_min'),
    pressure_max: numberParam(params, 'pressure_max'),
    temperature_min: numberParam(params, 'temperature_min'),
    temperature_max: numberParam(params, 'temperature_max'),
    setup: listValues(params, 'setup').join(',') || undefined,
    ...category.filter,
    sort_by: sortBy,
    sort_dir: sortDir,
  }

  const { data, isLoading, isError, refetch } = useCaseList({ ...filterParams, limit, offset })
  // The unpaged result set, for the CSV export. In-memory, so it costs little.
  const all = useAllCases(filterParams)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value == null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const onSort = (value: string) => {
    const [by, dir] = value.split(':')
    const next = new URLSearchParams(params)
    next.set('sort_by', by)
    next.set('sort_dir', dir)
    next.delete('offset')
    setParams(next, { replace: true })
  }

  const exportCsv = () => {
    if (!all.data) return
    downloadCasesCsv(all.data.items, `${category.mode === 'all' ? 'cases' : category.mode.replace('-', '_')}_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const activeCount = countActiveFilters(params)
  const forced = new Set(category.field ? [category.field] : [])
  const sortValue = SORT_OPTIONS.some(o => o.value === `${sortBy}:${sortDir}`) ? `${sortBy}:${sortDir}` : ''

  return (
    <div>
      <PageHeader
        title={category.label}
        description={category.description}
        tabs={<CategoryTabs active={category.mode} counts={counts.data} />}
      />

      <div className="container-x py-5 md:py-6 grid gap-6 md:grid-cols-[264px_minmax(0,1fr)]">
        {/* Filter rail */}
        <aside className="md:sticky md:top-[72px] md:self-start md:max-h-[calc(100vh-88px)] md:overflow-y-auto md:pr-1">
          <button
            type="button"
            onClick={() => setFiltersOpen(o => !o)}
            className="btn btn-secondary w-full justify-between md:hidden"
            aria-expanded={filtersOpen}
            aria-controls="facet-rail"
          >
            <span className="inline-flex items-center gap-2"><Icon name="filter" size={15} /> Filters{activeCount > 0 ? ` (${activeCount})` : ''}</span>
            <Icon name="chevronDown" size={14} className={filtersOpen ? 'rotate-180' : ''} />
          </button>
          <div id="facet-rail" className={`${filtersOpen ? 'block mt-3 panel p-4' : 'hidden'} md:block md:mt-0 md:p-0 md:border-0 md:bg-transparent`}>
            <FacetRail focusSearch={focusSearch} />
          </div>
        </aside>

        {/* Results */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
            <p className="text-[14px] text-ink mr-auto" aria-live="polite">
              {data ? (
                <><span className="num font-medium">{fmtCount(data.total)}</span> {data.total === 1 ? 'case' : 'cases'}</>
              ) : isLoading ? 'Loading…' : ''}
            </p>
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
              Sort
              <select value={sortValue} onChange={e => onSort(e.target.value)} className="select select-sm w-auto">
                {!sortValue && <option value="">Custom</option>}
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
              Rows
              <select value={limit} onChange={e => { const next = new URLSearchParams(params); next.set('limit', e.target.value); next.delete('offset'); setParams(next, { replace: true }) }} className="select select-sm w-auto">
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="hidden md:block">
              <ColumnSelector visible={visible} onToggle={toggle} onReset={reset} forced={forced} />
            </div>
            <button type="button" onClick={exportCsv} disabled={!all.data || all.data.total === 0} className="btn btn-secondary btn-sm" title="Download every case matching the current filters">
              <Icon name="download" size={14} /> Download CSV
            </button>
          </div>

          {activeCount > 0 && <div className="mb-3"><ActiveFilters /></div>}

          {isLoading && <Skeleton table rows={10} />}
          {isError && <ErrorMessage message="The case list could not be loaded." onRetry={refetch} />}
          {data && data.items.length === 0 && (
            <EmptyState
              title={activeCount > 0 ? 'No cases match these filters' : `No ${category.label} cases yet`}
              action={activeCount > 0 ? (
                <button type="button" onClick={() => setParams(clearFilters(params), { replace: true })} className="btn btn-primary">
                  Clear all filters
                </button>
              ) : category.placeholder ? (
                <Link to="/contribute" className="btn btn-primary hover:no-underline">Contribute data</Link>
              ) : undefined}
            >
              {activeCount > 0
                ? 'Try removing a filter or widening a range.'
                : category.placeholder
                  ? 'This category is ready for contributed data.'
                  : 'This category has no cases yet.'}
            </EmptyState>
          )}
          {data && data.items.length > 0 && (
            <>
              <DataTable items={data.items} visibleColumns={visible} forcedColumns={forced} />
              <div className="mt-4">
                <Pagination total={data.total} limit={limit} offset={offset} onChange={o => setParam('offset', String(o))} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
