import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadCases } from './loadCases'
import { filterCases, filterOptions, queryCases, sortCases } from './query'
import type { CaseListParams } from './query'
import { CATEGORIES, type BrowseMode } from '../lib/categories'
import { parseTitle } from '../lib/format'
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

// Every matching case, unpaged, for the plot and the CSV export.
export function useAllCases(params: CaseListParams): Loaded<AllCasesResult> {
  const cases = useCases()
  const key = JSON.stringify(params)
  const data = useMemo(() => {
    if (!cases.data) return undefined
    const p = JSON.parse(key) as CaseListParams
    const items = sortCases(filterCases(cases.data, p), p.sort_by, p.sort_dir)
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

/** Case count per browse category. */
export function useCategoryCounts(): { data: Record<BrowseMode, number> | undefined } {
  const cases = useCases()
  const data = useMemo(() => {
    if (!cases.data) return undefined
    const all = cases.data
    return {
      all: all.length,
      ...Object.fromEntries(CATEGORIES.map(c => [c.mode, filterCases(all, c.filter).length])),
    } as Record<BrowseMode, number>
  }, [cases.data])
  return { data }
}

export interface LibraryStats {
  cases: number
  withCellLength: number
  /** Distinct references, by the reference in the title or else the DOI field. */
  publications: number
}

/** The numbers on the landing page. */
export function useLibraryStats(): { data: LibraryStats | undefined } {
  const cases = useCases()
  const data = useMemo(() => {
    if (!cases.data) return undefined
    const refs = new Set<string>()
    for (const c of cases.data) {
      const ref = parseTitle(c.title).reference ?? c.doi_reference
      if (ref) refs.add(ref.trim().toLowerCase())
    }
    return {
      cases: cases.data.length,
      withCellLength: cases.data.filter(c => c.cell_length_mm != null).length,
      publications: refs.size,
    }
  }, [cases.data])
  return { data }
}
