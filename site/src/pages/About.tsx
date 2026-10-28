import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import { GALCIT_DB_URL, GALCIT_REPORT_DOI, GALCIT_REFERENCES_URL } from '../lib/format'
import { REPO_URL, NEW_ISSUE_URL } from '../config'
import { useRde } from '../data/rde'
import { fmtDate } from '../lib/format'

const CITATION = 'M. Kaneshige and J. E. Shepherd. Detonation Database. Technical Report FM97-8, GALCIT, California Institute of Technology, July 1997. https://doi.org/10.7907/g3gs-4y69'

const BIBTEX = `@techreport{kaneshige1997detonation,
  author      = {Kaneshige, M. and Shepherd, J. E.},
  title       = {Detonation Database},
  institution = {GALCIT, California Institute of Technology},
  number      = {FM97-8},
  year        = {1997},
  month       = {July},
  doi         = {10.7907/g3gs-4y69},
  url         = {https://shepherd.caltech.edu/detn_db/html/}
}`

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch {
      // Clipboard unavailable: the text is visible and can be selected.
    }
  }
  return (
    <button type="button" onClick={copy} className="btn btn-secondary btn-sm">
      <Icon name={done ? 'check' : 'copy'} size={13} /> {done ? 'Copied' : label}
    </button>
  )
}

export default function About() {
  const base = import.meta.env.BASE_URL
  const rde = useRde().data
  const release = rde?.release
  const hasRde = (rde?.operating_points.length ?? 0) > 0
  return (
    <div>
      <PageHeader
        title="About the library"
        description="An open, searchable collection of gaseous detonation measurements for research and hazard analysis."
      />
      <div className="container-x py-8 max-w-[880px] space-y-10 prose-sm text-[14px] text-ink leading-relaxed">
        <section>
          <h2 className="text-[18px] font-semibold mb-2">What it holds</h2>
          <p>
            Each case is one measurement of a detonable gas mixture: the fuel, oxidizer and
            equivalence ratio, any diluent or dopant, the initial pressure and temperature, the
            setup and geometry, and the measured detonation cell width or cell length. Every case
            names the publication it was taken from.
          </p>
          {hasRde && <p>
            The <Link to="/browse/rde">RDE</Link> category holds operating points of rotating
            detonation engines: the propellants and flow rates, the combustor geometry, the number,
            speed and frequency of the detonation waves, and, where the paper reports them, thrust,
            specific impulse, chamber pressures and pressure gain.
          </p>}
          <p>
            Units are fixed across the cell-size cases: pressures in kPa, temperatures in K and
            lengths in mm. The equivalence ratio is always the field <span className="num">equivalence_ratio</span>.
            The RDE columns carry their unit in their name, for example <span className="num">back_pressure_pa</span> in Pa.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-2">Data source and how to cite</h2>
          <p>
            The cases were transcribed from the tables of the GALCIT Detonation Database compiled at
            the Explosion Dynamics Laboratory, California Institute of Technology. Each case keeps
            the original dataset key (for example <span className="num">ja5d</span>) and the
            number of its entry in the{' '}
            <a href={GALCIT_REFERENCES_URL} target="_blank" rel="noopener noreferrer">GALCIT reference list</a>.
          </p>
          <div className="panel p-4 not-prose">
            <p className="text-[13.5px] leading-relaxed">{CITATION}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={CITATION} label="Copy citation" />
              <CopyButton text={BIBTEX} label="Copy BibTeX" />
              <a href={GALCIT_REPORT_DOI} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm hover:no-underline">Report <Icon name="external" size={12} /></a>
              <a href={GALCIT_DB_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm hover:no-underline">Online database <Icon name="external" size={12} /></a>
            </div>
          </div>
          <p className="mt-3">
            As the database's authors ask: when you use specific values, cite the original
            publication listed in the case's reference, not the database or this library. The data
            remain the intellectual property of the researchers who measured them.
          </p>
        </section>

        {hasRde && <section>
          <h2 className="text-[18px] font-semibold mb-2">RDE operating points</h2>
          <p>
            The RDE operating points come from the RDE database
            {release ? <>, release <span className="num">{release.release_version}</span> of {fmtDate(release.release_date)}</> : ''}, in
            which each paper's experiments are transcribed into a common template. The site shows a
            subset of its fields. Every operating point names its paper and DOI, and every value
            records how it was obtained: read from a table or the text, digitized from a figure,
            calculated from other reported values, inferred, or supplied by the paper's authors.
          </p>
          <p>
            An empty value means the release has no value for it; the release does not record why,
            and it is never a zero. Specific impulse is computed on a different flow for rockets,
            air-breathing and oxygen-augmented engines, and wave speeds refer to each paper's own
            reference diameter, so compare those within one engine class or paper. Operating point
            numbers belong to one release of the RDE database and can change in the next. As with the
            cell sizes, cite the original paper for any value you use.
          </p>
        </section>}

        <section>
          <h2 className="text-[18px] font-semibold mb-2">Get the data</h2>
          <p>
            The cell-size library is one file, with one row per case and the same column names and
            units the site shows. The RDE operating points are a second file, one row per operating
            point, and their chamber pressures, several per point, a third. An empty cell means
            there is no value.
          </p>
          <div className="flex flex-wrap gap-2 not-prose">
            <a href={`${base}cases.csv`} download="detonation-library-cases.csv" className="btn btn-primary hover:no-underline"><Icon name="download" size={15} /> cases.csv</a>
            <a href={`${base}cases.json`} download="detonation-library-cases.json" className="btn btn-secondary hover:no-underline"><Icon name="download" size={15} /> cases.json</a>
            {hasRde && <>
              <a href={`${base}rde.csv`} download="rde-operating-points.csv" className="btn btn-secondary hover:no-underline"><Icon name="download" size={15} /> rde.csv</a>
              <a href={`${base}rde_chamber_pressures.csv`} download="rde-chamber-pressures.csv" className="btn btn-secondary hover:no-underline"><Icon name="download" size={15} /> rde_chamber_pressures.csv</a>
            </>}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary hover:no-underline">Repository on GitHub <Icon name="external" size={12} /></a>
          </div>
          <p className="mt-3">
            The browse page's "Download CSV" button exports whatever the current filters select.
            The repository holds the source data file, the checks it must pass, and this site's code.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-2">Contributing and corrections</h2>
          <p>
            New measurements go in through a CSV file built from the template on the{' '}
            <Link to="/contribute">contribute page</Link>. Rows that duplicate an existing case
            (same mixture, conditions and measured values) are merged rather than added twice.
            Your name, institution and email are shown on each case you add.
          </p>
          <p>
            To correct a value,{' '}
            <a href={NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer">open an issue on GitHub</a>
            {' '}with the case number and the correction.
          </p>
        </section>
      </div>
    </div>
  )
}
