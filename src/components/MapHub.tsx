import React, { useState } from 'react'
import MapView from './MapView'
import WorldMapView, { type WorldRegion } from './WorldMapView'
import { TravelRepository } from '../lib/TravelRepository'

type MapMode = 'europe' | WorldRegion

export default function MapHub({
  profile,
  personId,
  profileName,
  defaultMapColor,
  onBack,
  onOpenPlace,
  travelRepo,
  cloudVisited,
  cloudMapColor,
  onSaveVisited,
  onSaveMapColor,
}: {
  profile: string
  personId?: string
  profileName?: string
  defaultMapColor?: string
  onBack: () => void
  onOpenPlace?: (tripId: string, placeId: string) => void
  travelRepo: TravelRepository
  cloudVisited?: string[]
  cloudMapColor?: string
  onSaveVisited?: (visitedCountryIds: string[]) => Promise<void>
  onSaveMapColor?: (color: string) => Promise<void>
}) {
  const [mode, setMode] = useState<MapMode>('europe')
  const shared = { profile, personId, profileName, defaultMapColor, onBack, onOpenPlace, travelRepo, cloudVisited, cloudMapColor, onSaveVisited, onSaveMapColor }

  const choices: Array<{ id: MapMode; label: string }> = [
    { id: 'world', label: 'World' },
    { id: 'europe', label: 'Europe' },
    { id: 'americas', label: 'Americas' },
    { id: 'asia', label: 'Asia' },
    { id: 'africa', label: 'Africa' },
    { id: 'oceania', label: 'Australia & Pacific' },
  ]

  return <>
    <nav className="map-region-nav" aria-label="Map region shortcuts">
      {choices.map((choice) => <button key={choice.id} type="button" className={mode === choice.id ? 'active' : ''} aria-pressed={mode === choice.id} onClick={() => setMode(choice.id)}>{choice.label}</button>)}
    </nav>
    {mode === 'europe' ? <MapView {...shared} /> : <WorldMapView {...shared} region={mode} />}
  </>
}
