import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadCases } from './loadCases'
import { filterCases, filterOptions, queryCases, sortCases } from './query'
import type { CaseListParams } from './query'
import type { CaseDetail, FilterOptions } from '../types/case'
import type { PaginatedResponse } from '../types/common'

interface Loaded<T> {
  data: T | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

// Loaded once per visit and kept: every page reads from this one copy.
function useCases() {
  return useQuery({ queryKey: ['cases'], queryFn: loadCases, staleTime: Infinity, gcTime: Infinity })
}

export function useCaseList(params: CaseListParams): Loaded<PaginatedResponse<CaseDetail>> {
  const cases = useCases()
  // Pages build a new params object on every render, so key the work on its
  // content: the query reruns only when a filter, the sort or the page changes.
  const key = JSON.stringify(params)
  const data = useMemo(
    () => (cases.data ? queryCases(cases.data, JSON.parse(key) as CaseListParams) : undefined),
    [cases.data, key],
  )
  return { data, isLoading: cases.isLoading, isError: cases.isError, refetch: cases.refetch }
}

export interface AllCasesResult {
  items: CaseDetail[]
  total: number
}

// Every matching case, unpaged, for the plot.
export function useAllCases(params: CaseListParams): Loaded<AllCasesResult> {
  const cases = useCases()
  const key = JSON.stringify(params)
  const data = useMemo(() => {
    if (!cases.data) return undefined
    const items = sortCases(filterCases(cases.data, JSON.parse(key) as CaseListParams))
    return { items, total: items.length }
  }, [cases.data, key])
  return { data, isLoading: cases.isLoading, isError: cases.isError, refetch: cases.refetch }
}

export function useCaseDetail(id: number): Loaded<CaseDetail> & { notFound: boolean } {
  const cases = useCases()
  const data = useMemo(() => cases.data?.find(c => c.id === id), [cases.data, id])
  return {
    data,
    notFound: cases.data !== undefined && data === undefined,
    isLoading: cases.isLoading,
    isError: cases.isError,
    refetch: cases.refetch,
  }
}

export function useFilterOptions(): { data: FilterOptions | undefined } {
  const cases = useCases()
  const data = useMemo(() => (cases.data ? filterOptions(cases.data) : undefined), [cases.data])
  return { data }
}

export function useCaseCounts(): { total: number | undefined; rde: number | undefined; isLoading: boolean } {
  const cases = useCases()
  const rde = useMemo(() => cases.data?.filter(c => c.setup === 'rde').length, [cases.data])
  return { total: cases.data?.length, rde, isLoading: cases.isLoading }
}
