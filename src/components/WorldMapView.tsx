import React, { useEffect, useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import * as d3 from 'd3-geo'
import countries from '../data/countries.json'
import { TravelRepository } from '../lib/TravelRepository'
import { addProfileMapPlace, deleteProfileMapPlace, geocodePlace, loadPersonMapPlaces, type PersonMapPlace } from '../lib/TripContentRuntime'

const MAP_COLORS = [
  { name: 'Green', value: '#4fb6a1' },
  { name: 'Blue', value: '#4f86c6' },
  { name: 'Red', value: '#d95d5d' },
  { name: 'Orange', value: '#e59a4a' },
  { name: 'Purple', value: '#8b6bb1' },
]

export type WorldRegion = 'world' | 'americas' | 'asia' | 'africa' | 'oceania'

type Transform = { x: number; y: number; k: number }
type CountryMeta = { id: string; name: string; feature: any; region: string }
type DragState = { pointerId: number; x: number; y: number; tx: number; ty: number; moved: boolean }

const VIEWBOX_W = 960
const VIEWBOX_H = 560
const WORLD_TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const EUROPE_ALIASES: Record<string, string> = {
  'united kingdom': 'GB-ENG',
  'czech republic': 'CZ',
  'turkey': 'TR',
  'russian federation': 'RU',
  'republic of moldova': 'MD',
  'bosnia and herzegovina': 'BA',
  'macedonia': 'MK',
}

// Explicit grouping prevents centroid-based mistakes around Europe, the Caucasus and the Middle East.
const EUROPE_NAMES = new Set([
  'albania', 'andorra', 'armenia', 'austria', 'azerbaijan', 'belarus', 'belgium',
  'bosnia and herzegovina', 'bulgaria', 'croatia', 'cyprus', 'czech republic', 'czechia',
  'denmark', 'estonia', 'faroe islands', 'finland', 'france', 'georgia', 'germany', 'greece',
  'hungary', 'iceland', 'ireland', 'italy', 'kosovo', 'latvia', 'liechtenstein', 'lithuania',
  'luxembourg', 'malta', 'moldova', 'monaco', 'montenegro', 'netherlands', 'north macedonia',
  'norway', 'poland', 'portugal', 'romania', 'russia', 'russian federation', 'san marino',
  'serbia', 'slovakia', 'slovenia', 'spain', 'sweden', 'switzerland', 'turkey', 'türkiye',
  'ukraine', 'united kingdom', 'vatican', 'vatican city',
])

const MIDDLE_EAST_ASIA_NAMES = new Set([
  'bahrain', 'iran', 'iraq', 'israel', 'jordan', 'kuwait', 'lebanon', 'oman', 'palestine',
  'qatar', 'saudi arabia', 'syria', 'united arab emirates', 'yemen',
])

function getRegion(name: string, centroid: [number, number]) {
  const [lon, lat] = centroid
  const n = normalizeName(name)
  if (n === 'french guiana' || n === 'greenland') return 'Americas'
  if (EUROPE_NAMES.has(n)) return 'Europe'
  if (MIDDLE_EAST_ASIA_NAMES.has(n)) return 'Asia'
  if (n === 'indonesia' || n === 'timor leste') return 'Asia'
  if (n === 'papua new guinea') return 'Australia & Pacific'
  if (lon < -25) return 'Americas'
  if (lon > 110 && lat < 5) return 'Australia & Pacific'
  if (lon >= -20 && lon <= 55 && lat <= 37 && lat >= -40) return 'Africa'
  if (lon >= 25 && lat > -10) return 'Asia'
  return 'Europe'
}

function isCompositeUkVisited(visited: Set<string>) {
  return ['GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR'].some((id) => visited.has(id))
}

export default function WorldMapView({
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
  region,
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
  region: WorldRegion
}) {
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const [mapColor, setMapColor] = useState(MAP_COLORS[0].value)
  const [features, setFeatures] = useState<any[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [placeMarkers, setPlaceMarkers] = useState<PersonMapPlace[]>([])
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null)
  const [quickPlaceName, setQuickPlaceName] = useState('')
  const [placeBusy, setPlaceBusy] = useState(false)
  const [markerError, setMarkerError] = useState<string | null>(null)
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const didDragRef = useRef(false)

  const projection = useMemo(() => d3.geoNaturalEarth1().fitExtent([[12, 12], [VIEWBOX_W - 12, VIEWBOX_H - 12]], { type: 'Sphere' } as any), [])
  const pathGen = useMemo(() => d3.geoPath().projection(projection as any), [projection])

  useEffect(() => {
    setVisited(new Set(cloudVisited || travelRepo.getVisited(profile)))
    setMapColor(cloudMapColor || travelRepo.getMapColor(profile) || defaultMapColor || MAP_COLORS[0].value)
  }, [cloudMapColor, cloudVisited, defaultMapColor, profile, travelRepo])

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    fetch(WORLD_TOPO_URL)
      .then((response) => {
        if (!response.ok) throw new Error('World geography could not be downloaded.')
        return response.json()
      })
      .then((topology) => {
        if (cancelled) return
        const decoded = feature(topology, topology.objects.countries) as any
        setFeatures(decoded.features || [])
      })
      .catch((error) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'World map could not be loaded.') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!personId) { setPlaceMarkers([]); return }
    let cancelled = false
    loadPersonMapPlaces(personId, profile)
      .then((rows) => { if (!cancelled) setPlaceMarkers(rows) })
      .catch((error) => { if (!cancelled) setMarkerError(error instanceof Error ? error.message : 'Places could not be loaded.') })
    return () => { cancelled = true }
  }, [personId, profile])

  async function refreshPlaces() {
    if (!personId) return
    setPlaceMarkers(await loadPersonMapPlaces(personId, profile))
  }

  const europeanByName = useMemo(() => {
    const map = new Map<string, string>()
    ;(countries as any[]).forEach((country) => {
      map.set(normalizeName(country.name), country.id)
      if (country.topoName) map.set(normalizeName(country.topoName), country.id)
    })
    Object.entries(EUROPE_ALIASES).forEach(([name, id]) => map.set(name, id))
    return map
  }, [])

  const countryMeta = useMemo<CountryMeta[]>(() => features
    .filter((item) => normalizeName(item.properties?.name || '') !== 'antarctica')
    .map((item) => {
      const name = item.properties?.name || `Country ${item.id}`
      const europeId = europeanByName.get(normalizeName(name))
      const id = europeId || (normalizeName(name) === 'united kingdom' ? 'GB' : `W${item.id}`)
      const centroid = d3.geoCentroid(item as any) as [number, number]
      return { id, name, feature: item, region: getRegion(name, centroid) }
    })
    .sort((a, b) => a.name.localeCompare(b.name)), [features, europeanByName])

  const countryByFeatureId = useMemo(() => new Map(countryMeta.map((entry) => [entry.feature.id, entry])), [countryMeta])

  const grouped = useMemo(() => {
    const names = ['Europe', 'Americas', 'Asia', 'Africa', 'Australia & Pacific']
    return names.map((name) => ({ name, countries: countryMeta.filter((country) => country.region === name) })).filter((group) => group.countries.length)
  }, [countryMeta])

  function isVisited(country: CountryMeta) {
    if (country.id === 'GB') return isCompositeUkVisited(visited)
    return visited.has(country.id)
  }

  async function persistVisited(next: Set<string>) {
    setVisited(next)
    if (onSaveVisited) await onSaveVisited(Array.from(next))
    else travelRepo.setVisited(profile, Array.from(next))
  }

  async function toggleCountry(country: CountryMeta) {
    const next = new Set(visited)
    if (country.id === 'GB') {
      const ids = ['GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR']
      if (isCompositeUkVisited(next)) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
    } else if (next.has(country.id)) next.delete(country.id)
    else next.add(country.id)
    setSaveError(null)
    try { await persistVisited(next) }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save travel changes.') }
  }

  async function selectMapColor(color: string) {
    setMapColor(color)
    setSaveError(null)
    try {
      if (onSaveMapColor) await onSaveMapColor(color)
      else travelRepo.setMapColor(profile, color)
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save map colour.') }
  }

  async function addQuickPlace(event: React.FormEvent, country: CountryMeta) {
    event.preventDefault()
    const name = quickPlaceName.trim()
    if (!name || !personId) return
    const countryId = country.id === 'GB' ? 'GB-ENG' : country.id
    if (placeMarkers.some((place) => place.countryId === countryId && normalizeName(place.name) === normalizeName(name))) {
      setMarkerError(`${name} is already shown for ${country.name}.`)
      return
    }
    setPlaceBusy(true)
    setMarkerError(null)
    try {
      const located = await geocodePlace(name, country.name)
      if (!located) throw new Error(`We could not find ${name} in ${country.name}. Try a more specific place name.`)
      await addProfileMapPlace({ profileId: profile, countryId, name, latitude: located.latitude, longitude: located.longitude })
      if (!isVisited(country)) await toggleCountry(country)
      setQuickPlaceName('')
      await refreshPlaces()
    } catch (error) { setMarkerError(error instanceof Error ? error.message : 'Place could not be added.') }
    finally { setPlaceBusy(false) }
  }

  async function removeQuickPlace(place: PersonMapPlace) {
    if (place.source !== 'map' || !window.confirm(`Remove ${place.name} from this map?`)) return
    setPlaceBusy(true)
    try { await deleteProfileMapPlace(place.id); await refreshPlaces() }
    catch (error) { setMarkerError(error instanceof Error ? error.message : 'Place could not be removed.') }
    finally { setPlaceBusy(false) }
  }

  useEffect(() => {
    const presets: Record<WorldRegion, { lon: number; lat: number; k: number }> = {
      world: { lon: 0, lat: 5, k: 1 },
      americas: { lon: -80, lat: 15, k: 1.65 },
      asia: { lon: 90, lat: 30, k: 1.7 },
      africa: { lon: 20, lat: 5, k: 2.05 },
      oceania: { lon: 145, lat: -20, k: 2.2 },
    }
    const preset = presets[region]
    if (preset.k === 1) { setTransform({ x: 0, y: 0, k: 1 }); return }
    const point = projection([preset.lon, preset.lat])
    if (!point) return
    setTransform({ x: VIEWBOX_W / 2 - point[0] * preset.k, y: VIEWBOX_H / 2 - point[1] * preset.k, k: preset.k })
  }, [projection, region])

  // React's delegated wheel event can be passive in the browser. A native non-passive listener
  // guarantees that zooming the map does not also scroll the page.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const rect = svg.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const px = (event.clientX - rect.left) * VIEWBOX_W / rect.width
      const py = (event.clientY - rect.top) * VIEWBOX_H / rect.height
      const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2
      setTransform((current) => {
        const nextK = Math.max(1, Math.min(12, current.k * factor))
        const worldX = (px - current.x) / current.k
        const worldY = (py - current.y) / current.k
        return { k: nextK, x: px - worldX * nextK, y: py - worldY * nextK }
      })
    }
    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [])

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    didDragRef.current = false
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, tx: transform.x, ty: transform.y, moved: false }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture may fail if the pointer ended early */ }
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const dxPixels = event.clientX - drag.x
    const dyPixels = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dxPixels, dyPixels) > 3) {
      drag.moved = true
      didDragRef.current = true
    }
    const dx = dxPixels * VIEWBOX_W / rect.width
    const dy = dyPixels * VIEWBOX_H / rect.height
    setTransform((current) => ({ ...current, x: drag.tx + dx, y: drag.ty + dy }))
  }

  function stopDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (drag?.pointerId === event.pointerId) {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      } catch { /* safe cleanup */ }
      dragRef.current = null
      window.setTimeout(() => { didDragRef.current = false }, 0)
    }
  }

  function handleCountryClick(event: React.MouseEvent, country: CountryMeta) {
    event.stopPropagation()
    if (didDragRef.current) return
    void toggleCountry(country)
  }

  return <div className="map-view world-map-view">
    <header className="map-header">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>{profileName || 'Traveller'}’s World Map</h2>
      <div className="map-colors" aria-label="Map colour">
        {MAP_COLORS.map((color) => <button key={color.value} type="button" title={color.name} aria-label={`${color.name} map colour`} aria-pressed={mapColor === color.value} className={`color-swatch${mapColor === color.value ? ' selected' : ''}`} style={{ backgroundColor: color.value }} onClick={() => selectMapColor(color.value)} />)}
      </div>
      <div className="visited-count">Countries visited: {visited.size}{placeMarkers.length ? ` · Places: ${placeMarkers.length}` : ''}</div>
      {(saveError || markerError || loadError) && <div className="save-error" role="alert">{saveError || markerError || loadError}</div>}
    </header>

    <div className="map-workspace world-map-workspace">
      <div className="map-container world-map-container">
        <div className="world-map-zoom-hint">Scroll/pinch to zoom · drag to move · use the region buttons above for a quick jump</div>
        <svg ref={svgRef} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} className="svg-map world-svg-map" role="img" aria-label="Interactive world travel map" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
          <rect width={VIEWBOX_W} height={VIEWBOX_H} fill="#f8fcfb" />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            {features.map((item) => {
              const meta = countryByFeatureId.get(item.id)
              if (!meta || normalizeName(meta.name) === 'antarctica') return null
              return <path key={item.id} d={pathGen(item as any) || undefined} fill={isVisited(meta) ? mapColor : '#fff'} stroke="#3e5452" strokeWidth={0.55 / transform.k} vectorEffect="non-scaling-stroke" onClick={(event) => handleCountryClick(event, meta)} style={{ cursor: 'pointer' }}><title>{meta.name}</title></path>
            })}
            {placeMarkers.map((place) => {
              if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return null
              const point = projection([place.longitude, place.latitude])
              if (!point) return null
              const canOpen = place.source === 'trip' && !!place.tripId && !!onOpenPlace
              const label = place.tripTitle ? `${place.name} · ${place.tripTitle}` : place.name
              return <g key={`${place.source}-${place.id}`} transform={`translate(${point[0]} ${point[1]})`} role={canOpen ? 'button' : undefined} tabIndex={canOpen ? 0 : undefined} onClick={(event) => { event.stopPropagation(); if (!didDragRef.current && canOpen && place.tripId) onOpenPlace?.(place.tripId, place.id) }} style={{ cursor: canOpen ? 'pointer' : 'default' }}>
                <circle r={6 / transform.k} fill="#111" stroke="#fff" strokeWidth={2 / transform.k} />
                <title>{label}</title>
              </g>
            })}
          </g>
        </svg>
        <div className="world-map-controls"><button type="button" onClick={() => setTransform({ x: 0, y: 0, k: 1 })}>Reset view</button><span>{Math.round(transform.k * 100)}%</span></div>
      </div>

      <aside className="country-checklist world-country-checklist" aria-label="World country checklist">
        <h3>Countries</h3>
        <p className="country-help">Tick a country or click its name to add a city/place. Europe keeps its detailed Family Atlas map in the Europe view.</p>
        {grouped.map((group) => <details key={group.name} open={group.name.toLowerCase().startsWith(region === 'oceania' ? 'australia' : region) || region === 'world'}>
          <summary>{group.name}</summary>
          <div className="country-list">
            {group.countries.map((country) => {
              const countryId = country.id === 'GB' ? 'GB-ENG' : country.id
              const countryPlaces = placeMarkers.filter((place) => place.countryId === countryId)
              const expanded = expandedCountry === country.id
              return <div className={`country-entry${expanded ? ' expanded' : ''}`} key={country.id}>
                <div className="country-row">
                  <input type="checkbox" checked={isVisited(country)} onChange={() => void toggleCountry(country)} style={{ accentColor: mapColor }} aria-label={`Visited ${country.name}`} />
                  <button className="country-name-btn" type="button" aria-expanded={expanded} onClick={() => { setExpandedCountry(expanded ? null : country.id); setQuickPlaceName(''); setMarkerError(null) }}>{country.name}</button>
                  {countryPlaces.length > 0 && <span className="country-place-count">{countryPlaces.length}</span>}
                </div>
                {expanded && <div className="country-place-editor">
                  <form onSubmit={(event) => void addQuickPlace(event, country)}>
                    <input value={quickPlaceName} onChange={(event) => setQuickPlaceName(event.target.value)} placeholder={`Add a city or place in ${country.name}`} disabled={placeBusy} />
                    <button type="submit" disabled={placeBusy || !quickPlaceName.trim()}>{placeBusy ? 'Adding…' : 'Add'}</button>
                  </form>
                  {countryPlaces.length > 0 && <div className="country-place-list">{countryPlaces.map((place) => <div key={`${place.source}-${place.id}`}><span>{place.name}</span>{place.source === 'map' ? <button type="button" aria-label={`Remove ${place.name}`} onClick={() => void removeQuickPlace(place)}>×</button> : <small>Trip</small>}</div>)}</div>}
                </div>}
              </div>
            })}
          </div>
        </details>)}
      </aside>
    </div>
  </div>
}
