import { useSearchParams } from 'react-router-dom'
import { useCaseList } from '../data/hooks'
import FilterBar from '../components/FilterBar'
import DataTable from '../components/DataTable'
import ColumnSelector from '../components/ColumnSelector'
import { useVisibleColumns } from '../components/columns'
import Skeleton from '../components/Skeleton'
import ErrorMessage from '../components/ErrorMessage'

const LIMIT = 25

export default function Search() {
  const [params, setParams] = useSearchParams()
  const { visible, toggle } = useVisibleColumns()
  const offset = Number(params.get('offset') ?? 0)
  const q = params.get('q') ?? ''

  const queryParams = {
    q: q || undefined,
    fuel: params.get('fuel') ?? undefined,
    oxidizer: params.get('oxidizer') ?? undefined,
    geometry: params.get('geometry') ?? undefined,
    setup: params.get('setup') ?? undefined,
    primary_diluent_name: params.get('primary_diluent_name') ?? undefined,
    primary_dopant_name: params.get('primary_dopant_name') ?? undefined,
    equivalence_ratio_min: params.get('equivalence_ratio_min') ? Number(params.get('equivalence_ratio_min')) : undefined,
    equivalence_ratio_max: params.get('equivalence_ratio_max') ? Number(params.get('equivalence_ratio_max')) : undefined,
    pressure_min: params.get('pressure_min') ? Number(params.get('pressure_min')) : undefined,
    pressure_max: params.get('pressure_max') ? Number(params.get('pressure_max')) : undefined,
    temperature_min: params.get('temperature_min') ? Number(params.get('temperature_min')) : undefined,
    temperature_max: params.get('temperature_max') ? Number(params.get('temperature_max')) : undefined,
    has_cell_size: params.get('has_cell_size') === 'true' ? true : undefined,
    has_critical_hd: params.get('has_critical_hd') === 'true' ? true : undefined,
    has_min_hd: params.get('has_min_hd') === 'true' ? true : undefined,
    has_critical_energy: params.get('has_critical_energy') === 'true' ? true : undefined,
    sort_by: params.get('sort_by') ?? undefined,
    sort_dir: params.get('sort_dir') ?? undefined,
    limit: LIMIT,
    offset,
  }

  const { data, isLoading, isError, refetch } = useCaseList(queryParams)

  const handlePageChange = (newOffset: number) => {
    const next = new URLSearchParams(params)
    next.set('offset', String(newOffset))
    setParams(next, { replace: true })
  }

  return (
    <div>
      <div className="px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-uci-dark-blue mb-4">Search</h1>
      </div>

      <FilterBar showSearch />

      <div className="px-8 py-4">
        <div className="mb-3">
          <ColumnSelector visible={visible} onToggle={toggle} />
        </div>

        {!data && !isLoading && (
          <p className="text-gray-400 py-8 text-center">Enter keywords or filters to search.</p>
        )}
        {isLoading && <Skeleton rows={8} />}
        {isError && <ErrorMessage message="Search failed." onRetry={refetch} />}
        {data && data.items.length === 0 && (
          <p className="text-gray-500 py-8 text-center">
            No results found.{' '}
            <button onClick={() => setParams({}, { replace: true })} className="text-uci-blue underline">
              Clear filters
            </button>
          </p>
        )}
        {data && data.items.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-3">{data.total} result{data.total !== 1 ? 's' : ''}</p>
            <DataTable
              items={data.items}
              total={data.total}
              limit={LIMIT}
              offset={offset}
              onPageChange={handlePageChange}
              visibleColumns={visible}
            />
          </>
        )}
      </div>
    </div>
  )
}
