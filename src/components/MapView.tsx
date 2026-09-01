import React, { useEffect, useState } from 'react'
import { TravelRepository } from '../lib/TravelRepository'
import { loadPersonMapPlaces, type PersonMapPlace } from '../lib/TripContentRuntime'
import countries from '../data/countries.json'
import { feature } from 'topojson-client'
import * as d3 from 'd3-geo'

const MAP_COLORS = [
  { name: 'Green', value: '#4fb6a1' },
  { name: 'Blue', value: '#4f86c6' },
  { name: 'Red', value: '#d95d5d' },
  { name: 'Orange', value: '#e59a4a' },
  { name: 'Purple', value: '#8b6bb1' },
]

function simplifyRing(ring: number[][], tolerance: number): number[][] {
  if (ring.length <= 3) return ring
  const squaredTolerance = tolerance * tolerance
  const keep = new Uint8Array(ring.length)
  keep[0] = 1
  keep[ring.length - 1] = 1
  const simplify = (start: number, end: number) => {
    let furthest = -1
    let furthestDistance = squaredTolerance
    const [startX, startY] = ring[start]
    const [endX, endY] = ring[end]
    const deltaX = endX - startX
    const deltaY = endY - startY
    for (let index = start + 1; index < end; index += 1) {
      const [x, y] = ring[index]
      const distance = deltaX === 0 && deltaY === 0
        ? (x - startX) ** 2 + (y - startY) ** 2
        : ((x - startX) * deltaY - (y - startY) * deltaX) ** 2 / (deltaX ** 2 + deltaY ** 2)
      if (distance > furthestDistance) {
        furthest = index
        furthestDistance = distance
      }
    }
    if (furthest >= 0) {
      keep[furthest] = 1
      simplify(start, furthest)
      simplify(furthest, end)
    }
  }
  simplify(0, ring.length - 1)
  return ring.filter((_, index) => keep[index] === 1)
}

function simplifyGeometry(geometry: any, tolerance: number): any {
  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: geometry.coordinates.map((ring: number[][]) => simplifyRing(ring, tolerance)) }
  }
  return { ...geometry, coordinates: geometry.coordinates.map((polygon: number[][][]) =>
    polygon.map((ring: number[][]) => simplifyRing(ring, tolerance)),
  ) }
}

export default function MapView({
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
  onOpenPlace?: (tripId:string, placeId:string) => void
  travelRepo: TravelRepository
  cloudVisited?: string[]
  cloudMapColor?: string
  onSaveVisited?: (visitedCountryIds: string[]) => Promise<void>
  onSaveMapColor?: (color: string) => Promise<void>
}) {
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const [mapColor, setMapColor] = useState(MAP_COLORS[0].value)
  const [geoFeatures, setGeoFeatures] = useState<any[]>([])
  const [boundaryFeature, setBoundaryFeature] = useState<any | null>(null)
  const [contextFeatures, setContextFeatures] = useState<any[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [placeMarkers,setPlaceMarkers]=useState<PersonMapPlace[]>([])
  const [markerError,setMarkerError]=useState<string|null>(null)

  useEffect(() => {
    const v = new Set(cloudVisited || travelRepo.getVisited(profile))
    setVisited(v)
    setMapColor(cloudMapColor || travelRepo.getMapColor(profile) || defaultMapColor || MAP_COLORS[0].value)
  }, [cloudMapColor, cloudVisited, defaultMapColor, profile, travelRepo])

  useEffect(()=>{
    if(!personId){setPlaceMarkers([]);return}
    let cancelled=false
    setMarkerError(null)
    loadPersonMapPlaces(personId).then((rows)=>{if(!cancelled)setPlaceMarkers(rows)}).catch((error)=>{if(!cancelled)setMarkerError(error instanceof Error?error.message:'Places could not be loaded.')})
    return()=>{cancelled=true}
  },[personId])

  useEffect(() => {
    let cancelled = false
    fetch('/data/europe-topo.json')
      .then((r) => r.json())
      .then((topology) => {
        if (cancelled) return
        const mapObject = topology?.objects?.countries
        if (!mapObject) {
          console.error('TopoJSON contains no objects')
          return
        }
        const mapFeatures = [mapObject, topology?.objects?.russia]
          .filter(Boolean)
          .flatMap((mapObjectPart: any) => {
            const decoded = feature(topology, mapObjectPart) as any
            return decoded.features || [decoded]
          })
        const contextFeatureCollection = topology?.objects?.context
          ? feature(topology, topology.objects.context)
          : null
        const byMapId = new Map(
          mapFeatures.map((mapFeature: any) => [mapFeature.properties?.mapId, mapFeature]),
        )
        const featuresMatched: any[] = []
        const missingList: string[] = []
        countries.forEach((c: any) => {
          const mapFeature = byMapId.get(c.id)
          if (mapFeature) {
            featuresMatched.push({ ...mapFeature, travelId: c.id })
          } else {
            missingList.push(`${c.id} (${c.name})`)
          }
        })

        setGeoFeatures(featuresMatched)
        const northernIreland = featuresMatched.find((f) => f.travelId === 'GB-NIR')
        setBoundaryFeature(northernIreland
          ? { ...northernIreland, geometry: simplifyGeometry(northernIreland.geometry, 0.01) }
          : null)
        setContextFeatures(contextFeatureCollection?.features || (contextFeatureCollection ? [contextFeatureCollection] : []))
        setMissing(missingList)
        if (missingList.length > 0) console.warn('Missing countries:', missingList)
      })
      .catch((err) => console.error('Error loading topojson', err))
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleCountry(countryId: string) {
    const next = new Set(visited)
    if (next.has(countryId)) next.delete(countryId)
    else next.add(countryId)
    setVisited(next)
    setSaveError(null)
    try {
      if (onSaveVisited) await onSaveVisited(Array.from(next))
      else travelRepo.setVisited(profile, Array.from(next))
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save travel changes.')
    }
  }

  async function selectMapColor(color: string) {
    setMapColor(color)
    setSaveError(null)
    try {
      if (onSaveMapColor) await onSaveMapColor(color)
      else travelRepo.setMapColor(profile, color)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save map colour.')
    }
  }

  const projection = d3.geoMercator().center([10, 50]).scale(650).translate([500, 520])
  const pathGen = d3.geoPath().projection(projection as any)

  return (
    <div className="map-view">
      <header className="map-header">
        <button className="back-btn" onClick={onBack} aria-label="Back to profiles">
          ← Back
        </button>
        <h2>{profileName || (profile.charAt(0).toUpperCase() + profile.slice(1))}’s Map</h2>
        <div className="map-colors" aria-label="Map colour">
          {MAP_COLORS.map((color) => (
            <button
              className={`color-swatch${mapColor === color.value ? ' selected' : ''}`}
              key={color.value}
              type="button"
              aria-label={`${color.name} map colour`}
              aria-pressed={mapColor === color.value}
              title={color.name}
              style={{ backgroundColor: color.value }}
              onClick={() => selectMapColor(color.value)}
            />
          ))}
        </div>
        <div className="visited-count">Countries visited: {visited.size}{placeMarkers.length>0?` · Places: ${placeMarkers.length}`:''}</div>
        {saveError && <div className="save-error" role="alert">{saveError}</div>}
        {markerError && <div className="save-error" role="alert">{markerError}</div>}
      </header>

      <div className="map-workspace">
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

          <svg viewBox="0 0 960 920" className="svg-map" role="img" aria-label="Europe map">
            <g>
              {contextFeatures.map((f) => (
                <path
                  key={f.properties?.contextId}
                  data-context-id={f.properties?.contextId}
                  d={pathGen(f as any) || undefined}
                  fill="#ffffff"
                  stroke="#000"
                  strokeWidth={0.5}
                  aria-hidden="true"
                />
              ))}
              {geoFeatures.map((f) => {
                const countryId = f.travelId
                const isVisited = visited.has(countryId)
                const d = pathGen(f as any) || undefined
                return (
                  <path
                    key={countryId}
                    data-country-id={countryId}
                    d={d}
                    fill={isVisited ? mapColor : '#ffffff'}
                    stroke="#000"
                    strokeWidth={0.5}
                    onClick={() => toggleCountry(countryId)}
                    style={{ cursor: 'pointer' }}
                  />
                )
              })}
              {boundaryFeature && (
                <path
                  data-boundary-id="IE-GB-NIR"
                  d={pathGen(boundaryFeature as any) || undefined}
                  fill="none"
                  stroke="#000"
                  strokeWidth={0.5}
                  pointerEvents="none"
                  aria-hidden="true"
                />
              )}
              {placeMarkers.map((place)=>{
                if(typeof place.latitude!=='number'||typeof place.longitude!=='number')return null
                const point=projection([place.longitude,place.latitude])
                if(!point)return null
                return <g key={place.id} className="place-marker" role="button" tabIndex={0} aria-label={`${place.name}, ${place.tripTitle}`} onClick={()=>onOpenPlace?.(place.tripId,place.id)} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpenPlace?.(place.tripId,place.id)}}} style={{cursor:onOpenPlace?'pointer':'default'}}>
                  <circle cx={point[0]} cy={point[1]} r={6.5} fill="#111" stroke="#fff" strokeWidth={2}/>
                  <title>{`${place.name} · ${place.tripTitle}`}</title>
                </g>
              })}
            </g>
          </svg>
          {placeMarkers.length>0&&<p className="map-place-help">● Place markers show cities and places from this person’s trips. Tap or click a dot to open that place.</p>}
        </div>

        <aside className="country-checklist" aria-label="Country checklist">
          <h3>Countries</h3>
          <div className="country-list">
            {countries.map((country: any) => (
              <label className="country-row" key={country.id}>
                <input
                  type="checkbox"
                  checked={visited.has(country.id)}
                  onChange={() => toggleCountry(country.id)}
                  style={{ accentColor: mapColor }}
                />
                <span>{country.name}</span>
              </label>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
