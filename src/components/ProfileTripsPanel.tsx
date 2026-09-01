import React, { useEffect, useMemo, useState } from 'react'
import type { Trip } from '../domain'
import countries from '../data/countries.json'
import { loadTrips } from '../lib/TripRuntime'

type Country = { id: string; name: string }
const countryNames = new Map((countries as Country[]).map((country) => [country.id, country.name]))

function tripDateLabel(trip: Trip): string {
  if (trip.startDate && trip.endDate) return `${trip.startDate} – ${trip.endDate}`
  if (trip.startDate) return trip.startDate
  if (trip.endDate) return `Until ${trip.endDate}`
  return 'Date not added yet'
}

export default function ProfileTripsPanel({ atlasId, personId, personName, onOpenTrip, onAddTrip }: {
  atlasId: string
  personId?: string
  personName: string
  onOpenTrip: (tripId: string) => void
  onAddTrip?: (personId: string) => void
}) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    loadTrips(atlasId)
      .then((loadedTrips) => { if (mounted) setTrips(loadedTrips) })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Trips could not be loaded.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [atlasId])

  const profileTrips = useMemo(() => {
    if (!personId) return []
    return trips.filter((trip) => trip.ownerPersonId === personId || trip.participantIds.includes(personId))
  }, [personId, trips])

  return (
    <section className="profile-trips-panel" aria-label={`${personName}'s trips`}>
      <div className="trips-title profile-trips-title">
        <p className="auth-eyebrow">Travel history</p>
        <div className="profile-trips-heading"><h2>{personName}’s Trips</h2>{personId&&onAddTrip&&<button className="primary-btn" type="button" onClick={()=>onAddTrip(personId)}>+ Add Trip</button>}</div>
        <p>Trips that {personName} took part in appear here, whether they were family holidays, solo journeys or trips with other people.</p>
      </div>
      {error && <p className="auth-error trip-error" role="alert">{error}</p>}
      {loading ? <p className="trips-empty">Loading trips…</p> : !personId ? <p className="trips-empty">This profile is not linked to a Person identity yet.</p> : profileTrips.length === 0 ? (
        <section className="trips-empty-card"><h3>No trips recorded yet</h3><p>Trips will appear here automatically when {personName} is included as a participant.</p>{onAddTrip&&<button className="primary-btn" type="button" onClick={()=>onAddTrip(personId)}>+ Add {personName}’s first trip</button>}</section>
      ) : (
        <section className="trip-grid" aria-label={`${personName}'s trip list`}>
          {profileTrips.map((trip) => (
            <button className="trip-card" key={trip.id} type="button" onClick={() => onOpenTrip(trip.id)} aria-label={`Open ${trip.title}`}>
              <span className="trip-card-label">{trip.visibility === 'private' ? 'Private trip' : 'Family trip'}</span>
              <strong>{trip.title}</strong>
              <span>{tripDateLabel(trip)}</span>
              {trip.countryIds.length > 0 && <span>{trip.countryIds.map((id) => countryNames.get(id) || id).join(' · ')}</span>}
              <span className="trip-card-people">{trip.participantNames.join(', ')}</span>
              <span className="trip-card-link">Open trip →</span>
            </button>
          ))}
        </section>
      )}
    </section>
  )
}
