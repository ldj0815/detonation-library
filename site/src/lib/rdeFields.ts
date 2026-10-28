import type { EngineCode, ExtractionMethod, RdeNumericKey, RdeOperatingPoint } from '../types/rde'

export type RdeFieldGroup = 'conditions' | 'geometry' | 'modes' | 'performance'

export const RDE_GROUP_LABELS: Record<RdeFieldGroup, string> = {
  conditions: 'Operating conditions',
  geometry: 'Combustor geometry',
  modes: 'Wave modes',
  performance: 'Performance',
}

export interface RdeField {
  key: RdeNumericKey
  /** Full name, for axis titles and the detail page. */
  label: string
  /** Column header and chip label. */
  short: string
  unit: string
  group: RdeFieldGroup
  /** What a reader must know before comparing values across papers. */
  note?: string
  /** Spans decades across the data: plotted on a log axis by default. */
  log?: boolean
  /** Only whole numbers (wave counts). */
  integer?: boolean
}

const ISP_NOTE =
  'The flow in the denominator differs by engine class: total propellant for rockets, fuel for air-breathing engines, ' +
  'fuel plus carried oxygen for oxygen-augmented air-breathing engines. Compare within one class.'
/** What an empty value means. The release records no reason for its gaps. */
export const NO_VALUE = 'No value in the release'
export const MISSING_NOTE =
  'An empty value means the release has no value for it; the release does not record why. It is never a zero.'

const WAVE_SPEED_NOTE =
  "Computed at each paper's reference diameter, which is not always the chamber outer diameter."

/** Every numeric field, in the order menus list them. */
export const RDE_FIELDS: RdeField[] = [
  // Operating conditions
  { key: 'equivalence_ratio', label: 'Global equivalence ratio', short: 'φ', unit: '', group: 'conditions' },
  { key: 'mdot_total_kg_s', label: 'Total mass flow rate', short: 'ṁ total', unit: 'kg/s', group: 'conditions', log: true },
  { key: 'mdot_fuel_kg_s', label: 'Fuel mass flow rate', short: 'ṁ fuel', unit: 'kg/s', group: 'conditions', log: true },
  { key: 'mdot_oxidizer_kg_s', label: 'Oxidizer mass flow rate', short: 'ṁ oxidizer', unit: 'kg/s', group: 'conditions', log: true },
  { key: 'mass_flux_throat_kg_m2_s', label: 'Mass flux at the throat', short: 'Throat mass flux', unit: 'kg/(m²·s)', group: 'conditions', log: true, note: 'Total chamber flow divided by the throat area; not a fuel-only flux.' },
  { key: 'mass_flux_chamber_kg_m2_s', label: 'Mass flux in the chamber', short: 'Chamber mass flux', unit: 'kg/(m²·s)', group: 'conditions', log: true, note: 'Total chamber flow divided by the chamber area.' },
  { key: 'fuel_manifold_pressure_kpa', label: 'Fuel manifold stagnation pressure', short: 'Fuel manifold P', unit: 'kPa', group: 'conditions' },
  { key: 'oxidizer_manifold_pressure_kpa', label: 'Oxidizer manifold stagnation pressure', short: 'Oxidizer manifold P', unit: 'kPa', group: 'conditions' },
  { key: 'fuel_manifold_temperature_k', label: 'Fuel manifold stagnation temperature', short: 'Fuel manifold T', unit: 'K', group: 'conditions' },
  { key: 'oxidizer_manifold_temperature_k', label: 'Oxidizer manifold stagnation temperature', short: 'Oxidizer manifold T', unit: 'K', group: 'conditions' },
  { key: 'back_pressure_pa', label: 'Back pressure', short: 'Back pressure', unit: 'Pa', group: 'conditions' },
  { key: 'burn_time_s', label: 'Burn time', short: 'Burn time', unit: 's', group: 'conditions' },
  { key: 'stoich_fuel_oxidizer_mass_ratio', label: 'Stoichiometric fuel/oxidizer mass ratio', short: 'Stoich. F/O', unit: '', group: 'conditions' },
  // Geometry
  { key: 'chamber_outer_diameter_mm', label: 'Chamber outer diameter', short: 'Chamber OD', unit: 'mm', group: 'geometry' },
  { key: 'chamber_inner_diameter_mm', label: 'Chamber inner diameter', short: 'Chamber ID', unit: 'mm', group: 'geometry' },
  { key: 'chamber_gap_mm', label: 'Chamber annular width', short: 'Gap', unit: 'mm', group: 'geometry', note: 'Half the difference of the outer and inner diameters: for a hollow chamber with no inner body, the chamber radius.' },
  { key: 'chamber_length_mm', label: 'Chamber length', short: 'Length', unit: 'mm', group: 'geometry' },
  { key: 'total_length_mm', label: 'Total length', short: 'Total length', unit: 'mm', group: 'geometry' },
  { key: 'throat_outer_diameter_mm', label: 'Throat outer diameter', short: 'Throat OD', unit: 'mm', group: 'geometry' },
  { key: 'throat_inner_diameter_mm', label: 'Throat inner diameter', short: 'Throat ID', unit: 'mm', group: 'geometry' },
  { key: 'exit_outer_diameter_mm', label: 'Exit outer diameter', short: 'Exit OD', unit: 'mm', group: 'geometry' },
  { key: 'exit_inner_diameter_mm', label: 'Exit inner diameter', short: 'Exit ID', unit: 'mm', group: 'geometry' },
  { key: 'chamber_area_m2', label: 'Chamber area', short: 'Chamber area', unit: 'm²', group: 'geometry', log: true },
  { key: 'throat_area_m2', label: 'Throat area', short: 'Throat area', unit: 'm²', group: 'geometry', log: true },
  { key: 'exit_area_m2', label: 'Exit area', short: 'Exit area', unit: 'm²', group: 'geometry', log: true },
  { key: 'contraction_ratio', label: 'Contraction ratio', short: 'Contraction', unit: '', group: 'geometry', note: 'Chamber area divided by throat area.' },
  { key: 'expansion_ratio', label: 'Expansion ratio', short: 'Expansion', unit: '', group: 'geometry', note: 'Exit area divided by throat area.' },
  { key: 'fuel_injection_area_m2', label: 'Fuel injection area', short: 'Fuel injection area', unit: 'm²', group: 'geometry', log: true },
  { key: 'oxidizer_injection_area_m2', label: 'Oxidizer injection area', short: 'Oxidizer injection area', unit: 'm²', group: 'geometry', log: true },
  { key: 'total_injection_area_m2', label: 'Total injection area', short: 'Injection area', unit: 'm²', group: 'geometry', log: true },
  { key: 'injector_to_throat_area_ratio', label: 'Injector-to-throat area ratio', short: 'Injector/throat', unit: '', group: 'geometry' },
  { key: 'injector_to_chamber_area_ratio', label: 'Injector-to-chamber area ratio', short: 'Injector/chamber', unit: '', group: 'geometry' },
  // Wave modes
  { key: 'wave_count', label: 'Number of waves (primary direction)', short: 'Waves', unit: '', group: 'modes', integer: true, note: 'Waves travelling in the primary direction. Waves in the opposite direction are counted separately; a "1 + 1" mode has one of each.' },
  { key: 'wave_speed_m_s', label: 'Wave speed', short: 'Wave speed', unit: 'm/s', group: 'modes', note: WAVE_SPEED_NOTE },
  { key: 'frequency_khz', label: 'Operating frequency', short: 'Frequency', unit: 'kHz', group: 'modes' },
  { key: 'wave_speed_reference_diameter_mm', label: 'Wave-speed reference diameter', short: 'Reference diameter', unit: 'mm', group: 'modes' },
  { key: 'secondary_wave_count', label: 'Secondary-direction waves', short: 'Secondary waves', unit: '', group: 'modes', integer: true, note: 'Waves travelling against the primary direction. No value does not mean zero.' },
  { key: 'secondary_wave_speed_m_s', label: 'Secondary-direction wave speed', short: 'Secondary speed', unit: 'm/s', group: 'modes' },
  { key: 'secondary_frequency_khz', label: 'Secondary-direction frequency', short: 'Secondary frequency', unit: 'kHz', group: 'modes' },
  // Performance
  { key: 'thrust_n', label: 'Thrust', short: 'Thrust', unit: 'N', group: 'performance', log: true, note: 'The thrust type comes from the release; where it is blank, the release does not say whether the thrust was corrected.' },
  { key: 'specific_impulse_s', label: 'Specific impulse', short: 'Isp', unit: 's', group: 'performance', note: ISP_NOTE },
  { key: 'pressure_gain_percent', label: 'Stagnation pressure gain', short: 'Pressure gain', unit: '%', group: 'performance', note: 'Negative values are a pressure loss.' },
]

const BY_KEY = new Map(RDE_FIELDS.map(f => [f.key, f]))

export function rdeField(key: RdeNumericKey): RdeField {
  const f = BY_KEY.get(key)
  if (!f) throw new Error(`Unknown RDE field ${key}`)
  return f
}

export function isRdeNumericKey(key: string | null | undefined): key is RdeNumericKey {
  return key != null && BY_KEY.has(key as RdeNumericKey)
}

/** "Wave speed (m/s)", "Global equivalence ratio". */
export function rdeAxisTitle(f: RdeField): string {
  return f.unit ? `${f.label} (${f.unit})` : f.label
}

/** A point's value of a numeric field, or null. */
export function rdeValue(p: RdeOperatingPoint, key: RdeNumericKey): number | null {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function rdeUncertainty(p: RdeOperatingPoint, key: RdeNumericKey): number | null {
  const v = (p as unknown as Record<string, unknown>)[`${key}_uncertainty`]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function rdeMethod(p: RdeOperatingPoint, key: RdeNumericKey): ExtractionMethod | null {
  const v = (p as unknown as Record<string, unknown>)[`${key}_method`]
  return typeof v === 'string' ? (v as ExtractionMethod) : null
}

/**
 * Numbers for tables and tooltips: grouping, at most two decimals from 100 up,
 * four below, and four significant digits under 0.1 (areas in m² are small).
 * The detail page shows the stored value on hover.
 */
export function fmtRde(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (Number.isInteger(v)) return v.toLocaleString('en-US')
  const a = Math.abs(v)
  if (a >= 100) return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (a >= 0.1) return v.toLocaleString('en-US', { maximumFractionDigits: 4 })
  return String(Number(v.toPrecision(4)))
}

/** The wave mode: "2", or "1 + 1" when the release also counts waves in the
 *  opposite direction. Null without a primary count. */
export function waveMode(p: RdeOperatingPoint): string | null {
  if (p.wave_count == null) return null
  return p.secondary_wave_count ? `${p.wave_count} + ${p.secondary_wave_count}` : String(p.wave_count)
}

/** "1,520 ± 30 m/s", "0.85", "—". */
export function fmtRdeMeasure(v: number | null | undefined, unc: number | null | undefined, unit: string): string {
  if (v == null) return '—'
  const u = unc != null ? ` ± ${fmtRde(unc)}` : ''
  return `${fmtRde(v)}${u}${unit ? ` ${unit}` : ''}`
}

// Labels for the release's coded values ----------------------------------------

export const ENGINE_LABELS: Record<EngineCode, string> = {
  R: 'Rocket',
  AB: 'Air-breathing',
  AAB: 'O₂-augmented air-breathing',
  unknown: 'Unknown',
}

export const ENGINE_DESCRIPTIONS: Record<EngineCode, string> = {
  R: 'Fuel and oxidizer both carried; specific impulse uses the total propellant flow.',
  AB: 'Air as the oxidizer; specific impulse uses the fuel flow.',
  AAB: 'Air enriched with carried oxygen; specific impulse uses the fuel plus the carried oxygen.',
  unknown: 'Engine class not classified.',
}

export const METHOD_LABELS: Record<ExtractionMethod, string> = {
  reported_table: 'Table',
  reported_text: 'Text',
  digitized_from_figure: 'Digitized',
  calculated: 'Calculated',
  inferred: 'Inferred',
  private_communication: 'Private comm.',
  uploaded: 'Author-supplied',
}

/** The release's own descriptions of its extraction methods. */
export const METHOD_DESCRIPTIONS: Record<ExtractionMethod, string> = {
  reported_table: 'Read from a table in the paper.',
  reported_text: 'Read from prose in the paper.',
  digitized_from_figure: 'Digitized from a figure.',
  calculated: 'Calculated from other reported values.',
  inferred: 'Inferred from context.',
  private_communication: 'Obtained via private communication.',
  uploaded: 'Supplied directly by the authors of the paper.',
}

const CODE_LABELS: Record<string, string> = {
  // operating_point_type
  steady: 'Steady',
  transient_blowdown: 'Transient, blowdown',
  transient_mode_change: 'Transient, mode change',
  // combustor_type
  axial_annular: 'Annular',
  axial_cylindrical: 'Hollow (cylindrical)',
  // exit_geometry_type
  straight: 'Straight',
  converging_only: 'Converging',
  converging_diverging: 'Converging–diverging',
  // center_body_termination
  flush: 'Flush with the exit',
  recessed: 'Recessed',
  extended: 'Extended past the exit',
  // cooling_strategy
  heat_sink: 'Heat sink',
  // back_pressure_environment
  local_atmospheric: 'Atmospheric',
  simulated_altitude_or_vacuum: 'Simulated altitude or vacuum',
  // ignition_type
  predetonator: 'Predetonator',
  explosive: 'Explosive',
  // modal_detection_method
  'high frequency sensors: dynamic pressure sensor array': 'Dynamic pressure sensor array',
  'high speed camera_downstream': 'High-speed camera, downstream view',
  'high speed camera_side': 'High-speed camera, side view',
  // phases and thrust type
  gas: 'Gas',
  liquid: 'Liquid',
  uncorrected: 'Uncorrected',
  // shared
  other_please_specify: 'Other',
  unspecified: 'Not stated',
  not_applicable: 'Not applicable',
}

/** A readable label for one of the release's coded values. */
export function codeLabel(code: string | null | undefined): string {
  if (code == null || code === '') return 'Not stated'
  const known = CODE_LABELS[code]
  if (known) return known
  const text = code.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function doiUrl(doi: string | null | undefined): string | null {
  if (!doi) return null
  return `https://doi.org/${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`
}
