import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { PaginatedResponse } from '../types/common'
import type { CaseListItem } from '../types/case'

async function countCases(params?: Record<string, string>): Promise<number> {
  const q = new URLSearchParams({ limit: '1', ...(params ?? {}) })
  const res = await apiFetch<PaginatedResponse<CaseListItem>>(`/api/cases/?${q.toString()}`)
  return res.total
}

export function useSiteStats() {
  return useQuery<Record<string, number>>({
    queryKey: ['site-stats'],
    queryFn: () => apiFetch('/api/stats/'),
  })
}

export function useCaseCounts() {
  const total = useQuery({ queryKey: ['stats', 'total'], queryFn: () => countCases() })
  const rde = useQuery({ queryKey: ['stats', 'rde'], queryFn: () => countCases({ setup: 'rde' }) })
  return { total, rde }
}
