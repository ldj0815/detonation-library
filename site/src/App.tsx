import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Sidebar from './components/Sidebar'

const Home = lazy(() => import('./pages/Home'))
const Search = lazy(() => import('./pages/Search'))
const CaseList = lazy(() => import('./pages/cases/CaseList'))
const CaseDetail = lazy(() => import('./pages/cases/CaseDetail'))
const BrowsePage = lazy(() => import('./pages/browse/BrowsePage'))
const PlotPage = lazy(() => import('./pages/plot/PlotPage'))
const Contribute = lazy(() => import('./pages/Contribute'))
const About = lazy(() => import('./pages/About'))

export default function App() {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <main className="flex-1">
          <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/search" element={<Search />} />
              <Route path="/cases" element={<CaseList />} />
              <Route path="/cases/:id" element={<CaseDetail />} />
              <Route path="/browse/rde" element={<BrowsePage mode="rde" />} />
              <Route path="/browse/cell-size" element={<BrowsePage mode="cell-size" />} />
              <Route path="/browse/critical-hd" element={<BrowsePage mode="critical-hd" />} />
              <Route path="/browse/min-hd" element={<BrowsePage mode="min-hd" />} />
              <Route path="/browse/critical-energy" element={<BrowsePage mode="critical-energy" />} />
              <Route path="/plot" element={<PlotPage />} />
              <Route path="/contribute" element={<Contribute />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
