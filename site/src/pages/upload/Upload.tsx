import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BASE_URL } from '../../api/client'

const CSV_HEADER = 'title,setup,geometry,fuel,oxidizer,equivalence_ratio,initial_pressure_kpa,initial_temperature_k,primary_diluent_name,primary_diluent_percentage,additional_diluents,primary_dopant_name,primary_dopant_ppm,additional_dopants,cell_width_mm,cell_width_uncertainty_mm,cell_length_mm,cell_length_uncertainty_mm,critical_hydraulic_diameter_mm,minimum_hydraulic_diameter_mm,critical_energy_j,tube_radius_mm,chamber_width_mm,chamber_height_mm,contributor_name,contributor_institution,contributor_email,doi_reference,sharing_link,notes'

const TEMPLATE_ROWS = [
  '# Detonation Science and Technology Library - CSV Upload Template',
  '# Lines starting with # are comments and will be ignored.',
  '# Required fields: title, setup, geometry, fuel, oxidizer, equivalence_ratio, initial_pressure_kpa, initial_temperature_k, contributor_name, contributor_institution, contributor_email',
  '# setup: detonation | rde',
  '# geometry: round_tube | square_channel | rectangular_channel | annular',
  '# Leave optional numeric fields blank if not applicable.',
  '# additional_diluents format: "name1:percentage1,name2:percentage2"',
  '# additional_dopants format: "name1:ppm1,name2:ppm2"',
  CSV_HEADER,
]

function downloadTemplate() {
  const content = TEMPLATE_ROWS.join('\n') + '\n'
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'detonation_db_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

interface ParsedRow {
  [key: string]: string
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += ch
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[]; errors: string[] } {
  const lines = text.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
  const errors: string[] = []
  if (lines.length < 2) {
    errors.push('CSV must have a header row and at least one data row.')
    return { headers: [], rows: [], errors }
  }
  const headers = splitCSVLine(lines[0])
  const expectedHeaders = CSV_HEADER.split(',')
  const missing = expectedHeaders.filter(h => !headers.includes(h))
  if (missing.length > 0) {
    errors.push(`Missing columns: ${missing.join(', ')}`)
  }
  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i])
    const row: ParsedRow = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
    rows.push(row)
    if (!row.title) errors.push(`Row ${i}: missing title`)
    if (!row.fuel) errors.push(`Row ${i}: missing fuel`)
    if (!row.oxidizer) errors.push(`Row ${i}: missing oxidizer`)
    if (!row.contributor_name) errors.push(`Row ${i}: missing contributor_name`)
  }
  return { headers, rows, errors }
}

export default function Upload() {
  const [parsed, setParsed] = useState<{ headers: string[]; rows: ParsedRow[]; errors: string[] } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: { row: number; error: string }[] } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setSubmitError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setParsed(parseCSV(text))
    }
    reader.readAsText(file)
  }

  const handleSubmit = async () => {
    if (!fileRef.current?.files?.[0]) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const formData = new FormData()
      formData.append('file', fileRef.current.files[0])
      const res = await fetch(`${BASE_URL}/api/cases/upload-csv`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        if (res.status === 413) {
          throw new Error('File is too large. The maximum upload size is 10 MB — split the CSV into smaller files and try again.')
        }
        const text = await res.text()
        throw new Error(text || `Upload failed: ${res.status}`)
      }
      const data = await res.json()
      setResult({ created: data.created ?? 0, updated: data.updated ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? [] })
      setParsed(null)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  const hasErrors = parsed && parsed.errors.length > 0

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-uci-dark-blue mb-2">Upload Data</h1>
      <p className="text-sm text-gray-600 mb-6">
        Upload a CSV file with detonation case data. Download the template to get started.
      </p>

      <div className="flex gap-3 mb-6">
        <button
          onClick={downloadTemplate}
          className="px-4 py-2 border border-uci-blue text-uci-blue rounded font-semibold text-sm hover:bg-uci-blue hover:text-white transition-colors"
        >
          Download Template
        </button>
      </div>

      <div className="mb-6">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-700">Select CSV file</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="text-sm file:mr-3 file:px-4 file:py-2 file:border file:border-gray-300 file:rounded file:text-sm file:bg-gray-50 file:hover:bg-gray-100"
          />
        </label>
      </div>

      {parsed && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Preview ({parsed.rows.length} row{parsed.rows.length !== 1 ? 's' : ''})
          </h2>

          {hasErrors && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <p className="font-semibold mb-1">Validation issues:</p>
              <ul className="list-disc ml-5 space-y-0.5">
                {parsed.errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                {parsed.errors.length > 10 && <li>...and {parsed.errors.length - 10} more</li>}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto border border-gray-200 rounded max-h-64">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1 text-left font-semibold text-gray-600">#</th>
                  {parsed.headers.slice(0, 10).map(h => (
                    <th key={h} className="px-2 py-1 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                  {parsed.headers.length > 10 && <th className="px-2 py-1 text-gray-400">+{parsed.headers.length - 10} more</th>}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 20).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                    {parsed.headers.slice(0, 10).map(h => (
                      <td key={h} className="px-2 py-1 whitespace-nowrap font-mono">{row[h] || <span className="text-gray-300">-</span>}</td>
                    ))}
                    {parsed.headers.length > 10 && <td className="px-2 py-1 text-gray-400">...</td>}
                  </tr>
                ))}
                {parsed.rows.length > 20 && (
                  <tr><td colSpan={12} className="px-2 py-1 text-center text-gray-400">...{parsed.rows.length - 20} more rows</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !!hasErrors}
            className="mt-4 px-6 py-2 bg-uci-blue text-white rounded font-semibold hover:bg-uci-dark-blue disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Uploading...' : 'Submit'}
          </button>
        </div>
      )}

      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 mb-4">
          {submitError}
        </div>
      )}

      {result && (
        <div className={`p-4 border rounded mb-4 ${result.errors.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <p className={`font-semibold ${result.errors.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
            {result.errors.length > 0 && 'Partial upload — '}
            {result.created} created, {result.updated} updated, {result.skipped} skipped
          </p>
          {result.errors.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <p className="font-semibold mb-1">
                {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} failed:
              </p>
              <ul className="list-disc ml-5 space-y-0.5">
                {result.errors.slice(0, 10).map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
                {result.errors.length > 10 && <li>...and {result.errors.length - 10} more</li>}
              </ul>
            </div>
          )}
          <Link to="/cases" className="text-uci-blue underline text-sm mt-2 inline-block">View all cases</Link>
        </div>
      )}
    </div>
  )
}
