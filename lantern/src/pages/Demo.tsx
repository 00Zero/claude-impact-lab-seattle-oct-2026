import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { RecommendationCard } from '../components/RecommendationCard'
import { DEMO_CASE, DEMO_RECOMMENDATIONS } from '../lib/demoData'
import { formatDate, todayLocal } from '../lib/dates'
import type { Recommendation } from '../lib/types'

const DISPOSITION_LABEL = { burial: 'Burial', cremation: 'Cremation', unsure: "Not sure yet" }

const STEPS = [
  'A hospital uploads the intake paperwork, and we pre-fill what we can.',
  'The family confirms the details on a short review screen.',
  'The family answers five quick questions about their loved one and their needs.',
  'We match them with funeral homes nearby and explain why each one fits.',
]

const TIME_SLOTS = ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM']

interface DemoBooking {
  homeName: string
  date: string
  time: string
}

export function Demo() {
  const [selected, setSelected] = useState<Recommendation | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [booking, setBooking] = useState<DemoBooking | null>(null)

  function chooseHome(rec: Recommendation) {
    setSelected(rec)
    setBooking(null)
    setDate('')
    setTime('')
  }

  function confirmBooking(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !date || !time) return
    setBooking({ homeName: selected.funeral_homes.name, date, time })
  }

  return (
    <Layout wide>
      <p className="eyebrow">Demo</p>
      <h1>See how AgenticLantern works</h1>
      <p className="lede">
        This walkthrough uses a sample family and sample funeral homes. No email, sign-in, or typing
        needed.
      </p>

      <div className="banner banner-info" role="status">
        Everything on this page is example data. Nothing is saved or sent to anyone.
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2>How it works</h2>
        <ol>
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h2>Sample family's answers</h2>
        <dl className="demo-summary">
          <dt>Loved one</dt>
          <dd>{DEMO_CASE.decedentName}</dd>
          <dt>Date of death</dt>
          <dd>{formatDate(DEMO_CASE.dateOfDeath)}</dd>
          <dt>Home zip code</dt>
          <dd>
            {DEMO_CASE.residenceZip} ({DEMO_CASE.residenceCounty} County)
          </dd>
          <dt>Burial or cremation</dt>
          <dd>{DISPOSITION_LABEL[DEMO_CASE.disposition]}</dd>
          <dt>Contact</dt>
          <dd>
            {DEMO_CASE.contactName} ({DEMO_CASE.contactRelationship})
          </dd>
        </dl>
      </div>

      <h2 style={{ marginTop: '2rem' }}>Recommended funeral homes</h2>
      <p className="lede">Ranked for this family based on location, services, and rating.</p>
      {DEMO_RECOMMENDATIONS.map((r) => (
        <RecommendationCard
          key={r.id}
          rec={r}
          action={
            <button
              type="button"
              className={`btn ${selected?.id === r.id ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => chooseHome(r)}
            >
              {selected?.id === r.id ? 'Booking this home' : 'Book a demo visit'}
            </button>
          }
        />
      ))}

      {selected && !booking && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2>Book a visit with {selected.funeral_homes.name}</h2>
          <p>Pick a time for {DEMO_CASE.contactName} to meet the home. This is a demo, so nothing is sent.</p>
          <form onSubmit={confirmBooking}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="demo-date">Date</label>
                <input
                  id="demo-date"
                  type="date"
                  min={todayLocal()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="demo-time">Time</label>
                <select id="demo-time" value={time} onChange={(e) => setTime(e.target.value)}>
                  <option value="">Select a time…</option>
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={!date || !time}>
                Confirm demo booking
              </button>
            </div>
          </form>
        </div>
      )}

      {booking && (
        <div className="banner banner-info" role="status" style={{ marginTop: '1.5rem' }}>
          <strong>Demo booking confirmed.</strong> {DEMO_CASE.contactName} is booked with {booking.homeName} on{' '}
          {formatDate(booking.date)} at {booking.time}. Nothing was sent to the funeral home.{' '}
          <button type="button" className="btn btn-secondary" onClick={() => {
              setSelected(null)
              setBooking(null)
            }}>
            Done
          </button>
        </div>
      )}

      <div className="btn-row">
        <Link to="/start" className="btn btn-primary">
          Find a funeral home for my family
        </Link>
        <Link to="/" className="btn btn-secondary">
          Back to home
        </Link>
      </div>
    </Layout>
  )
}
