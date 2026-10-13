import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFilterOptions } from '../api/cases'
import type { FilterOption } from '../types/case'

interface FilterBarProps {
  showSearch?: boolean
}

function CheckboxGroup({ label, paramName, options }: { label: string; paramName: string; options: FilterOption[] }) {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const selected = new Set((params.get(paramName) ?? '').split(',').filter(Boolean))

  const toggle = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    const joined = Array.from(next).join(',')
    const p = new URLSearchParams(params)
    if (joined) p.set(paramName, joined)
    else p.delete(paramName)
    p.delete('offset')
    setParams(p, { replace: true })
  }

  if (options.length === 0) return null

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50">
        {label} {selected.size > 0 && <span className="text-uci-blue font-bold">({selected.size})</span>} ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-48 max-h-60 overflow-y-auto">
            {options.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 py-0.5 text-xs cursor-pointer hover:bg-gray-50 px-1 rounded">
                <input type="checkbox" checked={selected.has(opt.value)} onChange={() => toggle(opt.value)} />
                {opt.value} <span className="text-gray-400">({opt.count})</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function RangeInputs({ label, minName, maxName }: { label: string; minName: string; maxName: string }) {
  const [params] = useSearchParams()
  return (
    <div className="flex items-end gap-1">
      <label className="flex flex-col gap-0.5 text-xs text-gray-600">
        {label} min
        <input type="number" step="any" name={minName} defaultValue={params.get(minName) ?? ''} className="border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50 w-20 font-mono" />
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-gray-600">
        max
        <input type="number" step="any" name={maxName} defaultValue={params.get(maxName) ?? ''} className="border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50 w-20 font-mono" />
      </label>
    </div>
  )
}

export default function FilterBar({ showSearch = false }: FilterBarProps) {
  const [params, setParams] = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)
  const { data: filterOpts } = useFilterOptions()

  const applyRanges = () => {
    if (!formRef.current) return
    const fd = new FormData(formRef.current)
    const next = new URLSearchParams(params)
    for (const name of ['equivalence_ratio_min', 'equivalence_ratio_max', 'pressure_min', 'pressure_max', 'temperature_min', 'temperature_max', 'q']) {
      const v = fd.get(name) as string
      if (v?.trim()) next.set(name, v.trim())
      else next.delete(name)
    }
    next.delete('offset')
    setParams(next, { replace: true })
  }

  const clearAll = () => {
    setParams({}, { replace: true })
    formRef.current?.reset()
  }

  return (
    <form ref={formRef} onSubmit={e => { e.preventDefault(); applyRanges() }} className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
      {showSearch && (
        <div>
          <input type="search" name="q" placeholder="Search cases…" defaultValue={params.get('q') ?? ''}
            className="w-full max-w-xl border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-uci-blue" />
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        {filterOpts && (
          <>
            <CheckboxGroup label="Fuel" paramName="fuel" options={filterOpts.fuels} />
            <CheckboxGroup label="Oxidizer" paramName="oxidizer" options={filterOpts.oxidizers} />
            <CheckboxGroup label="Geometry" paramName="geometry" options={filterOpts.geometries} />
            <CheckboxGroup label="Setup" paramName="setup" options={filterOpts.setups} />
            <CheckboxGroup label="Diluent" paramName="primary_diluent_name" options={filterOpts.primary_diluent_names} />
            <CheckboxGroup label="Dopant" paramName="primary_dopant_name" options={filterOpts.primary_dopant_names} />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <RangeInputs label="φ" minName="equivalence_ratio_min" maxName="equivalence_ratio_max" />
        <RangeInputs label="P (kPa)" minName="pressure_min" maxName="pressure_max" />
        <RangeInputs label="T (K)" minName="temperature_min" maxName="temperature_max" />
        <button type="submit" className="bg-uci-blue text-white px-3 py-1 rounded text-xs font-semibold hover:bg-uci-dark-blue">Apply</button>
        <button type="button" onClick={clearAll} className="text-xs text-uci-blue underline hover:no-underline">Clear all</button>
      </div>
    </form>
  )
}
