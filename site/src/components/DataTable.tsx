import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import Badge from './Badge'
import { useAdmin } from '../context/AdminContext'
import { useBulkAction } from '../api/mutations'
import { ALL_COLUMNS } from './ColumnSelector'
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
  const { isAdmin } = useAdmin()
  const bulkAction = useBulkAction()
  const page = Math.floor(offset / limit)
  const totalPages = Math.ceil(total / limit)
  const sortKey = searchParams.get('sort_by')
  const sortDir: SortDir = searchParams.get('sort_dir') === 'asc' ? 'asc' : 'desc'
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showBulkDelete, setShowBulkDelete] = useState(false)

  // Selection is per result-set; clear it whenever the rows change (page, sort,
  // or filter) so bulk actions never target rows the user can no longer see.
  useEffect(() => { setSelected(new Set()) }, [items])

  const visibleCols = ALL_COLUMNS.filter(c => visibleColumns.has(c.key))

  // Sorting is driven server-side (sort_by/sort_dir in the URL) so it applies to
  // the full result set, not just the current page.
  const handleSort = (key: string) => {
    const next = new URLSearchParams(searchParams)
    const dir: SortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    next.set('sort_by', key)
    next.set('sort_dir', dir)
    next.set('offset', '0')
    setSearchParams(next, { replace: true })
  }

  const allSelected = items.length > 0 && items.every(i => selected.has(i.id))
  const toggleAll = () => allSelected ? setSelected(new Set()) : setSelected(new Set(items.map(i => i.id)))
  const toggleOne = (id: number) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n) }
  const handleBulk = (action: string) => {
    if (action === 'delete') { setShowBulkDelete(true); return }
    bulkAction.mutate({ case_ids: Array.from(selected), action }, { onSuccess: () => setSelected(new Set()) })
  }

  return (
    <div>
      {isAdmin && selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button onClick={() => handleBulk('hide')} className="px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300">Hide</button>
          <button onClick={() => handleBulk('unhide')} className="px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300">Unhide</button>
          <button onClick={() => handleBulk('delete')} className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 underline ml-auto">Clear</button>
        </div>
      )}
      {isAdmin && bulkAction.isError && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {(bulkAction.error as Error)?.message ?? 'Bulk action failed.'}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              {isAdmin && <th className="px-3 py-2 w-8"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>}
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
                {isAdmin && (
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} />
                  </td>
                )}
                {visibleCols.map(col => (
                  <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                    {col.key === 'title' ? <span className="text-uci-blue font-medium">{item.title}</span> : getCellValue(item, col.key)}
                    {col.key === 'title' && isAdmin && item.hidden && <Badge label="Hidden" variant="neutral" />}
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
      {showBulkDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-bold text-red-600 mb-2">Delete {selected.size} Cases?</h3>
            <p className="text-sm text-gray-600 mb-4">This cannot be undone.</p>
            {bulkAction.isError && (
              <p className="text-sm text-red-600 mb-3">{(bulkAction.error as Error)?.message ?? 'Delete failed.'}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBulkDelete(false)} className="px-4 py-2 border border-gray-300 rounded text-sm font-semibold">Cancel</button>
              <button onClick={() => { bulkAction.mutate({ case_ids: Array.from(selected), action: 'delete' }, { onSuccess: () => { setSelected(new Set()); setShowBulkDelete(false) } }) }}
                className="px-4 py-2 bg-red-500 text-white rounded text-sm font-semibold hover:bg-red-600">
                {bulkAction.isPending ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
