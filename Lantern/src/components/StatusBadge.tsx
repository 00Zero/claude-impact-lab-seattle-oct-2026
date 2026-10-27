import type { CaseStatus } from '../lib/types'

const LABELS: Record<CaseStatus, string> = {
  pending_review: 'Pending review',
  active: 'Active',
  recommendations_ready: 'Recommendations ready',
}

const COLORS: Record<CaseStatus, string> = {
  pending_review: '#b45309',
  active: '#1d4ed8',
  recommendations_ready: '#15803d',
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className="status-badge"
      style={{
        color: COLORS[status],
        border: `1px solid ${COLORS[status]}`,
        background: 'transparent',
      }}
    >
      {LABELS[status]}
    </span>
  )
}
