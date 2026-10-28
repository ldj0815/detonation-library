import type { ReactNode } from 'react'
import type { ExtractionMethod, RdeChamberPressure } from '../../types/rde'
import { METHOD_DESCRIPTIONS, METHOD_LABELS, MISSING_NOTE, NO_VALUE, codeLabel, fmtRdeMeasure } from '../../lib/rdeFields'

// Pieces of the operating point page: a value with its uncertainty, unit and
// extraction method, the sections that hold them, and the chamber pressures.

/** How a value was obtained from its paper. */
export function MethodChip({ method }: { method: ExtractionMethod | null | undefined }) {
  if (!method) return null
  return (
    <span className="badge" title={METHOD_DESCRIPTIONS[method]}>
      {METHOD_LABELS[method] ?? codeLabel(method)}
    </span>
  )
}

function storedText(value: number, uncertainty: number | null | undefined, unit: string): string {
  return `${value}${uncertainty != null ? ` ± ${uncertainty}` : ''}${unit ? ` ${unit}` : ''}`
}

/** "1,520 ± 30 m/s" and its method; the stored numbers show on hover. */
export function MeasureValue({ value, uncertainty, unit, method }: {
  value: number
  uncertainty?: number | null
  unit: string
  method?: ExtractionMethod | null
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="num" title={storedText(value, uncertainty, unit)}>{fmtRdeMeasure(value, uncertainty, unit)}</span>
      <MethodChip method={method} />
    </span>
  )
}

/** One label and value of a section; the note sits under the value. */
export function Def({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] text-ink-2">{label}</dt>
      <dd className="mt-0.5 text-[14px] text-ink break-words">
        {children}
        {note && <p className="mt-1 max-w-[60ch] text-[12.5px] leading-snug text-ink-2">{note}</p>}
      </dd>
    </div>
  )
}

export function DefList({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-8 gap-y-3.5 md:grid-cols-2">{children}</dl>
}

/** The fields the release has no value for, so a gap is not read as a zero. */
export function MissingValues({ labels, separated = true }: { labels: string[]; separated?: boolean }) {
  if (labels.length === 0) return null
  return (
    <p className={`text-[12.5px] text-ink-2${separated ? ' mt-4 border-t border-line pt-3' : ''}`} title={MISSING_NOTE}>
      {NO_VALUE}: {labels.join(', ')}.
    </p>
  )
}

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-semibold">{title}</h2>
      <div className="panel px-4 py-4">{children}</div>
    </section>
  )
}

function yesNo(flag: number | undefined) {
  if (flag == null) return <span className="cell-empty">—</span>
  return flag === 1 ? 'Yes' : 'No'
}

export function ChamberPressureTable({ rows }: { rows: RdeChamberPressure[] }) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-semibold">Chamber pressure</h2>
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-num" title="Position in this list; the database id shows on hover">Tap</th>
              <th className="col-num">Pressure (kPa)</th>
              <th>Method</th>
              <th title="Marked by the paper as representative of the upstream side">Upstream side</th>
              <th title="Marked by the paper as representative of the downstream side">Downstream side</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="col-num" title={`Database id ${r.id} (the id column of rde_chamber_pressures.csv)`}>{i + 1}</td>
                <td className="col-num">
                  {r.pressure_kpa != null
                    ? <span title={storedText(r.pressure_kpa, r.pressure_kpa_uncertainty, 'kPa')}>{fmtRdeMeasure(r.pressure_kpa, r.pressure_kpa_uncertainty, '')}</span>
                    : <span className="cell-empty">—</span>}
                </td>
                <td>{r.pressure_kpa_method ? <MethodChip method={r.pressure_kpa_method} /> : <span className="cell-empty">—</span>}</td>
                <td>{yesNo(r.representative_upstream)}</td>
                <td>{yesNo(r.representative_downstream)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] text-ink-2">
        Several pressure taps per operating point are expected. Each measurement is listed separately; they are not
        averaged. The CSV download carries them joined with ';' in its chamber_pressures_kpa column; the full table is
        in{' '}
        <a href={`${import.meta.env.BASE_URL}rde_chamber_pressures.csv`} download="rde_chamber_pressures.csv">rde_chamber_pressures.csv</a>.
      </p>
    </section>
  )
}
