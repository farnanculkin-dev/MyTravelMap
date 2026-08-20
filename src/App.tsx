import React, { useEffect, useState } from 'react'
import HomeProfiles from './components/HomeProfiles'
import MapView from './components/MapView'
import { LocalStorageTravelRepository } from './lib/LocalStorageTravelRepository'
import { TravelRepository } from './lib/TravelRepository'
import type { ProfileId } from './domain'
import { CUSTOMER_ZERO_ATLAS, CUSTOMER_ZERO_PROFILES, isCustomerZeroProfileId } from './data/customerZero'
import { LocalSeedAtlasRepository, LocalSeedProfileRepository } from './lib/LocalSeedRepositories'

const travelRepo: TravelRepository = new LocalStorageTravelRepository()
const atlasRepo = new LocalSeedAtlasRepository(CUSTOMER_ZERO_ATLAS)
const profileRepo = new LocalSeedProfileRepository(CUSTOMER_ZERO_PROFILES)
const atlas = atlasRepo.getAtlas(CUSTOMER_ZERO_ATLAS.id)!
const profiles = profileRepo.getProfiles(atlas.id)

export default function App() {
  const [profile, setProfile] = useState<ProfileId | null>(null)

  // Initialize profile from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlProfile = params.get('profile')
    if (urlProfile && isCustomerZeroProfileId(urlProfile)) {
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
        <HomeProfiles profiles={profiles} onSelect={handleSelectProfile} />
      ) : (
        <MapView
          profile={profile}
          defaultMapColor={profiles.find((current) => current.id === profile)?.mapColour}
          onBack={handleBack}
          travelRepo={travelRepo}
        />
      )}
    </div>
  )
}
