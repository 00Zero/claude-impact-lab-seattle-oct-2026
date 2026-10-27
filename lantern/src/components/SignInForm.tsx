import { useState } from 'react'
import { sendMagicLink, type Role } from '../lib/auth'
import { Field } from './Field'

export function SignInForm({
  role,
  redirectTo,
  initialEmail = '',
  lockEmail = false,
  submitLabel = 'Send sign-in link',
}: {
  role: Role
  redirectTo?: string
  initialEmail?: string
  lockEmail?: boolean
  submitLabel?: string
}) {
  const [email, setEmail] = useState(initialEmail)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      await sendMagicLink(email, role, redirectTo)
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  if (status === 'sent') {
    return (
      <div className="banner banner-info" role="status">
        We sent a link to <strong>{email}</strong>. Open it on this device to continue — no password
        needed.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Email address" htmlFor="signin-email">
        <input
          id="signin-email"
          type="email"
          required
          readOnly={lockEmail}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <button type="submit" className="btn btn-primary btn-block" disabled={status === 'sending'}>
        {status === 'sending' ? (
          <>
            <span className="spinner" aria-hidden="true" /> Sending…
          </>
        ) : (
          submitLabel
        )}
      </button>
      {status === 'error' && <p className="error-text" role="alert">{errorMessage}</p>}
    </form>
  )
}
