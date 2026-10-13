import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import AdminLogin from './AdminLogin'

interface NavItem {
  label: string
  to: string
}

const browseItems: NavItem[] = [
  { label: 'All Cases', to: '/cases' },
  { label: 'RDE', to: '/browse/rde' },
  { label: 'Cell Size', to: '/browse/cell-size' },
  { label: 'Crit. Hydraulic Dia.', to: '/browse/critical-hd' },
  { label: 'Min. Hydraulic Dia.', to: '/browse/min-hd' },
  { label: 'Critical Energy', to: '/browse/critical-energy' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-1.5 rounded text-sm transition-colors ${
    isActive
      ? 'bg-uci-gold text-uci-dark-blue font-semibold'
      : 'text-white/80 hover:text-white hover:bg-white/10'
  }`

const actionLink = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-1.5 rounded text-sm transition-colors ${
    isActive
      ? 'bg-uci-gold text-uci-dark-blue font-semibold'
      : 'bg-white/10 text-white hover:bg-white/20'
  }`

export default function Sidebar() {
  const { isAdmin, logout } = useAdmin()
  const [showLogin, setShowLogin] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Ctrl+Shift+A opens admin login
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        // Always allow opening the login modal so a stale admin (whose token was
        // invalidated server-side) can re-authenticate without logging out first.
        setShowLogin(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const nav = (
    <nav className="flex flex-col gap-1 p-4">
      <NavLink to="/" className={linkClass} end>
        <span className="font-bold text-base">Home</span>
      </NavLink>
      <NavLink to="/about" className={linkClass}>Contributors</NavLink>

      <button
        onClick={() => setBrowseOpen(o => !o)}
        className="flex items-center justify-between px-3 py-1.5 text-sm text-white/90 hover:text-white font-medium w-full"
      >
        Categories {browseOpen ? '\u25BE' : '\u25B8'}
      </button>

      {browseOpen && (
        <div className="ml-2 flex flex-col gap-0.5">
          {browseItems.map(item => (
            <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === '/cases'}>
              {item.label}
            </NavLink>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-col gap-1">
        <NavLink to="/search" className={actionLink}>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            Search
          </span>
        </NavLink>
        <NavLink to="/plot" className={actionLink}>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 16 4-8 4 5 5-7"/></svg>
            Plot
          </span>
        </NavLink>
        <NavLink to="/calculator" className={actionLink}>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h4M8 18h2"/></svg>
            ZND Calculator
          </span>
        </NavLink>
        <NavLink to="/upload" className={actionLink}>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload
          </span>
        </NavLink>
      </div>

      {isAdmin && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-xs text-green-300 hover:text-white w-full">
            Admin Mode — Logout
          </button>
        </div>
      )}

      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-uci-dark-blue shrink-0 justify-between">
        {nav}
      </aside>

      {/* Mobile hamburger */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="fixed top-3 left-3 z-50 bg-uci-dark-blue text-white rounded p-2"
          aria-label="Toggle menu"
        >
          &#9776;
        </button>
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed left-0 top-0 h-full w-56 bg-uci-dark-blue z-50">
              {nav}
            </aside>
          </>
        )}
      </div>
    </>
  )
}
