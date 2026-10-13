import { SUBMIT_ISSUE_URL, TEMPLATE_URL } from '../config'

const link = 'text-uci-blue underline hover:no-underline'
const code = 'font-mono text-sm bg-gray-100 rounded px-1'

export default function Contribute() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-uci-dark-blue mb-4">Contribute Data</h1>
      <p className="text-gray-700 mb-6 leading-relaxed">
        We welcome detonation data from researchers worldwide. Send your data as a CSV file;
        the maintainers check it and add it to the library.
      </p>

      <ol className="list-decimal ml-5 space-y-3 text-gray-700 leading-relaxed">
        <li>
          Download the <a href={TEMPLATE_URL} className={link}>CSV template</a> and fill in one
          row per case. Keep the header row as it is.
        </li>
        <li>
          Each column name carries its unit (kPa, K, mm, J, ppm). Leave a cell empty when you
          have no value.
        </li>
        <li>
          <span className={code}>setup</span> is <span className={code}>detonation</span> or{' '}
          <span className={code}>rde</span>. Write additional diluents as{' '}
          <span className={code}>name:percentage</span> pairs separated by commas, and additional
          dopants as <span className={code}>name:ppm</span> pairs.
        </li>
        <li>
          Open a <a href={SUBMIT_ISSUE_URL} target="_blank" rel="noopener noreferrer" className={link}>data
          submission</a> on GitHub and attach your file. You need a free GitHub account.
        </li>
      </ol>

      <p className="text-sm text-gray-500 mt-6">
        Everything you submit, including your name and email address, is public.
      </p>
    </div>
  )
}
