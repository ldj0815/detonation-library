import type { ReactNode } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useCaseDetail, useCaseList } from '../../data/hooks'
import { NEW_ISSUE_URL } from '../../config'
import Badge from '../../components/Badge'
import Icon from '../../components/Icon'
import Skeleton from '../../components/Skeleton'
import ErrorMessage from '../../components/ErrorMessage'
import PageHeader from '../../components/PageHeader'
import type { CaseDetail as CaseDetailType, CaseListItem } from '../../types/case'
import { fmtNum, fmtDate, fmtMeasure, parseTitle, parseReference, mixtureLine, measurementsOf } from '../../lib/format'
import { HIDDEN_MEASUREMENTS } from '../../config'

// Columns of the series table beyond cell size, less the ones the site hides.
const EXTRA_COLUMNS = ([
  { key: 'critical_hydraulic_diameter_mm', label: 'Critical dia. (mm)' },
  { key: 'minimum_hydraulic_diameter_mm', label: 'Minimum dia. (mm)' },
  { key: 'critical_energy_j', label: 'Critical energy (J)' },
] as const).filter(c => !HIDDEN_MEASUREMENTS.has(c.key))
import { downloadText, toCsv, CASE_CSV_COLUMNS } from '../../lib/csv'

function parseAdditional(value: string | null): { name: string; amount: string }[] {
  if (!value) return []
  return value.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const parts = s.split(':')
    return { name: parts[0]?.trim() ?? s, amount: parts[1]?.trim() ?? '' }
  })
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

function Tile({ label, value, unit, unc }: { label: string; value: number; unit: string; unc?: number | null }) {
  return (
    <div className="panel px-4 py-3 min-w-0">
      <p className="text-[12.5px] text-ink-2">{label}</p>
      <p className="mt-1 num text-[22px] leading-tight text-ink">
        {fmtNum(value)}
        {unc != null && <span className="text-[15px] text-ink-2"> ± {fmtNum(unc)}</span>}
        <span className="text-[14px] text-ink-2"> {unit}</span>
      </p>
    </div>
  )
}

function RelatedCases({ current }: { current: CaseDetailType }) {
  const location = useLocation()
  // The series is every case with exactly this title (one GALCIT table, one
  // reference). The search is a substring match, so keep exact matches only.
  const { data } = useCaseList({ q: current.title, limit: 500, sort_by: 'id', sort_dir: 'asc' })
  const series: CaseListItem[] = (data?.items ?? []).filter(i => i.title === current.title)
  if (series.length < 2) return null
  const idx = series.findIndex(i => i.id === current.id)
  const prev = idx > 0 ? series[idx - 1] : null
  const next = idx >= 0 && idx < series.length - 1 ? series[idx + 1] : null
  const state = { backTo: (location.state as { backTo?: string } | null)?.backTo }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-[15px] font-semibold">
          Same series <span className="num text-ink-2 font-normal">({idx + 1} of {series.length})</span>
        </h2>
        <div className="flex gap-1.5">
          {prev ? <Link to={`/cases/${prev.id}`} state={state} className="btn btn-secondary btn-sm hover:no-underline"><Icon name="chevronLeft" size={14} /> Previous</Link>
                : <span className="btn btn-secondary btn-sm opacity-45"><Icon name="chevronLeft" size={14} /> Previous</span>}
          {next ? <Link to={`/cases/${next.id}`} state={state} className="btn btn-secondary btn-sm hover:no-underline">Next <Icon name="chevronRight" size={14} /></Link>
                : <span className="btn btn-secondary btn-sm opacity-45">Next <Icon name="chevronRight" size={14} /></span>}
        </div>
      </div>
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-num">Case</th>
              <th className="col-num">φ</th>
              <th className="col-num">P (kPa)</th>
              <th className="col-num">T (K)</th>
              <th>Diluent</th>
              <th className="col-num">Cell width (mm)</th>
              <th className="col-num">Cell length (mm)</th>
              {EXTRA_COLUMNS.map(c => <th key={c.key} className="col-num">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {series.map(i => {
              const isCurrent = i.id === current.id
              const n = (v: number | null, u?: number | null) => v == null ? <span className="cell-empty">—</span> : <>{fmtNum(v)}{u != null && <span className="text-ink-3"> ± {fmtNum(u)}</span>}</>
              return (
                <tr key={i.id} className={isCurrent ? 'bg-accent-soft' : ''}>
                  <td className="col-num">{isCurrent ? <span className="font-medium">{i.id}</span> : <Link to={`/cases/${i.id}`} state={state}>{i.id}</Link>}</td>
                  <td className="col-num">{n(i.equivalence_ratio)}</td>
                  <td className="col-num">{n(i.initial_pressure_kpa)}</td>
                  <td className="col-num">{n(i.initial_temperature_k)}</td>
                  <td>{i.primary_diluent_name ? `${i.primary_diluent_percentage != null ? `${fmtNum(i.primary_diluent_percentage)} % ` : ''}${i.primary_diluent_name}` : <span className="cell-empty">—</span>}</td>
                  <td className="col-num">{n(i.cell_width_mm, i.cell_width_uncertainty_mm)}</td>
                  <td className="col-num">{n(i.cell_length_mm, i.cell_length_uncertainty_mm)}</td>
                  {EXTRA_COLUMNS.map(c => <td key={c.key} className="col-num">{n(i[c.key])}</td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const numId = id ? Number(id) : 0
  const { data, isLoading, isError, refetch, notFound } = useCaseDetail(numId)
  const location = useLocation()
  const backTo = (location.state as { backTo?: string } | null)?.backTo ?? '/cases'

  if (!Number.isInteger(numId) || numId <= 0 || notFound) {
    return (
      <div>
        <PageHeader title="Case not found" description={notFound ? `There is no case ${numId} in the library.` : 'The case number in the address is not valid.'} />
        <div className="container-x py-6"><Link to="/cases">Browse all cases</Link></div>
      </div>
    )
  }

  if (isLoading) return <div className="container-x py-8"><Skeleton rows={10} /></div>
  if (isError) return <div className="container-x py-8"><ErrorMessage message="This case could not be loaded." onRetry={refetch} /></div>
  if (!data) return null

  const t = parseTitle(data.title)
  const ref = parseReference(data.doi_reference)
  const measurements = measurementsOf(data)
  const additionalDiluents = parseAdditional(data.additional_diluents)
  const additionalDopants = parseAdditional(data.additional_dopants)
  const hasTiles = data.cell_width_mm != null || data.cell_length_mm != null || data.critical_hydraulic_diameter_mm != null || data.minimum_hydraulic_diameter_mm != null || data.critical_energy_j != null

  const downloadJson = () => downloadText(JSON.stringify(data, null, 2), `case_${data.id}.json`, 'application/json')
  const downloadCsv = () => downloadText(toCsv([data as unknown as Record<string, unknown>], [...CASE_CSV_COLUMNS, 'contributor_institution', 'contributor_email', 'notes']), `case_${data.id}.csv`, 'text/csv')
  const plotSimilar = `/plot?fuel=${encodeURIComponent(data.fuel)}&oxidizer=${encodeURIComponent(data.oxidizer)}`

  return (
    <div>
      <PageHeader
        above={<Link to={backTo} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"><Icon name="arrowLeft" size={14} /> Back to results</Link>}
        title={
          t.key
            ? <span><span className="num">{t.key}</span><span className="text-ink-2 font-normal"> {parseReference(t.reference)?.label ?? t.reference}</span></span>
            : data.title
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span>Case <span className="num text-ink">{data.id}</span></span>
            <Badge label={data.setup} variant="setup" />
            <Badge label={data.geometry.replaceAll('_', ' ')} />
            {measurements.map(m => <Badge key={m} label={m} />)}
          </div>
        }
        actions={
          <>
            <button type="button" onClick={downloadJson} className="btn btn-secondary btn-sm"><Icon name="download" size={14} /> JSON</button>
            <button type="button" onClick={downloadCsv} className="btn btn-secondary btn-sm"><Icon name="download" size={14} /> CSV</button>
            <Link to={plotSimilar} className="btn btn-secondary btn-sm hover:no-underline"><Icon name="chart" size={14} /> Plot {data.fuel} / {data.oxidizer}</Link>
          </>
        }
      />

      <div className="container-x py-6 space-y-8">
        {/* Mixture line and measurement tiles */}
        <section>
          <p className="text-[16px] md:text-[17px] text-ink">{mixtureLine(data)}</p>
          {hasTiles && (
            <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4">
              {data.cell_width_mm != null && <Tile label="Cell width" value={data.cell_width_mm} unc={data.cell_width_uncertainty_mm} unit="mm" />}
              {data.cell_length_mm != null && <Tile label="Cell length" value={data.cell_length_mm} unc={data.cell_length_uncertainty_mm} unit="mm" />}
              {data.critical_hydraulic_diameter_mm != null && <Tile label="Critical tube diameter" value={data.critical_hydraulic_diameter_mm} unit="mm" />}
              {data.minimum_hydraulic_diameter_mm != null && <Tile label="Minimum tube diameter" value={data.minimum_hydraulic_diameter_mm} unit="mm" />}
              {data.critical_energy_j != null && <Tile label="Critical initiation energy" value={data.critical_energy_j} unit="J" />}
            </div>
          )}
        </section>

        {/* Reference */}
        <section className="panel px-4 py-3 grid gap-3 md:grid-cols-[auto_1fr] md:items-start">
          <span className="text-[13px] font-medium text-ink-2 md:pt-0.5 md:w-24">Reference</span>
          <div className="text-[14px]">
            {ref ? (
              <>
                {ref.kind === 'galcit' && (
                  <p>
                    {ref.label}{' '}
                    <span className="text-ink-2">
                      (entry <span className="num">{ref.index}</span> in the{' '}
                      <a href={`${ref.url}#${ref.index}`} target="_blank" rel="noopener noreferrer">GALCIT reference list <Icon name="external" size={11} className="inline" /></a>)
                    </span>
                  </p>
                )}
                {ref.kind !== 'galcit' && (
                  <p>{ref.url ? <a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.label} <Icon name="external" size={11} className="inline" /></a> : ref.label}</p>
                )}
                <p className="mt-1 text-[12.5px] text-ink-2">Cite this publication when you use the values above.</p>
              </>
            ) : (
              <p className="text-ink-2">No reference was given for this case.</p>
            )}
            {data.sharing_link && (
              <p className="mt-1.5"><a href={data.sharing_link} target="_blank" rel="noopener noreferrer">Linked data or images <Icon name="external" size={11} className="inline" /></a></p>
            )}
          </div>
        </section>

        <RelatedCases current={data} />

        {/* Details */}
        <section className="grid gap-8 md:grid-cols-3">
          <div>
            <h2 className="section-title">Mixture</h2>
            <dl className="kv">
              <Row label="Fuel" value={data.fuel} />
              <Row label="Oxidizer" value={data.oxidizer} />
              <Row label="Equivalence ratio" value={<span className="num">{fmtNum(data.equivalence_ratio)}</span>} />
              <Row label="Initial pressure" value={<span className="num">{data.initial_pressure_kpa != null ? `${fmtNum(data.initial_pressure_kpa)} kPa` : '—'}</span>} />
              <Row label="Initial temperature" value={<span className="num">{data.initial_temperature_k != null ? `${fmtNum(data.initial_temperature_k)} K` : '—'}</span>} />
              {data.primary_diluent_name && (
                <Row label="Diluent" value={`${data.primary_diluent_name}${data.primary_diluent_percentage != null ? ` (${fmtNum(data.primary_diluent_percentage)} %)` : ''}`} />
              )}
              {additionalDiluents.map((d, i) => (
                <Row key={`dil-${i}`} label={i === 0 ? 'Other diluents' : ''} value={`${d.name}${d.amount ? ` (${d.amount} %)` : ''}`} />
              ))}
              {data.primary_dopant_name && (
                <Row label="Dopant" value={`${data.primary_dopant_name}${data.primary_dopant_ppm != null ? ` (${fmtNum(data.primary_dopant_ppm)} ppm)` : ''}`} />
              )}
              {additionalDopants.map((d, i) => (
                <Row key={`dop-${i}`} label={i === 0 ? 'Other dopants' : ''} value={`${d.name}${d.amount ? ` (${d.amount} ppm)` : ''}`} />
              ))}
            </dl>
          </div>

          <div>
            <h2 className="section-title">Setup and geometry</h2>
            <dl className="kv">
              <Row label="Setup" value={data.setup} />
              <Row label="Geometry" value={data.geometry.replaceAll('_', ' ')} />
              {data.tube_radius_mm != null && <Row label="Tube radius" value={<span className="num">{fmtNum(data.tube_radius_mm)} mm</span>} />}
              {data.chamber_width_mm != null && <Row label="Chamber width" value={<span className="num">{fmtNum(data.chamber_width_mm)} mm</span>} />}
              {data.chamber_height_mm != null && <Row label="Chamber height" value={<span className="num">{fmtNum(data.chamber_height_mm)} mm</span>} />}
              {data.cell_width_mm != null && <Row label="Cell width" value={<span className="num">{fmtMeasure(data.cell_width_mm, data.cell_width_uncertainty_mm, 'mm')}</span>} />}
              {data.cell_length_mm != null && <Row label="Cell length" value={<span className="num">{fmtMeasure(data.cell_length_mm, data.cell_length_uncertainty_mm, 'mm')}</span>} />}
              {data.critical_hydraulic_diameter_mm != null && <Row label="Critical diameter" value={<span className="num">{fmtNum(data.critical_hydraulic_diameter_mm)} mm</span>} />}
              {data.minimum_hydraulic_diameter_mm != null && <Row label="Minimum diameter" value={<span className="num">{fmtNum(data.minimum_hydraulic_diameter_mm)} mm</span>} />}
              {data.critical_energy_j != null && <Row label="Critical energy" value={<span className="num">{fmtNum(data.critical_energy_j)} J</span>} />}
            </dl>
          </div>

          <div>
            <h2 className="section-title">Contributed by</h2>
            <dl className="kv">
              <Row label="Name" value={data.contributor_name} />
              <Row label="Institution" value={data.contributor_institution} />
              <Row label="Email" value={<a href={`mailto:${data.contributor_email}`}>{data.contributor_email}</a>} />
              <Row label="Added" value={fmtDate(data.created_at)} />
            </dl>
          </div>
        </section>

        {data.notes && (
          <section>
            <h2 className="section-title">Notes</h2>
            <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-wrap max-w-[72ch]">{data.notes}</p>
          </section>
        )}

        <p className="text-[13px] text-ink-2 border-t border-line pt-5">
          Spotted a wrong value?{' '}
          <a href={NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer">Open an issue on GitHub <Icon name="external" size={11} className="inline" /></a>
          {' '}with the case number and the correction.
        </p>
      </div>
    </div>
  )
}
