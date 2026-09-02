import React, { useState } from 'react'
import WorldMapView, { type WorldRegion } from './WorldMapView'
import { TravelRepository } from '../lib/TravelRepository'

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
  const [mode, setMode] = useState<WorldRegion>('world')
  const shared = { profile, personId, profileName, defaultMapColor, onBack, onOpenPlace, travelRepo, cloudVisited, cloudMapColor, onSaveVisited, onSaveMapColor }

  const choices: Array<{ id: WorldRegion; label: string }> = [
    { id: 'world', label: 'World' },
    { id: 'europe', label: 'Europe' },
    { id: 'northAmerica', label: 'North America' },
    { id: 'southAmerica', label: 'South America' },
    { id: 'asia', label: 'Asia' },
    { id: 'africa', label: 'Africa' },
    { id: 'oceania', label: 'Australia & Pacific' },
  ]

  return <>
    <nav className="map-region-nav" aria-label="Map region shortcuts">
      {choices.map((choice) => <button key={choice.id} type="button" className={mode === choice.id ? 'active' : ''} aria-pressed={mode === choice.id} onClick={() => setMode(choice.id)}>{choice.label}</button>)}
    </nav>
    <WorldMapView {...shared} region={mode} />
  </>
}
