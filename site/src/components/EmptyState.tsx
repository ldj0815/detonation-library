import type { ReactNode } from 'react'
import SootFoil from './SootFoil'

interface Props {
  title: string
  children?: ReactNode
  action?: ReactNode
}

export default function EmptyState({ title, children, action }: Props) {
  return (
    <div className="relative overflow-hidden panel px-6 py-10 text-center">
      <SootFoil className="absolute inset-0 w-full h-full" cell={30} opacity={0.5} />
      <div className="relative">
        <p className="text-[15px] font-medium text-ink">{title}</p>
        {children && <p className="mt-1 text-[13.5px] text-ink-2 max-w-[48ch] mx-auto">{children}</p>}
        {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
      </div>
    </div>
  )
}
