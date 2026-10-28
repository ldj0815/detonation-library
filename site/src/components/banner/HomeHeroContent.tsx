import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../Icon'

const EXAMPLES = [
  { label: 'H2 / O2', to: '/cases?fuel=H2&oxidizer=O2' },
  { label: 'C2H4 cell width', to: '/browse/cell-size?fuel=C2H4' },
  { label: 'N2O as oxidizer', to: '/cases?oxidizer=N2O' },
  { label: 'Bull (1982)', to: '/cases?q=Bull' },
  { label: 'below 20 kPa', to: '/cases?pressure_max=20' },
]

export default function HomeHeroContent({ preview = false }: { preview?: boolean }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (preview) return
    const term = q.trim()
    navigate(term ? `/cases?q=${encodeURIComponent(term)}` : '/cases')
  }
  return <div className="banner-copy">
          <h1 className="text-[34px] md:text-[46px] font-semibold leading-[1.08] max-w-[16ch]">
            Gaseous detonation data, searchable.
          </h1>
          <p className="mt-5 text-[15px] md:text-[17px] text-ink-2 max-w-[58ch] leading-relaxed">
            Detonation cell widths and lengths measured on soot foils, transcribed from the
            GALCIT Detonation Database and searchable by mixture, initial conditions and
            reference. Every value carries its original citation.
          </p>
          <form onSubmit={submit} role="search" className="mt-7 flex max-w-[560px] gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search cases</span>
              <Icon name="search" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="search"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Fuel, oxidizer, diluent or author"
                className="input h-[44px] pl-10 text-[15px]"
                autoComplete="off"
              />
            </label>
            <button type="submit" className="btn btn-primary btn-lg">Search</button>
          </form>
          <p className="mt-3 text-[13px] text-ink-2">
            Try{' '}
            {EXAMPLES.map((ex, i) => (
              <span key={ex.to}>
                <Link onClick={e => { if (preview) e.preventDefault() }} to={ex.to} className="text-accent underline underline-offset-2 decoration-line-2 hover:decoration-accent">{ex.label}</Link>
                {i < EXAMPLES.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
  </div>
}
