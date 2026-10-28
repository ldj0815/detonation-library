import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { RdePublication } from '../../types/rde'
import Icon from '../../components/Icon'
import { RDE_FACETS, RDE_MEASURES, RDE_RANGES, parseRdeFilters } from '../../data/rde'
import { fmtRde } from '../../lib/rdeFields'

interface Chip {
  key: string
  label: string
  remove: (p: URLSearchParams) => void
}

function removeValue(p: URLSearchParams, param: string, values: string[], value: string) {
  const rest = values.filter(v => v !== value)
  if (rest.length) p.set(param, rest.join(','))
  else p.delete(param)
}

interface RdeActiveFiltersProps {
  pubs: Map<number, RdePublication>
  onClearAll: () => void
  /** Where focus goes when the last chip is removed. */
  focusResults: () => void
}

/** One removable chip per active RDE filter. */
export default function RdeActiveFilters({ pubs, onClearAll, focusResults }: RdeActiveFiltersProps) {
  const [params, setParams] = useSearchParams()
  const listRef = useRef<HTMLDivElement>(null)
  const clearRef = useRef<HTMLButtonElement>(null)
  const f = parseRdeFilters(params)

  const chips: Chip[] = []
  if (f.q) chips.push({ key: 'q', label: `“${f.q}”`, remove: p => p.delete('q') })

  for (const facet of RDE_FACETS) {
    const values = f.lists[facet.param] ?? []
    for (const value of values) {
      chips.push({
        key: `${facet.param}:${value}`,
        label: `${facet.label}: ${facet.display(value, pubs)}`,
        remove: p => removeValue(p, facet.param, values, value),
      })
    }
  }

  for (const value of f.has) {
    const m = RDE_MEASURES.find(x => x.value === value)
    if (m) chips.push({ key: `has:${value}`, label: `Has ${m.label.toLowerCase()}`, remove: p => removeValue(p, 'has', f.has, value) })
  }

  for (const r of RDE_RANGES) {
    const range = f.ranges[r.param]
    if (!range) continue
    const unit = r.unit ? ` ${r.unit}` : ''
    const min = `${r.param}_min`, max = `${r.param}_max`
    if (range.min != null && range.max != null) {
      chips.push({ key: r.param, label: `${r.label} ${fmtRde(range.min)}–${fmtRde(range.max)}${unit}`, remove: p => { p.delete(min); p.delete(max) } })
    } else if (range.min != null) {
      chips.push({ key: r.param, label: `${r.label} ≥ ${fmtRde(range.min)}${unit}`, remove: p => p.delete(min) })
    } else if (range.max != null) {
      chips.push({ key: r.param, label: `${r.label} ≤ ${fmtRde(range.max)}${unit}`, remove: p => p.delete(max) })
    }
  }

  if (chips.length === 0) return null

  const remove = (i: number) => {
    // Focus moves before the chip goes: to the next chip, else Clear all, else the results count.
    const next = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-chip-remove]')[i + 1]
    if (next) next.focus()
    else if (chips.length > 1) clearRef.current?.focus()
    else focusResults()
    const p = new URLSearchParams(params)
    chips[i].remove(p)
    p.delete('offset')
    setParams(p, { replace: true })
  }

  return (
    <div ref={listRef} role="group" className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {chips.map((chip, i) => (
        <span key={chip.key} className="chip max-w-full">
          <span className="min-w-0 truncate">{chip.label}</span>
          <button type="button" data-chip-remove onClick={() => remove(i)} aria-label={`Remove filter ${chip.label}`} className="shrink-0">
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
      <button ref={clearRef} type="button" onClick={onClearAll} className="btn btn-ghost btn-sm">
        Clear all
      </button>
    </div>
  )
}
