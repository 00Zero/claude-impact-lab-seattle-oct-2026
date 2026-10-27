import { useCallback, useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { Field } from '../components/Field'
import { RecommendationCard } from '../components/RecommendationCard'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { takeInviteToken, takeWizardDraft } from '../lib/familyOnboarding'
import { triggerRecommend } from '../lib/triggerRecommend'
import { decedentName, type Case, type DispositionPreference, type IntakeDocument, type Recommendation } from '../lib/types'

type BootStatus = 'working' | 'done' | 'error'

export function FamilyCase() {
  const { session } = useAuth()
  const [bootStatus, setBootStatus] = useState<BootStatus>('working')
  const [bootError, setBootError] = useState('')
  const [caseRow, setCaseRow] = useState<Case | null | undefined>(undefined)
  const [fetchError, setFetchError] = useState('')

  const fetchCase = useCallback(async () => {
    if (!session) return
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('family_user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) setFetchError(error.message)
    else setCaseRow(data as Case | null)
  }, [session])

  useEffect(() => {
    if (!session) return

    async function bootstrap() {
      const pendingToken = takeInviteToken()
      if (pendingToken) {
        const { error } = await supabase.rpc('redeem_invite_token', { p_token: pendingToken })
        if (error) {
          setBootStatus('error')
          setBootError(
            error.message.includes('already linked')
              ? "This invite has already been used to set up a case."
              : "We couldn't confirm your invite. It may have expired — please contact the hospital for a new link.",
          )
          return
        }
      } else {
        const draft = takeWizardDraft()
        if (draft) {
          const { data: newCase, error } = await supabase
            .from('cases')
            .insert({
              source: 'self_serve',
              status: 'active',
              family_user_id: session!.user.id,
              ...draft,
            })
            .select()
            .single()
          if (error || !newCase) {
            setBootStatus('error')
            setBootError("We couldn't create your case. Please try the form again.")
            return
          }
          triggerRecommend(newCase.id)
        }
      }
      setBootStatus('done')
      await fetchCase()
    }

    bootstrap().catch((err) => {
      setBootStatus('error')
      setBootError(err instanceof Error ? err.message : 'Something went wrong. Please refresh and try again.')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  if (bootStatus === 'error') {
    return (
      <Layout>
        <h1>Something went wrong</h1>
        <div className="banner banner-error" role="alert">
          {bootError}
        </div>
      </Layout>
    )
  }

  if (fetchError) {
    return (
      <Layout>
        <h1>Something went wrong</h1>
        <div className="banner banner-error" role="alert">
          We couldn't load your case ({fetchError}). Please refresh the page to try again.
        </div>
      </Layout>
    )
  }

  if (bootStatus === 'working' || caseRow === undefined) {
    return (
      <Layout>
        <p className="center-note">Getting things ready…</p>
      </Layout>
    )
  }

  if (!caseRow) {
    return (
      <Layout>
        <h1>We couldn't find a case for your account</h1>
        <p>If you followed an invite link, please try it again. Otherwise, you can start here.</p>
        <a href="/start" className="btn btn-primary">
          Start the questionnaire
        </a>
      </Layout>
    )
  }

  if (caseRow.status === 'pending_review') {
    return <ConfirmationScreen caseRow={caseRow} onConfirmed={setCaseRow} />
  }

  if (caseRow.status === 'active') {
    return <WaitingForRecommendations caseRow={caseRow} onReady={setCaseRow} />
  }

  return <RecommendationsView caseRow={caseRow} />
}

// ---------------------------------------------------------------------------

function ConfirmationScreen({
  caseRow,
  onConfirmed,
}: {
  caseRow: Case
  onConfirmed: (c: Case) => void
}) {
  const [parsed, setParsed] = useState<IntakeDocument['parsed_fields']>(null)
  const [loadingParsed, setLoadingParsed] = useState(true)

  useEffect(() => {
    supabase
      .from('intake_documents')
      .select('parsed_fields')
      .eq('case_id', caseRow.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setParsed((data as { parsed_fields: IntakeDocument['parsed_fields'] } | null)?.parsed_fields ?? null)
        setLoadingParsed(false)
      })
  }, [caseRow.id])

  const val = (key: keyof NonNullable<IntakeDocument['parsed_fields']>, caseValue: string | number | null) => {
    if (caseValue !== null && caseValue !== undefined) return { value: String(caseValue), confidence: 1 }
    const p = parsed?.[key]
    return { value: p?.value != null ? String(p.value) : '', confidence: p?.confidence ?? 0 }
  }

  const [form, setForm] = useState<Record<string, string>>({})
  const [disposition, setDisposition] = useState<DispositionPreference | ''>(caseRow.disposition_preference ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (loadingParsed || initialized) return
    const keys: (keyof NonNullable<IntakeDocument['parsed_fields']>)[] = [
      'legal_first_name',
      'legal_middle_name',
      'legal_last_name',
      'sex',
      'date_of_birth',
      'age_at_death',
      'date_of_death',
      'time_of_death',
      'facility_name',
      'facility_city',
      'facility_state',
      'facility_zip',
      'residence_street',
      'residence_city',
      'residence_state',
      'residence_zip',
      'residence_county',
    ]
    const next: Record<string, string> = {}
    for (const k of keys) {
      next[k] = val(k, (caseRow as unknown as Record<string, string | number | null>)[k]).value
    }
    setForm(next)
    setInitialized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingParsed, initialized])

  function isUncertain(key: keyof NonNullable<IntakeDocument['parsed_fields']>) {
    const caseValue = (caseRow as unknown as Record<string, string | number | null>)[key]
    if (caseValue !== null && caseValue !== undefined) return false
    const c = parsed?.[key]?.confidence ?? 0
    return c > 0 && c < 0.7
  }

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!disposition) return
    setSubmitting(true)
    setSubmitError('')

    const payload: Record<string, string | number | null> = {
      ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() === '' ? null : v.trim()])),
      disposition_preference: disposition,
      status: 'active',
    }
    if (payload.age_at_death) payload.age_at_death = Number(payload.age_at_death)

    const { data, error } = await supabase.from('cases').update(payload).eq('id', caseRow.id).select().single()

    if (error || !data) {
      setSubmitError(error?.message ?? 'Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }
    triggerRecommend(caseRow.id)
    onConfirmed(data as Case)
  }

  if (loadingParsed || !initialized) {
    return (
      <Layout wide>
        <p className="center-note">Loading what we have so far…</p>
      </Layout>
    )
  }

  return (
    <Layout wide>
      <p className="eyebrow">Confirm the details</p>
      <h1>Here's what we have for {decedentName(caseRow) === 'Unnamed case' ? 'your loved one' : decedentName(caseRow)}</h1>
      <p className="lede">
        The hospital shared some information with us. Please look it over and fix anything that's
        missing or wrong — then we'll start finding funeral homes.
      </p>

      <form onSubmit={handleConfirm}>
        <div className="card">
          <h2>About them</h2>
          <div className="field-row">
            <Field label="First name" htmlFor="c-first" uncertain={isUncertain('legal_first_name')}>
              <input id="c-first" value={form.legal_first_name ?? ''} onChange={(e) => update('legal_first_name', e.target.value)} />
            </Field>
            <Field label="Middle name" htmlFor="c-middle" uncertain={isUncertain('legal_middle_name')}>
              <input id="c-middle" value={form.legal_middle_name ?? ''} onChange={(e) => update('legal_middle_name', e.target.value)} />
            </Field>
            <Field label="Last name" htmlFor="c-last" uncertain={isUncertain('legal_last_name')}>
              <input id="c-last" value={form.legal_last_name ?? ''} onChange={(e) => update('legal_last_name', e.target.value)} />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Sex" htmlFor="c-sex" uncertain={isUncertain('sex')}>
              <input id="c-sex" value={form.sex ?? ''} onChange={(e) => update('sex', e.target.value)} placeholder="e.g. F" />
            </Field>
            <Field label="Date of birth" htmlFor="c-dob" uncertain={isUncertain('date_of_birth')}>
              <input id="c-dob" type="date" value={form.date_of_birth ?? ''} onChange={(e) => update('date_of_birth', e.target.value)} />
            </Field>
            <Field label="Age at death" htmlFor="c-age" uncertain={isUncertain('age_at_death')}>
              <input id="c-age" type="number" min={0} value={form.age_at_death ?? ''} onChange={(e) => update('age_at_death', e.target.value)} />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Date of death" htmlFor="c-dod" uncertain={isUncertain('date_of_death')}>
              <input id="c-dod" type="date" value={form.date_of_death ?? ''} onChange={(e) => update('date_of_death', e.target.value)} />
            </Field>
            <Field label="Time of death (optional)" htmlFor="c-tod" uncertain={isUncertain('time_of_death')}>
              <input id="c-tod" type="time" value={form.time_of_death ?? ''} onChange={(e) => update('time_of_death', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="card">
          <h2>Place of death</h2>
          <div className="field-row">
            <Field label="Facility name" htmlFor="c-fac" uncertain={isUncertain('facility_name')}>
              <input id="c-fac" value={form.facility_name ?? ''} onChange={(e) => update('facility_name', e.target.value)} />
            </Field>
            <Field label="City" htmlFor="c-fac-city" uncertain={isUncertain('facility_city')}>
              <input id="c-fac-city" value={form.facility_city ?? ''} onChange={(e) => update('facility_city', e.target.value)} />
            </Field>
          </div>
          <div className="field-row">
            <Field label="State" htmlFor="c-fac-state" uncertain={isUncertain('facility_state')}>
              <input id="c-fac-state" value={form.facility_state ?? ''} onChange={(e) => update('facility_state', e.target.value)} />
            </Field>
            <Field label="Zip" htmlFor="c-fac-zip" uncertain={isUncertain('facility_zip')}>
              <input id="c-fac-zip" value={form.facility_zip ?? ''} onChange={(e) => update('facility_zip', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="card">
          <h2>Residence</h2>
          <Field label="Street" htmlFor="c-res-street" uncertain={isUncertain('residence_street')}>
            <input id="c-res-street" value={form.residence_street ?? ''} onChange={(e) => update('residence_street', e.target.value)} />
          </Field>
          <div className="field-row">
            <Field label="City" htmlFor="c-res-city" uncertain={isUncertain('residence_city')}>
              <input id="c-res-city" value={form.residence_city ?? ''} onChange={(e) => update('residence_city', e.target.value)} />
            </Field>
            <Field label="State" htmlFor="c-res-state" uncertain={isUncertain('residence_state')}>
              <input id="c-res-state" value={form.residence_state ?? ''} onChange={(e) => update('residence_state', e.target.value)} />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Zip" htmlFor="c-res-zip" uncertain={isUncertain('residence_zip')}>
              <input id="c-res-zip" value={form.residence_zip ?? ''} onChange={(e) => update('residence_zip', e.target.value)} />
            </Field>
            <Field label="County" htmlFor="c-res-county" uncertain={isUncertain('residence_county')}>
              <input id="c-res-county" value={form.residence_county ?? ''} onChange={(e) => update('residence_county', e.target.value)} />
            </Field>
          </div>
          <p className="field-hint">We use the zip and county to find funeral homes nearby.</p>
        </div>

        <div className="card">
          <h2>Burial or cremation?</h2>
          <p>Let us know your preference so we only show relevant options.</p>
          <div className="radio-group" role="radiogroup">
            {(
              [
                ['burial', 'Burial'],
                ['cremation', 'Cremation'],
                ['unsure', "I'm not sure yet"],
              ] as [DispositionPreference, string][]
            ).map(([value, label]) => (
              <label key={value} className={`radio-option${disposition === value ? ' is-checked' : ''}`}>
                <input
                  type="radio"
                  name="disposition"
                  checked={disposition === value}
                  onChange={() => setDisposition(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {submitError && (
          <div className="banner banner-error" role="alert">
            {submitError}
          </div>
        )}

        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={submitting || !disposition}>
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" /> Saving…
              </>
            ) : (
              "Looks right — find funeral homes"
            )}
          </button>
        </div>
      </form>
    </Layout>
  )
}

// ---------------------------------------------------------------------------

const STUCK_AFTER_POLLS = 10 // ~60s at the 6s poll interval below

function WaitingForRecommendations({ caseRow, onReady }: { caseRow: Case; onReady: (c: Case) => void }) {
  const [pollCount, setPollCount] = useState(0)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase.from('cases').select('*').eq('id', caseRow.id).maybeSingle()
      if (data && (data as Case).status === 'recommendations_ready') {
        onReady(data as Case)
        return
      }
      setPollCount((n) => n + 1)
    }, 6000)
    return () => clearInterval(interval)
  }, [caseRow.id, onReady])

  function handleRetry() {
    setRetrying(true)
    triggerRecommend(caseRow.id)
    setPollCount(0)
    setTimeout(() => setRetrying(false), 1000)
  }

  return (
    <Layout>
      <div className="center-note">
        <span className="spinner" aria-hidden="true" style={{ width: '1.6em', height: '1.6em' }} />
        <h1 style={{ marginTop: '1.25rem' }}>We're putting together your recommendations</h1>
        <p>
          This usually takes just a minute. You can leave this page open — we'll update it as soon
          as it's ready.
        </p>
        {pollCount >= STUCK_AFTER_POLLS && (
          <div className="banner banner-error" role="alert" style={{ marginTop: '1.5rem', textAlign: 'left' }}>
            <p style={{ margin: 0 }}>
              This is taking longer than expected. You can try again, or reach out and we'll help you
              directly.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: '0.75rem' }}
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? 'Retrying…' : 'Try again'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

// ---------------------------------------------------------------------------

function RecommendationsView({ caseRow }: { caseRow: Case }) {
  const [recs, setRecs] = useState<Recommendation[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('recommendations')
      .select('*, funeral_homes(*)')
      .eq('case_id', caseRow.id)
      .order('rank', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRecs(data as unknown as Recommendation[])
      })
  }, [caseRow.id])

  return (
    <Layout wide>
      <p className="eyebrow">Your recommendations</p>
      <h1>Funeral homes for {decedentName(caseRow) === 'Unnamed case' ? 'your family' : decedentName(caseRow)}</h1>
      <p className="lede">Ranked for you based on location, services, and rating. Take your time.</p>

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}

      {recs === null && !error && <p className="center-note">Loading…</p>}

      {recs?.length === 0 && (
        <div className="card card-quiet">
          <p style={{ margin: 0 }}>
            We couldn't find a matching funeral home nearby yet. Please reach out and we'll help you
            directly.
          </p>
        </div>
      )}

      {recs?.map((r) => (
        <RecommendationCard key={r.id} rec={r} />
      ))}
    </Layout>
  )
}
