import { FormEvent, useMemo, useState } from 'react'
import type { Profile } from '../domain'
import { inviteAtlasMember } from '../lib/memberInvitation'

export default function MemberInvitePanel({ atlasId, profiles }: { atlasId: string; profiles: Profile[] }) {
  const eligibleProfiles = useMemo(() => profiles.filter((profile) => profile.profileKey), [profiles])
  const [profileKey, setProfileKey] = useState(eligibleProfiles[0]?.profileKey || '')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProfile = eligibleProfiles.find((profile) => profile.profileKey === profileKey)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSending || !profileKey) return
    setIsSending(true)
    setError(null)
    setSent(false)
    try {
      await inviteAtlasMember(atlasId, profileKey, email)
      setSent(true)
      setEmail('')
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'The Family Atlas invitation could not be sent.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="migration-panel" aria-labelledby="member-invite-title">
      <p className="auth-eyebrow">Family access</p>
      <h2 id="member-invite-title">Invite a family member</h2>
      <p className="migration-note">Use this when the person already has a profile in this Family Atlas. The invitation links their sign-in to that existing profile; it does not create another person or another Atlas.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="invite-profile">Which profile?</label>
        <select id="invite-profile" value={profileKey} onChange={(event) => { setProfileKey(event.target.value); setSent(false) }} required>
          {eligibleProfiles.map((profile) => <option key={profile.id} value={profile.profileKey}>{profile.name}</option>)}
        </select>
        <label htmlFor="member-email">{selectedProfile?.name || 'Family member'}'s email address</label>
        <input id="member-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setSent(false) }} required />
        <button className="primary-btn" type="submit" disabled={isSending || !profileKey}>
          {isSending ? 'Preparing invitation...' : 'Send invitation'}
        </button>
        {sent && <p role="status">Invitation sent. When they use the sign-in link, it will connect them to the selected existing profile.</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </form>
      <div className="settings-explainer">
        <strong>What about wider family or friends?</strong>
        <p>Someone who does not already have a profile here should not automatically become a member of your inner Family Atlas. Wider-family and trusted-friend access is a separate connection/sharing layer so you can choose what they can see without adding them to the household Atlas.</p>
      </div>
    </section>
  )
}
