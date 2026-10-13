import { useState } from 'react'
import { NavLink } from 'react-router-dom'

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
  const [browseOpen, setBrowseOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

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
        Categories {browseOpen ? '▾' : '▸'}
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
      </div>
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
