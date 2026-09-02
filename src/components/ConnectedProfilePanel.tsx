import { useEffect, useState } from 'react'
import { loadConnectedProfile, loadSharedTripsForConnection, type ConnectedProfileSummary, type SharedTripSummary } from '../lib/SharingRuntime'

function dateLabel(trip: SharedTripSummary) {
  if (trip.startDate && trip.endDate) return `${trip.startDate} – ${trip.endDate}`
  return trip.startDate || trip.endDate || 'Date not added'
}

export default function ConnectedProfilePanel({ connectionId, onBack }: { connectionId: string; onBack: () => void }) {
  const [profile, setProfile] = useState<ConnectedProfileSummary | null>(null)
  const [trips, setTrips] = useState<SharedTripSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true); setError(null)
    Promise.all([loadConnectedProfile(connectionId), loadSharedTripsForConnection(connectionId)])
      .then(([nextProfile, nextTrips]) => { if (mounted) { setProfile(nextProfile); setTrips(nextTrips) } })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Connected profile could not be loaded.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [connectionId])

  if (loading) return <section className="settings-card">Loading connected profile…</section>
  if (error || !profile) return <section className="settings-card"><button className="back-btn" onClick={onBack}>← Connections</button><p className="auth-error">{error || 'Connected profile not found.'}</p></section>

  const relationship = profile.relationshipLabel || (profile.connectionType === 'friend' ? 'Friend' : profile.connectionType === 'family' ? 'Connected family' : 'Relative')
  return <section className="connected-profile-view">
    <button className="back-btn" type="button" onClick={onBack}>← Connections</button>
    <div className="connected-profile-hero">
      <div className="connected-avatar" aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</div>
      <div><p className="auth-eyebrow">Connected profile</p><h2>{profile.displayName}</h2><p>{relationship} · {profile.status === 'connected' ? 'Connected' : 'Not connected yet'}</p></div>
    </div>
    <div className="connected-profile-section">
      <h3>Shared trips</h3>
      <p className="trip-form-help">Only trips deliberately shared with this connection appear here. Memories, photos and the full Atlas stay private unless we explicitly add sharing for them later.</p>
      {trips.length === 0 ? <div className="timeline-empty"><h4>No trips shared yet</h4><p>Open one of your trips and use “Share trip” to make it visible to {profile.displayName}.</p></div> : <div className="shared-trip-grid">{trips.map((trip) => <article className="shared-trip-card" key={trip.tripId}><p className="auth-eyebrow">Shared trip</p><h4>{trip.title}</h4><p className="trip-dates">{dateLabel(trip)}</p>{trip.description && <p>{trip.description}</p>}</article>)}</div>}
    </div>
  </section>
}
