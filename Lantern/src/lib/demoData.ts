import type { DispositionPreference, Recommendation } from './types'

// Fictional case and funeral homes for the /demo walkthrough. Nothing here is
// read from or written to Supabase -- the demo runs entirely in the browser.

export const DEMO_CASE = {
  decedentName: 'Eleanor Marie Whitfield',
  dateOfDeath: '2026-10-18',
  residenceZip: '98109',
  residenceCounty: 'King',
  disposition: 'unsure' as DispositionPreference,
  contactName: 'Daniel Whitfield',
  contactRelationship: 'Son',
}

const DEMO_CASE_ID = 'demo-case'
const DEMO_CREATED_AT = '2026-10-25T00:00:00.000Z'

function demoRec(
  rank: number,
  id: string,
  home: Recommendation['funeral_homes'],
  rationale: string,
): Recommendation {
  return {
    id: `demo-rec-${rank}`,
    case_id: DEMO_CASE_ID,
    funeral_home_id: id,
    rank,
    rationale,
    created_at: DEMO_CREATED_AT,
    funeral_homes: home,
  }
}

export const DEMO_RECOMMENDATIONS: Recommendation[] = [
  demoRec(
    1,
    'demo-home-1',
    {
      id: 'demo-home-1',
      name: 'Evergreen Memorial Chapel (demo)',
      address: '1200 Cedar Ave, Seattle, WA',
      county: 'King',
      zip: '98109',
      phone: '(206) 555-0141',
      cremation_capable: true,
      burial_capable: true,
      price_cremation: 2450,
      price_burial: 6900,
      rating: 4.8,
    },
    'Serves your county, offers both burial and cremation so you can decide later, and has the strongest family reviews of the homes nearby.',
  ),
  demoRec(
    2,
    'demo-home-2',
    {
      id: 'demo-home-2',
      name: 'Harborview Funeral Home (demo)',
      address: '84 Lakeshore Dr, Bellevue, WA',
      county: 'King',
      zip: '98004',
      phone: '(425) 555-0187',
      cremation_capable: true,
      burial_capable: true,
      price_cremation: 2150,
      price_burial: 7400,
      rating: 4.5,
    },
    'The lowest cremation price in your area, with on-site staff who can handle paperwork with the hospital and county on your behalf.',
  ),
  demoRec(
    3,
    'demo-home-3',
    {
      id: 'demo-home-3',
      name: 'Cascade Family Services (demo)',
      address: '57 Ridge Rd, Renton, WA',
      county: 'King',
      zip: '98057',
      phone: '(425) 555-0102',
      cremation_capable: true,
      burial_capable: false,
      price_cremation: 1980,
      price_burial: null,
      rating: 4.2,
    },
    'A cremation-only provider with the most affordable option on the list. Choose this if cremation is the direction you settle on.',
  ),
]
