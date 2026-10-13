import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authHeaders, onUnauthorized, BASE_URL } from './client'

export function useUpdateCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => {
      const res = await fetch(`${BASE_URL}/api/cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        if (res.status === 401) onUnauthorized()
        const text = await res.text()
        throw new Error(text || `Update failed: ${res.status}`)
      }
      return res.json()
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['case', vars.id] })
      qc.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

export function useDeleteCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}/api/cases/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) {
        if (res.status === 401) onUnauthorized()
        throw new Error(`Delete failed: ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

export function useBulkAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { case_ids: number[]; action: string }) => {
      const res = await fetch(`${BASE_URL}/api/cases/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        if (res.status === 401) onUnauthorized()
        throw new Error(`Bulk action failed: ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}
