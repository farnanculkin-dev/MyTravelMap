import React, { useEffect, useState } from 'react'
import HomeProfiles from './components/HomeProfiles'
import MapView from './components/MapView'
import { LocalStorageTravelRepository } from './lib/LocalStorageTravelRepository'
import { TravelRepository } from './lib/TravelRepository'

const travelRepo: TravelRepository = new LocalStorageTravelRepository()

export type ProfileId = 'mum' | 'dad' | 'amelia' | 'dylan' | 'cian'

const VALID_PROFILES: ProfileId[] = ['mum', 'dad', 'amelia', 'dylan', 'cian']

export default function App() {
  const [profile, setProfile] = useState<ProfileId | null>(null)

  // Initialize profile from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlProfile = params.get('profile')
    if (urlProfile && VALID_PROFILES.includes(urlProfile as ProfileId)) {
      setProfile(urlProfile as ProfileId)
    }
  }, [])

  // Update URL when profile changes
  const handleSelectProfile = (p: ProfileId) => {
    setProfile(p)
    window.history.pushState({}, '', `?profile=${p}`)
  }

  const handleBack = () => {
    setProfile(null)
    window.history.pushState({}, '', window.location.pathname)
  }

  return (
    <div className="app">
      {!profile ? (
        <HomeProfiles onSelect={handleSelectProfile} />
      ) : (
        <MapView profile={profile} onBack={handleBack} travelRepo={travelRepo} />
      )}
    </div>
  )
}
