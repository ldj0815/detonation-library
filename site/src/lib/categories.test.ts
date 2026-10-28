import { describe, it, expect } from 'vitest'
import { CATEGORIES, DEFAULT_CATEGORY, categoryFor } from './categories'
import { HIDDEN_MEASUREMENTS } from '../config'
import { ALL_COLUMNS } from '../components/columns'
import { CASE_CSV_COLUMNS } from './csv'

describe('visible categories', () => {
  it('leaves out the hidden measurements', () => {
    for (const c of CATEGORIES) {
      if (c.field) expect(HIDDEN_MEASUREMENTS.has(c.field)).toBe(false)
    }
    expect(CATEGORIES.map(c => c.mode)).toEqual(['cell-size', 'rde'])
  })

  it('has no "All cases" tab while there is one kind of measurement', () => {
    expect(CATEGORIES.some(c => c.mode === 'all')).toBe(false)
    expect(DEFAULT_CATEGORY.mode).toBe('cell-size')
    expect(categoryFor('all')).toBe(DEFAULT_CATEGORY)
    expect(categoryFor('critical-hd')).toBe(DEFAULT_CATEGORY)
  })

  it('lists RDE operating points as a category of their own', () => {
    expect(categoryFor('rde').placeholder).toBeFalsy()
    expect(categoryFor('rde').noun).toBe('operating points')
  })

  it('drops the hidden columns from the table and the export', () => {
    for (const key of HIDDEN_MEASUREMENTS) {
      expect(ALL_COLUMNS.some(c => c.key === key)).toBe(false)
      expect(CASE_CSV_COLUMNS).not.toContain(key)
    }
  })
})
