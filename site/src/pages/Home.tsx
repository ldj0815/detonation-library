import { Link } from 'react-router-dom'
import { useCategoryCounts, useFilterOptions, useLibraryStats } from '../data/hooks'
import HeroBanner from '../components/banner/HeroBanner'
import HomeHeroContent from '../components/banner/HomeHeroContent'
import Icon from '../components/Icon'
import { CATEGORIES } from '../lib/categories'
import { fmtCount, GALCIT_DB_URL, GALCIT_REPORT_DOI } from '../lib/format'

function Stat({ value, label, to }: { value: number | undefined; label: string; to?: string }) {
  const inner = (
    <>
      <span className="num block text-[26px] md:text-[30px] font-medium leading-none text-ink">{value == null ? <span className="skeleton inline-block h-7 w-16 align-middle" /> : fmtCount(value)}</span>
      <span className="mt-1.5 block text-[13px] text-ink-2">{label}</span>
    </>
  )
  const cls = 'block py-4 md:py-5 md:px-6 md:first:pl-0 md:last:pr-0 hover:no-underline'
  return to ? <Link to={to} className={`${cls} hover:[&>span:first-child]:text-accent`}>{inner}</Link> : <div className={cls}>{inner}</div>
}

export default function Home() {
  const counts = useCategoryCounts()
  const opts = useFilterOptions()
  const stats = useLibraryStats()

  const categories = CATEGORIES.filter(c => c.mode !== 'all')

  return (
    <div>
      {/* Hero */}
      <HeroBanner><HomeHeroContent /></HeroBanner>

      {/* Numbers */}
      <section className="border-b border-line bg-surface">
        <div className="container-x grid grid-cols-2 md:flex md:divide-x md:divide-line">
          <Stat value={stats.data?.cases} label="cell size cases" to="/browse/cell-size" />
          <Stat value={stats.data?.withCellLength} label="with cell length" to="/browse/cell-size?sort_by=cell_length_mm&sort_dir=desc" />
          <Stat value={opts.data ? opts.data.fuels.length : undefined} label="fuels" />
          <Stat value={stats.data?.publications} label="publications" />
        </div>
      </section>

      {/* Categories */}
      <section className="container-x py-10 md:py-14">
        <h2 className="text-[20px] font-semibold">What is in the library</h2>
        <p className="mt-1 text-[14px] text-ink-2 max-w-[64ch]">
          Each case ties a measurement to a fuel, an oxidizer, an equivalence ratio and the
          initial pressure and temperature. Open a category to filter it.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 max-w-[760px]">
          {categories.map(c => {
            // A category with nothing published yet says so instead of showing 0.
            const empty = c.placeholder || counts.data?.[c.mode] === 0
            return (
              <Link key={c.mode} to={c.path} className="panel group flex flex-col p-5 hover:no-underline hover:border-accent transition-colors">
                <span className="flex items-center gap-2 text-[16px] font-semibold text-ink group-hover:text-accent">
                  {c.label}
                  {empty && <span className="badge">Coming</span>}
                </span>
                <span className="mt-2 text-[13.5px] text-ink-2 leading-relaxed flex-1">
                  {empty ? `${c.description} None published yet; this is where they will appear.` : c.description}
                </span>
                <span className="mt-4 text-[13px] text-ink-2">
                  {empty
                    ? 'Not published yet'
                    : <><span className="num text-ink">{counts.data?.[c.mode] != null ? fmtCount(counts.data[c.mode]) : '…'}</span> {c.noun ?? 'cases'}</>}
                  <Icon name="arrowRight" size={13} className="inline ml-1.5 text-ink-3 group-hover:text-accent" />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Source and contribute */}
      <section className="border-t border-line bg-surface">
        <div className="container-x py-10 md:py-14 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-[20px] font-semibold">Where the data comes from</h2>
            <p className="mt-2 text-[14px] text-ink-2 leading-relaxed max-w-[60ch]">
              The cases were transcribed from the tables of the GALCIT Detonation Database compiled
              at Caltech's Explosion Dynamics Laboratory. Each case keeps its original dataset key and
              reference number, so a value can be traced back to the paper it was measured in.
            </p>
            <blockquote className="mt-4 panel px-4 py-3 text-[13.5px] leading-relaxed max-w-[60ch]">
              M. Kaneshige and J. E. Shepherd. <em>Detonation Database.</em> Technical Report FM97-8,
              GALCIT, California Institute of Technology, July 1997.{' '}
              <a href={GALCIT_REPORT_DOI} target="_blank" rel="noopener noreferrer">doi:10.7907/g3gs-4y69</a>.{' '}
              <a href={GALCIT_DB_URL} target="_blank" rel="noopener noreferrer">Online version</a>.
            </blockquote>
            <p className="mt-3 text-[13px] text-ink-2">
              When you use a specific value, cite the publication in the case's reference rather than this library.{' '}
              <Link to="/about">More on citing</Link>.
            </p>
          </div>
          <div>
            <h2 className="text-[20px] font-semibold">Use the data, add to it</h2>
            <p className="mt-2 text-[14px] text-ink-2 leading-relaxed max-w-[56ch]">
              The cell-size cases are one CSV file and the RDE operating points another, both
              ready to download and work with directly. New cell-size measurements from your own
              experiments go in through a template: fill one row per case and send the file
              through GitHub.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`${import.meta.env.BASE_URL}cases.csv`} download="detonation-library-cases.csv" className="btn btn-primary hover:no-underline"><Icon name="download" size={15} /> Download all cases (CSV)</a>
              {counts.data?.rde ? <a href={`${import.meta.env.BASE_URL}rde.csv`} download="rde-operating-points.csv" className="btn btn-secondary hover:no-underline"><Icon name="download" size={15} /> RDE operating points (CSV)</a> : null}
              <Link to="/contribute" className="btn btn-secondary hover:no-underline"><Icon name="upload" size={15} /> Contribute data</Link>
              <Link to="/browse/cell-size?view=plot" className="btn btn-secondary hover:no-underline"><Icon name="chart" size={15} /> Plot the data</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
