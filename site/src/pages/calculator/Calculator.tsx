import { useState, useMemo } from 'react'
import { apiFetch } from '../../api/client'
import LazyPlotlyChart from '../../components/LazyPlotlyChart'

const MECHANISMS = [
  { value: 'ffcm1_h2_9sp', label: 'FFCM-1 H2 (9 sp)' },
  { value: 'ffcm1_h2_o3_12sp', label: 'FFCM-1 H2+O3 (12 sp)' },
  { value: 'gri30', label: 'GRI-Mech 3.0 (53 sp)' },
]

interface CalcResult {
  cj_speed: number
  induction_time_s: number | null
  induction_length_m: number | null
  exothermic_time_s: number | null
  exothermic_length_m: number | null
  mixture_string: string
  equivalence_ratio: number | null
  profile: Record<string, number[]>
  species_csv: string
  znd_txt: string
  znd2_txt: string
}

const PROFILE_Y_OPTIONS = [
  { value: 'T', label: 'Temperature (K)' },
  { value: 'P', label: 'Pressure (Pa)' },
  { value: 'rho', label: 'Density (kg/m3)' },
  { value: 'Mach', label: 'Mach Number' },
  { value: 'thermicity', label: 'Thermicity' },
  { value: 'species', label: 'Species (all)' },
]

// Non-species profile keys emitted by the backend (ZND1 + ZND2 columns);
// everything else in the profile is a chemical species.
const NON_SPECIES_KEYS = new Set([
  'distance', 'time', 'T', 'P', 'rho', 'Mach', 'thermicity',
  'velocity', 'sound_speed', 'gamma', 'weight', 'c2_minus_u2',
])

function downloadFile(content: string, filename: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function fmtSci(v: number | null, digits = 3): string {
  if (v == null) return 'N/A'
  if (Math.abs(v) < 0.01 || Math.abs(v) >= 1e6) return v.toExponential(digits)
  return v.toPrecision(digits + 1)
}

export default function Calculator() {
  const [advanced, setAdvanced] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CalcResult | null>(null)
  const [profileY, setProfileY] = useState('T')
  const [selectedSpecies, setSelectedSpecies] = useState<Set<string>>(new Set())
  const [zndXMin, setZndXMin] = useState('')
  const [zndXMax, setZndXMax] = useState('')
  const [zndYMin, setZndYMin] = useState('')
  const [zndYMax, setZndYMax] = useState('')

  const [fuel, setFuel] = useState('H2')
  const [oxidizer, setOxidizer] = useState('O2')
  const [phi, setPhi] = useState('1.0')
  const [pressure, setPressure] = useState('15')
  const [temperature, setTemperature] = useState('300')
  const [diluent, setDiluent] = useState('')
  const [diluentPct, setDiluentPct] = useState('')
  const [ozonePpm, setOzonePpm] = useState('')
  const [mechanism, setMechanism] = useState('ffcm1_h2_9sp')
  const [rawMixture, setRawMixture] = useState('')
  const [hasOzone, setHasOzone] = useState(false)

  const buildBody = (): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      mode: advanced ? 'advanced' : 'standard',
      fuel,
      oxidizer,
      initial_pressure_kpa: Number(pressure),
      initial_temperature_k: Number(temperature),
      mechanism,
    }
    if (advanced) {
      body.raw_mixture = rawMixture
      body.has_ozone = hasOzone
      if (diluent) body.diluent_name = diluent
    } else {
      body.equivalence_ratio = Number(phi)
      if (diluent && diluentPct) {
        body.diluent_name = diluent
        body.diluent_percentage = Number(diluentPct)
      }
      if (ozonePpm) body.ozone_doping_ppm = Number(ozonePpm)
    }
    return body
  }

  const handleRun = async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiFetch<CalcResult>('/api/znd-calculator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      })
      setResult(res)
      // Initialize species selection to all available species
      if (res.profile) {
        const species = Object.keys(res.profile).filter(k => !NON_SPECIES_KEYS.has(k) && Array.isArray(res.profile[k]))
        setSelectedSpecies(new Set(species))
      }
      setZndXMin(''); setZndXMax(''); setZndYMin(''); setZndYMax('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setRunning(false)
    }
  }

  const field = (label: string, value: string, onChange: (v: string) => void, type = 'text', placeholder = '') => (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={running}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-uci-blue disabled:opacity-50"
      />
    </label>
  )

  function getMach09Distance(): number | undefined {
    const profile = result?.profile
    if (!profile?.distance || !profile.Mach) return undefined
    const mach = profile.Mach
    const dist = profile.distance
    // Find first index where Mach >= 0.9 (Mach starts low and rises toward CJ)
    for (let i = 0; i < mach.length; i++) {
      if (mach[i] >= 0.9) return dist[i]
    }
    return undefined
  }

  function buildProfileTraces() {
    const profile = result?.profile
    if (!profile || !profile.distance) return []

    const distance = profile.distance

    if (profileY === 'species') {
      return Object.entries(profile)
        .filter(([k]) => !NON_SPECIES_KEYS.has(k) && Array.isArray(profile[k]) && selectedSpecies.has(k))
        .map(([name, values]) => ({
          x: distance,
          y: values,
          name,
          type: 'scatter' as const,
          mode: 'lines' as const,
        }))
    }

    const values = profile[profileY]
    if (!values) return []
    return [{
      x: distance,
      y: values,
      type: 'scatter' as const,
      mode: 'lines' as const,
      marker: { color: '#0064A4' },
    }]
  }

  // Memoized so the chart receives stable props and updates in place instead of
  // tearing down/rebuilding on every keystroke elsewhere on the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profileTraces = useMemo(() => buildProfileTraces(), [result, profileY, selectedSpecies])
  const profileLayout = useMemo(() => {
    const hasCustomX = zndXMin || zndXMax
    const hasCustomY = zndYMin || zndYMax
    const autoXMax = getMach09Distance()
    const xRange = hasCustomX
      ? [zndXMin ? Number(zndXMin) : undefined, zndXMax ? Number(zndXMax) : undefined]
      : autoXMax ? [0, autoXMax * 1.1] : undefined
    const yRange = hasCustomY
      ? [zndYMin ? Number(zndYMin) : undefined, zndYMax ? Number(zndYMax) : undefined]
      : undefined
    return {
      xaxis: {
        title: { text: 'Distance (m)' },
        ...(xRange ? { range: xRange } : {}),
      },
      yaxis: {
        title: { text: PROFILE_Y_OPTIONS.find(o => o.value === profileY)?.label ?? profileY },
        ...(yRange ? { range: yRange } : {}),
      },
      showlegend: profileY === 'species',
      hovermode: 'closest' as const,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, profileY, zndXMin, zndXMax, zndYMin, zndYMax])

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-uci-dark-blue mb-1">ZND Solution Calculator</h1>
      <p className="text-sm text-gray-500 mb-6">Compute ZND detonation structure using Cantera + SDToolbox</p>

      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={advanced} onChange={e => setAdvanced(e.target.checked)} />
          Advanced mode (raw mixture string)
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {field('Fuel', fuel, setFuel, 'text', 'H2')}
        {field('Oxidizer', oxidizer, setOxidizer, 'text', 'O2')}

        {!advanced && field('Equivalence ratio (\u03C6)', phi, setPhi, 'number', '1.0')}

        {field('Pressure (kPa)', pressure, setPressure, 'number', '15')}
        {field('Temperature (K)', temperature, setTemperature, 'number', '300')}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Mechanism</span>
          <select
            value={mechanism}
            onChange={e => setMechanism(e.target.value)}
            disabled={running}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-uci-blue disabled:opacity-50"
          >
            {MECHANISMS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>

        {!advanced && (
          <>
            {field('Diluent name (optional)', diluent, setDiluent, 'text', 'AR')}
            {diluent && field('Diluent percentage (%)', diluentPct, setDiluentPct, 'number', '10')}
            {field('Ozone doping (ppm, optional)', ozonePpm, setOzonePpm, 'number', '1500')}
          </>
        )}

        {advanced && (
          <>
            {field('Diluent species (optional)', diluent, setDiluent, 'text', 'AR')}
            <label className="flex items-center gap-2 text-sm text-gray-700 self-end pb-1.5">
              <input type="checkbox" checked={hasOzone} onChange={e => setHasOzone(e.target.checked)} />
              Has ozone (O3)
            </label>
            <div className="col-span-full">
              {field('Raw mixture string', rawMixture, setRawMixture, 'text', 'H2:2 O2:1')}
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-200 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <button
        onClick={handleRun}
        disabled={running || !fuel || !oxidizer || !pressure || !temperature || (advanced && !rawMixture) || (!advanced && !phi)}
        className="bg-uci-blue text-white px-6 py-2.5 rounded font-semibold hover:bg-uci-dark-blue transition-colors disabled:opacity-40"
      >
        {running ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Calculating...
          </span>
        ) : 'Run ZND Calculation'}
      </button>

      {/* Inline results */}
      {result && (
        <div className="mt-8 border-t pt-6">
          <h2 className="text-lg font-bold text-uci-dark-blue mb-4">Results</h2>

          {/* Scalar summary grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Mixture (mole fractions)</div>
              <div className="font-mono text-sm font-semibold break-all">{result.mixture_string || 'N/A'}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Equivalence Ratio (&#966;)</div>
              <div className="font-mono text-sm font-semibold">{result.equivalence_ratio == null ? 'N/A' : result.equivalence_ratio.toPrecision(4)}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">CJ Velocity</div>
              <div className="font-mono text-sm font-semibold">{fmtSci(result.cj_speed)} m/s</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Induction Time</div>
              <div className="font-mono text-sm font-semibold">{fmtSci(result.induction_time_s)} s</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Induction Length</div>
              <div className="font-mono text-sm font-semibold">{fmtSci(result.induction_length_m)} m</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Exothermic Time</div>
              <div className="font-mono text-sm font-semibold">{fmtSci(result.exothermic_time_s)} s</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Exothermic Length</div>
              <div className="font-mono text-sm font-semibold">{fmtSci(result.exothermic_length_m)} m</div>
            </div>
          </div>

          {/* Profile chart */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-4 items-end mb-3">
              <label className="flex flex-col gap-1 text-xs text-gray-600">
                Y-axis
                <select
                  value={profileY}
                  onChange={e => setProfileY(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50"
                >
                  {PROFILE_Y_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>

            {/* Species toggles */}
            {profileY === 'species' && result.profile && (() => {
              const allSpecies = Object.keys(result.profile).filter(k => !NON_SPECIES_KEYS.has(k) && Array.isArray(result.profile[k]))
              return (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-600 font-medium">Species:</span>
                    <button
                      onClick={() => setSelectedSpecies(new Set(allSpecies))}
                      className="text-xs text-uci-blue underline hover:no-underline"
                    >All</button>
                    <button
                      onClick={() => setSelectedSpecies(new Set())}
                      className="text-xs text-uci-blue underline hover:no-underline"
                    >None</button>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {allSpecies.map(sp => (
                      <label key={sp} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSpecies.has(sp)}
                          onChange={() => {
                            const next = new Set(selectedSpecies)
                            if (next.has(sp)) next.delete(sp)
                            else next.add(sp)
                            setSelectedSpecies(next)
                          }}
                        />
                        {sp}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* X/Y range controls */}
            <div className="flex flex-wrap gap-4 items-end mb-3">
              <label className="flex flex-col gap-1 text-xs text-gray-600">
                X min
                <input type="number" step="any" value={zndXMin} onChange={e => setZndXMin(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 w-24 font-mono" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600">
                X max
                <input type="number" step="any" value={zndXMax} onChange={e => setZndXMax(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 w-24 font-mono" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600">
                Y min
                <input type="number" step="any" value={zndYMin} onChange={e => setZndYMin(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 w-24 font-mono" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600">
                Y max
                <input type="number" step="any" value={zndYMax} onChange={e => setZndYMax(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 w-24 font-mono" />
              </label>
              <button
                onClick={() => { setZndXMin(''); setZndXMax(''); setZndYMin(''); setZndYMax('') }}
                className="text-xs text-uci-blue underline hover:no-underline self-end pb-1"
              >Reset range</button>
            </div>

            <LazyPlotlyChart data={profileTraces} layout={profileLayout} />
          </div>

          {/* Download buttons */}
          <div className="flex flex-wrap gap-3">
            {result.znd_txt && (
              <button
                onClick={() => downloadFile(result.znd_txt, 'znd_output.txt')}
                className="text-sm text-uci-blue border border-uci-blue rounded px-4 py-1.5 hover:bg-uci-blue hover:text-white transition-colors"
              >
                Download ZND TXT
              </button>
            )}
            {result.znd2_txt && (
              <button
                onClick={() => downloadFile(result.znd2_txt, 'znd2_output.txt')}
                className="text-sm text-uci-blue border border-uci-blue rounded px-4 py-1.5 hover:bg-uci-blue hover:text-white transition-colors"
              >
                Download ZND2 TXT
              </button>
            )}
            {result.species_csv && (
              <button
                onClick={() => downloadFile(result.species_csv, 'species.csv', 'text/csv')}
                className="text-sm text-uci-blue border border-uci-blue rounded px-4 py-1.5 hover:bg-uci-blue hover:text-white transition-colors"
              >
                Download Species CSV
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
