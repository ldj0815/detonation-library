import type { ReactNode } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import Badge from './Badge'
import Icon from './Icon'
import { ALL_COLUMNS, type ColumnDef } from './columns'
import { fmtNum, fmtDate, parseTitle, parseReference, mixtureLine, fmtMeasure } from '../lib/format'
import type { CaseListItem } from '../types/case'

interface DataTableProps {
  items: CaseListItem[]
  visibleColumns: Set<string>
  /** Columns always shown regardless of the user's selection. */
  forcedColumns?: Set<string>
}

type SortDir = 'asc' | 'desc'

function rec(item: CaseListItem): Record<string, unknown> {
  return item as unknown as Record<string, unknown>
}

function cell(item: CaseListItem, col: ColumnDef): ReactNode {
  const v = rec(item)[col.key]
  if (col.key === 'title') {
    const t = parseTitle(item.title)
    return t.key
      ? <span><span className="num text-ink">{t.key}</span><span className="text-ink-2"> {parseReference(t.reference)?.label ?? t.reference}</span></span>
      : <span className="text-ink font-medium">{item.title}</span>
  }
  if (v == null) return <span className="cell-empty">—</span>
  if (col.key === 'doi_reference') {
    const r = parseReference(v as string)
    return r ? <span className="text-ink-2">{r.label}</span> : String(v)
  }
  if (col.key === 'created_at') return fmtDate(v as string)
  if (col.key === 'setup') return <Badge label={v as string} variant="setup" />
  if (col.key === 'sharing_link') {
    return (
      <a href={v as string} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px]" onClick={e => e.stopPropagation()}>
        Open <Icon name="external" size={11} />
      </a>
    )
  }
  if (typeof v === 'number') {
    const u = col.uncertaintyKey ? rec(item)[col.uncertaintyKey] : null
    return typeof u === 'number' ? <span>{fmtNum(v)} <span className="text-ink-3">±</span> {fmtNum(u)}</span> : fmtNum(v)
  }
  return String(v)
}

function measurementsLine(item: CaseListItem): string {
  const parts: string[] = []
  if (item.cell_width_mm != null) parts.push(`cell width ${fmtMeasure(item.cell_width_mm, item.cell_width_uncertainty_mm, 'mm')}`)
  if (item.cell_length_mm != null) parts.push(`cell length ${fmtMeasure(item.cell_length_mm, item.cell_length_uncertainty_mm, 'mm')}`)
  if (item.critical_hydraulic_diameter_mm != null) parts.push(`critical dia. ${fmtNum(item.critical_hydraulic_diameter_mm)} mm`)
  if (item.minimum_hydraulic_diameter_mm != null) parts.push(`minimum dia. ${fmtNum(item.minimum_hydraulic_diameter_mm)} mm`)
  if (item.critical_energy_j != null) parts.push(`critical energy ${fmtNum(item.critical_energy_j)} J`)
  return parts.join(', ')
}

export default function DataTable({ items, visibleColumns, forcedColumns }: DataTableProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const sortKey = searchParams.get('sort_by')
  const sortDir: SortDir = searchParams.get('sort_dir') === 'asc' ? 'asc' : 'desc'

  const cols = ALL_COLUMNS.filter(c => visibleColumns.has(c.key) || forcedColumns?.has(c.key))

  // Sorting lives in the URL (sort_by / sort_dir) so it applies to the whole
  // result set, not just this page, and survives a refresh.
  const handleSort = (key: string) => {
    const next = new URLSearchParams(searchParams)
    const dir: SortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    next.set('sort_by', key)
    next.set('sort_dir', dir)
    next.set('offset', '0')
    setSearchParams(next, { replace: true })
  }

  const open = (id: number) => navigate(`/cases/${id}`, { state: { backTo: location.pathname + location.search } })

  return (
    <div>
      {/* Table (tablet and up) */}
      <div className="hidden md:block panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {cols.map(col => {
                const sorted = sortKey === col.key
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`sortable ${col.numeric ? 'col-num' : ''} ${sorted ? 'sorted' : ''}`}
                    aria-sort={sorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sorted && <Icon name="chevronDown" size={12} className={sortDir === 'asc' ? 'rotate-180' : ''} />}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} onClick={() => open(item.id)} className="row-link" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') open(item.id) }}>
                {cols.map(col => (
                  <td key={col.key} className={col.numeric ? 'col-num' : ''}>
                    {cell(item, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards (phones) */}
      <ul className="md:hidden space-y-2">
        {items.map(item => {
          const t = parseTitle(item.title)
          const m = measurementsLine(item)
          return (
            <li key={item.id}>
              <button type="button" onClick={() => open(item.id)} className="panel w-full text-left px-4 py-3 hover:bg-accent-soft transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] text-ink">
                      {t.key ? <><span className="num">{t.key}</span> <span className="text-ink-2">{parseReference(t.reference)?.label ?? t.reference}</span></> : item.title}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-2 truncate">{mixtureLine(item)}</p>
                    {m && <p className="mt-1 text-[13px] num text-ink">{m}</p>}
                  </div>
                  <Icon name="chevronRight" size={16} className="shrink-0 mt-1 text-ink-3" />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
