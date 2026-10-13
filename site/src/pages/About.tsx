import { Link } from 'react-router-dom'

const link = 'text-uci-blue underline hover:no-underline'

export default function About() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-uci-dark-blue mb-4">Contributors</h1>
      <p className="text-gray-700 mb-6 leading-relaxed">
        Our mission is to provide an open, curated collection of combustion and detonation
        data for the research community.
      </p>

      <h2 className="text-xl font-bold text-uci-dark-blue mt-8 mb-3">Data source</h2>
      <p className="text-gray-700 leading-relaxed mb-3">
        The cases in this library were transcribed from the GALCIT Detonation Database:
      </p>
      <blockquote className="border-l-4 border-gray-200 pl-4 text-gray-700 leading-relaxed mb-3">
        M. Kaneshige and J.E. Shepherd. <em>Detonation Database</em>. Technical Report FM97-8,
        GALCIT, California Institute of Technology, July 1997.{' '}
        <a href="https://doi.org/10.7907/g3gs-4y69" className={link}>https://doi.org/10.7907/g3gs-4y69</a>.
        Online version:{' '}
        <a href="https://shepherd.caltech.edu/detn_db/html/" className={link}>https://shepherd.caltech.edu/detn_db/html/</a>
      </blockquote>
      <p className="text-gray-700 leading-relaxed">
        As the database authors ask, when you use specific data please cite the original
        publication listed in each case's reference field.
      </p>

      <h2 className="text-xl font-bold text-uci-dark-blue mt-8 mb-3">Contributing</h2>
      <p className="text-gray-700 leading-relaxed">
        We welcome data contributions from researchers worldwide. See the{' '}
        <Link to="/contribute" className={link}>Contribute</Link> page for how to submit your
        experimental or computational detonation data.
      </p>
    </div>
  )
}
