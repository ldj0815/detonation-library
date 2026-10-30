import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { getTheme, setTheme, resolvedTheme } from '../lib/theme'

const isBrowse = (p: string) => p.startsWith('/cases') || p.startsWith('/browse') || p === '/search'
const isPlot = (p: string, s: string) => isBrowse(p) && new URLSearchParams(s).get('view') === 'plot'

// Plot is the plot view of the category being browsed: RDE from an RDE page,
// cell size from everywhere else. The links are plain Links with aria-current
// set from match(): NavLink would mark Plot current on the table views, whose
// path it shares.
const NAV = [
  { label: 'Browse', to: () => '/cases', match: (p: string, s: string) => isBrowse(p) && !isPlot(p, s) },
  { label: 'Plot', to: (p: string) => (p.startsWith('/browse/rde') ? '/browse/rde?view=plot' : '/browse/cell-size?view=plot'), match: isPlot },
  { label: 'Contribute', to: () => '/contribute', match: (p: string) => p === '/contribute' },
  { label: 'About', to: () => '/about', match: (p: string) => p === '/about' },
]

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-ink hover:no-underline hover:text-ink shrink-0" aria-label="Detonation Science and Technology Library home">
      <svg width="26" height="26" viewBox="0 0 26 26" className="shrink-0" aria-hidden="true">
        <rect width="26" height="26" rx="6" fill="var(--accent-ink)" />
        <path d="M4 13 L13 5 L22 13 L13 21 Z" fill="none" stroke="var(--mark)" strokeWidth="1.6" />
        <path d="M8.5 13 L13 9 L17.5 13 L13 17 Z" fill="var(--mark)" fillOpacity="0.9" />
      </svg>
      {/* Two lines below lg, where one would crowd out the search and the nav. */}
      <span className="font-semibold text-[14px] lg:text-[15px] leading-[1.2] tracking-tight">
        Detonation Science and{' '}<br className="lg:hidden" />Technology Library
      </span>
    </Link>
  )
}

function ThemeToggle() {
  const [theme, setT] = useState(getTheme())
  const dark = theme === 'dark' || (theme === 'system' && resolvedTheme() === 'dark')
  const toggle = () => {
    const next = dark ? 'light' : 'dark'
    setTheme(next)
    setT(next)
  }
  return (
    <button type="button" onClick={toggle} className="btn btn-ghost w-[34px] px-0" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>
      <Icon name={dark ? 'sun' : 'moon'} size={17} />
    </button>
  )
}

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  // The drawer is open only for the location it was opened on, so navigating closes it.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const open = openKey === location.key
  const setOpen = (next: boolean) => setOpenKey(next ? location.key : null)
  const [q, setQ] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    navigate(term ? `/cases?q=${encodeURIComponent(term)}` : '/cases')
    setQ('')
  }

  const links = NAV.map(item => {
    const active = item.match(location.pathname, location.search)
    return (
      <Link
        key={item.label}
        to={item.to(location.pathname)}
        aria-current={active ? 'page' : undefined}
        className={`relative inline-flex items-center h-9 px-2.5 rounded-[6px] text-[13.5px] font-medium hover:no-underline transition-colors ${
          active ? 'text-ink' : 'text-ink-2 hover:text-ink hover:bg-surface-2'
        }`}
      >
        {item.label}
        {active && <span className="absolute left-2.5 right-2.5 -bottom-[9px] h-[3px] rounded-full bg-mark" aria-hidden="true" />}
      </Link>
    )
  })

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-line">
      <div className="container-x flex items-center gap-3 h-[56px]">
        <Brand />

        <form onSubmit={submit} role="search" className="hidden md:flex flex-1 max-w-[460px] ml-4">
          <label className="relative w-full">
            <span className="sr-only">Search cases</span>
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search cases: fuel, oxidizer, reference…"
              className="input pl-9"
              autoComplete="off"
            />
          </label>
        </form>

        <nav className="hidden md:flex items-center gap-0.5 ml-auto" aria-label="Primary">
          {links}
        </nav>

        <div className="hidden md:flex items-center gap-1 ml-1">
          <ThemeToggle />
        </div>

        <div className="flex md:hidden items-center gap-1 ml-auto">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="btn btn-ghost w-[34px] px-0"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <Icon name={open ? 'x' : 'menu'} size={20} />
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="md:hidden border-t border-line bg-surface">
          <div className="container-x py-3 flex flex-col gap-2">
            <form onSubmit={submit} role="search">
              <label className="relative block">
                <span className="sr-only">Search cases</span>
                <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  type="search"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search cases…"
                  className="input pl-9"
                />
              </label>
            </form>
            <nav className="flex flex-col" aria-label="Primary">
              {NAV.map(item => {
                const active = item.match(location.pathname, location.search)
                return (
                  <Link
                    key={item.label}
                    to={item.to(location.pathname)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center justify-between h-10 px-2 rounded-[6px] text-[14px] font-medium hover:no-underline ${
                      active ? 'bg-accent-soft text-accent-ink' : 'text-ink hover:bg-surface-2'
                    }`}
                  >
                    {item.label}
                    <Icon name="chevronRight" size={14} className="text-ink-3" />
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
