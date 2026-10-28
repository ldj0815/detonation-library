import type { ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { downloadRdeCsv, publicationIndex, useRde } from '../../data/rde'
import { NEW_ISSUE_URL } from '../../config'
import { downloadText } from '../../lib/csv'
import { fmtDate } from '../../lib/format'
import {
  ENGINE_DESCRIPTIONS, ENGINE_LABELS, RDE_FIELDS, RDE_GROUP_LABELS, codeLabel, doiUrl, fmtRde, rdeField,
  rdeMethod, rdeUncertainty, rdeValue, waveMode,
} from '../../lib/rdeFields'
import type { RdeField, RdeFieldGroup } from '../../lib/rdeFields'
import type { RdeNumericKey, RdeOperatingPoint, RdePublication, RdeRelease } from '../../types/rde'
import Badge from '../../components/Badge'
import Icon from '../../components/Icon'
import Skeleton from '../../components/Skeleton'
import ErrorMessage from '../../components/ErrorMessage'
import PageHeader from '../../components/PageHeader'
import { ChamberPressureTable, Def, DefList, DetailSection, MeasureValue, MissingValues } from './RdeValue'

type CodedKey =
  | 'back_pressure_environment' | 'ignition_type' | 'combustor_type' | 'exit_geometry_type'
  | 'center_body_termination' | 'cooling_strategy' | 'modal_detection_method' | 'thrust_type'

interface CodedField {
  key: CodedKey
  label: string
  /** Listed after this numeric field; first in its section without one. */
  after?: RdeNumericKey
}

// The release's coded text fields, in the section a reader looks for them in.
const CODED_FIELDS: Record<RdeFieldGroup, CodedField[]> = {
  conditions: [
    { key: 'back_pressure_environment', label: 'Back-pressure environment', after: 'back_pressure_pa' },
    { key: 'ignition_type', label: 'Ignition', after: 'burn_time_s' },
  ],
  geometry: [
    { key: 'combustor_type', label: 'Combustor type' },
    { key: 'exit_geometry_type', label: 'Exit geometry' },
    { key: 'center_body_termination', label: 'Center body' },
    { key: 'cooling_strategy', label: 'Cooling' },
  ],
  modes: [{ key: 'modal_detection_method', label: 'Mode detection' }],
  performance: [{ key: 'thrust_type', label: 'Thrust type', after: 'thrust_n' }],
}

// Shown with the propellants rather than with the operating conditions.
const STOICH = rdeField('stoich_fuel_oxidizer_mass_ratio')

type Entry = { kind: 'num'; field: RdeField } | { kind: 'code'; coded: CodedField }

function groupEntries(group: RdeFieldGroup): Entry[] {
  const coded = CODED_FIELDS[group]
  const out: Entry[] = coded.filter(c => !c.after).map(c => ({ kind: 'code', coded: c }))
  for (const field of RDE_FIELDS) {
    if (field.group !== group || field.key === STOICH.key) continue
    out.push({ kind: 'num', field })
    for (const c of coded) if (c.after === field.key) out.push({ kind: 'code', coded: c })
  }
  return out
}

const GROUPS = Object.keys(RDE_GROUP_LABELS) as RdeFieldGroup[]
const GROUP_ENTRIES = Object.fromEntries(GROUPS.map(g => [g, groupEntries(g)])) as Record<RdeFieldGroup, Entry[]>

// sequence_index counts the points of one test run, so a paper with several
// runs is ordered by run first.
function paperOrder(a: RdeOperatingPoint, b: RdeOperatingPoint): number {
  return a.test_run_id - b.test_run_id || (a.sequence_index ?? 0) - (b.sequence_index ?? 0) || a.id - b.id
}

const oxidizerName = (v: string) => v.replace('O2', 'O₂')

function summaryLine(p: RdeOperatingPoint): string {
  const parts = [`${p.fuel} / ${oxidizerName(p.oxidizer)}`]
  if (p.equivalence_ratio != null) parts.push(`${rdeField('equivalence_ratio').short} = ${fmtRde(p.equivalence_ratio)}`)
  if (p.mdot_total_kg_s != null) parts.push(`ṁ = ${fmtRde(p.mdot_total_kg_s)} ${rdeField('mdot_total_kg_s').unit}`)
  return parts.join(' · ')
}

function opTypeLabel(type: string): string {
  if (type === 'unspecified') return 'Point type not stated'
  if (type === 'other_please_specify') return 'Other point type'
  return codeLabel(type)
}

function windowText(p: RdeOperatingPoint): string | null {
  const a = p.window_start_s, b = p.window_end_s
  if (a != null && b != null) return `${fmtRde(a)}–${fmtRde(b)} s`
  if (a != null) return `from ${fmtRde(a)} s`
  if (b != null) return `until ${fmtRde(b)} s`
  return null
}

// The release's text can carry a curator's note, so it is "recorded", not "reported".
function AsRecorded({ name, normalised, recorded }: { name: string; normalised: string; recorded?: string }) {
  const differs = !!recorded && recorded.trim().toLowerCase() !== normalised.toLowerCase()
  return <>{name}{differs && <span className="text-ink-2"> (as recorded: {recorded})</span>}</>
}

function GroupSection({ group, point }: { group: RdeFieldGroup; point: RdeOperatingPoint }) {
  const defs: ReactNode[] = []
  const missing: string[] = []
  for (const e of GROUP_ENTRIES[group]) {
    if (e.kind === 'code') {
      const v = point[e.coded.key]
      if (v && v !== 'unspecified') defs.push(<Def key={e.coded.key} label={e.coded.label}>{codeLabel(v)}</Def>)
      // A thrust type only matters when there is a thrust.
      else if (e.coded.key !== 'thrust_type' || point.thrust_n != null) missing.push(e.coded.label)
      continue
    }
    const f = e.field
    const v = rdeValue(point, f.key)
    if (v == null) {
      missing.push(f.short)
      continue
    }
    const note = f.key === 'specific_impulse_s'
      ? <>{f.note} This point is from the {ENGINE_LABELS[point.engine_code]} class: {ENGINE_DESCRIPTIONS[point.engine_code]}</>
      : f.note
    defs.push(
      <Def key={f.key} label={f.label} note={note}>
        <MeasureValue value={v} uncertainty={rdeUncertainty(point, f.key)} unit={f.unit} method={rdeMethod(point, f.key)} />
      </Def>,
    )
    const mode = f.key === 'wave_count' && point.secondary_wave_count != null ? waveMode(point) : null
    if (mode) defs.push(<Def key="wave_mode" label="Mode"><span className="num">{mode}</span></Def>)
  }
  if (defs.length === 0 && missing.length === 0) return null
  return (
    <DetailSection title={RDE_GROUP_LABELS[group]}>
      {defs.length > 0 && <DefList>{defs}</DefList>}
      <MissingValues labels={missing} separated={defs.length > 0} />
    </DetailSection>
  )
}

/** The point's run among the paper's runs, in test_run_id order. */
interface RunPlace { index: number; count: number }

function releaseNote(release: RdeRelease): string {
  if (!release.internal_use_only) {
    return `Operating point numbers are specific to release ${release.release_version} of the RDE database and may change in a later release.`
  }
  return `The values come from release ${release.release_version} (${fmtDate(release.release_date)}) of the RDE database, ` +
    'an internal development release in which not every review item is resolved. ' +
    'Operating point numbers are specific to this release and may change in a later release.'
}

function SourceSection({ point, pub, release, run }: {
  point: RdeOperatingPoint
  pub?: RdePublication
  release: RdeRelease | null
  run: RunPlace
}) {
  const url = doiUrl(pub?.doi)
  const timeWindow = windowText(point)
  const missing = [
    !pub?.authors && 'Authors', !pub?.venue && 'Venue', !pub?.country && 'Country', !pub?.doi && 'DOI', !timeWindow && 'Time window',
  ].filter((s): s is string => Boolean(s))
  return (
    <DetailSection title="Source">
      <DefList>
        <Def label="Publication">
          {!pub ? <span className="text-ink-2">Publication {point.publication_id} is missing from the data.</span>
            : url ? <a href={url} target="_blank" rel="noopener noreferrer">{pub.title} <Icon name="external" size={11} className="inline" /></a>
            : pub.title}
        </Def>
        {pub?.authors && <Def label="Authors">{pub.authors.split(/\s*;\s*/).join(', ')}</Def>}
        {pub?.venue && <Def label="Venue">{pub.venue}</Def>}
        {pub && <Def label="Year"><span className="num">{pub.year}</span></Def>}
        {pub?.country && <Def label="Country">{pub.country}</Def>}
        {pub?.doi && url && <Def label="DOI"><a href={url} target="_blank" rel="noopener noreferrer">{pub.doi}</a></Def>}
        <Def label="Test run">
          <span title={`Database test run id ${point.test_run_id}. Runs are counted in database order, which need not match the paper's own numbering.`}>
            {run.count > 1
              ? <>Run <span className="num">{run.index}</span> of <span className="num">{run.count}</span> in this paper</>
              : 'The only run in this paper'}
          </span>
          {point.sequence_index != null && <span className="text-ink-2"> · point <span className="num">{point.sequence_index}</span> of the run</span>}
        </Def>
        {timeWindow && <Def label="Time window"><span className="num">{timeWindow}</span></Def>}
        <Def label="Operating point type">{codeLabel(point.operating_point_type)}</Def>
      </DefList>
      <MissingValues labels={missing} />
      <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-ink-2">
        Cite the original paper when you use any value on this page.
        {release && <> {releaseNote(release)}</>}
      </p>
    </DetailSection>
  )
}

function PropellantSection({ point }: { point: RdeOperatingPoint }) {
  const stoich = rdeValue(point, STOICH.key)
  const missing = [
    !point.fuel_phase && 'Fuel phase', !point.oxidizer_phase && 'Oxidizer phase', stoich == null && STOICH.short,
  ].filter((s): s is string => Boolean(s))
  return (
    <DetailSection title="Propellants">
      <DefList>
        <Def label="Fuel"><AsRecorded name={point.fuel} normalised={point.fuel} recorded={point.fuel_reported} /></Def>
        {point.fuel_phase && <Def label="Fuel phase">{codeLabel(point.fuel_phase)}</Def>}
        <Def label="Oxidizer"><AsRecorded name={oxidizerName(point.oxidizer)} normalised={point.oxidizer} recorded={point.oxidizer_reported} /></Def>
        {point.oxidizer_phase && <Def label="Oxidizer phase">{codeLabel(point.oxidizer_phase)}</Def>}
        {point.diluent && <Def label="Diluent or dopant">{point.diluent}</Def>}
        {stoich != null && (
          <Def label={STOICH.label} note={STOICH.note}>
            <MeasureValue value={stoich} uncertainty={rdeUncertainty(point, STOICH.key)} unit={STOICH.unit} method={rdeMethod(point, STOICH.key)} />
          </Def>
        )}
      </DefList>
      <MissingValues labels={missing} />
    </DetailSection>
  )
}

function NotFound({ message }: { message: string }) {
  return (
    <div>
      <PageHeader title="Operating point not found" description={message} />
      <div className="container-x py-6"><Link to="/browse/rde">Browse all RDE operating points</Link></div>
    </div>
  )
}

export default function RdeDetail() {
  const { id } = useParams<{ id: string }>()
  // Only a plain positive integer: Number() would also read '1e2', '0x64' or '5.0'.
  const numId = id && /^[1-9]\d*$/.test(id) ? Number(id) : NaN
  const { data, isLoading, isError, refetch } = useRde()
  const location = useLocation()
  // The list passes its query string, so "back" returns to the same filters.
  const from = (location.state as { from?: unknown } | null)?.from
  const fromSearch = typeof from === 'string' ? from : null
  const backTo = `/browse/rde${fromSearch ?? ''}`
  const linkState = fromSearch != null ? { from: fromSearch } : undefined

  if (Number.isNaN(numId)) return <NotFound message="The operating point number in the address is not valid." />
  if (isLoading) return <div className="container-x py-8"><Skeleton rows={10} /></div>
  if (isError) return <div className="container-x py-8"><ErrorMessage message="The RDE operating points could not be loaded." onRetry={refetch} /></div>
  if (!data) return null

  const point = data.operating_points.find(p => p.id === numId)
  if (!point) return <NotFound message={`There is no operating point ${numId} in the RDE data.`} />

  const pubs = publicationIndex(data)
  const pub = pubs.get(point.publication_id)
  const pubLabel = pub?.label ?? `Publication ${point.publication_id}`
  const siblings = data.operating_points.filter(p => p.publication_id === point.publication_id).sort(paperOrder)
  const idx = siblings.indexOf(point)
  const prev = idx > 0 ? siblings[idx - 1] : null
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null
  const runIds = [...new Set(siblings.map(p => p.test_run_id))]
  const run = { index: runIds.indexOf(point.test_run_id) + 1, count: runIds.length }
  const pressures = point.chamber_pressures ?? []

  const downloadJson = () => downloadText(JSON.stringify({ publication: pub ?? null, operating_point: point }, null, 2), `rde_point_${point.id}.json`, 'application/json')
  const downloadCsv = () => downloadRdeCsv([point], pubs, data.release ?? null, `rde_point_${point.id}.csv`)

  return (
    <div>
      <PageHeader
        above={<Link to={backTo} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"><Icon name="arrowLeft" size={14} /> RDE operating points</Link>}
        title={<>Operating point <span className="num">{point.id}</span></>}
        description={summaryLine(point)}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex" title={ENGINE_DESCRIPTIONS[point.engine_code]}>
              <Badge label={ENGINE_LABELS[point.engine_code] ?? point.engine_code} variant="accent" />
            </span>
            <span className="inline-flex" title="Operating point type, as the release classifies it">
              <Badge label={opTypeLabel(point.operating_point_type)} />
            </span>
            <span>
              {pubLabel} · point <span className="num text-ink">{idx + 1}</span> of <span className="num text-ink">{siblings.length}</span>
            </span>
          </div>
        }
        actions={
          <>
            <button type="button" onClick={downloadJson} className="btn btn-secondary btn-sm"><Icon name="download" size={14} /> JSON</button>
            <button type="button" onClick={downloadCsv} className="btn btn-secondary btn-sm"><Icon name="download" size={14} /> CSV</button>
          </>
        }
      />

      <div className="container-x py-6 space-y-8">
        {siblings.length > 1 && (
          <nav aria-label={`Operating points from ${pubLabel}`} className="flex flex-wrap items-center justify-between gap-2">
            <Link to={`/browse/rde?publication=${point.publication_id}`} className="text-[13.5px]">
              All {siblings.length} operating points from {pubLabel}
            </Link>
            <div className="flex gap-1.5">
              {prev ? <Link to={`/browse/rde/${prev.id}`} state={linkState} className="btn btn-secondary btn-sm hover:no-underline"><Icon name="chevronLeft" size={14} /> Previous</Link>
                    : <span className="btn btn-secondary btn-sm opacity-45"><Icon name="chevronLeft" size={14} /> Previous</span>}
              {next ? <Link to={`/browse/rde/${next.id}`} state={linkState} className="btn btn-secondary btn-sm hover:no-underline">Next <Icon name="chevronRight" size={14} /></Link>
                    : <span className="btn btn-secondary btn-sm opacity-45">Next <Icon name="chevronRight" size={14} /></span>}
            </div>
          </nav>
        )}

        <SourceSection point={point} pub={pub} release={data.release ?? null} run={run} />
        <PropellantSection point={point} />
        {GROUPS.map(g => <GroupSection key={g} group={g} point={point} />)}
        {pressures.length > 0 && <ChamberPressureTable rows={pressures} />}

        <p className="text-[13px] text-ink-2 border-t border-line pt-5">
          Spotted a wrong value?{' '}
          <a href={NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer">Open an issue on GitHub <Icon name="external" size={11} className="inline" /></a>
          {' '}with the operating point number and the correction.
        </p>
      </div>
    </div>
  )
}
