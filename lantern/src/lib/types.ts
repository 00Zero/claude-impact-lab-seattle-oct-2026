export type CaseSource = 'hospital' | 'self_serve'
export type CaseStatus = 'pending_review' | 'active' | 'recommendations_ready'
export type DispositionPreference = 'burial' | 'cremation' | 'unsure'
export type PlaceOfDeathType =
  | 'inpatient'
  | 'emergency'
  | 'dead_on_arrival'
  | 'hospice'
  | 'nursing_home'
  | 'decedent_home'
  | 'other'
  | 'unknown'

export interface Case {
  id: string
  source: CaseSource
  status: CaseStatus
  legal_first_name: string | null
  legal_middle_name: string | null
  legal_last_name: string | null
  sex: string | null
  date_of_birth: string | null
  age_at_death: number | null
  date_of_death: string | null
  time_of_death: string | null
  ward: string | null
  facility_name: string | null
  facility_city: string | null
  facility_state: string | null
  facility_zip: string | null
  place_of_death_type: PlaceOfDeathType
  residence_street: string | null
  residence_city: string | null
  residence_state: string | null
  residence_zip: string | null
  residence_county: string | null
  disposition_preference: DispositionPreference | null
  family_contact_name: string | null
  family_contact_email: string | null
  family_contact_relationship: string | null
  hospital_id: string | null
  family_user_id: string | null
  created_at: string
  updated_at: string
}

export function decedentName(c: Pick<Case, 'legal_first_name' | 'legal_middle_name' | 'legal_last_name'>) {
  return [c.legal_first_name, c.legal_middle_name, c.legal_last_name].filter(Boolean).join(' ') || 'Unnamed case'
}

export interface ParsedField<T = string> {
  value: T | null
  confidence: number
}

export type ParsedCaseFields = Partial<
  Record<
    | 'legal_first_name'
    | 'legal_middle_name'
    | 'legal_last_name'
    | 'sex'
    | 'date_of_birth'
    | 'age_at_death'
    | 'date_of_death'
    | 'time_of_death'
    | 'facility_name'
    | 'facility_city'
    | 'facility_state'
    | 'facility_zip'
    | 'residence_street'
    | 'residence_city'
    | 'residence_state'
    | 'residence_zip'
    | 'residence_county',
    ParsedField<string | number>
  >
>

export interface IntakeDocument {
  id: string
  case_id: string
  storage_path: string
  parsed_fields: ParsedCaseFields | null
  created_at: string
}

export interface FuneralHome {
  id: string
  name: string
  address: string | null
  county: string | null
  zip: string | null
  phone: string | null
  cremation_capable: boolean
  burial_capable: boolean
  price_cremation: number | null
  price_burial: number | null
  rating: number | null
}

export interface Recommendation {
  id: string
  case_id: string
  funeral_home_id: string
  rank: number
  rationale: string
  created_at: string
  funeral_homes: FuneralHome
}
