import { useState } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useCaseDetail, useCaseHistory } from '../../api/cases'
import { useAdmin } from '../../context/AdminContext'
import { useUpdateCase, useDeleteCase } from '../../api/mutations'
import Badge from '../../components/Badge'
import Skeleton from '../../components/Skeleton'
import ErrorMessage from '../../components/ErrorMessage'
import type { CaseDetail as CaseDetailType } from '../../types/case'
import type { ReactNode } from 'react'

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr>
      <td className="pr-4 py-1 text-sm text-gray-500 font-medium align-top whitespace-nowrap">{label}</td>
      <td className="py-1 text-sm font-mono text-gray-800">{value}</td>
    </tr>
  )
}

// Numeric columns: blank -> null, otherwise Number(...).
const NUMERIC_FIELDS = new Set([
  'equivalence_ratio', 'initial_pressure_kpa', 'initial_temperature_k',
  'primary_diluent_percentage', 'primary_dopant_ppm',
  'cell_width_mm', 'cell_width_uncertainty_mm', 'cell_length_mm', 'cell_length_uncertainty_mm',
  'critical_hydraulic_diameter_mm', 'minimum_hydraulic_diameter_mm', 'critical_energy_j',
  'tube_radius_mm', 'chamber_width_mm', 'chamber_height_mm',
])

// Required text columns: never sent as null (empty string passes through so the
// server validator rejects it with a clear message).
const REQUIRED_TEXT_FIELDS = new Set([
  'title', 'setup', 'geometry', 'fuel', 'oxidizer',
  'contributor_name', 'contributor_institution', 'contributor_email',
])

function parseAdditional(value: string | null): { name: string; amount: string }[] {
  if (!value) return []
  return value.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const parts = s.split(':')
    return { name: parts[0]?.trim() ?? s, amount: parts[1]?.trim() ?? '' }
  })
}

function CaseEditForm({ data, onClose }: { data: CaseDetailType; onClose: () => void }) {
  const updateCase = useUpdateCase()
  const [form, setForm] = useState({
    title: data.title,
    setup: data.setup,
    geometry: data.geometry,
    fuel: data.fuel,
    oxidizer: data.oxidizer,
    equivalence_ratio: data.equivalence_ratio != null ? String(data.equivalence_ratio) : '',
    initial_pressure_kpa: data.initial_pressure_kpa != null ? String(data.initial_pressure_kpa) : '',
    initial_temperature_k: data.initial_temperature_k != null ? String(data.initial_temperature_k) : '',
    primary_diluent_name: data.primary_diluent_name ?? '',
    primary_diluent_percentage: data.primary_diluent_percentage != null ? String(data.primary_diluent_percentage) : '',
    additional_diluents: data.additional_diluents ?? '',
    primary_dopant_name: data.primary_dopant_name ?? '',
    primary_dopant_ppm: data.primary_dopant_ppm != null ? String(data.primary_dopant_ppm) : '',
    additional_dopants: data.additional_dopants ?? '',
    cell_width_mm: data.cell_width_mm != null ? String(data.cell_width_mm) : '',
    cell_width_uncertainty_mm: data.cell_width_uncertainty_mm != null ? String(data.cell_width_uncertainty_mm) : '',
    cell_length_mm: data.cell_length_mm != null ? String(data.cell_length_mm) : '',
    cell_length_uncertainty_mm: data.cell_length_uncertainty_mm != null ? String(data.cell_length_uncertainty_mm) : '',
    critical_hydraulic_diameter_mm: data.critical_hydraulic_diameter_mm != null ? String(data.critical_hydraulic_diameter_mm) : '',
    minimum_hydraulic_diameter_mm: data.minimum_hydraulic_diameter_mm != null ? String(data.minimum_hydraulic_diameter_mm) : '',
    critical_energy_j: data.critical_energy_j != null ? String(data.critical_energy_j) : '',
    tube_radius_mm: data.tube_radius_mm != null ? String(data.tube_radius_mm) : '',
    chamber_width_mm: data.chamber_width_mm != null ? String(data.chamber_width_mm) : '',
    chamber_height_mm: data.chamber_height_mm != null ? String(data.chamber_height_mm) : '',
    contributor_name: data.contributor_name,
    contributor_institution: data.contributor_institution,
    contributor_email: data.contributor_email,
    doi_reference: data.doi_reference ?? '',
    sharing_link: data.sharing_link ?? '',
    notes: data.notes ?? '',
  })

  const handleSubmit = () => {
    // Build a JSON patch: only changed fields are sent. A cleared field becomes
    // an explicit null (for nullable columns) so the server can clear it; an
    // untouched field is omitted entirely.
    const original = data as unknown as Record<string, unknown>
    const body: Record<string, unknown> = {}
    for (const [k, raw] of Object.entries(form)) {
      const trimmed = raw.trim()
      let newVal: unknown
      if (NUMERIC_FIELDS.has(k)) newVal = trimmed === '' ? null : Number(trimmed)
      else if (REQUIRED_TEXT_FIELDS.has(k)) newVal = trimmed
      else newVal = trimmed === '' ? null : trimmed
      const origVal = original[k] === undefined ? null : original[k]
      if (newVal !== origVal) body[k] = newVal
    }
    updateCase.mutate({ id: data.id, body }, { onSuccess: () => onClose() })
  }

  const field = (label: string, key: keyof typeof form, type = 'text') => (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-uci-blue"
      />
    </label>
  )

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-uci-dark-blue mb-6">Edit Case</h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="col-span-full">{field('Title', 'title')}</div>
        {field('Setup', 'setup')}
        {field('Geometry', 'geometry')}
        {field('Fuel', 'fuel')}
        {field('Oxidizer', 'oxidizer')}
        {field('Equivalence ratio', 'equivalence_ratio', 'number')}
        {field('Pressure (kPa)', 'initial_pressure_kpa', 'number')}
        {field('Temperature (K)', 'initial_temperature_k', 'number')}
        {field('Primary diluent name', 'primary_diluent_name')}
        {field('Primary diluent %', 'primary_diluent_percentage', 'number')}
        {field('Additional diluents', 'additional_diluents')}
        {field('Primary dopant name', 'primary_dopant_name')}
        {field('Primary dopant (ppm)', 'primary_dopant_ppm', 'number')}
        {field('Additional dopants', 'additional_dopants')}
        {field('Cell width (mm)', 'cell_width_mm', 'number')}
        {field('Cell width +/- (mm)', 'cell_width_uncertainty_mm', 'number')}
        {field('Cell length (mm)', 'cell_length_mm', 'number')}
        {field('Cell length +/- (mm)', 'cell_length_uncertainty_mm', 'number')}
        {field('Critical HD (mm)', 'critical_hydraulic_diameter_mm', 'number')}
        {field('Min HD (mm)', 'minimum_hydraulic_diameter_mm', 'number')}
        {field('Critical energy (J)', 'critical_energy_j', 'number')}
        {field('Tube radius (mm)', 'tube_radius_mm', 'number')}
        {field('Chamber width (mm)', 'chamber_width_mm', 'number')}
        {field('Chamber height (mm)', 'chamber_height_mm', 'number')}
        {field('Contributor', 'contributor_name')}
        {field('Institution', 'contributor_institution')}
        {field('Email', 'contributor_email', 'email')}
        {field('DOI / Reference', 'doi_reference')}
        {field('Sharing link', 'sharing_link', 'url')}
        <div className="col-span-full">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Notes</span>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-uci-blue"
            />
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="px-6 py-2 rounded border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={updateCase.isPending}
          className="px-6 py-2 rounded bg-uci-blue text-white font-semibold hover:bg-uci-dark-blue disabled:opacity-40"
        >
          {updateCase.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {updateCase.isError && (
        <p className="text-sm text-red-500 mt-3">Failed to save changes. Please try again.</p>
      )}
    </div>
  )
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const numId = id ? Number(id) : 0
  const { data, isLoading, isError, refetch } = useCaseDetail(numId)
  const { isAdmin } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = (location.state as { backTo?: string } | null)?.backTo ?? '/cases'
  const updateCase = useUpdateCase()
  const deleteCaseMut = useDeleteCase()
  const [editing, setEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const history = useCaseHistory(numId, isAdmin)

  if (!Number.isInteger(numId) || numId <= 0) {
    return (
      <div className="p-8 max-w-4xl">
        <h1 className="text-2xl font-bold text-uci-dark-blue mb-2">Case not found</h1>
        <p className="text-sm text-gray-600 mb-4">The case ID in the URL is not valid.</p>
        <Link to="/cases" className="text-sm text-uci-blue underline">&larr; Back to All Cases</Link>
      </div>
    )
  }

  if (isLoading) return <div className="p-8"><Skeleton rows={12} /></div>
  if (isError) return <div className="p-8"><ErrorMessage message="Failed to load case." onRetry={refetch} /></div>
  if (!data) return null

  if (editing) {
    return <CaseEditForm data={data} onClose={() => { setEditing(false) }} />
  }

  const handleHideToggle = () => {
    updateCase.mutate({ id: data.id, body: { hidden: !data.hidden } })
  }

  const handleDelete = () => {
    deleteCaseMut.mutate(data.id, {
      onSuccess: () => navigate(backTo),
    })
  }

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

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-6 p-3 bg-gray-50 border border-gray-200 rounded">
          {data.hidden && <Badge label="Hidden" variant="neutral" />}
          <button onClick={() => setEditing(true)} className="px-3 py-1 text-sm bg-uci-blue text-white rounded hover:bg-uci-dark-blue">Edit</button>
          <button onClick={handleHideToggle} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100">
            {data.hidden ? 'Unhide' : 'Hide'}
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-bold text-red-600 mb-2">Permanently Delete Case?</h3>
            <p className="text-sm text-gray-600 mb-4">This cannot be undone. The case will be permanently removed.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border border-gray-300 rounded text-sm font-semibold">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded text-sm font-semibold hover:bg-red-600">
                {deleteCaseMut.isPending ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <MetaRow label="Uploaded" value={new Date(data.created_at).toLocaleDateString()} />
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

      {/* History (admin only) */}
      {isAdmin && history.data && history.data.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Change History</h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2 font-semibold text-gray-600">Action</th>
                  <th className="px-3 py-2 font-semibold text-gray-600">Details</th>
                  <th className="px-3 py-2 font-semibold text-gray-600">By</th>
                  <th className="px-3 py-2 font-semibold text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map(entry => (
                  <tr key={entry.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        entry.action === 'created' ? 'bg-green-100 text-green-700' :
                        entry.action === 'deleted' ? 'bg-red-100 text-red-700' :
                        entry.action === 'hidden' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{entry.changed_fields ?? '\u2014'}</td>
                    <td className="px-3 py-2 text-gray-600">{entry.changed_by ?? '\u2014'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{new Date(entry.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4">
        <Link to="/cases" className="text-sm text-uci-blue underline">&larr; Back to All Cases</Link>
      </div>
    </div>
  )
}
