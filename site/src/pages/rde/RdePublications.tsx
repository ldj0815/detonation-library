import { useMemo } from 'react'
import type { RdeNumericKey, RdeOperatingPoint, RdePublication } from '../../types/rde'
import Icon from '../../components/Icon'
import { RDE_MEASURES, type RdeMeasure } from '../../data/rde'
import { ENGINE_DESCRIPTIONS, ENGINE_LABELS, codeLabel, doiUrl, rdeField } from '../../lib/rdeFields'

// The numeric field behind each "has a value for" measure, for its short label.
const MEASURE_FIELDS: Record<string, RdeNumericKey> = {
  wave_count: 'wave_count',
  secondary_waves: 'secondary_wave_count',
  wave_speed: 'wave_speed_m_s',
  frequency: 'frequency_khz',
  thrust: 'thrust_n',
  isp: 'specific_impulse_s',
  pressure_gain: 'pressure_gain_percent',
}

function measureLabel(m: RdeMeasure): string {
  const key = MEASURE_FIELDS[m.value]
  return key ? rdeField(key).short : m.label
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

interface Group {
  id: number
  pub: RdePublication | undefined
  points: RdeOperatingPoint[]
}

function PublicationCard({ group, onShow }: { group: Group; onShow: (publicationId: number) => void }) {
  const { id, pub, points } = group
  const label = pub?.label ?? `Publication ${id}`
  const k = points.length
  const n = pub?.operating_points ?? k
  const doi = doiUrl(pub?.doi)
  const venue = [pub?.venue, pub?.year].filter(Boolean).join(', ')

  const types = new Map<string, number>()
  for (const p of points) types.set(p.operating_point_type, (types.get(p.operating_point_type) ?? 0) + 1)
  const typeList = Array.from(types).sort((a, b) => b[1] - a[1])
  const coverage = RDE_MEASURES.map(m => ({ value: m.value, label: measureLabel(m), count: points.filter(m.test).length }))

  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-[15px] font-semibold text-ink">{label}</h2>
        {pub && <span className="badge" title={ENGINE_DESCRIPTIONS[pub.engine_code]}>{ENGINE_LABELS[pub.engine_code]}</span>}
      </div>
      {pub?.title && <p className="mt-1 text-[14px] text-ink">{pub.title}</p>}
      {(venue || pub?.country) && (
        <p className="mt-1 text-[13px] text-ink-2">
          {venue}{venue && pub?.country ? ' · ' : ''}{pub?.country}
        </p>
      )}
      {pub?.authors && <p className="mt-1 text-[12.5px] text-ink-2 line-clamp-2" title={pub.authors}>{pub.authors}</p>}
      {doi && (
        <a href={doi} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[13px] [overflow-wrap:anywhere]">
          doi:{pub?.doi} <Icon name="external" size={11} className="shrink-0" />
        </a>
      )}

      <div className="mt-3 border-t border-line pt-3 space-y-1 text-[13px] text-ink-2">
        <p className="text-ink">
          <span className="num">{k.toLocaleString('en-US')}</span> of <span className="num">{n.toLocaleString('en-US')}</span>{' '}
          {n === 1 ? 'operating point' : 'operating points'} {k === 1 ? 'matches' : 'match'}
        </p>
        <p>
          <span className="text-ink-3">Type: </span>
          {typeList.map(([type, count], i) => (
            <span key={type}>{i > 0 && ' · '}{codeLabel(type)} <span className="num">{count}</span></span>
          ))}
        </p>
        <p>
          <span className="text-ink-3">Points with a value: </span>
          {coverage.map((c, i) => (
            <span key={c.value} className={c.count === 0 ? 'text-ink-3' : ''}>
              {i > 0 && ' · '}{c.label} <span className="num">{c.count}</span>
            </span>
          ))}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onShow(id)}
        className="btn btn-secondary btn-sm mt-3"
        aria-label={`Show these operating points from ${label}`}
      >
        Show these operating points
      </button>
    </article>
  )
}

interface RdePublicationsProps {
  /** The operating points that pass the page's filters. */
  points: RdeOperatingPoint[]
  pubs: Map<number, RdePublication>
  onShow: (publicationId: number) => void
}

/** The papers behind the filtered points, with which values the release has for them. */
export default function RdePublications({ points, pubs, onShow }: RdePublicationsProps) {
  const groups = useMemo(() => {
    const byPub = new Map<number, RdeOperatingPoint[]>()
    for (const p of points) {
      const list = byPub.get(p.publication_id)
      if (list) list.push(p)
      else byPub.set(p.publication_id, [p])
    }
    return Array.from(byPub, ([id, list]): Group => ({ id, pub: pubs.get(id), points: list })).sort(
      (a, b) => (a.pub?.year ?? 0) - (b.pub?.year ?? 0) || collator.compare(a.pub?.label ?? '', b.pub?.label ?? ''),
    )
  }, [points, pubs])

  return (
    <div className="space-y-3">
      {groups.map(g => <PublicationCard key={g.id} group={g} onShow={onShow} />)}
    </div>
  )
}
