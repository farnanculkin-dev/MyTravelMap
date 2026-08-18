import React from 'react'
import type { ProfileId } from '../App'

export default function HomeProfiles({ onSelect }: { onSelect: (p: ProfileId) => void }) {
  const profiles: { id: ProfileId; label: string }[] = [
    { id: 'mum', label: 'Mum' },
    { id: 'dad', label: 'Dad' },
    { id: 'amelia', label: 'Amelia' },
    { id: 'dylan', label: 'Dylan' },
    { id: 'cian', label: 'Cian' },
  ]

  return (
    <main className="home">
      <h1>Our Family Travel Map</h1>
      <div className="profiles">
        {profiles.map((p) => (
          <button key={p.id} className="profile-btn" onClick={() => onSelect(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="hint">Tap a profile to view and edit their travel map.</p>
    </main>
  )
}
