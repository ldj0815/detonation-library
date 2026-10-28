import { useMemo } from 'react'
import type { CaseDetail } from '../../types/case'
import Icon from '../../components/Icon'
import { GALCIT_REFERENCES_URL, fmtCount, fmtNum } from '../../lib/format'
import { groupByReference, type Range, type ReferenceGroup } from '../../lib/references'
import { HIDDEN_MEASUREMENTS } from '../../config'

const COVERAGE = [
  { key: 'cell_width_mm', label: 'Cell width', count: (g: ReferenceGroup) => g.cellWidth },
  { key: 'cell_length_mm', label: 'Cell length', count: (g: ReferenceGroup) => g.cellLength },
].filter(m => !HIDDEN_MEASUREMENTS.has(m.key))

// A summary, so rounded to a few significant figures: some stored pressures
// were converted from other units and carry long tails (4.44828749 kPa).
function fmtRange(r: Range, digits: number): string {
  const min = fmtNum(Number(r.min.toPrecision(digits)))
  const max = fmtNum(Number(r.max.toPrecision(digits)))
  return min === max ? min : `${min}–${max}`
}

function PublicationCard({ group, onShow }: { group: ReferenceGroup; onShow: (reference: string) => void }) {
  const { reference, index, label, kind, url, matching, total, mixtures, pressureKpa, equivalenceRatio } = group
  const name = index != null ? `${label}, ref. ${index}` : label

  return (
    <article className="panel p-4">
      <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-ink">
        <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        {index != null && <span className="badge">GALCIT ref. {index}</span>}
      </h2>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[13px] [overflow-wrap:anywhere]"
          aria-label={kind === 'galcit' ? `GALCIT reference list, entry ${index}` : undefined}
        >
          {kind === 'galcit' ? 'GALCIT reference list' : url} <Icon name="external" size={11} className="shrink-0" />
        </a>
      )}

      <div className="mt-3 border-t border-line pt-3 space-y-1 text-[13px] text-ink-2">
        <p className="text-ink">
          <span className="num">{fmtCount(matching)}</span> of <span className="num">{fmtCount(total)}</span>{' '}
          {total === 1 ? 'case' : 'cases'} {matching === 1 ? 'matches' : 'match'}
        </p>
        <p>
          <span className="text-ink-3">Mixtures: </span>
          {mixtures.map((m, i) => (
            <span key={m.value}>{i > 0 && ' · '}{m.value} <span className="num">{fmtCount(m.count)}</span></span>
          ))}
        </p>
        {(pressureKpa || equivalenceRatio) && (
          <p>
            {pressureKpa && <>Initial pressure <span className="num">{fmtRange(pressureKpa, 4)}</span> kPa</>}
            {pressureKpa && equivalenceRatio && ' · '}
            {equivalenceRatio && <>φ <span className="num">{fmtRange(equivalenceRatio, 3)}</span></>}
          </p>
        )}
        {COVERAGE.length > 0 && (
          <p>
            <span className="text-ink-3">Cases with a value: </span>
            {COVERAGE.map((m, i) => {
              const count = m.count(group)
              return (
                <span key={m.key} className={count === 0 ? 'text-ink-3' : undefined}>
                  {i > 0 && ' · '}{m.label} <span className="num">{fmtCount(count)}</span>
                </span>
              )
            })}
          </p>
        )}
      </div>

      {reference !== null && (
        <button
          type="button"
          onClick={() => onShow(reference)}
          className="btn btn-secondary btn-sm mt-3"
          aria-label={`Show these cases from ${name}`}
        >
          Show these cases
        </button>
      )}
    </article>
  )
}

export interface CasePublicationsProps {
  /** The cases that pass the page's filters. */
  items: CaseDetail[]
  /** Every case of the category, for each paper's total. */
  allItems: CaseDetail[]
  /** Called with the caseReference() string of the paper. */
  onShow: (reference: string) => void
}

/** The papers behind the filtered cases, with what each one covers. */
export default function CasePublications({ items, allItems, onShow }: CasePublicationsProps) {
  const groups = useMemo(() => groupByReference(items, allItems), [items, allItems])
  const hasGalcit = groups.some(g => g.kind === 'galcit')

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-[12.5px] text-ink-2">
        <Icon name="info" size={14} className="mt-[2px] shrink-0 text-ink-3" />
        <span>
          {hasGalcit && (
            <>
              Cases from the GALCIT Detonation Database come from the papers in its{' '}
              <a href={GALCIT_REFERENCES_URL} target="_blank" rel="noopener noreferrer">reference list</a>, where GALCIT ref. N is entry N.{' '}
            </>
          )}
          Cite the original paper when you use its values.
        </span>
      </p>
      {groups.map(g => <PublicationCard key={g.reference ?? ''} group={g} onShow={onShow} />)}
    </div>
  )
}
