import { WA_COUNTY_ADJACENCY } from './waCountyAdjacency.ts'
import { WA_ZIP_TO_COUNTY } from './waZipToCounty.ts'

export type DispositionPreference = 'burial' | 'cremation' | 'unsure'

export interface FuneralHomeCandidate {
  id: string
  county: string | null
  cremation_capable: boolean
  burial_capable: boolean
  [key: string]: unknown
}

const DEFAULT_CAP = 20

function matchesDisposition(home: FuneralHomeCandidate, disposition: DispositionPreference): boolean {
  if (disposition === 'cremation') return home.cremation_capable
  if (disposition === 'burial') return home.burial_capable
  return home.cremation_capable || home.burial_capable
}

/**
 * Selects funeral home candidates for a case: same-county matches first,
 * widened to Census-adjacent WA counties only if the same county doesn't
 * fill the cap. Never widens further than one ring of adjacency -- a county
 * with no capable homes in it or its neighbors returns an empty list rather
 * than searching the whole state.
 */
export function filterCandidates<T extends FuneralHomeCandidate>(
  homes: T[],
  params: { county: string | null; disposition: DispositionPreference },
  cap = DEFAULT_CAP,
): T[] {
  if (!params.county) return []

  const capable = homes.filter((h) => matchesDisposition(h, params.disposition))

  const sameCounty = capable.filter((h) => h.county === params.county)
  if (sameCounty.length >= cap) return sameCounty.slice(0, cap)

  const neighbors = WA_COUNTY_ADJACENCY[params.county] ?? []
  const nearby = capable.filter((h) => h.county !== params.county && h.county !== null && neighbors.includes(h.county))

  return [...sameCounty, ...nearby].slice(0, cap)
}

/**
 * Resolves the county to search for a case. Hospital-path cases carry
 * residence_county directly (parsed from the intake PDF); self-serve cases
 * only collect residence_zip, so those are resolved via the Census zip lookup.
 */
export function resolveCaseCounty(caseRow: { residence_county: string | null; residence_zip: string | null }): string | null {
  if (caseRow.residence_county) return caseRow.residence_county
  if (caseRow.residence_zip && WA_ZIP_TO_COUNTY[caseRow.residence_zip]) return WA_ZIP_TO_COUNTY[caseRow.residence_zip]
  return null
}

export function filterCandidatesForCase<T extends FuneralHomeCandidate>(
  homes: T[],
  caseRow: { residence_county: string | null; residence_zip: string | null; disposition_preference: DispositionPreference | null },
  cap = DEFAULT_CAP,
): T[] {
  if (!caseRow.disposition_preference) return []
  return filterCandidates(homes, { county: resolveCaseCounty(caseRow), disposition: caseRow.disposition_preference }, cap)
}
