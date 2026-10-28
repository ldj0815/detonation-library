import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCategoryCounts } from '../../data/hooks'
import { clearRdeFilters, countRdeFilters, downloadRdeCsv, filterRde, parseRdeFilters, publicationIndex, sortRde, useRde } from '../../data/rde'
import type { RdeNumericKey, RdePublication, RdeRelease } from '../../types/rde'
import RdeHeader from '../../components/banner/RdeHeader'
import CategoryTabs from '../../components/CategoryTabs'
import Pagination from '../../components/Pagination'
import Skeleton from '../../components/Skeleton'
import ErrorMessage from '../../components/ErrorMessage'
import EmptyState from '../../components/EmptyState'
import Icon from '../../components/Icon'
import { categoryFor } from '../../lib/categories'
import { fmtCount, fmtDate } from '../../lib/format'
import { MISSING_NOTE, isRdeNumericKey, rdeField } from '../../lib/rdeFields'
import RdeFacetRail from './RdeFacetRail'
import RdeActiveFilters from './RdeActiveFilters'
import RdeTable from './RdeTable'
import RdePublications from './RdePublications'
import RdePlot from './RdePlot'

const PAGE_SIZES = [25, 50, 100]

const VIEWS = [
  { value: 'table', label: 'Table' },
  { value: 'plot', label: 'Plot' },
  { value: 'publications', label: 'Publications' },
] as const
type View = typeof VIEWS[number]['value']

const SORT_FIELDS: RdeNumericKey[] = [
  'equivalence_ratio', 'mdot_total_kg_s', 'mass_flux_throat_kg_m2_s', 'chamber_outer_diameter_mm',
  'wave_count', 'wave_speed_m_s', 'frequency_khz', 'thrust_n', 'specific_impulse_s',
]

function sortLabel(key: RdeNumericKey, dir: 'asc' | 'desc'): string {
  return `${rdeField(key).short}, ${dir === 'asc' ? 'low to high' : 'high to low'}`
}

const SORT_OPTIONS = [
  { value: 'publication:asc', label: 'Publication' },
  ...SORT_FIELDS.flatMap(key => (['asc', 'desc'] as const).map(dir => ({ value: `${key}:${dir}`, label: sortLabel(key, dir) }))),
]

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

function AboutData({ release }: { release: RdeRelease | null }) {
  const notes: [string, string | undefined][] = [
    ['Empty values.', `${MISSING_NOTE} An empty secondary wave count does not mean there are no secondary waves.`],
    ...(['specific_impulse_s', 'wave_speed_m_s', 'mass_flux_throat_kg_m2_s'] as const).map(key => {
      const f = rdeField(key)
      return [`${f.label}.`, f.note] as [string, string | undefined]
    }),
    ['Operating points differ.', 'They include steady runs, blowdowns and mode changes, and each has a different set of values. Check the type and which values are present before treating a row as a stable, fully characterized condition.'],
    ['Operating point numbers belong to this release.', 'A number such as #12 identifies a point within this release of the RDE database and may change in a later one. The CSV downloads carry the release_version on every row.'],
    ['Chamber pressures.', "A point can have several pressure taps. The chamber pressures file has one row per measurement; the operating point CSVs also join each point's pressures with ';' in the chamber_pressures_kpa column."],
    ['Cite the original paper.', 'When you use a value, cite the publication it comes from. Each operating point links to its DOI.'],
  ]
  return (
    <details className="panel group mb-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[13.5px] font-medium text-ink [&::-webkit-details-marker]:hidden">
        <Icon name="info" size={15} className="shrink-0 text-ink-3" />
        About this data
        <Icon name="chevronDown" size={14} className="ml-auto shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-4 py-3 space-y-3 text-[13.5px] text-ink-2">
        {release?.internal_use_only && (
          <p className="text-ink max-w-[80ch]">
            This is a development release of the RDE database: some of its review items are still open, and
            values can change in a later release.
          </p>
        )}
        <ul className="list-disc space-y-1.5 pl-5 max-w-[80ch]">
          {notes.map(([title, text]) => (
            <li key={title}><span className="font-medium text-ink">{title}</span> {text}</li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <a href={`${import.meta.env.BASE_URL}rde.csv`} download="rde-operating-points.csv" className="btn btn-secondary btn-sm hover:no-underline">
            <Icon name="download" size={14} /> Download all (CSV)
          </a>
          <a href={`${import.meta.env.BASE_URL}rde_chamber_pressures.csv`} download="rde-chamber-pressures.csv" className="btn btn-secondary btn-sm hover:no-underline">
            <Icon name="download" size={14} /> Chamber pressures (CSV)
          </a>
          {release && <span className="text-[12.5px] text-ink-3 [overflow-wrap:anywhere]">Exported from {release.database}</span>}
        </div>
      </div>
    </details>
  )
}

export default function RdePage() {
  const category = categoryFor('rde')
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Bumped by Clear all, so the rail drops values typed but not applied.
  const [formKey, setFormKey] = useState(0)
  const countRef = useRef<HTMLParagraphElement>(null)
  const counts = useCategoryCounts()
  const { data, isLoading, isError, refetch } = useRde()
  const qs = params.toString()

  const pubs = useMemo(() => (data ? publicationIndex(data) : new Map<number, RdePublication>()), [data])
  const release = data?.release ?? null

  // An unknown sort_by falls back to the publication order, ascending.
  const sortParam = params.get('sort_by')
  const sortBy: RdeNumericKey | null = isRdeNumericKey(sortParam) ? sortParam : null
  const sortDir: 'asc' | 'desc' = sortBy && params.get('sort_dir') === 'desc' ? 'desc' : 'asc'

  const results = useMemo(() => {
    if (!data) return null
    const p = new URLSearchParams(qs)
    const filtered = filterRde(data, parseRdeFilters(p))
    const by = p.get('sort_by')
    const sorted = isRdeNumericKey(by) ? sortRde(filtered, pubs, by, p.get('sort_dir')) : sortRde(filtered, pubs, null, 'asc')
    return {
      sorted,
      publications: new Set(filtered.map(x => x.publication_id)).size,
      ispClasses: new Set(filtered.filter(x => x.specific_impulse_s != null).map(x => x.engine_code)).size,
    }
  }, [data, pubs, qs])

  const view: View = VIEWS.find(v => v.value === params.get('view'))?.value ?? 'table'
  const limit = PAGE_SIZES.includes(Number(params.get('limit'))) ? Number(params.get('limit')) : PAGE_SIZES[0]
  const total = results?.sorted.length ?? 0
  const rawOffset = Number(params.get('offset') ?? 0)
  const offset = Number.isInteger(rawOffset) && rawOffset > 0 && rawOffset < total ? rawOffset : 0

  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    fn(next)
    setParams(next, { replace: true })
  }

  const onSort = (value: string) => update(p => {
    const [by, dir] = value.split(':')
    if (isRdeNumericKey(by)) {
      p.set('sort_by', by)
      p.set('sort_dir', dir === 'desc' ? 'desc' : 'asc')
    } else {
      p.delete('sort_by')
      p.delete('sort_dir')
    }
    p.delete('offset')
  })

  const onHeaderSort = (key: RdeNumericKey) => onSort(`${key}:${sortBy === key && sortDir === 'asc' ? 'desc' : 'asc'}`)

  const setView = (v: View) => update(p => {
    if (v === 'table') p.delete('view')
    else p.set('view', v)
  })

  // Focus goes to the results count when the control that was used goes away.
  const focusResults = () => countRef.current?.focus({ preventScroll: true })

  const clearFilters = () => {
    focusResults()
    setParams(clearRdeFilters(params), { replace: true })
    setFormKey(k => k + 1)
  }

  const showPublication = (id: number) => {
    focusResults()
    update(p => {
      p.set('publication', String(id))
      p.delete('view')
      p.delete('offset')
    })
    window.scrollTo({ top: 0 })
  }

  const exportCsv = () => {
    if (!results) return
    downloadRdeCsv(results.sorted, pubs, release, `rde_operating_points_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const activeCount = countRdeFilters(params)
  const sortValue = sortBy ? `${sortBy}:${sortDir}` : 'publication:asc'
  const sortOptions = SORT_OPTIONS.some(o => o.value === sortValue) || !sortBy
    ? SORT_OPTIONS
    : [...SORT_OPTIONS, { value: sortValue, label: sortLabel(sortBy, sortDir) }]

  const datasetEmpty = data != null && data.operating_points.length === 0
  const meta = data && (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>
        {release && <>RDE database release <span className="num">{release.release_version}</span>, {fmtDate(release.release_date)} · </>}
        <span className="num text-ink">{fmtCount(data.operating_points.length)}</span> {plural(data.operating_points.length, 'operating point', 'operating points')} from{' '}
        <span className="num text-ink">{fmtCount(data.publications.length)}</span> {plural(data.publications.length, 'publication', 'publications')}
      </span>
      {release?.internal_use_only && (
        <span className="badge badge-warn" title="A development release of the RDE database: some of its review items are still open.">
          Development release
        </span>
      )}
    </div>
  )

  const clearAll = (
    <button type="button" onClick={clearFilters} className="btn btn-primary">
      Clear all filters
    </button>
  )

  return (
    <div>
      <RdeHeader
        description={category.description}
        meta={meta}
        tabs={<CategoryTabs active="rde" counts={counts.data} />}
      />

      <div className="container-x py-5 md:py-6">
        {data && !datasetEmpty && <AboutData release={release} />}

        {isLoading && <Skeleton table rows={10} />}
        {isError && <ErrorMessage message="The RDE data could not be loaded." onRetry={() => { void refetch() }} />}
        {datasetEmpty && (
          <EmptyState
            title="No RDE operating points yet"
            action={<Link to="/about" className="btn btn-primary hover:no-underline">About the data</Link>}
          >
            The RDE category is filled from the RDE database. Its operating points appear here once the site is built from a release.
          </EmptyState>
        )}

        {data && results && !datasetEmpty && (
          <div className="grid gap-6 md:grid-cols-[264px_minmax(0,1fr)]">
            {/* Filter rail */}
            <aside className="md:sticky md:top-[72px] md:self-start md:max-h-[calc(100vh-88px)] md:overflow-y-auto md:pr-1">
              <button
                type="button"
                onClick={() => setFiltersOpen(o => !o)}
                className="btn btn-secondary w-full justify-between md:hidden"
                aria-expanded={filtersOpen}
                aria-controls="rde-facet-rail"
              >
                <span className="inline-flex items-center gap-2"><Icon name="filter" size={15} /> Filters{activeCount > 0 ? ` (${activeCount})` : ''}</span>
                <Icon name="chevronDown" size={14} className={filtersOpen ? 'rotate-180' : ''} />
              </button>
              <div id="rde-facet-rail" className={`${filtersOpen ? 'block mt-3 panel p-4' : 'hidden'} md:block md:mt-0 md:p-0 md:border-0 md:bg-transparent`}>
                <RdeFacetRail data={data} resetKey={formKey} onClearAll={clearFilters} />
              </div>
            </aside>

            {/* Results */}
            <section className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
                <p ref={countRef} tabIndex={-1} className="text-[14px] text-ink mr-auto" aria-live="polite">
                  <span className="num font-medium">{fmtCount(total)}</span> {plural(total, 'operating point', 'operating points')}
                  <span className="text-ink-2"> from <span className="num">{fmtCount(results.publications)}</span> {plural(results.publications, 'publication', 'publications')}</span>
                </p>
                <div role="group" aria-label="View" className="inline-flex rounded-[6px] border border-line-2 bg-surface p-0.5">
                  {VIEWS.map(v => (
                    <button
                      key={v.value}
                      type="button"
                      aria-pressed={view === v.value}
                      onClick={() => setView(v.value)}
                      className={`h-[22px] px-2.5 rounded-[4px] text-[12.5px] font-medium transition-colors ${
                        view === v.value ? 'bg-accent-soft text-accent-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                {view === 'table' && (
                  <>
                    <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                      Sort
                      <select value={sortValue} onChange={e => onSort(e.target.value)} className="select select-sm w-auto">
                        {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                      Rows
                      <select value={limit} onChange={e => update(p => { p.set('limit', e.target.value); p.delete('offset') })} className="select select-sm w-auto">
                        {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  </>
                )}
                <button type="button" onClick={exportCsv} disabled={total === 0} className="btn btn-secondary btn-sm" title="Download every operating point matching the current filters">
                  <Icon name="download" size={14} /> Download CSV
                </button>
              </div>

              {activeCount > 0 && <div className="mb-3"><RdeActiveFilters pubs={pubs} onClearAll={clearFilters} focusResults={focusResults} /></div>}

              {total === 0 && (
                <EmptyState title="No operating points match these filters" action={clearAll}>
                  Try removing a filter or widening a range.
                </EmptyState>
              )}
              {total > 0 && view === 'table' && (
                <>
                  {sortBy === 'specific_impulse_s' && results.ispClasses > 1 && (
                    <p className="mb-3 flex items-start gap-2 text-[12.5px] text-ink-2">
                      <Icon name="info" size={14} className="mt-[2px] shrink-0 text-ink-3" />
                      <span>This order mixes engine classes. {rdeField('specific_impulse_s').note}</span>
                    </p>
                  )}
                  <RdeTable points={results.sorted.slice(offset, offset + limit)} pubs={pubs} sortBy={sortBy} sortDir={sortDir} onSort={onHeaderSort} />
                  <div className="mt-4">
                    <Pagination total={total} limit={limit} offset={offset} onChange={o => update(p => { p.set('offset', String(o)) })} />
                  </div>
                </>
              )}
              {total > 0 && view === 'plot' && <RdePlot points={results.sorted} pubs={pubs} />}
              {total > 0 && view === 'publications' && <RdePublications points={results.sorted} pubs={pubs} onShow={showPublication} />}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
