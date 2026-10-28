import { Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom'
import { lazy, Suspense, useLayoutEffect } from 'react'
import AppHeader from './components/AppHeader'
import AppFooter from './components/AppFooter'
import Skeleton from './components/Skeleton'
import { CATEGORIES } from './lib/categories'

const Home = lazy(() => import('./pages/Home'))
const BrowsePage = lazy(() => import('./pages/browse/BrowsePage'))
const CaseDetail = lazy(() => import('./pages/cases/CaseDetail'))
const RdePage = lazy(() => import('./pages/rde/RdePage'))
const RdeDetail = lazy(() => import('./pages/rde/RdeDetail'))
const PlotPage = lazy(() => import('./pages/plot/PlotPage'))
const Contribute = lazy(() => import('./pages/Contribute'))
const About = lazy(() => import('./pages/About'))

// A new page opens at its top. Back and forward (POP) keep the browser's own
// scroll position, and filter changes keep the pathname, so neither jumps.
function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  useLayoutEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navigationType])
  return null
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-surface focus:px-3 focus:py-2 focus:rounded-[6px] focus:border focus:border-line"
      >
        Skip to content
      </a>
      <ScrollToTop />
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
              <Route key={c.mode} path={c.path} element={c.mode === 'rde' ? <RdePage /> : <BrowsePage mode={c.mode} />} />
            ))}
            <Route path="/browse/rde/:id" element={<RdeDetail />} />
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
