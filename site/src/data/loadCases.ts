import type { CaseDetail } from '../types/case'

// The whole database is one static file, generated from data/cases.csv by
// scripts/build_data.py and served next to index.html.
export async function loadCases(): Promise<CaseDetail[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}cases.json`)
  if (!res.ok) throw new Error(`Could not load cases.json (HTTP ${res.status})`)
  return res.json() as Promise<CaseDetail[]>
}
