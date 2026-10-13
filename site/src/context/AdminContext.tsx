import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { adminLogin } from '../api/admin'
import { setAdminToken, getAdminToken } from '../api/client'

interface AdminContextType {
  isAdmin: boolean
  login: (password: string) => Promise<void>
  logout: () => void
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  login: async () => {},
  logout: () => {},
})

export function useAdmin() {
  return useContext(AdminContext)
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => !!getAdminToken())

  const login = useCallback(async (password: string) => {
    const token = await adminLogin(password)
    setAdminToken(token)
    setIsAdmin(true)
  }, [])

  const logout = useCallback(() => {
    setAdminToken(null)
    setIsAdmin(false)
  }, [])

  // Any 401 from the API (stale/invalid token) drops admin state so the UI
  // reflects reality and the login modal can be reopened.
  useEffect(() => {
    const handler = () => setIsAdmin(false)
    window.addEventListener('admin-unauthorized', handler)
    return () => window.removeEventListener('admin-unauthorized', handler)
  }, [])

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminContext.Provider>
  )
}
