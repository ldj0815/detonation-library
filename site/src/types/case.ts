export type SetupType = 'detonation' | 'rde'

export interface CaseListItem {
  id: number
  title: string
  setup: SetupType
  geometry: string
  fuel: string
  oxidizer: string
  equivalence_ratio: number | null
  initial_pressure_kpa: number | null
  initial_temperature_k: number | null
  primary_diluent_name: string | null
  primary_diluent_percentage: number | null
  additional_diluents: string | null
  primary_dopant_name: string | null
  primary_dopant_ppm: number | null
  additional_dopants: string | null
  cell_width_mm: number | null
  cell_width_uncertainty_mm: number | null
  cell_length_mm: number | null
  cell_length_uncertainty_mm: number | null
  critical_hydraulic_diameter_mm: number | null
  minimum_hydraulic_diameter_mm: number | null
  critical_energy_j: number | null
  tube_radius_mm: number | null
  chamber_width_mm: number | null
  chamber_height_mm: number | null
  contributor_name: string
  doi_reference: string | null
  sharing_link: string | null
  created_at: string
  hidden: boolean
}

export interface CaseDetail extends CaseListItem {
  contributor_institution: string
  contributor_email: string
  notes: string | null
}

export interface FilterOption {
  value: string
  count: number
}

export interface FilterOptions {
  fuels: FilterOption[]
  oxidizers: FilterOption[]
  geometries: FilterOption[]
  primary_diluent_names: FilterOption[]
  primary_dopant_names: FilterOption[]
  setups: FilterOption[]
}
