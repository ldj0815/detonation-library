export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) {
    if (res.status === 401) onUnauthorized()
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// Clear a stale/invalid admin token and notify AdminContext to drop admin state.
export function onUnauthorized(): void {
  setAdminToken(null)
  window.dispatchEvent(new Event('admin-unauthorized'))
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem('admin_token')
}

export function setAdminToken(token: string | null): void {
  if (token) sessionStorage.setItem('admin_token', token)
  else sessionStorage.removeItem('admin_token')
}

export function authHeaders(): Record<string, string> {
  const token = getAdminToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
