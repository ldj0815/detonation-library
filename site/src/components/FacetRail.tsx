import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFilterOptions } from '../data/hooks'
import type { FilterOption } from '../types/case'
import Icon from './Icon'
import { LIST_LABELS, RANGE_PARAMS, listValues, countActiveFilters, clearFilters, type ListParam } from './filters'

const SHOW_FIRST = 8

function CheckboxGroup({ param, options, defaultOpen }: { param: ListParam; options: FilterOption[]; defaultOpen: boolean }) {
  const [params, setParams] = useSearchParams()
  const selected = new Set(listValues(params, param))
  const [open, setOpen] = useState(defaultOpen || selected.size > 0)
  const [showAll, setShowAll] = useState(false)

  if (options.length === 0) return null

  const toggle = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    const p = new URLSearchParams(params)
    const joined = Array.from(next).join(',')
    if (joined) p.set(param, joined)
    else p.delete(param)
    p.delete('offset')
    setParams(p, { replace: true })
  }

  // Selected values stay visible even when they fall outside the first N.
  const shown = showAll ? options : options.filter((o, i) => i < SHOW_FIRST || selected.has(o.value))
  const hiddenCount = options.length - shown.length

  return (
    <section className="border-b border-line py-2.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between py-1 text-[13px] font-medium text-ink"
        aria-expanded={open}
      >
        <span>
          {LIST_LABELS[param]}
          {selected.size > 0 && <span className="ml-1.5 badge badge-accent h-[18px] px-1.5 text-[11px]">{selected.size}</span>}
        </span>
        <Icon name="chevronDown" size={14} className={`text-ink-3 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {shown.map(opt => (
            <li key={opt.value}>
              <label className="flex items-center gap-2 rounded-[4px] px-1 py-[3px] text-[13px] cursor-pointer hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={selected.has(opt.value)}
                  onChange={() => toggle(opt.value)}
                  className="accent-[var(--accent)]"
                />
                <span className={`flex-1 truncate ${opt.value === 'None' ? 'text-ink-2 italic' : ''}`}>{opt.value === 'None' ? 'none' : opt.value}</span>
                <span className="num text-[12px] text-ink-3">{opt.count.toLocaleString('en-US')}</span>
              </label>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li>
              <button type="button" onClick={() => setShowAll(true)} className="px-1 py-1 text-[12.5px] text-accent hover:underline">
                Show all {options.length}
              </button>
            </li>
          )}
          {showAll && options.length > SHOW_FIRST && (
            <li>
              <button type="button" onClick={() => setShowAll(false)} className="px-1 py-1 text-[12.5px] text-accent hover:underline">
                Show fewer
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

interface FacetRailProps {
  /** Hide the setup facet (for the RDE category, where it is fixed). */
  hideSetup?: boolean
  focusSearch?: boolean
}

export default function FacetRail({ hideSetup = false, focusSearch = false }: FacetRailProps) {
  const [params, setParams] = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const { data: opts } = useFilterOptions()
  const active = countActiveFilters(params)

  useEffect(() => {
    if (focusSearch) searchRef.current?.focus()
  }, [focusSearch])

  const apply = (e?: FormEvent) => {
    e?.preventDefault()
    if (!formRef.current) return
    const fd = new FormData(formRef.current)
    const next = new URLSearchParams(params)
    const keys = ['q', ...RANGE_PARAMS.flatMap(r => [`${r.key}_min`, `${r.key}_max`])]
    for (const name of keys) {
      const v = (fd.get(name) as string | null)?.trim()
      if (v) next.set(name, v)
      else next.delete(name)
    }
    next.delete('offset')
    setParams(next, { replace: true })
  }

  const clearAll = () => {
    setParams(clearFilters(params), { replace: true })
    formRef.current?.reset()
  }

  const showSetup = !hideSetup && (opts?.setups.length ?? 0) > 1

  return (
    <form ref={formRef} onSubmit={apply} className="text-[13px]">
      <div className="flex items-center justify-between pb-2.5 border-b border-line">
        <span className="text-[13px] font-semibold text-ink">Filters</span>
        {active > 0 && (
          <button type="button" onClick={clearAll} className="text-[12.5px] text-accent hover:underline">
            Clear all ({active})
          </button>
        )}
      </div>

      <section className="border-b border-line py-3">
        <label className="relative block">
          <span className="sr-only">Search within results</span>
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            ref={searchRef}
            type="search"
            name="q"
            key={params.get('q') ?? ''}
            defaultValue={params.get('q') ?? ''}
            placeholder="Search within results"
            className="input input-sm pl-8"
            onBlur={() => apply()}
          />
        </label>
      </section>

      {opts && (
        <>
          <CheckboxGroup param="fuel" options={opts.fuels} defaultOpen />
          <CheckboxGroup param="oxidizer" options={opts.oxidizers} defaultOpen />
          <CheckboxGroup param="primary_diluent_name" options={opts.primary_diluent_names} defaultOpen={false} />
          <CheckboxGroup param="primary_dopant_name" options={opts.primary_dopant_names} defaultOpen={false} />
          <CheckboxGroup param="geometry" options={opts.geometries} defaultOpen={false} />
          {showSetup && <CheckboxGroup param="setup" options={opts.setups} defaultOpen={false} />}
        </>
      )}

      <section className="py-3">
        <p className="text-[13px] font-medium text-ink mb-2">Conditions</p>
        <div className="space-y-2">
          {RANGE_PARAMS.map(r => (
            <div key={r.key} className="grid grid-cols-[2.6rem_1fr_auto_1fr] items-center gap-1.5">
              <span className="text-[12.5px] text-ink-2">{r.label}{r.unit && <span className="text-ink-3"> {r.unit}</span>}</span>
              <input
                type="number" step="any" inputMode="decimal"
                name={`${r.key}_min`}
                key={`${r.key}_min-${params.get(`${r.key}_min`) ?? ''}`}
                defaultValue={params.get(`${r.key}_min`) ?? ''}
                placeholder="min"
                aria-label={`${r.label} minimum`}
                className="input input-sm num px-2"
              />
              <span className="text-ink-3">–</span>
              <input
                type="number" step="any" inputMode="decimal"
                name={`${r.key}_max`}
                key={`${r.key}_max-${params.get(`${r.key}_max`) ?? ''}`}
                defaultValue={params.get(`${r.key}_max`) ?? ''}
                placeholder="max"
                aria-label={`${r.label} maximum`}
                className="input input-sm num px-2"
              />
            </div>
          ))}
        </div>
        <button type="submit" className="btn btn-secondary btn-sm mt-3">Apply conditions</button>
      </section>
    </form>
  )
}
