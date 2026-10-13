import { lazy, Suspense, Component } from 'react'
import type { ReactNode } from 'react'

const PlotlyChartInner = lazy(() => import('./PlotlyChart'))

// Catches both lazy-load failures and render/effect errors thrown by Plotly so
// a chart problem never takes down the whole page.
class ChartErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(err: Error) { return { error: err.message } }
  render() {
    if (this.state.error) return <p className="text-red-500 text-sm p-4">Chart error: {this.state.error}</p>
    return this.props.children
  }
}

interface LazyPlotlyChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout?: any
  className?: string
  onPointClick?: (pointData: { customdata?: unknown }) => void
}

export default function LazyPlotlyChart(props: LazyPlotlyChartProps) {
  return (
    <ChartErrorBoundary>
      <Suspense fallback={<div className="text-sm text-gray-400 p-4">Loading chart…</div>}>
        <PlotlyChartInner {...props} />
      </Suspense>
    </ChartErrorBoundary>
  )
}
