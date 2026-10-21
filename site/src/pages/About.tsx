import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import { GALCIT_DB_URL, GALCIT_REPORT_DOI, GALCIT_REFERENCES_URL } from '../lib/format'
import { REPO_URL, NEW_ISSUE_URL } from '../config'

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
            setup and geometry, and the measured quantity. The measured quantities are cell width
            and length, critical tube diameter, minimum tube diameter and critical initiation
            energy. Every case names the publication it was taken from.
          </p>
          <p>
            Units are fixed across the library: pressures in kPa, temperatures in K, lengths in mm
            and energies in J. The equivalence ratio is always the field <span className="num">equivalence_ratio</span>.
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

        <section>
          <h2 className="text-[18px] font-semibold mb-2">Get the data</h2>
          <p>
            The whole library is one file, with one row per case and the same column names and
            units the site shows. An empty cell means there is no value.
          </p>
          <div className="flex flex-wrap gap-2 not-prose">
            <a href={`${base}cases.csv`} download="detonation-library-cases.csv" className="btn btn-primary hover:no-underline"><Icon name="download" size={15} /> cases.csv</a>
            <a href={`${base}cases.json`} download="detonation-library-cases.json" className="btn btn-secondary hover:no-underline"><Icon name="download" size={15} /> cases.json</a>
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
