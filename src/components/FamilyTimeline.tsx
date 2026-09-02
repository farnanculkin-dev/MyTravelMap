import React, { useEffect, useMemo, useState } from 'react'
import countries from '../data/countries.json'
import type { Trip } from '../domain'
import { loadTrips } from '../lib/TripRuntime'

const countryNames = new Map((countries as { id: string; name: string }[]).map((country) => [country.id, country.name]))

function displayDate(value?: string) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function tripYear(trip: Trip) {
  const source = trip.startDate || trip.endDate || trip.createdAt
  const year = source ? new Date(source).getFullYear() : new Date().getFullYear()
  return Number.isFinite(year) ? year : new Date().getFullYear()
}

export default function FamilyTimeline({ atlasId, onOpenTrip, onAddTrip }: { atlasId: string; onOpenTrip: (tripId: string) => void; onAddTrip: () => void }) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    loadTrips(atlasId)
      .then((items) => { if (mounted) setTrips(items) })
      .catch((timelineError: unknown) => { if (mounted) setError(timelineError instanceof Error ? timelineError.message : 'Trips could not be loaded.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [atlasId])

  const grouped = useMemo(() => {
    const groups = new Map<number, Trip[]>()
    trips.forEach((trip) => {
      const year = tripYear(trip)
      groups.set(year, [...(groups.get(year) || []), trip])
    })
    return [...groups.entries()].sort((a, b) => b[0] - a[0])
  }, [trips])

  return <main className="timeline-screen">
    <div className="timeline-title-row">
      <div className="timeline-title">
        <p className="auth-eyebrow">Family Atlas</p>
        <h1>My Trips</h1>
        <p>Your journeys in date order — a growing record of the places, trips and memories you share.</p>
      </div>
      <button className="primary-btn timeline-add-btn" type="button" onClick={onAddTrip}>+ Add trip</button>
    </div>

    {loading ? <p role="status">Loading your trips…</p> : null}
    {error ? <p className="auth-error" role="alert">{error}</p> : null}
    {!loading && !error && trips.length === 0 ? <section className="timeline-empty"><h2>Your travel story starts here</h2><p>Add a recent holiday or a trip from years ago. It will appear here automatically.</p><button className="primary-btn" type="button" onClick={onAddTrip}>+ Add your first trip</button></section> : null}

    <div className="timeline-years">
      {grouped.map(([year, yearTrips]) => <section className="timeline-year" key={year}>
        <h2>{year}</h2>
        <div className="timeline-items">
          {yearTrips.map((trip) => {
            const locations = trip.countryIds.map((id) => countryNames.get(id) || id).join(' · ')
            const dates = trip.startDate && trip.endDate
              ? `${displayDate(trip.startDate)} – ${displayDate(trip.endDate)}`
              : displayDate(trip.startDate || trip.endDate)
            return <button className="timeline-card" key={trip.id} type="button" onClick={() => onOpenTrip(trip.id)}>
              {trip.coverPhotoUrl ? <img src={trip.coverPhotoUrl} alt="" /> : <div className="timeline-card-placeholder" aria-hidden="true">✈</div>}
              <div className="timeline-card-copy">
                <h3>{trip.title}</h3>
                {dates ? <p className="timeline-card-date">{dates}</p> : null}
                {locations ? <p>{locations}</p> : null}
                {trip.participantNames.length ? <p className="timeline-card-people">{trip.participantNames.join(', ')}</p> : null}
              </div>
            </button>
          })}
        </div>
      </section>)}
    </div>
  </main>
}
