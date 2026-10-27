import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { decedentName, type Case, type IntakeDocument } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'
import { HospitalLayout } from '../components/HospitalLayout'
import { triggerParseIntake } from '../lib/triggerParseIntake'

interface InviteToken {
  id: string
  token: string
  contact_email: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const [caseRow, setCaseRow] = useState<Case | null>(null)
  const [intakeDoc, setIntakeDoc] = useState<IntakeDocument | null>(null)
  const [invite, setInvite] = useState<InviteToken | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resending, setResending] = useState(false)
  const [retryingParse, setRetryingParse] = useState(false)
  const [copied, setCopied] = useState(false)
  const [now] = useState(() => Date.now())

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [{ data: caseData, error: caseErr }, { data: docData }, { data: inviteData }] = await Promise.all([
      supabase.from('cases').select('*').eq('id', id).single(),
      supabase
        .from('intake_documents')
        .select('*')
        .eq('case_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('invite_tokens')
        .select('*')
        .eq('case_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (caseErr) setError(caseErr.message)
    setCaseRow(caseData as Case | null)
    setIntakeDoc(docData as IntakeDocument | null)
    setInvite(inviteData as InviteToken | null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function handleResend() {
    if (!id || !caseRow || !caseRow.family_contact_email) return
    setResending(true)

    if (invite && !invite.used_at) {
      await supabase.from('invite_tokens').update({ used_at: new Date().toISOString() }).eq('id', invite.id)
    }

    await supabase.from('invite_tokens').insert({
      case_id: id,
      contact_email: caseRow.family_contact_email,
    })

    await loadAll()
    setResending(false)
  }

  // Covers T7.1's "parse failure" case where the fire-and-forget call to
  // parse-intake from NewCase.tsx never reached the server at all (network
  // blip) -- there's no intake_documents row to show a specific error from,
  // just nothing. Re-lists the uploaded PDF from storage (we don't persist
  // its path anywhere else) and fires parse-intake again.
  async function handleRetryParse() {
    if (!id) return
    setRetryingParse(true)

    const { data: files } = await supabase.storage.from('intake-documents').list(id)
    const file = files?.[0]
    if (file) triggerParseIntake(id, `${id}/${file.name}`)

    setTimeout(async () => {
      await loadAll()
      setRetryingParse(false)
    }, 3000)
  }

  if (loading)
    return (
      <HospitalLayout>
        <p className="center-note">Loading…</p>
      </HospitalLayout>
    )
  if (error)
    return (
      <HospitalLayout>
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      </HospitalLayout>
    )
  if (!caseRow)
    return (
      <HospitalLayout>
        <p className="center-note">Case not found.</p>
      </HospitalLayout>
    )

  const inviteExpired = invite ? new Date(invite.expires_at).getTime() <= now : false
  const inviteUsable = Boolean(invite && !invite.used_at && !inviteExpired)
  const inviteUrl = inviteUsable ? `${window.location.origin}/invite/${invite!.token}` : null

  return (
    <HospitalLayout>
      <p className="eyebrow">Case</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
        <h1 style={{ margin: 0 }}>{decedentName(caseRow)}</h1>
        <StatusBadge status={caseRow.status} />
      </div>

      <div className="card">
        <h2>Invite link</h2>
        {inviteUrl ? (
          <p>
            <code
              style={{
                display: 'inline-block',
                background: 'var(--border-soft)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.4rem 0.6rem',
                fontSize: '0.9rem',
                wordBreak: 'break-all',
              }}
            >
              {inviteUrl}
            </code>
          </p>
        ) : (
          <p>{invite ? (invite.used_at ? 'Invite already used.' : 'Invite expired.') : 'No invite yet.'}</p>
        )}
        <div className="btn-row">
        {inviteUrl && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              navigator.clipboard?.writeText(inviteUrl).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              })
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={handleResend} disabled={resending}>
          {resending ? 'Creating…' : 'Generate new invite link'}
        </button>
        </div>
      </div>

      <div className="card">
        <h2>Parsed fields</h2>
        {!intakeDoc && (
          <>
            <p>PDF not parsed yet.</p>
            <button type="button" className="btn btn-secondary" onClick={handleRetryParse} disabled={retryingParse}>
              {retryingParse ? 'Checking…' : 'Re-check / retry parsing'}
            </button>
          </>
        )}
        {intakeDoc && !intakeDoc.parsed_fields && <p>Parse returned no usable fields.</p>}
        {intakeDoc?.parsed_fields && (
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(intakeDoc.parsed_fields)
                .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] !== undefined)
                .map(([key, field]) => (
                  <tr key={key}>
                    <td>{key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}</td>
                    <td>{field.value === null ? '—' : String(field.value)}</td>
                    <td>{typeof field.confidence === 'number' ? field.confidence.toFixed(2) : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </HospitalLayout>
  )
}
