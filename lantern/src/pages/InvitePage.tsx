import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { SignInForm } from '../components/SignInForm'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { stashInviteToken } from '../lib/familyOnboarding'

type LookupState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'valid'; contactEmail: string }

interface InviteTokenLookupRow {
  valid: boolean
  contact_email: string
  case_id: string
}

export function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { session, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [lookup, setLookup] = useState<LookupState>({ status: 'loading' })

  useEffect(() => {
    if (!token) return
    supabase
      .rpc('invite_token_lookup', { p_token: token })
      .single<InviteTokenLookupRow>()
      .then(({ data, error }) => {
        if (error || !data || !data.valid) {
          setLookup({ status: 'invalid' })
        } else {
          setLookup({ status: 'valid', contactEmail: data.contact_email })
        }
      })
  }, [token])

  if (!token || lookup.status === 'invalid') {
    return (
      <Layout>
        <h1>This link isn't active</h1>
        <p>
          It may have already been used, or it's expired. Please contact the hospital that sent it
          and ask them to resend your invite — it only takes them a moment.
        </p>
      </Layout>
    )
  }

  if (lookup.status === 'loading' || authLoading) {
    return (
      <Layout>
        <p className="center-note">Checking your invite…</p>
      </Layout>
    )
  }

  const alreadySignedInAsRecipient =
    session && profile?.role === 'family' && session.user.email?.toLowerCase() === lookup.contactEmail.toLowerCase()

  if (alreadySignedInAsRecipient) {
    return (
      <Layout>
        <h1>Welcome back</h1>
        <p>You're already signed in as {session!.user.email}.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            stashInviteToken(token!)
            navigate('/case')
          }}
        >
          Continue to your case
        </button>
      </Layout>
    )
  }

  return (
    <Layout>
      <p className="eyebrow">You've been invited</p>
      <h1>Let's get you signed in</h1>
      <p className="lede">
        A hospital shared some details with us to help find the right funeral home. Confirm your
        email below and we'll send you a secure link — no password needed.
      </p>
      <div className="card">
        <SignInForm
          role="family"
          lockEmail
          initialEmail={lookup.contactEmail}
          redirectTo={`${window.location.origin}/case`}
          submitLabel="Send my sign-in link"
        />
      </div>
      {/* Stash the token as soon as we know the invite is valid, so the sign-in
          redirect (which may land in a different tab/session) can redeem it. */}
      <TokenStasher token={token!} />
    </Layout>
  )
}

function TokenStasher({ token }: { token: string }) {
  useEffect(() => {
    stashInviteToken(token)
  }, [token])
  return null
}
