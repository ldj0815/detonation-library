import { apiFetch } from './client'

export async function adminLogin(password: string): Promise<string> {
  const res = await apiFetch<{ token: string }>('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return res.token
}
