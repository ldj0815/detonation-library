import { Link } from 'react-router-dom'
import { useCaseCounts, useSiteStats } from '../api/stats'
import Skeleton from '../components/Skeleton'

interface CountCardProps {
  label: string
  value: number | undefined
  loading: boolean
}

function CountCard({ label, value, loading }: CountCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
      <div className="text-3xl font-bold font-mono text-uci-dark-blue">
        {loading ? '\u2013' : value ?? '\u2013'}
      </div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  )
}

export default function Home() {
  const { total, rde } = useCaseCounts()
  const siteStats = useSiteStats()
  const loading = total.isLoading || rde.isLoading

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-uci-dark-blue mb-4">Detonation Science and Technology Library</h1>
      <p className="text-gray-700 mb-6 leading-relaxed">
        A curated collection of combustion and detonation data from researchers and
        collaborating institutions. Browse experimental results including cell size measurements,
        critical diameters, RDE data, and more.
      </p>

      <Link
        to="/search"
        className="inline-block bg-uci-blue text-white px-5 py-2.5 rounded font-semibold hover:bg-uci-dark-blue transition-colors mb-8"
      >
        Search All Cases &rarr;
      </Link>

      {loading ? (
        <Skeleton rows={4} />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <CountCard label="Total Cases" value={total.data} loading={false} />
          <CountCard label="RDE Cases" value={rde.data} loading={false} />
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Community Impact</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
            <div className="text-2xl font-bold font-mono text-uci-blue">{siteStats.data?.total_uploads ?? '\u2013'}</div>
            <div className="text-sm text-gray-600 mt-1">Uploads</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
            <div className="text-2xl font-bold font-mono text-uci-blue">{siteStats.data?.total_views ?? '\u2013'}</div>
            <div className="text-sm text-gray-600 mt-1">Views</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
            <div className="text-2xl font-bold font-mono text-uci-blue">{siteStats.data?.total_calculations ?? '\u2013'}</div>
            <div className="text-sm text-gray-600 mt-1">ZND Calculations</div>
          </div>
        </div>
      </div>
    </div>
  )
}
