import type { ReactNode } from 'react'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import { SUBMIT_ISSUE_URL, TEMPLATE_URL, REPO_URL } from '../config'

const REQUIRED = ['title', 'setup', 'geometry', 'fuel', 'oxidizer', 'equivalence_ratio', 'initial_pressure_kpa', 'initial_temperature_k', 'contributor_name', 'contributor_institution', 'contributor_email']

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="relative pl-12 pb-8 last:pb-0">
      <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface num text-[13px] font-medium text-ink">{n}</span>
      <span className="absolute left-4 top-8 bottom-0 w-px bg-line" aria-hidden="true" />
      <h2 className="text-[16px] font-semibold leading-8">{title}</h2>
      <div className="mt-1">{children}</div>
    </li>
  )
}

export default function Contribute() {
  return (
    <div>
      <PageHeader
        title="Contribute data"
        description="Add measurements to the library from a CSV file: one row per case, using the template's columns and units. The maintainers check the file and add it."
      />

      <div className="container-x py-8 max-w-[880px]">
        <ol>
          <Step n={1} title="Download the template">
            <p className="text-[13.5px] text-ink-2 max-w-[64ch]">
              The template has every column the library understands. Keep the header row as it is.
              Each column name carries its unit: kPa, K, mm, J, ppm.
            </p>
            <a href={TEMPLATE_URL} className="btn btn-secondary mt-3 hover:no-underline">
              <Icon name="download" size={15} /> Download template CSV
            </a>
          </Step>

          <Step n={2} title="Fill in one row per case">
            <p className="text-[13.5px] text-ink-2 max-w-[64ch]">
              Required: {REQUIRED.join(', ')}. Leave a cell empty when you have no value.
              Put the paper the value comes from in <span className="num">doi_reference</span>.
            </p>
            <ul className="mt-2 text-[13.5px] text-ink-2 max-w-[64ch] list-disc ml-5 space-y-1">
              <li><span className="num">setup</span> is <span className="num">detonation</span>; <span className="num">geometry</span> is free text such as "round tube" or "rectangular channel 50x30mm". The RDE operating points come from the RDE database, not from this template.</li>
              <li>Additional diluents are <span className="num">name:percentage</span> pairs separated by commas; additional dopants are <span className="num">name:ppm</span> pairs.</li>
            </ul>
          </Step>

          <Step n={3} title="Send the file through GitHub">
            <p className="text-[13.5px] text-ink-2 max-w-[64ch]">
              Open a data submission on GitHub and attach your CSV. You need a free GitHub account.
              Rows that duplicate an existing case (same mixture, conditions and measured values) are
              merged into it rather than added twice.
            </p>
            <a href={SUBMIT_ISSUE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-3 hover:no-underline">
              <Icon name="upload" size={15} /> Open a data submission <Icon name="external" size={12} />
            </a>
          </Step>

          <Step n={4} title="What happens next">
            <p className="text-[13.5px] text-ink-2 max-w-[64ch]">
              A maintainer runs the checks, adds the rows to the data file and closes the submission.
              The site rebuilds from the data file, so your cases appear with your name, institution
              and email on each one. Everything you submit is public, in the{' '}
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">repository</a> as well as on this site.
            </p>
          </Step>
        </ol>
      </div>
    </div>
  )
}
