// @ts-expect-error no types for dist bundle
import Plotly from 'plotly.js/dist/plotly'
import type { Data, Layout } from 'plotly.js'
import { useEffect, useRef, useState, useCallback } from 'react'

interface PlotlyChartProps {
  data: Data[]
  layout?: Partial<Layout>
  className?: string
  onPointClick?: (pointData: { customdata?: unknown }) => void
}

// Colour-blind-safe categorical set (Okabe–Ito), first entry replaced by the accent.
const COLORWAY = ['#0064A4', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#7A5195', '#8C8C8C']

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Re-renders when the colour theme changes (data-theme attribute or OS setting). */
function useThemeVersion(): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    const bump = () => setV(n => n + 1)
    const mo = new MutationObserver(bump)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', bump)
    return () => { mo.disconnect(); mq.removeEventListener('change', bump) }
  }, [])
  return v
}

export default function PlotlyChart({ data, layout, className = '', onPointClick }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const onPointClickRef = useRef(onPointClick)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [height, setHeight] = useState(440)
  const themeVersion = useThemeVersion()

  useEffect(() => {
    onPointClickRef.current = onPointClick
  }, [onPointClick])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    const onMove = (ev: MouseEvent) => {
      setHeight(Math.max(240, startH + ev.clientY - startY))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (containerRef.current) Plotly.Plots.resize(containerRef.current)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [height])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // The spinner shows only until the very first draw; subsequent Plotly.react
    // updates are in-place and fast, so there is no teardown/flash.
    const surface = cssVar('--surface') || '#ffffff'
    const ink = cssVar('--ink') || '#13203a'
    const ink2 = cssVar('--ink-2') || '#51607a'
    const grid = cssVar('--plot-grid') || '#e6eaf0'
    const accent = cssVar('--accent') || COLORWAY[0]
    const axis = {
      gridcolor: grid,
      zerolinecolor: grid,
      linecolor: grid,
      tickfont: { color: ink2 },
      title: { font: { color: ink2 } },
    }

    const fullLayout = {
      autosize: true,
      margin: { l: 64, r: 16, t: 16, b: 56 },
      paper_bgcolor: surface,
      plot_bgcolor: surface,
      colorway: [accent, ...COLORWAY.slice(1)],
      font: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 12, color: ink },
      legend: { font: { color: ink2 }, bgcolor: 'rgba(0,0,0,0)' },
      hoverlabel: { font: { family: 'IBM Plex Mono, monospace', size: 12 } },
      ...layout,
      xaxis: { ...axis, ...(layout?.xaxis ?? {}) },
      yaxis: { ...axis, ...(layout?.yaxis ?? {}) },
    }

    Plotly.react(el, data, fullLayout, { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] })
      .then(() => {
        setRendering(false)
        setError(null)
        if (!initialized.current) {
          initialized.current = true
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(el as any).on('plotly_click', (eventData: any) => {
            const point = eventData?.points?.[0]
            if (point) onPointClickRef.current?.({ customdata: point.customdata })
          })
        }
      })
      .catch((err: unknown) => {
        setRendering(false)
        setError(err instanceof Error ? err.message : 'The plot could not be drawn.')
      })
  }, [data, layout, themeVersion])

  // Tear down Plotly only when the component unmounts.
  useEffect(() => {
    const el = containerRef.current
    return () => { if (el) Plotly.purge(el) }
  }, [])

  // Resize Plotly when height changes
  useEffect(() => {
    if (containerRef.current && !rendering) {
      Plotly.Plots.resize(containerRef.current)
    }
  }, [height, rendering])

  return (
    <div className={`relative ${className}`}>
      <div style={{ width: '100%', height: `${height}px` }}>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/90 z-20 p-4">
            <p className="text-[13px] text-danger text-center">{error}</p>
          </div>
        )}
        {rendering && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80 z-10">
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              <svg className="animate-spin h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Drawing the plot…
            </div>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <div
        onMouseDown={onMouseDown}
        className="w-full h-2.5 cursor-ns-resize flex items-center justify-center hover:bg-surface-2 transition-colors"
        title="Drag to resize"
      >
        <div className="w-10 h-1 rounded bg-line-2" />
      </div>
    </div>
  )
}
