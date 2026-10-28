import { describe, expect, it } from 'vitest'
import {
  ENGINE_DESCRIPTIONS,
  ENGINE_LABELS,
  METHOD_DESCRIPTIONS,
  METHOD_LABELS,
  RDE_FIELDS,
  RDE_GROUP_LABELS,
  codeLabel,
  doiUrl,
  fmtRde,
  fmtRdeMeasure,
  isRdeNumericKey,
  rdeAxisTitle,
  rdeField,
  rdeMethod,
  rdeUncertainty,
  rdeValue,
} from './rdeFields'
import type { RdeNumericKey, RdeOperatingPoint } from '../types/rde'

// Every member of the RdeNumericKey union. As a Record, the compiler rejects
// this list if a key is added to or removed from the union.
const NUMERIC_KEYS: Record<RdeNumericKey, true> = {
  stoich_fuel_oxidizer_mass_ratio: true,
  mdot_total_kg_s: true,
  equivalence_ratio: true,
  mdot_fuel_kg_s: true,
  mdot_oxidizer_kg_s: true,
  mass_flux_chamber_kg_m2_s: true,
  mass_flux_throat_kg_m2_s: true,
  fuel_manifold_pressure_kpa: true,
  oxidizer_manifold_pressure_kpa: true,
  fuel_manifold_temperature_k: true,
  oxidizer_manifold_temperature_k: true,
  back_pressure_pa: true,
  burn_time_s: true,
  chamber_outer_diameter_mm: true,
  chamber_inner_diameter_mm: true,
  chamber_gap_mm: true,
  chamber_length_mm: true,
  total_length_mm: true,
  throat_outer_diameter_mm: true,
  throat_inner_diameter_mm: true,
  exit_outer_diameter_mm: true,
  exit_inner_diameter_mm: true,
  chamber_area_m2: true,
  throat_area_m2: true,
  exit_area_m2: true,
  contraction_ratio: true,
  expansion_ratio: true,
  fuel_injection_area_m2: true,
  oxidizer_injection_area_m2: true,
  total_injection_area_m2: true,
  injector_to_throat_area_ratio: true,
  injector_to_chamber_area_ratio: true,
  wave_count: true,
  wave_speed_m_s: true,
  frequency_khz: true,
  wave_speed_reference_diameter_mm: true,
  secondary_wave_count: true,
  secondary_wave_speed_m_s: true,
  secondary_frequency_khz: true,
  thrust_n: true,
  specific_impulse_s: true,
  pressure_gain_percent: true,
}

function point(over: Partial<RdeOperatingPoint> = {}): RdeOperatingPoint {
  return {
    id: 1,
    publication_id: 1,
    test_run_id: 1,
    operating_point_type: 'steady',
    engine_code: 'R',
    fuel: 'H2',
    oxidizer: 'O2',
    ...over,
  }
}

describe('fmtRde', () => {
  it('groups whole numbers', () => {
    expect(fmtRde(1520)).toBe('1,520')
    expect(fmtRde(1234567)).toBe('1,234,567')
    expect(fmtRde(2)).toBe('2')
    expect(fmtRde(0)).toBe('0')
    expect(fmtRde(-3)).toBe('-3')
  })

  it('keeps two decimals from 100 up', () => {
    expect(fmtRde(102.2073532223264)).toBe('102.21')
    expect(fmtRde(1520.456)).toBe('1,520.46')
    expect(fmtRde(100.5)).toBe('100.5')
    expect(fmtRde(-250.125)).toBe('-250.13')
  })

  it('keeps four decimals between 0.1 and 100', () => {
    expect(fmtRde(2.09)).toBe('2.09')
    expect(fmtRde(0.85)).toBe('0.85')
    expect(fmtRde(1.234567)).toBe('1.2346')
    expect(fmtRde(-12.9)).toBe('-12.9')
  })

  it('keeps four significant digits below 0.1, for small areas', () => {
    expect(fmtRde(0.000123456)).toBe('0.0001235')
    expect(fmtRde(0.00123456)).toBe('0.001235')
    expect(fmtRde(0.05)).toBe('0.05')
    expect(fmtRde(-0.0312345)).toBe('-0.03123')
  })

  it('shows a dash for no value', () => {
    expect(fmtRde(null)).toBe('—')
    expect(fmtRde(undefined)).toBe('—')
    expect(fmtRde(NaN)).toBe('—')
    expect(fmtRde(Infinity)).toBe('—')
  })
})

describe('fmtRdeMeasure', () => {
  it('joins value, uncertainty and unit', () => {
    expect(fmtRdeMeasure(1520, 30, 'm/s')).toBe('1,520 ± 30 m/s')
    expect(fmtRdeMeasure(2.09, null, 'kg/s')).toBe('2.09 kg/s')
    expect(fmtRdeMeasure(2.09, undefined, 'kg/s')).toBe('2.09 kg/s')
    expect(fmtRdeMeasure(0.85, 0.05, '')).toBe('0.85 ± 0.05')
    expect(fmtRdeMeasure(-12.9, 0.4, '%')).toBe('-12.9 ± 0.4 %')
  })

  it('shows zero as a value', () => {
    expect(fmtRdeMeasure(0, null, 's')).toBe('0 s')
  })

  it('shows a dash for no value, whatever the uncertainty', () => {
    expect(fmtRdeMeasure(null, 30, 'm/s')).toBe('—')
    expect(fmtRdeMeasure(undefined, null, '')).toBe('—')
  })
})

describe('codeLabel', () => {
  it('uses the known labels', () => {
    expect(codeLabel('axial_annular')).toBe('Annular')
    expect(codeLabel('transient_blowdown')).toBe('Transient, blowdown')
    expect(codeLabel('high speed camera_side')).toBe('High-speed camera, side view')
    expect(codeLabel('other_please_specify')).toBe('Other')
    expect(codeLabel('unspecified')).toBe('Not stated')
  })

  it('turns an unknown snake_case code into words', () => {
    expect(codeLabel('rotating_wave_mode')).toBe('Rotating wave mode')
    expect(codeLabel('regenerative')).toBe('Regenerative')
  })

  it('reads "Not stated" for no value', () => {
    expect(codeLabel(null)).toBe('Not stated')
    expect(codeLabel(undefined)).toBe('Not stated')
    expect(codeLabel('')).toBe('Not stated')
  })
})

describe('rdeValue, rdeUncertainty and rdeMethod', () => {
  const p = point({
    wave_speed_m_s: 1520,
    wave_speed_m_s_uncertainty: 30,
    wave_speed_m_s_method: 'calculated',
    wave_count: 2,
    wave_count_method: 'digitized_from_figure',
    chamber_inner_diameter_mm: 0,
    pressure_gain_percent: -12.9,
  })

  it('reads a value, keeping zero and negative values', () => {
    expect(rdeValue(p, 'wave_speed_m_s')).toBe(1520)
    expect(rdeValue(p, 'chamber_inner_diameter_mm')).toBe(0)
    expect(rdeValue(p, 'pressure_gain_percent')).toBe(-12.9)
  })

  it('reads null for a missing or non-finite value', () => {
    expect(rdeValue(p, 'thrust_n')).toBeNull()
    expect(rdeValue(point({ thrust_n: NaN }), 'thrust_n')).toBeNull()
  })

  it('reads the uncertainty and method next to a value', () => {
    expect(rdeUncertainty(p, 'wave_speed_m_s')).toBe(30)
    expect(rdeUncertainty(p, 'wave_count')).toBeNull()
    expect(rdeMethod(p, 'wave_speed_m_s')).toBe('calculated')
    expect(rdeMethod(p, 'wave_count')).toBe('digitized_from_figure')
    expect(rdeMethod(p, 'thrust_n')).toBeNull()
  })
})

describe('isRdeNumericKey', () => {
  it('accepts the numeric fields only', () => {
    expect(isRdeNumericKey('wave_speed_m_s')).toBe(true)
    expect(isRdeNumericKey('pressure_gain_percent')).toBe(true)
    expect(isRdeNumericKey('wave_speed_m_s_uncertainty')).toBe(false)
    expect(isRdeNumericKey('fuel')).toBe(false)
    expect(isRdeNumericKey('id')).toBe(false)
    expect(isRdeNumericKey('publication')).toBe(false)
    expect(isRdeNumericKey('')).toBe(false)
    expect(isRdeNumericKey(null)).toBe(false)
    expect(isRdeNumericKey(undefined)).toBe(false)
  })
})

describe('doiUrl', () => {
  it('links a bare DOI', () => {
    expect(doiUrl('10.2514/1.b37959')).toBe('https://doi.org/10.2514/1.b37959')
  })

  it('does not prefix a DOI that is already a link', () => {
    expect(doiUrl('https://doi.org/10.2514/1.b37959')).toBe('https://doi.org/10.2514/1.b37959')
    expect(doiUrl('http://dx.doi.org/10.1007/s10573-006-0090-y')).toBe('https://doi.org/10.1007/s10573-006-0090-y')
    expect(doiUrl('HTTPS://DOI.ORG/10.1/x')).toBe('https://doi.org/10.1/x')
  })

  it('reads null for no DOI', () => {
    expect(doiUrl(null)).toBeNull()
    expect(doiUrl(undefined)).toBeNull()
    expect(doiUrl('')).toBeNull()
  })
})

describe('RDE_FIELDS', () => {
  const keys = RDE_FIELDS.map(f => f.key)

  it('lists each numeric field once', () => {
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) {
      expect(key in NUMERIC_KEYS, key).toBe(true)
      expect(isRdeNumericKey(key)).toBe(true)
    }
  })

  it('covers every key of RdeNumericKey', () => {
    expect([...keys].sort()).toEqual(Object.keys(NUMERIC_KEYS).sort())
  })

  it('gives every field a label, a short label and a known group', () => {
    for (const f of RDE_FIELDS) {
      expect(f.label, f.key).not.toBe('')
      expect(f.short, f.key).not.toBe('')
      expect(Object.keys(RDE_GROUP_LABELS), f.key).toContain(f.group)
    }
  })

  it('marks only the wave counts as whole numbers', () => {
    expect(RDE_FIELDS.filter(f => f.integer).map(f => f.key).sort()).toEqual(['secondary_wave_count', 'wave_count'])
  })

  it('carries the release caveats', () => {
    expect(rdeField('specific_impulse_s').note).toMatch(/engine class/)
    expect(rdeField('wave_speed_m_s').note).toMatch(/reference diameter/)
    expect(rdeField('mass_flux_throat_kg_m2_s').note).toMatch(/not a fuel-only/)
    expect(rdeField('secondary_wave_count').note).toMatch(/does not mean zero/)
    expect(rdeField('pressure_gain_percent').unit).toBe('%')
  })

  it('looks fields up by key', () => {
    expect(rdeField('wave_speed_m_s').unit).toBe('m/s')
    expect(() => rdeField('fuel' as RdeNumericKey)).toThrow()
  })

  it('builds axis titles with the unit when there is one', () => {
    expect(rdeAxisTitle(rdeField('wave_speed_m_s'))).toBe('Wave speed (m/s)')
    expect(rdeAxisTitle(rdeField('equivalence_ratio'))).toBe('Global equivalence ratio')
  })
})

describe('code labels', () => {
  it('describes every engine class and extraction method', () => {
    expect(Object.keys(ENGINE_DESCRIPTIONS).sort()).toEqual(Object.keys(ENGINE_LABELS).sort())
    expect(Object.keys(METHOD_DESCRIPTIONS).sort()).toEqual(Object.keys(METHOD_LABELS).sort())
    expect(Object.keys(METHOD_LABELS).sort()).toEqual([
      'calculated', 'digitized_from_figure', 'inferred', 'private_communication', 'reported_table', 'reported_text', 'uploaded',
    ])
  })
})
