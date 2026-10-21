import { Link, useSearchParams } from 'react-router-dom'
import { CATEGORIES, type BrowseMode } from '../lib/categories'

interface Props {
  active: BrowseMode
  counts?: Partial<Record<BrowseMode, number>>
}

/** Category tabs. Filters in the URL carry over when switching category. */
export default function CategoryTabs({ active, counts }: Props) {
  const [params] = useSearchParams()
  const carried = new URLSearchParams(params)
  carried.delete('offset')
  const qs = carried.toString()

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto no-scrollbar" aria-label="Categories">
      {CATEGORIES.map(c => {
        const isActive = c.mode === active
        const n = counts?.[c.mode]
        return (
          <Link
            key={c.mode}
            to={qs ? `${c.path}?${qs}` : c.path}
            aria-current={isActive ? 'page' : undefined}
            className={`relative inline-flex items-center gap-1.5 h-10 px-3 text-[13.5px] font-medium whitespace-nowrap hover:no-underline border-b-2 transition-colors ${
              isActive ? 'text-ink border-mark' : 'text-ink-2 border-transparent hover:text-ink'
            }`}
          >
            {c.label}
            {n != null && <span className={`num text-[12px] ${isActive ? 'text-ink-2' : 'text-ink-3'}`}>{n.toLocaleString('en-US')}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
