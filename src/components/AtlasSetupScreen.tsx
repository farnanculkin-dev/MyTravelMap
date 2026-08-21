import { FormEvent, useState } from 'react'
import type { AtlasType } from '../domain'

export default function AtlasSetupScreen({
  onCreate,
  isCreating,
  error,
  onSignOut,
}: {
  onCreate: (details: { atlasName: string; atlasType: AtlasType; profileName: string }) => void
  isCreating: boolean
  error: string | null
  onSignOut: () => void
}) {
  const [atlasName, setAtlasName] = useState('Culkin Family')
  const [profileName, setProfileName] = useState('Dad')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onCreate({ atlasName: atlasName.trim(), atlasType: 'family', profileName: profileName.trim() })
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="setup-title">
        <div className="auth-toolbar">
          <span>Signed in</span>
          <button className="sign-out-btn" type="button" onClick={onSignOut}>Sign out</button>
        </div>
        <p className="auth-eyebrow">Family Atlas</p>
        <h1 id="setup-title">Set up your Atlas</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <p>Create your private family space. You can add other profiles later.</p>
          <label htmlFor="atlas-name">Atlas name</label>
          <input
            id="atlas-name"
            type="text"
            value={atlasName}
            onChange={(event) => setAtlasName(event.target.value)}
            required
          />
          <label htmlFor="atlas-type">Atlas type</label>
          <select id="atlas-type" value="family" disabled>
            <option value="family">Family</option>
          </select>
          <label htmlFor="profile-name">Your profile name</label>
          <input
            id="profile-name"
            type="text"
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            required
          />
          <button className="primary-btn" type="submit" disabled={isCreating}>
            {isCreating ? 'Creating Atlas...' : 'Create Family Atlas'}
          </button>
          {error && <p className="auth-error" role="alert">{error}</p>}
        </form>
      </section>
    </main>
  )
}