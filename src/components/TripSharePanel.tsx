import { useEffect, useState } from 'react'
import { loadAtlasConnections, type AtlasConnection } from '../lib/ConnectionRuntime'
import { loadTripShareConnectionIds, setTripSharedWithConnection } from '../lib/SharingRuntime'

export default function TripSharePanel({ atlasId, tripId }: { atlasId: string; tripId: string }) {
  const [connections, setConnections] = useState<AtlasConnection[]>([])
  const [sharedIds, setSharedIds] = useState<string[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([loadAtlasConnections(atlasId), loadTripShareConnectionIds(tripId)])
      .then(([allConnections, ids]) => {
        if (!mounted) return
        setConnections(allConnections.filter((connection) => connection.status === 'connected'))
        setSharedIds(ids)
      })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Sharing options could not be loaded.') })
    return () => { mounted = false }
  }, [atlasId, tripId])

  async function toggle(connectionId: string) {
    const currentlyShared = sharedIds.includes(connectionId)
    setSavingId(connectionId); setError(null)
    try {
      await setTripSharedWithConnection(tripId, connectionId, !currentlyShared)
      setSharedIds((current) => currentlyShared ? current.filter((id) => id !== connectionId) : [...current, connectionId])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Trip sharing could not be updated.') }
    finally { setSavingId(null) }
  }

  return <section className="trip-detail-section trip-share-panel">
    <h2>Share trip</h2>
    <p className="trip-form-help">Choose connected people who may see this trip. This does not share your whole Family Atlas, map, memories or photo library.</p>
    {connections.length === 0 ? <p>No connected people yet. Connections become shareable after they accept their invitation.</p> : <div className="trip-share-list">{connections.map((connection) => <label key={connection.id}><input type="checkbox" checked={sharedIds.includes(connection.id)} disabled={savingId === connection.id} onChange={() => void toggle(connection.id)} /><span><strong>{connection.displayName}</strong>{connection.relationshipLabel && <small>{connection.relationshipLabel}</small>}</span></label>)}</div>}
    {error && <p className="auth-error" role="alert">{error}</p>}
  </section>
}
