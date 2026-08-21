import { FormEvent, useState } from 'react'
import { inviteMum } from '../lib/memberInvitation'

export default function MemberInvitePanel({ atlasId }: { atlasId: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSending || sent) return
    setIsSending(true)
    setError(null)
    try {
      await inviteMum(atlasId, email)
      setSent(true)
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'The Mum invitation could not be sent.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="migration-panel" aria-labelledby="member-invite-title">
      <p className="auth-eyebrow">Administrator tool</p>
      <h2 id="member-invite-title">Invite Mum</h2>
      <p className="migration-note">This links the existing Mum profile. It does not create another profile or Atlas.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="mum-email">Mum's email address</label>
        <input id="mum-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={sent} />
        <button className="primary-btn" type="submit" disabled={isSending || sent}>
          {isSending ? 'Preparing invitation...' : sent ? 'Invitation sent' : 'Send invitation'}
        </button>
        {sent && <p role="status">A Family Atlas sign-in link was sent. Mum can use it to link the existing profile.</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </form>
    </section>
  )
}