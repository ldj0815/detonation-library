import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { CaseListItem, CaseDetail, FilterOptions } from '../types/case'
import type { PaginatedResponse } from '../types/common'

export interface CaseListParams {
  q?: string
  fuel?: string
  oxidizer?: string
  geometry?: string
  setup?: string
  primary_diluent_name?: string
  primary_dopant_name?: string
  equivalence_ratio_min?: number
  equivalence_ratio_max?: number
  pressure_min?: number
  pressure_max?: number
  temperature_min?: number
  temperature_max?: number
  has_cell_size?: boolean
  has_critical_hd?: boolean
  has_min_hd?: boolean
  has_critical_energy?: boolean
  show_hidden?: boolean
  sort_by?: string
  sort_dir?: string
  limit?: number
  offset?: number
}

function buildQuery(params: CaseListParams): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function useCaseList(params: CaseListParams) {
  return useQuery<PaginatedResponse<CaseListItem>>({
    queryKey: ['cases', params],
    queryFn: () => apiFetch(`/api/cases/${buildQuery(params)}`),
  })
}

// Hard cap so a runaway dataset cannot exhaust the browser; the caller shows a
// notice when `truncated` is true.
const PLOT_PAGE = 1000
const PLOT_HARD_CAP = 20000

export interface AllCasesResult {
  items: CaseListItem[]
  total: number
  truncated: boolean
}

// Fetches every matching case for the plot by paging through the list endpoint
// (which caps each page at 1000) until all rows are collected or the hard cap
// is hit.
export function useAllCases(params: CaseListParams) {
  return useQuery<AllCasesResult>({
    queryKey: ['cases-all', params],
    queryFn: async () => {
      const items: CaseListItem[] = []
      let offset = 0
      let total = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const page = await apiFetch<PaginatedResponse<CaseListItem>>(
          `/api/cases/${buildQuery({ ...params, limit: PLOT_PAGE, offset })}`
        )
        total = page.total
        items.push(...page.items)
        offset += PLOT_PAGE
        if (page.items.length === 0 || items.length >= total || items.length >= PLOT_HARD_CAP) break
      }
      return { items: items.slice(0, PLOT_HARD_CAP), total, truncated: total > PLOT_HARD_CAP }
    },
  })
}

export function useCaseDetail(id: number) {
  return useQuery<CaseDetail>({
    queryKey: ['case', id],
    queryFn: () => apiFetch(`/api/cases/${id}`),
    enabled: id > 0,
  })
}

export interface HistoryEntry {
  id: number
  action: string
  changed_fields: string | null
  changed_by: string | null
  timestamp: string
}

export function useCaseHistory(id: number, isAdmin: boolean) {
  return useQuery<HistoryEntry[]>({
    queryKey: ['case-history', id],
    queryFn: () => {
      const token = sessionStorage.getItem('admin_token')
      return apiFetch(`/api/cases/${id}/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    },
    // History is admin-only on the server; anonymous visitors must not fire it.
    enabled: id > 0 && isAdmin,
    retry: false,
  })
}

export function useFilterOptions() {
  return useQuery<FilterOptions>({
    queryKey: ['filter-options'],
    queryFn: () => apiFetch('/api/cases/filter-options'),
    staleTime: 60_000,
  })
}
