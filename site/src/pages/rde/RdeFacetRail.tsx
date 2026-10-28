import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { RdeDataset } from '../../types/rde'
import Icon from '../../components/Icon'
import {
  NOT_REPORTED,
  RDE_FACETS,
  RDE_RANGES,
  countRdeFilters,
  facetOptions,
  measureOptions,
  parseRdeFilters,
  type RdeOption,
} from '../../data/rde'
import { rdeAxisTitle, rdeField } from '../../lib/rdeFields'

const SHOW_FIRST = 8
// Long lists most visitors do not start from.
const COLLAPSED = new Set(['publication', 'op_type'])

// The typed inputs: the search and each range's ends.
const DRAFT_KEYS = ['q', ...RDE_RANGES.flatMap(r => [`${r.param}_min`, `${r.param}_max`])]
type Draft = Record<string, string>

function draftFromUrl(params: URLSearchParams): Draft {
  return Object.fromEntries(DRAFT_KEYS.map(k => [k, params.get(k) ?? '']))
}

/** What is typed in the search and range inputs, kept until applied. An input
 *  follows the URL when its parameter changes elsewhere (a chip, the back
 *  button); all of them do when `resetKey` changes (Clear all). */
function useDraft(params: URLSearchParams, resetKey: number) {
  const fromUrl = draftFromUrl(params)
  const [draft, setDraft] = useState(fromUrl)
  const [seen, setSeen] = useState({ fromUrl, resetKey })
  const changed = DRAFT_KEYS.filter(k => fromUrl[k] !== seen.fromUrl[k])
  if (resetKey !== seen.resetKey || changed.length > 0) {
    setSeen({ fromUrl, resetKey })
    setDraft(resetKey !== seen.resetKey ? fromUrl : { ...draft, ...Object.fromEntries(changed.map(k => [k, fromUrl[k]])) })
  }
  return [draft, setDraft] as const
}

interface CheckboxGroupProps {
  param: string
  label: string
  options: RdeOption[]
  /** The ticked values, as parseRdeFilters reads them from the URL. */
  values: string[]
  defaultOpen: boolean
  hint?: string
}

function CheckboxGroup({ param, label, options, values, defaultOpen, hint }: CheckboxGroupProps) {
  const [params, setParams] = useSearchParams()
  const selected = new Set(values)
  // Null until the group is toggled by hand, so a collapsed group still opens
  // when a value is selected from elsewhere (a chip, the publications view).
  const [open, setOpen] = useState<boolean | null>(null)
  const isOpen = open ?? (defaultOpen || selected.size > 0)
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
        onClick={() => setOpen(!isOpen)}
        className="flex w-full items-center justify-between py-1 text-[13px] font-medium text-ink"
        aria-expanded={isOpen}
      >
        <span>
          {label}
          {selected.size > 0 && <span className="ml-1.5 badge badge-accent h-[18px] px-1.5 text-[11px]">{selected.size}</span>}
        </span>
        <Icon name="chevronDown" size={14} className={`text-ink-3 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      {isOpen && (
        <>
          {hint && <p className="px-1 pt-0.5 text-[12px] text-ink-3">{hint}</p>}
          <ul className="mt-1 space-y-0.5">
            {shown.map(opt => {
              const checked = selected.has(opt.value)
              const dim = opt.count === 0 && !checked
              const missing = opt.value === NOT_REPORTED || opt.value === 'unspecified'
              return (
                <li key={opt.value}>
                  <label className="flex items-center gap-2 rounded-[4px] px-1 py-[3px] text-[13px] cursor-pointer hover:bg-surface-2">
                    <input type="checkbox" checked={checked} onChange={() => toggle(opt.value)} className="accent-[var(--accent)]" />
                    <span className={`flex-1 truncate ${dim ? 'text-ink-3' : missing ? 'text-ink-2' : ''} ${missing ? 'italic' : ''}`} title={opt.label}>
                      {opt.label}
                    </span>
                    <span className="num text-[12px] text-ink-3">{opt.count.toLocaleString('en-US')}</span>
                  </label>
                </li>
              )
            })}
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
        </>
      )}
    </section>
  )
}

interface RdeFacetRailProps {
  data: RdeDataset
  /** Changed by the page's Clear all, which also drops anything typed. */
  resetKey: number
  onClearAll: () => void
}

export default function RdeFacetRail({ data, resetKey, onClearAll }: RdeFacetRailProps) {
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useDraft(params, resetKey)
  const qs = params.toString()
  const active = countRdeFilters(params)

  const groups = useMemo(() => {
    const f = parseRdeFilters(new URLSearchParams(qs))
    return {
      facets: RDE_FACETS.map(facet => ({ facet, options: facetOptions(data, f, facet), values: f.lists[facet.param] ?? [] })),
      measures: measureOptions(data, f),
      has: f.has,
    }
  }, [data, qs])

  const apply = (e?: FormEvent) => {
    e?.preventDefault()
    const next = new URLSearchParams(params)
    for (const name of DRAFT_KEYS) {
      const v = draft[name].trim()
      if (v) next.set(name, v)
      else next.delete(name)
    }
    // Nothing changed (tabbing through the search box, say): keep the page.
    if (next.toString() === params.toString()) return
    next.delete('offset')
    setParams(next, { replace: true })
  }

  const edit = (name: string, value: string) => setDraft(d => ({ ...d, [name]: value }))

  return (
    <form onSubmit={apply} className="text-[13px]">
      <div className="flex items-center justify-between pb-2.5 border-b border-line">
        <span className="text-[13px] font-semibold text-ink">Filters</span>
        {active > 0 && (
          <button type="button" onClick={onClearAll} className="text-[12.5px] text-accent hover:underline">
            Clear all ({active})
          </button>
        )}
      </div>

      <section className="border-b border-line py-3">
        <label className="relative block">
          <span className="sr-only">Search within results</span>
          <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            name="q"
            value={draft.q}
            onChange={e => edit('q', e.target.value)}
            placeholder="Paper, author, fuel"
            className="input input-sm pl-8"
            onBlur={() => apply()}
          />
        </label>
      </section>

      {groups.facets.map(({ facet, options, values }) => (
        <CheckboxGroup
          key={facet.param}
          param={facet.param}
          label={facet.label}
          options={options}
          values={values}
          defaultOpen={!COLLAPSED.has(facet.param)}
        />
      ))}
      <CheckboxGroup
        param="has"
        label="Has a value for"
        options={groups.measures}
        values={groups.has}
        defaultOpen
        hint="Points must have a value for every ticked quantity."
      />

      <section className="py-3">
        <p className="text-[13px] font-medium text-ink">Ranges</p>
        <p className="mt-0.5 text-[12px] text-ink-3">A range leaves out points with no value in the release.</p>
        <div className="mt-2 space-y-2.5">
          {RDE_RANGES.map(r => {
            const title = rdeAxisTitle(rdeField(r.field))
            return (
              <div key={r.param}>
                <span className="block mb-1 text-[12.5px] text-ink-2">{title}</span>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                  <input
                    type="number" step="any" inputMode="decimal"
                    name={`${r.param}_min`}
                    value={draft[`${r.param}_min`]}
                    onChange={e => edit(`${r.param}_min`, e.target.value)}
                    placeholder="min"
                    aria-label={`${title}, minimum`}
                    className="input input-sm num px-2"
                  />
                  <span className="text-ink-3">–</span>
                  <input
                    type="number" step="any" inputMode="decimal"
                    name={`${r.param}_max`}
                    value={draft[`${r.param}_max`]}
                    onChange={e => edit(`${r.param}_max`, e.target.value)}
                    placeholder="max"
                    aria-label={`${title}, maximum`}
                    className="input input-sm num px-2"
                  />
                </div>
              </div>
            )
          })}
        </div>
        <button type="submit" className="btn btn-secondary btn-sm mt-3">Apply ranges</button>
      </section>
    </form>
  )
}
