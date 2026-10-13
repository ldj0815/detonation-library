import { useParams, Link, useLocation } from 'react-router-dom'
import { useCaseDetail } from '../../data/hooks'
import { NEW_ISSUE_URL } from '../../config'
import Badge from '../../components/Badge'
import Skeleton from '../../components/Skeleton'
import ErrorMessage from '../../components/ErrorMessage'
import type { ReactNode } from 'react'

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr>
      <td className="pr-4 py-1 text-sm text-gray-500 font-medium align-top whitespace-nowrap">{label}</td>
      <td className="py-1 text-sm font-mono text-gray-800">{value}</td>
    </tr>
  )
}

function parseAdditional(value: string | null): { name: string; amount: string }[] {
  if (!value) return []
  return value.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const parts = s.split(':')
    return { name: parts[0]?.trim() ?? s, amount: parts[1]?.trim() ?? '' }
  })
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const numId = id ? Number(id) : 0
  const { data, isLoading, isError, refetch, notFound } = useCaseDetail(numId)
  const location = useLocation()
  const backTo = (location.state as { backTo?: string } | null)?.backTo ?? '/cases'

  if (!Number.isInteger(numId) || numId <= 0 || notFound) {
    return (
      <div className="p-8 max-w-4xl">
        <h1 className="text-2xl font-bold text-uci-dark-blue mb-2">Case not found</h1>
        <p className="text-sm text-gray-600 mb-4">There is no case with this ID.</p>
        <Link to="/cases" className="text-sm text-uci-blue underline">&larr; Back to All Cases</Link>
      </div>
    )
  }

  if (isLoading) return <div className="p-8"><Skeleton rows={12} /></div>
  if (isError) return <div className="p-8"><ErrorMessage message="Failed to load case." onRetry={refetch} /></div>
  if (!data) return null

  const additionalDiluents = parseAdditional(data.additional_diluents)
  const additionalDopants = parseAdditional(data.additional_dopants)

  return (
    <div className="p-8 max-w-4xl">
      <Link to={backTo} className="text-sm text-uci-blue hover:underline mb-4 inline-block">← Back to results</Link>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-uci-dark-blue">{data.title}</h1>
          <div className="flex gap-2 mt-2">
            <Badge label={data.setup} variant="setup" />
            <Badge label={data.geometry.replaceAll('_', ' ')} variant="neutral" />
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Mixture</h2>
          <table>
            <tbody>
              <MetaRow label="Fuel" value={data.fuel} />
              <MetaRow label="Oxidizer" value={data.oxidizer} />
              <MetaRow label="Equivalence ratio" value={data.equivalence_ratio ?? '–'} />
              <MetaRow label="Pressure" value={data.initial_pressure_kpa != null ? `${data.initial_pressure_kpa} kPa` : '–'} />
              <MetaRow label="Temperature" value={data.initial_temperature_k != null ? `${data.initial_temperature_k} K` : '–'} />
            </tbody>
          </table>

          {(data.primary_diluent_name || additionalDiluents.length > 0) && (
            <>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2">Diluents</h2>
              <table>
                <tbody>
                  {data.primary_diluent_name && (
                    <MetaRow
                      label="Primary"
                      value={`${data.primary_diluent_name}${data.primary_diluent_percentage != null ? ` (${data.primary_diluent_percentage}%)` : ''}`}
                    />
                  )}
                  {additionalDiluents.map((d, i) => (
                    <MetaRow key={i} label={i === 0 ? 'Additional' : ''} value={`${d.name}${d.amount ? ` (${d.amount}%)` : ''}`} />
                  ))}
                </tbody>
              </table>
            </>
          )}

          {(data.primary_dopant_name || additionalDopants.length > 0) && (
            <>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2">Dopants</h2>
              <table>
                <tbody>
                  {data.primary_dopant_name && (
                    <MetaRow
                      label="Primary"
                      value={`${data.primary_dopant_name}${data.primary_dopant_ppm != null ? ` (${data.primary_dopant_ppm} ppm)` : ''}`}
                    />
                  )}
                  {additionalDopants.map((d, i) => (
                    <MetaRow key={i} label={i === 0 ? 'Additional' : ''} value={`${d.name}${d.amount ? ` (${d.amount} ppm)` : ''}`} />
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div>
          {(data.cell_width_mm != null || data.cell_length_mm != null || data.critical_hydraulic_diameter_mm != null || data.minimum_hydraulic_diameter_mm != null || data.critical_energy_j != null) && (
            <>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Detonation Parameters</h2>
              <table>
                <tbody>
                  {data.cell_width_mm != null && (
                    <MetaRow label="Cell width" value={`${data.cell_width_mm}${data.cell_width_uncertainty_mm != null ? ` \u00B1 ${data.cell_width_uncertainty_mm}` : ''} mm`} />
                  )}
                  {data.cell_length_mm != null && (
                    <MetaRow label="Cell length" value={`${data.cell_length_mm}${data.cell_length_uncertainty_mm != null ? ` \u00B1 ${data.cell_length_uncertainty_mm}` : ''} mm`} />
                  )}
                  {data.critical_hydraulic_diameter_mm != null && (
                    <MetaRow label="Critical HD" value={`${data.critical_hydraulic_diameter_mm} mm`} />
                  )}
                  {data.minimum_hydraulic_diameter_mm != null && (
                    <MetaRow label="Min HD" value={`${data.minimum_hydraulic_diameter_mm} mm`} />
                  )}
                  {data.critical_energy_j != null && (
                    <MetaRow label="Critical energy" value={`${data.critical_energy_j} J`} />
                  )}
                </tbody>
              </table>
            </>
          )}

          {(data.tube_radius_mm != null || data.chamber_width_mm != null || data.chamber_height_mm != null) && (
            <>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2">Geometry Dimensions</h2>
              <table>
                <tbody>
                  {data.tube_radius_mm != null && <MetaRow label="Tube radius" value={`${data.tube_radius_mm} mm`} />}
                  {data.chamber_width_mm != null && <MetaRow label="Chamber width" value={`${data.chamber_width_mm} mm`} />}
                  {data.chamber_height_mm != null && <MetaRow label="Chamber height" value={`${data.chamber_height_mm} mm`} />}
                </tbody>
              </table>
            </>
          )}

          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2">Contributor</h2>
          <table>
            <tbody>
              <MetaRow label="Name" value={data.contributor_name} />
              <MetaRow label="Institution" value={data.contributor_institution} />
              <MetaRow label="Email" value={<a href={`mailto:${data.contributor_email}`} className="text-uci-blue underline">{data.contributor_email}</a>} />
              {data.doi_reference && <MetaRow label="DOI / Ref" value={data.doi_reference} />}
              {data.sharing_link && (
                <MetaRow label="Sharing link" value={<a href={data.sharing_link} target="_blank" rel="noopener noreferrer" className="text-uci-blue underline">{data.sharing_link}</a>} />
              )}
              <MetaRow label="Added" value={new Date(data.created_at).toLocaleDateString()} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}

      {/* Correction notice */}
      <p className="text-sm text-gray-500 border-t border-gray-100 pt-6">
        To correct this data,{' '}
        <a href={NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer" className="text-uci-blue underline">open an issue on GitHub</a>.
      </p>

      <div className="mt-4">
        <Link to="/cases" className="text-sm text-uci-blue underline">&larr; Back to All Cases</Link>
      </div>
    </div>
  )
}
