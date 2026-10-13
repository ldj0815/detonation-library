interface SkeletonProps {
  rows?: number
}

export default function Skeleton({ rows = 5 }: SkeletonProps) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-5 bg-gray-200 rounded w-full" style={{ width: `${80 + (i % 3) * 7}%` }} />
      ))}
    </div>
  )
}
