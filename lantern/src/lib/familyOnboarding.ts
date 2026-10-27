import type { DispositionPreference } from './types'

const INVITE_TOKEN_KEY = 'al_pending_invite_token'
const WIZARD_DRAFT_KEY = 'al_pending_wizard_draft'

export interface WizardDraft {
  legal_first_name: string
  legal_middle_name: string | null
  legal_last_name: string
  date_of_death: string
  residence_zip: string
  disposition_preference: DispositionPreference
  family_contact_name: string
  family_contact_relationship: string
  family_contact_email: string | null
}

export function stashInviteToken(token: string) {
  localStorage.setItem(INVITE_TOKEN_KEY, token)
}

export function takeInviteToken(): string | null {
  const token = localStorage.getItem(INVITE_TOKEN_KEY)
  if (token) localStorage.removeItem(INVITE_TOKEN_KEY)
  return token
}

export function stashWizardDraft(draft: WizardDraft) {
  localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft))
}

export function takeWizardDraft(): WizardDraft | null {
  const raw = localStorage.getItem(WIZARD_DRAFT_KEY)
  if (!raw) return null
  localStorage.removeItem(WIZARD_DRAFT_KEY)
  try {
    return JSON.parse(raw) as WizardDraft
  } catch {
    return null
  }
}
