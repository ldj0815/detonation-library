import type { ReactNode } from 'react'

interface Props {
  title: ReactNode
  description?: ReactNode
  /** Small line under the title: counts, status. */
  meta?: ReactNode
  actions?: ReactNode
  /** Rendered under the header, flush with its bottom border (tabs). */
  tabs?: ReactNode
  /** Rendered above the title (back links, breadcrumbs). */
  above?: ReactNode
}

export default function PageHeader({ title, description, meta, actions, tabs, above }: Props) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="container-x pt-6 pb-0">
        {above && <div className="mb-2 text-[13px]">{above}</div>}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-5">
          <div className="min-w-0 max-w-[72ch]">
            <h1 className="text-[24px] md:text-[28px] font-semibold">{title}</h1>
            {description && <p className="mt-1.5 text-[14px] text-ink-2">{description}</p>}
            {meta && <div className="mt-2 text-[13px] text-ink-2">{meta}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {tabs}
      </div>
    </div>
  )
}
