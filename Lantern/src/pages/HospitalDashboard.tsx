import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { signOut } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { decedentName, type Case } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'
import { HospitalLayout } from '../components/HospitalLayout'

export function HospitalDashboard() {
  const { session } = useAuth()
  const [cases, setCases] = useState<Case[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    supabase
      .from('cases')
      .select('*')
      .eq('hospital_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setCases(data as Case[])
      })
  }, [session])

  return (
    <HospitalLayout
      headerRight={
        <>
          <span>{session?.user.email}</span>
          <button type="button" className="btn btn-quiet" style={{ color: 'inherit' }} onClick={() => signOut()}>
            Sign out
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem' }}>
        <div>
          <p className="eyebrow">Cases</p>
          <h1 style={{ margin: 0 }}>Hospital dashboard</h1>
        </div>
        <Link to="/hospital/cases/new" className="btn btn-primary">
          New case
        </Link>
      </div>

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}
      {cases === null && !error && <p className="center-note">Loading cases…</p>}

      {cases?.length === 0 && (
        <div className="card card-quiet">
          <p style={{ margin: 0 }}>No cases yet. Create one to get started.</p>
        </div>
      )}

      {cases && cases.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Decedent</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/hospital/cases/${c.id}`}>{decedentName(c)}</Link>
                </td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </HospitalLayout>
  )
}
