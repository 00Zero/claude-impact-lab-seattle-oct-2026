import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Field } from '../components/Field'
import { startAnonymousFamilySession } from '../lib/auth'
import { stashWizardDraft, type WizardDraft } from '../lib/familyOnboarding'
import { todayLocal } from '../lib/dates'
import type { DispositionPreference } from '../lib/types'

const TOTAL_STEPS = 5

const RELATIONSHIPS = ['Spouse', 'Son', 'Daughter', 'Parent', 'Sibling', 'Other family member']

type FormState = {
  legalFirstName: string
  legalMiddleName: string
  legalLastName: string
  dateOfDeath: string
  residenceZip: string
  disposition: DispositionPreference | ''
  contactName: string
  contactRelationship: string
}

const EMPTY_FORM: FormState = {
  legalFirstName: '',
  legalMiddleName: '',
  legalLastName: '',
  dateOfDeath: '',
  residenceZip: '',
  disposition: '',
  contactName: '',
  contactRelationship: '',
}

function stepIsValid(step: number, form: FormState): boolean {
  switch (step) {
    case 0:
      return form.legalFirstName.trim() !== '' && form.legalLastName.trim() !== ''
    case 1:
      return form.dateOfDeath !== ''
    case 2:
      return /^\d{5}$/.test(form.residenceZip)
    case 3:
      return form.disposition !== ''
    case 4:
      return form.contactName.trim() !== '' && form.contactRelationship.trim() !== ''
    default:
      return false
  }
}

export function Wizard() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [submitError, setSubmitError] = useState('')

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleFinalSubmit() {
    setSubmitStatus('sending')
    setSubmitError('')
    try {
      const draft: WizardDraft = {
        legal_first_name: form.legalFirstName.trim(),
        legal_middle_name: form.legalMiddleName.trim() || null,
        legal_last_name: form.legalLastName.trim(),
        date_of_death: form.dateOfDeath,
        residence_zip: form.residenceZip,
        disposition_preference: form.disposition as DispositionPreference,
        family_contact_name: form.contactName.trim(),
        family_contact_relationship: form.contactRelationship.trim(),
        family_contact_email: null,
      }
      stashWizardDraft(draft)
      await startAnonymousFamilySession()
      // Full page load (not client-side navigate) so the freshly stored session is
      // read from storage before RequireRole on /case checks it.
      window.location.assign('/case')
    } catch (err) {
      setSubmitStatus('error')
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  const canContinue = stepIsValid(step, form)

  return (
    <Layout>
      <p className="progress-label">
        Step {step + 1} of {TOTAL_STEPS}
      </p>
      <div className="progress-track" aria-hidden="true">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`progress-step${i <= step ? ' is-done' : ''}`} />
        ))}
      </div>

      <div className="card">
        {step === 0 && (
          <>
            <h2>Who are we helping find care for?</h2>
            <p>Their legal name, as it would appear on official paperwork.</p>
            <div className="field-row">
              <Field label="First name" htmlFor="w-first">
                <input
                  id="w-first"
                  type="text"
                  value={form.legalFirstName}
                  onChange={(e) => update('legalFirstName', e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Middle name (optional)" htmlFor="w-middle">
                <input
                  id="w-middle"
                  type="text"
                  value={form.legalMiddleName}
                  onChange={(e) => update('legalMiddleName', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Last name" htmlFor="w-last">
              <input
                id="w-last"
                type="text"
                value={form.legalLastName}
                onChange={(e) => update('legalLastName', e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <h2>When did they pass away?</h2>
            <Field label="Date of death" htmlFor="w-dod">
              <input
                id="w-dod"
                type="date"
                max={todayLocal()}
                value={form.dateOfDeath}
                onChange={(e) => update('dateOfDeath', e.target.value)}
                autoFocus
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Where should we look for funeral homes?</h2>
            <p>Their home zip code — we'll use this to find nearby options.</p>
            <Field label="Zip code" htmlFor="w-zip">
              <input
                id="w-zip"
                type="text"
                inputMode="numeric"
                pattern="\d{5}"
                maxLength={5}
                value={form.residenceZip}
                onChange={(e) => update('residenceZip', e.target.value.replace(/\D/g, '').slice(0, 5))}
                autoFocus
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Do you have a preference for burial or cremation?</h2>
            <p>It's completely fine if you're not sure yet — we'll show you both.</p>
            <div className="radio-group" role="radiogroup">
              {(
                [
                  ['burial', 'Burial'],
                  ['cremation', 'Cremation'],
                  ['unsure', "I'm not sure yet"],
                ] as [DispositionPreference, string][]
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`radio-option${form.disposition === value ? ' is-checked' : ''}`}
                >
                  <input
                    type="radio"
                    name="disposition"
                    value={value}
                    checked={form.disposition === value}
                    onChange={() => update('disposition', value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2>How are you connected to them?</h2>
            <p>So we know who's arranging care.</p>
            <Field label="Your name" htmlFor="w-contact-name">
              <input
                id="w-contact-name"
                type="text"
                value={form.contactName}
                onChange={(e) => update('contactName', e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Your relationship to them" htmlFor="w-relationship">
              <select
                id="w-relationship"
                value={form.contactRelationship}
                onChange={(e) => update('contactRelationship', e.target.value)}
              >
                <option value="">Select one…</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            {submitStatus === 'error' && <p className="error-text" role="alert">{submitError}</p>}
          </>
        )}

        <div className="btn-row">
          {step > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canContinue}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canContinue || submitStatus === 'sending'}
              onClick={handleFinalSubmit}
            >
              {submitStatus === 'sending' ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Finding funeral homes…
                </>
              ) : (
                'Get my recommendations'
              )}
            </button>
          )}
        </div>
      </div>
    </Layout>
  )
}
