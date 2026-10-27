import type { ReactNode } from 'react'
import type { Recommendation } from '../lib/types'

export function RecommendationCard({ rec, action }: { rec: Recommendation; action?: ReactNode }) {
  return (
    <div className="home-card">
      <div className="home-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="home-card-rank">{rec.rank}</span>
          <h3 className="home-card-name">{rec.funeral_homes.name}</h3>
        </div>
        {rec.funeral_homes.rating != null && <span>★ {rec.funeral_homes.rating.toFixed(1)}</span>}
      </div>
      <div className="home-card-meta">
        {rec.funeral_homes.county && <span>{rec.funeral_homes.county}</span>}
        {rec.funeral_homes.price_cremation != null && <span>Cremation from ${rec.funeral_homes.price_cremation}</span>}
        {rec.funeral_homes.price_burial != null && <span>Burial from ${rec.funeral_homes.price_burial}</span>}
        {rec.funeral_homes.phone && <span>{rec.funeral_homes.phone}</span>}
      </div>
      <p className="home-card-rationale">{rec.rationale}</p>
      {action && <div className="btn-row">{action}</div>}
    </div>
  )
}
