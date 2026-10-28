import { Link } from 'react-router-dom'
import { GALCIT_DB_URL, GALCIT_REPORT_DOI } from '../lib/format'
import { REPO_URL } from '../config'

export default function AppFooter() {
  return (
    <footer className="border-t border-line mt-16 bg-surface">
      <div className="container-x py-8 grid gap-8 md:grid-cols-[1fr_auto] text-[13px] text-ink-2">
        <div className="max-w-[72ch] space-y-2">
          <p className="text-ink font-medium">Detonation Science and Technology Library</p>
          <p>
            Cases are transcribed from the GALCIT Detonation Database: M. Kaneshige and J. E. Shepherd,
            <em> Detonation Database</em>, Technical Report FM97-8, GALCIT, California Institute of Technology, 1997,{' '}
            <a href={GALCIT_REPORT_DOI} target="_blank" rel="noopener noreferrer">doi:10.7907/g3gs-4y69</a>
            {' '}(<a href={GALCIT_DB_URL} target="_blank" rel="noopener noreferrer">online version</a>).
          </p>
          <p>
            When you use specific values, cite the original publication listed in the case's reference, not this
            library. Cell-size cases give pressures in kPa, temperatures in K and lengths in mm; RDE columns name
            their unit.
          </p>
        </div>
        <nav className="flex md:flex-col gap-x-6 gap-y-2 md:text-right" aria-label="Footer">
          <Link to="/about">About and how to cite</Link>
          <Link to="/contribute">Contribute data</Link>
          <a href={`${import.meta.env.BASE_URL}cases.csv`} download="detonation-library-cases.csv">Download the cell-size cases (CSV)</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Source and data on GitHub</a>
        </nav>
      </div>
    </footer>
  )
}
