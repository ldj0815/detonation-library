import { useSearchParams } from 'react-router-dom'
import Icon from './Icon'
import { LIST_PARAMS, LIST_LABELS, RANGE_PARAMS, REFERENCE_PARAM, listValues, countActiveFilters, clearFilters } from './filters'
import { parseReference } from '../lib/format'

interface Chip {
  label: string
  remove: (p: URLSearchParams) => void
}

export default function ActiveFilters() {
  const [params, setParams] = useSearchParams()
  if (countActiveFilters(params) === 0) return null

  const chips: Chip[] = []
  const q = params.get('q')?.trim()
  if (q) chips.push({ label: `“${q}”`, remove: p => p.delete('q') })

  const ref = params.get(REFERENCE_PARAM)?.trim()
  if (ref) {
    const parsed = parseReference(ref)
    const label = parsed?.index != null ? `${parsed.label}, ref. ${parsed.index}` : ref
    chips.push({ label: `Publication: ${label}`, remove: p => p.delete(REFERENCE_PARAM) })
  }

  for (const key of LIST_PARAMS) {
    for (const value of listValues(params, key)) {
      chips.push({
        label: `${LIST_LABELS[key]}: ${value === 'None' ? 'none' : value}`,
        remove: p => {
          const rest = listValues(p, key).filter(v => v !== value)
          if (rest.length) p.set(key, rest.join(','))
          else p.delete(key)
        },
      })
    }
  }

  for (const r of RANGE_PARAMS) {
    const min = params.get(`${r.key}_min`)
    const max = params.get(`${r.key}_max`)
    const unit = r.unit ? ` ${r.unit}` : ''
    if (min && max) chips.push({ label: `${r.label} ${min}–${max}${unit}`, remove: p => { p.delete(`${r.key}_min`); p.delete(`${r.key}_max`) } })
    else if (min) chips.push({ label: `${r.label} ≥ ${min}${unit}`, remove: p => p.delete(`${r.key}_min`) })
    else if (max) chips.push({ label: `${r.label} ≤ ${max}${unit}`, remove: p => p.delete(`${r.key}_max`) })
  }

  const apply = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    fn(next)
    next.delete('offset')
    setParams(next, { replace: true })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {chips.map(chip => (
        <span key={chip.label} className="chip">
          {chip.label}
          <button type="button" onClick={() => apply(chip.remove)} aria-label={`Remove filter ${chip.label}`}>
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => setParams(clearFilters(params), { replace: true })} className="btn btn-ghost btn-sm">
        Clear all
      </button>
    </div>
  )
}
