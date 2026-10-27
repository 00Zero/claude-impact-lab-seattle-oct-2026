import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'

export function Home() {
  return (
    <Layout>
      <p className="eyebrow">AgenticLantern</p>
      <h1>We're sorry for your loss.</h1>
      <p className="lede">
        We're here to make one part of this easier: finding a funeral home that's right for your
        family. Answer a few short questions and we'll put together a shortlist for you — no
        pressure, no sales calls.
      </p>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2>Get started</h2>
        <p>It takes about three minutes. You can stop and come back any time.</p>
        <div className="btn-row">
          <Link to="/start" className="btn btn-primary">
            Find a funeral home
          </Link>
          <Link to="/demo" className="btn btn-secondary">
            Try the demo
          </Link>
        </div>
      </div>

      <p style={{ marginTop: '2rem', fontSize: '0.9rem' }}>
        Were you sent a link by a hospital? Open that link directly — it already has your case's
        details ready.
      </p>
    </Layout>
  )
}
