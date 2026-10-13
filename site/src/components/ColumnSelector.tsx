import { useState } from 'react'
import { ALL_COLUMNS } from './columns'

interface Props {
  visible: Set<string>
  onToggle: (key: string) => void
}

export default function ColumnSelector({ visible, onToggle }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
      >
        Columns ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 max-h-80 overflow-y-auto">
            {ALL_COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-2 py-0.5 text-sm cursor-pointer hover:bg-gray-50 px-1 rounded">
                <input
                  type="checkbox"
                  checked={visible.has(col.key)}
                  onChange={() => onToggle(col.key)}
                  disabled={col.key === 'title'}
                />
                {col.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
