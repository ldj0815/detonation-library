import { Link } from 'react-router-dom'
import { useCaseCounts } from '../data/hooks'
import Skeleton from '../components/Skeleton'

interface CountCardProps {
  label: string
  value: number | undefined
}

function CountCard({ label, value }: CountCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
      <div className="text-3xl font-bold font-mono text-uci-dark-blue">{value ?? '–'}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  )
}

export default function Home() {
  const { total, rde, isLoading } = useCaseCounts()

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-uci-dark-blue mb-4">Detonation Science and Technology Library</h1>
      <p className="text-gray-700 mb-6 leading-relaxed">
        A curated collection of combustion and detonation data from researchers and
        collaborating institutions. Browse experimental results including cell size measurements,
        critical diameters, RDE data, and more.
      </p>

      <div className="flex flex-wrap items-center gap-4 mb-8">
        <Link
          to="/search"
          className="inline-block bg-uci-blue text-white px-5 py-2.5 rounded font-semibold hover:bg-uci-dark-blue transition-colors"
        >
          Search All Cases &rarr;
        </Link>
        <a
          href={`${import.meta.env.BASE_URL}cases.csv`}
          download="detonation-library-cases.csv"
          className="text-sm text-uci-blue underline hover:no-underline"
        >
          Download full dataset (CSV)
        </a>
      </div>

      {isLoading ? (
        <Skeleton rows={4} />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <CountCard label="Total Cases" value={total} />
          <CountCard label="RDE Cases" value={rde} />
        </div>
      )}
    </div>
  )
}
