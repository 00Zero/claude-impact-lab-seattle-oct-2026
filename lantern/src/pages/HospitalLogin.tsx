import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { signOut } from '../lib/auth'
import { useAuth } from '../context/AuthContext'
import { HospitalLayout } from '../components/HospitalLayout'

export function HospitalLogin() {
  const { session, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setSubmitting(false)
  }

  if (loading) return <HospitalLayout><p className="center-note">Loading…</p></HospitalLayout>
  if (session && profile?.role === 'hospital') return <Navigate to="/hospital/dashboard" replace />
  const notStaff = Boolean(session && profile && profile.role !== 'hospital')

  return (
    <HospitalLayout>
      <div className="page-narrow" style={{ margin: '2rem auto 0', maxWidth: 420, padding: 0 }}>
        <p className="eyebrow">Hospital Portal</p>
        <h1>Sign in</h1>
        <p>Sign in with your hospital staff account.</p>
        <div className="card" style={{ background: 'var(--primary-soft)', border: '1px solid var(--border)', marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Demo credentials</p>
          <p style={{ margin: '0.25rem 0 0' }}>Email: <code>demo.hospital@agenticlantern.test</code></p>
          <p style={{ margin: '0.25rem 0 0' }}>Password: <code>Lantern-Demo-2026!</code></p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="hl-email">Email</label>
              <input id="hl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="hl-password">Password</label>
              <input id="hl-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {notStaff && (
              <p className="error-text" role="alert">
                This browser is signed in with a family account.{' '}
                <button type="button" className="btn btn-quiet" onClick={() => signOut()}>
                  Sign out
                </button>{' '}
                to continue as hospital staff.
              </p>
            )}
            {error && <p className="error-text" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </HospitalLayout>
  )
}
