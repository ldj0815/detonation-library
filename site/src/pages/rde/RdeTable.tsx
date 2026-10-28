import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { RdeNumericKey, RdeOperatingPoint, RdePublication } from '../../types/rde'
import Icon from '../../components/Icon'
import { RDE_FACETS } from '../../data/rde'
import {
  ENGINE_LABELS,
  METHOD_LABELS,
  NO_VALUE,
  codeLabel,
  fmtRde,
  fmtRdeMeasure,
  rdeAxisTitle,
  rdeField,
  rdeMethod,
  rdeUncertainty,
  rdeValue,
  waveMode,
} from '../../lib/rdeFields'

/** The numeric columns, in order. Each one sorts the whole result set. */
const RDE_TABLE_FIELDS: RdeNumericKey[] = [
  'equivalence_ratio',
  'mdot_total_kg_s',
  'mass_flux_throat_kg_m2_s',
  'chamber_outer_diameter_mm',
  'chamber_gap_mm',
  'wave_count',
  'wave_speed_m_s',
  'frequency_khz',
  'thrust_n',
  'specific_impulse_s',
]

const oxidizerFacet = RDE_FACETS.find(f => f.param === 'oxidizer')

function NumberCell({ point, field }: { point: RdeOperatingPoint; field: RdeNumericKey }) {
  const v = rdeValue(point, field)
  if (v == null) return <td className="col-num"><span className="cell-empty" title={NO_VALUE}>—</span></td>
  const f = rdeField(field)
  const method = rdeMethod(point, field)
  // The wave count shows the mode, "1 + 1" when waves also run the other way.
  const mode = field === 'wave_count' ? waveMode(point) : null
  const secondary = field === 'wave_count' && point.secondary_wave_count ? point.secondary_wave_count : null
  // The hover text carries what the column has no room for.
  const measure = secondary != null
    ? `${fmtRde(v)} in the primary direction, ${fmtRde(secondary)} in the opposite direction`
    : fmtRdeMeasure(v, rdeUncertainty(point, field), f.unit)
  const title = measure + (method ? ` · ${METHOD_LABELS[method] ?? method}` : '')
  return <td className="col-num num" title={title}>{mode ?? fmtRde(v)}</td>
}

interface RdeTableProps {
  points: RdeOperatingPoint[]
  pubs: Map<number, RdePublication>
  sortBy: string | null
  sortDir: 'asc' | 'desc'
  onSort: (field: RdeNumericKey) => void
}

export default function RdeTable({ points, pubs, sortBy, sortDir, onSort }: RdeTableProps) {
  const navigate = useNavigate()
  const location = useLocation()
  // The detail page's back link returns to this filtered, sorted list.
  const state = { from: location.search }
  const open = (id: number) => navigate(`/browse/rde/${id}`, { state })

  return (
    <div className="panel overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Publication</th>
            <th scope="col" title="R: rocket. AB: air-breathing. AAB: O₂-augmented air-breathing.">Class</th>
            <th scope="col" title="Operating-point type: steady, transient blowdown, mode change or other.">Type</th>
            <th scope="col">Fuel / oxidizer</th>
            {RDE_TABLE_FIELDS.map(key => {
              const f = rdeField(key)
              const sorted = sortBy === key
              return (
                <th
                  key={key}
                  scope="col"
                  className={`sortable col-num ${sorted ? 'sorted' : ''}`}
                  aria-sort={sorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  title={f.note ? `${rdeAxisTitle(f)}. ${f.note}` : rdeAxisTitle(f)}
                >
                  <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1 cursor-pointer">
                    {sorted && <Icon name="chevronDown" size={12} className={sortDir === 'asc' ? 'rotate-180' : ''} />}
                    {f.unit ? `${f.short} (${f.unit})` : f.short}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {points.map(p => {
            const pub = pubs.get(p.publication_id)
            const oxidizer = oxidizerFacet ? oxidizerFacet.display(p.oxidizer, pubs) : p.oxidizer
            const reported = `As reported: ${p.fuel_reported ?? p.fuel} / ${p.oxidizer_reported ?? p.oxidizer}`
            return (
              <tr key={p.id} className="row-link" onClick={() => open(p.id)}>
                <td>
                  <Link
                    to={`/browse/rde/${p.id}`}
                    state={state}
                    onClick={e => e.stopPropagation()}
                    className="num"
                    aria-label={`Operating point ${p.id}`}
                  >
                    {p.id}
                  </Link>
                </td>
                <td className="text-ink" title={pub?.title}>{pub?.label ?? `Publication ${p.publication_id}`}</td>
                <td><span className="badge" title={ENGINE_LABELS[p.engine_code]}>{p.engine_code}</span></td>
                <td className="text-ink-2">{codeLabel(p.operating_point_type)}</td>
                <td title={reported}>{p.fuel} / {oxidizer}</td>
                {RDE_TABLE_FIELDS.map(key => <NumberCell key={key} point={p} field={key} />)}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
