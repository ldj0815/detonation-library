import { useState } from 'react'
import { ALL_COLUMNS } from './columns'
import Icon from './Icon'

interface Props {
  visible: Set<string>
  onToggle: (key: string) => void
  onReset?: () => void
  /** Columns that are always shown on this page (the category's own measurement). */
  forced?: Set<string>
}

export default function ColumnSelector({ visible, onToggle, onReset, forced }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="btn btn-secondary btn-sm"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon name="columns" size={14} /> Columns
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="menu absolute right-0 top-full mt-1 z-50 w-64 max-h-[22rem] overflow-y-auto p-2">
            <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-line">
              <span className="text-[12.5px] font-medium text-ink-2">Show columns</span>
              {onReset && (
                <button type="button" onClick={onReset} className="text-[12px] text-accent hover:underline">
                  Reset
                </button>
              )}
            </div>
            {ALL_COLUMNS.map(col => {
              const locked = col.key === 'title' || forced?.has(col.key)
              return (
                <label key={col.key} className={`flex items-center gap-2 px-2 py-1 rounded-[4px] text-[13px] ${locked ? 'text-ink-3' : 'cursor-pointer hover:bg-surface-2'}`}>
                  <input
                    type="checkbox"
                    checked={locked || visible.has(col.key)}
                    onChange={() => onToggle(col.key)}
                    disabled={locked}
                    className="accent-[var(--accent)]"
                  />
                  {col.label}
                </label>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
