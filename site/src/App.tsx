import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppHeader from './components/AppHeader'
import AppFooter from './components/AppFooter'
import Skeleton from './components/Skeleton'
import { CATEGORIES } from './lib/categories'

const Home = lazy(() => import('./pages/Home'))
const BrowsePage = lazy(() => import('./pages/browse/BrowsePage'))
const CaseDetail = lazy(() => import('./pages/cases/CaseDetail'))
const PlotPage = lazy(() => import('./pages/plot/PlotPage'))
const Contribute = lazy(() => import('./pages/Contribute'))
const About = lazy(() => import('./pages/About'))

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-surface focus:px-3 focus:py-2 focus:rounded-[6px] focus:border focus:border-line"
      >
        Skip to content
      </a>
      <AppHeader />
      <main id="main" className="flex-1">
        <Suspense fallback={<div className="container-x py-10"><Skeleton rows={6} /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/search" element={<BrowsePage mode="all" focusSearch />} />
            <Route path="/cases" element={<BrowsePage mode="all" />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            {CATEGORIES.filter(c => c.mode !== 'all').map(c => (
              <Route key={c.mode} path={c.path} element={<BrowsePage mode={c.mode} />} />
            ))}
            <Route path="/browse/*" element={<Navigate to="/cases" replace />} />
            <Route path="/plot" element={<PlotPage />} />
            <Route path="/contribute" element={<Contribute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <AppFooter />
    </div>
  )
}
