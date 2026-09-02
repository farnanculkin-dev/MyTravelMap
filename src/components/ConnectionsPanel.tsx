import { FormEvent, useEffect, useState } from 'react'
import { createAtlasConnection, inviteAtlasConnection, loadAtlasConnections, type AtlasConnection } from '../lib/ConnectionRuntime'

export default function ConnectionsPanel({ atlasId }: { atlasId: string }) {
  const [connections, setConnections] = useState<AtlasConnection[]>([])
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [type, setType] = useState<AtlasConnection['connectionType']>('relative')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function refresh() {
    try { setConnections(await loadAtlasConnections(atlasId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Connections could not be loaded.') }
  }

  useEffect(() => { void refresh() }, [atlasId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !name.trim()) return
    setSaving(true); setError(null); setMessage(null)
    try {
      const created = await createAtlasConnection({ atlasId, displayName: name, relationshipLabel: relationship, connectionType: type, email })
      if (email.trim()) {
        await inviteAtlasConnection(created.connectionId, email)
        setMessage(`${name.trim()} was added and an invitation email was sent.`)
      } else {
        setMessage(`${name.trim()} was added. You can include them on trips now and invite them later.`)
      }
      setName(''); setRelationship(''); setType('relative'); setEmail('')
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connection could not be added.')
    } finally { setSaving(false) }
  }

  async function handleInvite(connection: AtlasConnection) {
    const address = window.prompt(`Email address for ${connection.displayName}`, connection.email || '')?.trim()
    if (!address) return
    setError(null); setMessage(null)
    try {
      await inviteAtlasConnection(connection.id, address)
      setMessage(`Invitation sent to ${connection.displayName}.`)
      await refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invitation could not be sent.') }
  }

  return <section className="settings-card connections-card" aria-labelledby="connections-title">
    <p className="auth-eyebrow">Trusted circle</p>
    <h2 id="connections-title">People & Connections</h2>
    <p>Add grandparents, brothers, sisters, wider family or friends without putting them inside your household profile row. They can be reused on trips immediately; an email invitation can connect their own account later.</p>

    <form className="connection-form" onSubmit={handleSubmit}>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Grandad" required /></label>
      <label>Relationship <span>(optional)</span><input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="e.g. Dad, sister, family friend" /></label>
      <label>Connection type<select value={type} onChange={(event) => setType(event.target.value as AtlasConnection['connectionType'])}><option value="relative">Relative</option><option value="family">Connected family</option><option value="friend">Friend</option></select></label>
      <label>Email <span>(optional)</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Invite now, or leave blank" /></label>
      <button className="primary-btn" type="submit" disabled={saving || !name.trim()}>{saving ? 'Adding…' : '+ Add connection'}</button>
    </form>

    {message && <p className="connection-message" role="status">{message}</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}

    <div className="connections-list">
      {connections.length === 0 ? <p className="trip-form-help">No wider connections added yet.</p> : connections.map((connection) => <article key={connection.id} className="connection-row">
        <div><strong>{connection.displayName}</strong><span>{connection.relationshipLabel || (connection.connectionType === 'friend' ? 'Friend' : connection.connectionType === 'family' ? 'Connected family' : 'Relative')}</span></div>
        <span className={`connection-status ${connection.status}`}>{connection.status === 'connected' ? 'Connected' : connection.status === 'invited' ? 'Invited' : 'Saved'}</span>
        {connection.status !== 'connected' && <button className="secondary-btn" type="button" onClick={() => void handleInvite(connection)}>{connection.status === 'invited' ? 'Resend invite' : 'Invite'}</button>}
      </article>)}
    </div>
  </section>
}
