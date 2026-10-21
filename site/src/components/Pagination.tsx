import Icon from './Icon'

interface Props {
  total: number
  limit: number
  offset: number
  onChange: (offset: number) => void
}

function pageList(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i)
  const set = new Set<number>([0, pages - 1, page - 1, page, page + 1])
  if (page <= 2) [1, 2, 3].forEach(p => set.add(p))
  if (page >= pages - 3) [pages - 4, pages - 3, pages - 2].forEach(p => set.add(p))
  const sorted = Array.from(set).filter(p => p >= 0 && p < pages).sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap')
    out.push(p)
  })
  return out
}

export default function Pagination({ total, limit, offset, onChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / limit))
  const page = Math.min(pages - 1, Math.floor(offset / limit))
  const first = total === 0 ? 0 : offset + 1
  const last = Math.min(total, offset + limit)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-2">
      <p>
        Showing <span className="num text-ink">{first.toLocaleString('en-US')}–{last.toLocaleString('en-US')}</span> of{' '}
        <span className="num text-ink">{total.toLocaleString('en-US')}</span>
      </p>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button type="button" disabled={page === 0} onClick={() => onChange(Math.max(0, offset - limit))} className="btn btn-secondary btn-sm w-8 px-0" aria-label="Previous page">
            <Icon name="chevronLeft" size={14} />
          </button>
          {pageList(page, pages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-ink-3">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p * limit)}
                aria-current={p === page ? 'page' : undefined}
                className={`btn btn-sm min-w-8 px-2 num ${p === page ? 'btn-primary' : 'btn-ghost'}`}
              >
                {p + 1}
              </button>
            )
          )}
          <button type="button" disabled={page >= pages - 1} onClick={() => onChange(offset + limit)} className="btn btn-secondary btn-sm w-8 px-0" aria-label="Next page">
            <Icon name="chevronRight" size={14} />
          </button>
        </nav>
      )}
    </div>
  )
}
