// Standalone unit tests for filterCandidates -- no network, no Supabase.
// Run with `npm test` from the repo root.
import {
  filterCandidates,
  filterCandidatesForCase,
  resolveCaseCounty,
  type FuneralHomeCandidate,
} from '../supabase/functions/_shared/filterCandidates.ts'

let failures = 0

function check(label: string, condition: boolean) {
  console.log(`${condition ? 'PASS' : 'FAIL'} - ${label}`)
  if (!condition) failures++
}

function home(id: string, county: string, cremation: boolean, burial: boolean): FuneralHomeCandidate {
  return { id, county, cremation_capable: cremation, burial_capable: burial }
}

function testExactCountyMatch() {
  // Spokane is not adjacent to King, so it must never appear in a King search.
  const homes = [home('a', 'King', true, true), home('b', 'King', true, true), home('c', 'Spokane', true, true)]
  const result = filterCandidates(homes, { county: 'King', disposition: 'cremation' })
  check('exact county match: only King homes returned', result.every((h) => h.county === 'King'))
  check('exact county match: both King homes returned', result.length === 2)
}

function testNearbyFallback() {
  // San Juan has zero funeral homes in the dataset (as in production data) --
  // candidates should come from its adjacent counties instead.
  const homes = [home('a', 'Island', true, true), home('b', 'Skagit', true, true), home('c', 'Spokane', true, true)]
  const result = filterCandidates(homes, { county: 'San Juan', disposition: 'cremation' })
  check('nearby fallback: pulls from adjacent counties', result.some((h) => h.county === 'Island') && result.some((h) => h.county === 'Skagit'))
  check('nearby fallback: excludes non-adjacent county', !result.some((h) => h.county === 'Spokane'))
}

function testNearbyFallbackOnlyFillsGap() {
  // Same county already fills the cap -- nearby counties should not be pulled in.
  const homes = [home('a', 'King', true, true), home('b', 'King', true, true), home('c', 'Pierce', true, true)]
  const result = filterCandidates(homes, { county: 'King', disposition: 'cremation' }, 2)
  check('cap already filled by same county: no nearby homes pulled in', result.every((h) => h.county === 'King'))
}

function testDispositionMismatchExcluded() {
  const homes = [home('a', 'King', true, false), home('b', 'King', false, true), home('c', 'King', true, true)]
  const cremationOnly = filterCandidates(homes, { county: 'King', disposition: 'cremation' })
  check('disposition mismatch excluded: burial-only home dropped for cremation', !cremationOnly.some((h) => h.id === 'b'))
  check('disposition match: cremation-capable homes kept', cremationOnly.some((h) => h.id === 'a') && cremationOnly.some((h) => h.id === 'c'))

  const burialOnly = filterCandidates(homes, { county: 'King', disposition: 'burial' })
  check('disposition mismatch excluded: cremation-only home dropped for burial', !burialOnly.some((h) => h.id === 'a'))
}

function testCapEnforced() {
  const homes = Array.from({ length: 30 }, (_, i) => home(`h${i}`, 'King', true, true))
  const result = filterCandidates(homes, { county: 'King', disposition: 'cremation' })
  check('cap enforced: default cap of 20 respected', result.length === 20)

  const customCap = filterCandidates(homes, { county: 'King', disposition: 'cremation' }, 5)
  check('cap enforced: custom cap respected', customCap.length === 5)
}

function testZeroResultNoWidening() {
  // Adjacent counties exist (Lincoln, Grant, etc. for Ferry) but have no
  // capable homes either -- should return empty, not keep widening further.
  const homes = [home('a', 'King', true, true)]
  const result = filterCandidates(homes, { county: 'Ferry', disposition: 'cremation' })
  check('zero-result case: returns empty list rather than widening past one adjacency ring', result.length === 0)
}

function testUnknownCountyReturnsEmpty() {
  const homes = [home('a', 'King', true, true)]
  const result = filterCandidates(homes, { county: null, disposition: 'cremation' })
  check('null county returns empty list', result.length === 0)
}

function testUnsureDispositionMatchesEither() {
  const homes = [home('a', 'King', true, false), home('b', 'King', false, true), home('c', 'King', false, false)]
  const result = filterCandidates(homes, { county: 'King', disposition: 'unsure' })
  check('unsure disposition: matches cremation-only and burial-only homes', result.some((h) => h.id === 'a') && result.some((h) => h.id === 'b'))
  check('unsure disposition: excludes homes capable of neither', !result.some((h) => h.id === 'c'))
}

function testResolveCaseCounty() {
  check(
    'resolveCaseCounty: prefers residence_county when present',
    resolveCaseCounty({ residence_county: 'Pierce', residence_zip: '98001' }) === 'Pierce',
  )
  check(
    'resolveCaseCounty: falls back to zip lookup for self-serve cases (98001 -> King)',
    resolveCaseCounty({ residence_county: null, residence_zip: '98001' }) === 'King',
  )
  check(
    'resolveCaseCounty: returns null when neither is available or zip is unrecognized',
    resolveCaseCounty({ residence_county: null, residence_zip: null }) === null &&
      resolveCaseCounty({ residence_county: null, residence_zip: '00000' }) === null,
  )
}

function testFilterCandidatesForCase() {
  const homes = [home('a', 'King', true, true), home('b', 'Pierce', true, true)]
  const resolvedViaZip = filterCandidatesForCase(homes, {
    residence_county: null,
    residence_zip: '98001',
    disposition_preference: 'cremation',
  })
  check('filterCandidatesForCase: self-serve case resolved via zip returns King home', resolvedViaZip.some((h) => h.id === 'a'))

  const noDisposition = filterCandidatesForCase(homes, {
    residence_county: 'King',
    residence_zip: null,
    disposition_preference: null,
  })
  check('filterCandidatesForCase: no disposition set returns empty list', noDisposition.length === 0)
}

testExactCountyMatch()
testNearbyFallback()
testNearbyFallbackOnlyFillsGap()
testDispositionMismatchExcluded()
testCapEnforced()
testZeroResultNoWidening()
testUnknownCountyReturnsEmpty()
testUnsureDispositionMatchesEither()
testResolveCaseCounty()
testFilterCandidatesForCase()

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`)
process.exit(failures === 0 ? 0 : 1)
