import React, { useEffect, useState } from 'react'
import type { ProfileId } from '../App'
import { TravelRepository } from '../lib/TravelRepository'
import countries from '../data/countries.json'
import { feature } from 'topojson-client'
import * as d3 from 'd3-geo'

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
  const [geoFeatures, setGeoFeatures] = useState<any[]>([])
  const [missing, setMissing] = useState<string[]>([])

  useEffect(() => {
    const v = new Set(travelRepo.getVisited(profile))
    setVisited(v)
  }, [profile])

  useEffect(() => {
    let cancelled = false
    fetch('/data/europe-topo.json')
      .then((r) => r.json())
      .then((topology) => {
        if (cancelled) return
        // Attempt to detect the object name containing geometries
        const keys = Object.keys((topology && topology.objects) || {})
        if (keys.length === 0) {
          console.error('TopoJSON contains no objects')
          return
        }
        // Combine all objects into one feature list
        const allFeatures: any[] = []
        keys.forEach((k) => {
          const fc = feature(topology, topology.objects[k])
          if (fc && fc.features) allFeatures.push(...fc.features)
        })

        // Map features by name property (various datasets use NAME, name, NAME_EN, etc.)
        const nameProps = ['NAME_EN', 'NAME', 'name', 'NAME_LONG', 'admin']
        const byName: Record<string, any> = {}
        allFeatures.forEach((f) => {
          const props = f.properties || {}
          let nameVal: string | null = null
          for (const p of nameProps) {
            if (props[p]) {
              nameVal = String(props[p])
              break
            }
          }
          if (!nameVal) {
            // fallback to using ISO_A2 or similar
            if (props.ISO_A2) nameVal = props.ISO_A2
            else if (props.iso_a2) nameVal = props.iso_a2
          }
          if (nameVal) {
            byName[nameVal] = f
          }
        })

        // Match countries.json topoName to features
        const featuresMatched: any[] = []
        const missingList: string[] = []
        countries.forEach((c: any) => {
          const topoKey = c.topoName
          if (byName[topoKey]) {
            featuresMatched.push({ ...byName[topoKey], travelId: c.id })
          } else {
            missingList.push(`${c.id} (${c.name}) -> ${topoKey}`)
          }
        })

        setGeoFeatures(featuresMatched)
        setMissing(missingList)
        if (missingList.length > 0) console.warn('Missing countries:', missingList)
      })
      .catch((err) => console.error('Error loading topojson', err))
    return () => {
      cancelled = true
    }
  }, [])

  function toggleCountry(countryId: string) {
    const next = new Set(visited)
    if (next.has(countryId)) next.delete(countryId)
    else next.add(countryId)
    setVisited(next)
    travelRepo.setVisited(profile, Array.from(next))
  }

  // Create a projection and path generator
  const projection = d3.geoMercator().center([15, 54]).scale(600).translate([480, 350])
  const pathGen = d3.geoPath().projection(projection as any)

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
        {missing.length > 0 && (
          <div style={{ padding: 8, background: '#fff3f3', border: '1px solid #ffcccc', marginBottom: 10 }}>
            <strong>Unmatched countries:</strong>
            <ul>
              {missing.map((m) => (
                <li key={m} style={{ fontFamily: 'monospace' }}>
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        <svg viewBox="0 0 960 700" className="svg-map" role="img" aria-label="Europe map">
          <g>
            {geoFeatures.map((f, i) => {
              const countryId = f.travelId
              const isVisited = visited.has(countryId)
              const d = pathGen(f as any) || undefined
              return (
                <path
                  key={countryId}
                  d={d}
                  fill={isVisited ? '#4fb6a1' : '#ffffff'}
                  stroke="#000"
                  strokeWidth={0.5}
                  onClick={() => toggleCountry(countryId)}
                  style={{ cursor: 'pointer' }}
                />
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
