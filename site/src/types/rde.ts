// The RDE operating points, as site/public/rde.json carries them. The file is
// written by scripts/build_data.py from data/rde_subset/, which
// scripts/export_rde.py exports from a release of the RDE database; the column
// list lives in scripts/rde_data.py. Empty values are left out of each point,
// so every field but the identifiers is optional. A missing value means the
// paper gives none; it is never a zero.

/** R: rocket. AB: air-breathing. AAB: oxygen-augmented air-breathing. */
export type EngineCode = 'R' | 'AB' | 'AAB' | 'unknown'

/** How a value was obtained from its paper. */
export type ExtractionMethod =
  | 'reported_table'
  | 'reported_text'
  | 'digitized_from_figure'
  | 'calculated'
  | 'inferred'
  | 'private_communication'
  | 'uploaded'

export interface RdeRelease {
  release_version: string
  release_date: string
  schema_version?: string
  internal_use_only?: boolean
  database: string
  database_sha256: string
  views: string[]
}

export interface RdePublication {
  id: number
  /** Short label: "Smith (2021)". */
  label: string
  title: string
  year: number
  venue?: string
  authors?: string
  doi?: string
  country?: string
  engine_code: EngineCode
  /** Number of operating points from this paper. */
  operating_points: number
}

export interface RdeChamberPressure {
  id: number
  pressure_kpa?: number
  pressure_kpa_uncertainty?: number
  pressure_kpa_method?: ExtractionMethod
  /** 1 when the paper marks this tap as representative of that side. */
  representative_upstream?: number
  representative_downstream?: number
}

export interface RdeOperatingPoint {
  id: number
  publication_id: number
  test_run_id: number
  operating_point_type: string
  engine_code: EngineCode
  /** Normalised name: H2, CH4, C2H4, C2H6, Kerosene. */
  fuel: string
  /** Normalised name: Air, O2, O2-enriched air. */
  oxidizer: string
  sequence_index?: number
  window_start_s?: number
  window_end_s?: number
  fuel_reported?: string
  fuel_phase?: string
  oxidizer_reported?: string
  oxidizer_phase?: string
  diluent?: string
  stoich_fuel_oxidizer_mass_ratio?: number
  mdot_total_kg_s?: number
  mdot_total_kg_s_uncertainty?: number
  mdot_total_kg_s_method?: ExtractionMethod
  equivalence_ratio?: number
  equivalence_ratio_uncertainty?: number
  equivalence_ratio_method?: ExtractionMethod
  mdot_fuel_kg_s?: number
  mdot_fuel_kg_s_uncertainty?: number
  mdot_fuel_kg_s_method?: ExtractionMethod
  mdot_oxidizer_kg_s?: number
  mdot_oxidizer_kg_s_uncertainty?: number
  mdot_oxidizer_kg_s_method?: ExtractionMethod
  mass_flux_chamber_kg_m2_s?: number
  mass_flux_chamber_kg_m2_s_uncertainty?: number
  mass_flux_chamber_kg_m2_s_method?: ExtractionMethod
  mass_flux_throat_kg_m2_s?: number
  mass_flux_throat_kg_m2_s_uncertainty?: number
  mass_flux_throat_kg_m2_s_method?: ExtractionMethod
  fuel_manifold_pressure_kpa?: number
  fuel_manifold_pressure_kpa_uncertainty?: number
  fuel_manifold_pressure_kpa_method?: ExtractionMethod
  oxidizer_manifold_pressure_kpa?: number
  oxidizer_manifold_pressure_kpa_uncertainty?: number
  oxidizer_manifold_pressure_kpa_method?: ExtractionMethod
  fuel_manifold_temperature_k?: number
  fuel_manifold_temperature_k_uncertainty?: number
  fuel_manifold_temperature_k_method?: ExtractionMethod
  oxidizer_manifold_temperature_k?: number
  oxidizer_manifold_temperature_k_uncertainty?: number
  oxidizer_manifold_temperature_k_method?: ExtractionMethod
  back_pressure_pa?: number
  back_pressure_pa_uncertainty?: number
  back_pressure_pa_method?: ExtractionMethod
  back_pressure_environment?: string
  burn_time_s?: number
  burn_time_s_uncertainty?: number
  burn_time_s_method?: ExtractionMethod
  ignition_type?: string
  geometry_id?: number
  combustor_type?: string
  exit_geometry_type?: string
  center_body_termination?: string
  cooling_strategy?: string
  chamber_outer_diameter_mm?: number
  chamber_outer_diameter_mm_uncertainty?: number
  chamber_outer_diameter_mm_method?: ExtractionMethod
  chamber_inner_diameter_mm?: number
  chamber_inner_diameter_mm_uncertainty?: number
  chamber_inner_diameter_mm_method?: ExtractionMethod
  chamber_gap_mm?: number
  chamber_gap_mm_uncertainty?: number
  chamber_gap_mm_method?: ExtractionMethod
  chamber_length_mm?: number
  chamber_length_mm_uncertainty?: number
  chamber_length_mm_method?: ExtractionMethod
  total_length_mm?: number
  total_length_mm_method?: ExtractionMethod
  throat_outer_diameter_mm?: number
  throat_outer_diameter_mm_method?: ExtractionMethod
  throat_inner_diameter_mm?: number
  throat_inner_diameter_mm_method?: ExtractionMethod
  exit_outer_diameter_mm?: number
  exit_outer_diameter_mm_method?: ExtractionMethod
  exit_inner_diameter_mm?: number
  exit_inner_diameter_mm_method?: ExtractionMethod
  chamber_area_m2?: number
  chamber_area_m2_method?: ExtractionMethod
  throat_area_m2?: number
  throat_area_m2_method?: ExtractionMethod
  exit_area_m2?: number
  exit_area_m2_method?: ExtractionMethod
  contraction_ratio?: number
  contraction_ratio_method?: ExtractionMethod
  expansion_ratio?: number
  expansion_ratio_method?: ExtractionMethod
  fuel_injection_area_m2?: number
  fuel_injection_area_m2_method?: ExtractionMethod
  oxidizer_injection_area_m2?: number
  oxidizer_injection_area_m2_method?: ExtractionMethod
  total_injection_area_m2?: number
  total_injection_area_m2_method?: ExtractionMethod
  injector_to_throat_area_ratio?: number
  injector_to_throat_area_ratio_method?: ExtractionMethod
  injector_to_chamber_area_ratio?: number
  injector_to_chamber_area_ratio_method?: ExtractionMethod
  modal_detection_method?: string
  wave_count?: number
  wave_count_method?: ExtractionMethod
  wave_speed_m_s?: number
  wave_speed_m_s_uncertainty?: number
  wave_speed_m_s_method?: ExtractionMethod
  frequency_khz?: number
  frequency_khz_uncertainty?: number
  frequency_khz_method?: ExtractionMethod
  wave_speed_reference_diameter_mm?: number
  wave_speed_reference_diameter_mm_uncertainty?: number
  wave_speed_reference_diameter_mm_method?: ExtractionMethod
  secondary_wave_count?: number
  secondary_wave_count_method?: ExtractionMethod
  secondary_wave_speed_m_s?: number
  secondary_wave_speed_m_s_method?: ExtractionMethod
  secondary_frequency_khz?: number
  secondary_frequency_khz_method?: ExtractionMethod
  thrust_n?: number
  thrust_n_uncertainty?: number
  thrust_n_method?: ExtractionMethod
  thrust_type?: string
  specific_impulse_s?: number
  specific_impulse_s_uncertainty?: number
  specific_impulse_s_method?: ExtractionMethod
  pressure_gain_percent?: number
  pressure_gain_percent_uncertainty?: number
  pressure_gain_percent_method?: ExtractionMethod
  chamber_pressures?: RdeChamberPressure[]
}

export interface RdeDataset {
  /** Null when the site was built without an RDE subset. */
  release: RdeRelease | null
  publications: RdePublication[]
  operating_points: RdeOperatingPoint[]
}

/** The numeric fields of an operating point: what can be plotted, sorted and
 *  range-filtered. The averaging window (window_start_s, window_end_s) is not
 *  one: the detail page shows it with the test run. */
export type RdeNumericKey =
  | 'stoich_fuel_oxidizer_mass_ratio'
  | 'mdot_total_kg_s'
  | 'equivalence_ratio'
  | 'mdot_fuel_kg_s'
  | 'mdot_oxidizer_kg_s'
  | 'mass_flux_chamber_kg_m2_s'
  | 'mass_flux_throat_kg_m2_s'
  | 'fuel_manifold_pressure_kpa'
  | 'oxidizer_manifold_pressure_kpa'
  | 'fuel_manifold_temperature_k'
  | 'oxidizer_manifold_temperature_k'
  | 'back_pressure_pa'
  | 'burn_time_s'
  | 'chamber_outer_diameter_mm'
  | 'chamber_inner_diameter_mm'
  | 'chamber_gap_mm'
  | 'chamber_length_mm'
  | 'total_length_mm'
  | 'throat_outer_diameter_mm'
  | 'throat_inner_diameter_mm'
  | 'exit_outer_diameter_mm'
  | 'exit_inner_diameter_mm'
  | 'chamber_area_m2'
  | 'throat_area_m2'
  | 'exit_area_m2'
  | 'contraction_ratio'
  | 'expansion_ratio'
  | 'fuel_injection_area_m2'
  | 'oxidizer_injection_area_m2'
  | 'total_injection_area_m2'
  | 'injector_to_throat_area_ratio'
  | 'injector_to_chamber_area_ratio'
  | 'wave_count'
  | 'wave_speed_m_s'
  | 'frequency_khz'
  | 'wave_speed_reference_diameter_mm'
  | 'secondary_wave_count'
  | 'secondary_wave_speed_m_s'
  | 'secondary_frequency_khz'
  | 'thrust_n'
  | 'specific_impulse_s'
  | 'pressure_gain_percent'
