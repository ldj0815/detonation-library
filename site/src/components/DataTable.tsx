import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import Badge from './Badge'
import { ALL_COLUMNS } from './columns'
import type { CaseListItem } from '../types/case'

interface DataTableProps {
  items: CaseListItem[]
  total: number
  limit: number
  offset: number
  onPageChange: (offset: number) => void
  visibleColumns: Set<string>
}

type SortDir = 'asc' | 'desc'

function getCellValue(item: CaseListItem, key: string): React.ReactNode {
  const v = (item as unknown as Record<string, unknown>)[key]
  if (v == null) return '–'
  if (key === 'created_at') return new Date(v as string).toLocaleDateString()
  if (key === 'setup') return <Badge label={v as string} variant="setup" />
  if (key === 'sharing_link' && v) return <a href={v as string} target="_blank" rel="noopener noreferrer" className="text-uci-blue underline text-xs" onClick={e => e.stopPropagation()}>Link</a>
  if (typeof v === 'number') return <span className="font-mono">{v}</span>
  return String(v)
}

export default function DataTable({ items, total, limit, offset, onPageChange, visibleColumns }: DataTableProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.floor(offset / limit)
  const totalPages = Math.ceil(total / limit)
  const sortKey = searchParams.get('sort_by')
  const sortDir: SortDir = searchParams.get('sort_dir') === 'asc' ? 'asc' : 'desc'

  const visibleCols = ALL_COLUMNS.filter(c => visibleColumns.has(c.key))

  // The sort lives in the URL (sort_by/sort_dir) so it applies to the full
  // result set, not just the current page, and survives a shared link.
  const handleSort = (key: string) => {
    const next = new URLSearchParams(searchParams)
    const dir: SortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    next.set('sort_by', key)
    next.set('sort_dir', dir)
    next.set('offset', '0')
    setSearchParams(next, { replace: true })
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              {visibleCols.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)}
                  className="px-3 py-2 font-semibold text-gray-700 cursor-pointer hover:text-uci-blue select-none whitespace-nowrap">
                  {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} onClick={() => navigate(`/cases/${item.id}`, { state: { backTo: location.pathname + location.search } })}
                className={`cursor-pointer hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                {visibleCols.map(col => (
                  <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                    {col.key === 'title' ? <span className="text-uci-blue font-medium">{item.title}</span> : getCellValue(item, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end mt-3 text-sm">
          <button disabled={page === 0} onClick={() => onPageChange(Math.max(0, offset - limit))} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-gray-500">Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => onPageChange(offset + limit)} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}
    </div>
  )
}
