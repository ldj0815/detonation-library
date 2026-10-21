interface SkeletonProps {
  rows?: number
  /** Table-shaped placeholder instead of text lines. */
  table?: boolean
}

export default function Skeleton({ rows = 5, table = false }: SkeletonProps) {
  if (table) {
    return (
      <div className="panel overflow-hidden" aria-busy="true" aria-label="Loading">
        <div className="skeleton h-9 rounded-none" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-3 py-2.5 border-t border-line">
            <div className="skeleton h-4" style={{ width: `${26 + (i % 3) * 6}%` }} />
            <div className="skeleton h-4 w-[8%]" />
            <div className="skeleton h-4 w-[8%]" />
            <div className="skeleton h-4 w-[10%]" />
            <div className="skeleton h-4 w-[10%]" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${70 + (i % 3) * 9}%` }} />
      ))}
    </div>
  )
}
