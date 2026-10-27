import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { HospitalLayout } from '../components/HospitalLayout'
import { Field } from '../components/Field'
import { triggerParseIntake } from '../lib/triggerParseIntake'

const MAX_PDF_BYTES = 10 * 1024 * 1024

export function NewCase() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [familyEmail, setFamilyEmail] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(null)
    setFileError('')

    if (!selected) return

    if (selected.type !== 'application/pdf') {
      setFileError('File must be a PDF.')
      return
    }
    if (selected.size > MAX_PDF_BYTES) {
      setFileError('File must be 10MB or smaller.')
      return
    }
    setFile(selected)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !file) return

    setSubmitting(true)
    setSubmitError('')

    const { data: newCase, error: caseError } = await supabase
      .from('cases')
      .insert({
        source: 'hospital',
        status: 'pending_review',
        hospital_id: session.user.id,
        family_contact_email: familyEmail,
        family_contact_name: familyName || null,
      })
      .select()
      .single()

    if (caseError || !newCase) {
      setSubmitError(caseError?.message ?? 'Failed to create case')
      setSubmitting(false)
      return
    }

    const storagePath = `${newCase.id}/${file.name}`
    const { error: uploadError } = await supabase.storage.from('intake-documents').upload(storagePath, file)

    if (uploadError) {
      setSubmitError(uploadError.message)
      setSubmitting(false)
      return
    }

    triggerParseIntake(newCase.id, storagePath)

    // Don't block navigation on this -- the case + upload already succeeded,
    // and the case detail page has its own "resend invite" affordance (T1.7)
    // to mint one if it's missing.
    const { error: inviteError } = await supabase.from('invite_tokens').insert({
      case_id: newCase.id,
      contact_email: familyEmail,
    })
    if (inviteError) console.warn('Invite creation failed; use "Resend invite" on the case page.', inviteError.message)

    navigate(`/hospital/cases/${newCase.id}`)
  }

  return (
    <HospitalLayout>
      <p className="eyebrow">New case</p>
      <h1>Start an intake</h1>
      <p>Upload the hospital's intake document and we'll generate an invite link you can share with the family.</p>

      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 520 }}>
        <Field label="Family contact email (required)" htmlFor="nc-email">
          <input
            id="nc-email"
            type="email"
            required
            value={familyEmail}
            onChange={(e) => setFamilyEmail(e.target.value)}
          />
        </Field>
        <Field label="Family contact name (optional)" htmlFor="nc-name">
          <input id="nc-name" type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
        </Field>
        <Field label="Intake PDF" htmlFor="nc-file" hint="PDF only, up to 10MB.">
          <input id="nc-file" type="file" accept="application/pdf" onChange={handleFileChange} />
        </Field>
        {fileError && (
          <p className="error-text" role="alert">
            {fileError}
          </p>
        )}
        {submitError && (
          <p className="error-text" role="alert">
            {submitError}
          </p>
        )}
        <div className="btn-row" style={{ marginTop: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" disabled={!file || submitting}>
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" /> Creating…
              </>
            ) : (
              'Create case'
            )}
          </button>
        </div>
      </form>
    </HospitalLayout>
  )
}
