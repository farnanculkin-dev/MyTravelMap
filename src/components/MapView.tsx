import React, { useEffect, useState } from 'react'
import type { ProfileId } from '../App'
import { TravelRepository } from '../lib/TravelRepository'
import countries from '../data/countries.json'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function MapView({
  profile,
  onBack,
  travelRepo,
}: {
  profile: ProfileId
  onBack: () => void
  travelRepo: TravelRepository
}) {
  const [visited, setVisited] = useState<Set<string>>(new Set())

  useEffect(() => {
    const v = new Set(travelRepo.getVisited(profile))
    setVisited(v)
  }, [profile])

  function toggleCountry(countryId: string) {
    const next = new Set(visited)
    if (next.has(countryId)) next.delete(countryId)
    else next.add(countryId)
    setVisited(next)
    travelRepo.setVisited(profile, Array.from(next))
  }

  return (
    <div className="map-view">
      <header className="map-header">
        <button className="back-btn" onClick={onBack} aria-label="Back to profiles">
          ← Back
        </button>
        <h2>{profile.charAt(0).toUpperCase() + profile.slice(1)}’s Map</h2>
        <div className="visited-count">Countries visited: {visited.size}</div>
      </header>

      <div className="map-container">
        {/* Placeholder SVG map: each country is a small rectangle. Replace this file with a real SVG/TopoJSON export for accurate geometry. */}
        <svg viewBox="0 0 1000 800" className="svg-map" role="img" aria-label="Europe map">
          {countries.map((c, i) => {
            const cols = 8
            const gap = 8
            const w = 110
            const h = 60
            const col = i % cols
            const row = Math.floor(i / cols)
            const x = 20 + col * (w + gap)
            const y = 20 + row * (h + gap)
            const isVisited = visited.has(c.id)
            return (
              <g key={c.id} transform={`translate(${x}, ${y})`}>
                <rect
                  x={0}
                  y={0}
                  width={w}
                  height={h}
                  rx={8}
                  ry={8}
                  fill={isVisited ? '#4fb6a1' : '#ffffff'}
                  stroke="#000"
                  strokeWidth={1}
                  onClick={() => toggleCountry(c.id)}
                  style={{ cursor: 'pointer' }}
                />
                <text x={10} y={28} fontSize={12}>
                  {c.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
