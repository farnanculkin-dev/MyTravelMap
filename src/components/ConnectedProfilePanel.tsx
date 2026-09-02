import { useEffect, useMemo, useState } from 'react'
import { loadTrips } from '../lib/TripRuntime'
import { loadConnectedProfile, loadSharedTripsForConnection, setTripSharedWithConnection, type ConnectedProfileSummary, type SharedTripSummary } from '../lib/SharingRuntime'
import type { Trip } from '../domain'

function dateLabel(trip: SharedTripSummary | Trip) {
  if (trip.startDate && trip.endDate) return `${trip.startDate} – ${trip.endDate}`
  return trip.startDate || trip.endDate || 'Date not added'
}

export default function ConnectedProfilePanel({ atlasId, connectionId, onBack }: { atlasId: string; connectionId: string; onBack: () => void }) {
  const [profile, setProfile] = useState<ConnectedProfileSummary | null>(null)
  const [sharedTrips, setSharedTrips] = useState<SharedTripSummary[]>([])
  const [atlasTrips, setAtlasTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTripId, setSavingTripId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const [nextProfile, nextSharedTrips, nextAtlasTrips] = await Promise.all([
      loadConnectedProfile(connectionId),
      loadSharedTripsForConnection(connectionId),
      loadTrips(atlasId),
    ])
    setProfile(nextProfile); setSharedTrips(nextSharedTrips); setAtlasTrips(nextAtlasTrips)
  }

  useEffect(() => {
    let mounted = true
    setLoading(true); setError(null)
    Promise.all([loadConnectedProfile(connectionId), loadSharedTripsForConnection(connectionId), loadTrips(atlasId)])
      .then(([nextProfile, nextSharedTrips, nextAtlasTrips]) => { if (mounted) { setProfile(nextProfile); setSharedTrips(nextSharedTrips); setAtlasTrips(nextAtlasTrips) } })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Connected profile could not be loaded.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [atlasId, connectionId])

  const sharedIds = useMemo(() => new Set(sharedTrips.map((trip) => trip.tripId)), [sharedTrips])

  async function toggleTrip(tripId: string) {
    const currentlyShared = sharedIds.has(tripId)
    setSavingTripId(tripId); setError(null)
    try {
      await setTripSharedWithConnection(tripId, connectionId, !currentlyShared)
      await refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Trip sharing could not be updated.') }
    finally { setSavingTripId(null) }
  }

  if (loading) return <section className="settings-card">Loading connected profile…</section>
  if (error && !profile) return <section className="settings-card"><button className="back-btn" onClick={onBack}>← Connections</button><p className="auth-error">{error}</p></section>
  if (!profile) return <section className="settings-card"><button className="back-btn" onClick={onBack}>← Connections</button><p className="auth-error">Connected profile not found.</p></section>

  const relationship = profile.relationshipLabel || (profile.connectionType === 'friend' ? 'Friend' : profile.connectionType === 'family' ? 'Connected family' : 'Relative')
  return <section className="connected-profile-view">
    <button className="back-btn" type="button" onClick={onBack}>← Connections</button>
    <div className="connected-profile-hero">
      <div className="connected-avatar" aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</div>
      <div><p className="auth-eyebrow">Connected profile</p><h2>{profile.displayName}</h2><p>{relationship} · {profile.status === 'connected' ? 'Connected' : 'Not connected yet'}</p></div>
    </div>

    <div className="connected-profile-section">
      <h3>Share trips with {profile.displayName}</h3>
      <p className="trip-form-help">Choose individual trips. Their account will not gain access to your whole Family Atlas, map or other trips.</p>
      {atlasTrips.length === 0 ? <p>No trips to share yet.</p> : <div className="connection-trip-picker">{atlasTrips.map((trip) => <label key={trip.id}><input type="checkbox" checked={sharedIds.has(trip.id)} disabled={savingTripId === trip.id || profile.status !== 'connected'} onChange={() => void toggleTrip(trip.id)} /><span><strong>{trip.title}</strong><small>{dateLabel(trip)}</small></span></label>)}</div>}
      {profile.status !== 'connected' && <p className="trip-form-help">Trip sharing becomes available after the invitation is accepted.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>

    <div className="connected-profile-section">
      <h3>Currently shared</h3>
      <p className="trip-form-help">This is the exact travel information currently visible to {profile.displayName}. Memories and photos remain private for now.</p>
      {sharedTrips.length === 0 ? <div className="timeline-empty"><h4>No trips shared yet</h4><p>Select a trip above when you want to share it.</p></div> : <div className="shared-trip-grid">{sharedTrips.map((trip) => <article className="shared-trip-card" key={trip.tripId}><p className="auth-eyebrow">Shared trip</p><h4>{trip.title}</h4><p className="trip-dates">{dateLabel(trip)}</p>{trip.description && <p>{trip.description}</p>}</article>)}</div>}
    </div>
  </section>
}
