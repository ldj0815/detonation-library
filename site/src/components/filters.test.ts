import { describe, expect, it } from 'vitest'
import { REFERENCE_PARAM, categorySwitchParams, clearFilters, countActiveFilters } from './filters'

describe('the publication filter', () => {
  it('counts as one filter and is cleared with the others', () => {
    const params = new URLSearchParams({ [REFERENCE_PARAM]: '27, Bull (1982)', fuel: 'H2', view: 'plot' })
    expect(countActiveFilters(params)).toBe(2)
    const cleared = clearFilters(params)
    expect(cleared.get(REFERENCE_PARAM)).toBeNull()
    expect(cleared.get('view')).toBe('plot')
  })
})

describe('categorySwitchParams', () => {
  it('takes the filters and the view along', () => {
    const next = categorySwitchParams(new URLSearchParams('fuel=H2&q=bull&equivalence_ratio_min=0.5&view=plot'))
    expect(next.toString()).toBe('fuel=H2&q=bull&equivalence_ratio_min=0.5&view=plot')
  })

  it("leaves behind one category's sorting, paging, paper filter and plot settings", () => {
    const next = categorySwitchParams(new URLSearchParams(
      'fuel=H2&view=plot&sort_by=thrust_n&sort_dir=asc&offset=50&ref=27%2C+Bull+%281982%29&publication=3' +
      '&x=wave_speed_m_s&y=thrust_n&color=engine&shape=fuel&logx=1&logy=0&xmin=1&xmax=2&ymin=3&ymax=4',
    ))
    expect(next.toString()).toBe('fuel=H2&view=plot')
  })

  it('leaves its input untouched', () => {
    const params = new URLSearchParams('fuel=H2&x=thrust_n')
    categorySwitchParams(params)
    expect(params.toString()).toBe('fuel=H2&x=thrust_n')
  })
})
