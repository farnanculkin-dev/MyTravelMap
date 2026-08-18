import React, { useState } from 'react'
import HomeProfiles from './components/HomeProfiles'
import MapView from './components/MapView'
import { LocalStorageTravelRepository } from './lib/LocalStorageTravelRepository'
import { TravelRepository } from './lib/TravelRepository'

const travelRepo: TravelRepository = new LocalStorageTravelRepository()

export type ProfileId = 'mum' | 'dad' | 'amelia' | 'dylan' | 'cian'

export default function App() {
  const [profile, setProfile] = useState<ProfileId | null>(null)

  return (
    <div className="app">
      {!profile ? (
        <HomeProfiles onSelect={(p) => setProfile(p)} />
      ) : (
        <MapView profile={profile} onBack={() => setProfile(null)} travelRepo={travelRepo} />
      )}
    </div>
  )
}
