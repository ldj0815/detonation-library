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

export default function PlotlyChart({ data, layout, className = '', onPointClick }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const onPointClickRef = useRef(onPointClick)
  useEffect(() => { onPointClickRef.current = onPointClick }, [onPointClick])
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [height, setHeight] = useState(400)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    const onMove = (ev: MouseEvent) => {
      setHeight(Math.max(200, startH + ev.clientY - startY))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // Trigger Plotly resize after drag ends
      if (containerRef.current) Plotly.Plots.resize(containerRef.current)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [height])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const fullLayout = {
      autosize: true,
      margin: { l: 60, r: 20, t: 30, b: 60 },
      paper_bgcolor: 'white',
      plot_bgcolor: '#F5F5F5',
      font: { family: 'Inter, system-ui, sans-serif', size: 12 },
      ...layout,
    }

    Plotly.react(el, data, fullLayout, { displaylogo: false, responsive: true })
      .then(() => {
        // The spinner shows only until the first draw finishes; later
        // Plotly.react updates are in-place and fast, so no teardown/flash.
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
        setError(err instanceof Error ? err.message : 'Failed to render plot')
      })
  }, [data, layout])

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
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div style={{ width: '100%', height: `${height}px` }}>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-20 p-4">
            <p className="text-sm text-red-500 text-center">Failed to render plot: {error}</p>
          </div>
        )}
        {rendering && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="animate-spin h-5 w-5 text-uci-blue" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Loading plot...
            </div>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <div
        onMouseDown={onMouseDown}
        className="w-full h-2 cursor-ns-resize flex items-center justify-center hover:bg-gray-100 transition-colors"
        title="Drag to resize"
      >
        <div className="w-10 h-1 rounded bg-gray-300" />
      </div>
    </div>
  )
}
