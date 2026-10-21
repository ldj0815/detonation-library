interface BadgeProps {
  label: string
  variant?: 'setup' | 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'
}

const variants: Record<string, string> = {
  setup: 'badge badge-accent',
  accent: 'badge badge-accent',
  neutral: 'badge',
  ok: 'badge badge-ok',
  warn: 'badge badge-warn',
  danger: 'badge badge-danger',
}

export default function Badge({ label, variant = 'neutral' }: BadgeProps) {
  return <span className={variants[variant] ?? variants.neutral}>{label}</span>
}
