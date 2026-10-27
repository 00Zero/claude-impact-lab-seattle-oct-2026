import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'

export function FuneralHomeWip() {
  return (
    <Layout variant="funeral">
      <p className="eyebrow">Funeral home portal</p>
      <h1>Coming soon</h1>
      <p className="lede">
        This is where funeral homes will receive referrals from AgenticLantern and manage their
        side of the flow. It's still a work in progress.
      </p>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2>Planned flow</h2>
        <ol>
          <li>Funeral home signs up and lists its services, pricing, and coverage area.</li>
          <li>Matching families are referred to them with the case details they've agreed to share.</li>
          <li>The home confirms availability and follows up directly with the family.</li>
        </ol>
        <Link to="/" className="btn btn-secondary">
          Back to home
        </Link>
      </div>
    </Layout>
  )
}
