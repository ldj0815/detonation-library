interface BadgeProps {
  label: string
  variant?: 'setup' | 'neutral'
}

const variants: Record<string, string> = {
  setup: 'bg-uci-blue text-white',
  neutral: 'bg-gray-100 text-gray-700',
}

export default function Badge({ label, variant = 'neutral' }: BadgeProps) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${variants[variant] ?? variants.neutral}`}>
      {label}
    </span>
  )
}
