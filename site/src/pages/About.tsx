export default function About() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-uci-dark-blue mb-4">Contributors</h1>
      <p className="text-gray-700 mb-6 leading-relaxed">
        Our mission is to provide an open, curated collection of combustion and detonation
        data for the research community.
      </p>

      <h2 className="text-xl font-bold text-uci-dark-blue mt-8 mb-3">Contributing</h2>
      <p className="text-gray-700 leading-relaxed">
        We welcome data contributions from researchers worldwide. Use the{' '}
        <a href="/upload" className="text-uci-blue underline hover:no-underline">Upload</a>{' '}
        page to submit your experimental or computational detonation data. For questions,
        corrections, or collaboration inquiries, please reach out to us via email.
      </p>
    </div>
  )
}
