import React, { useEffect, useRef } from 'react'
import type { PersonMapPlace } from '../lib/TripContentRuntime'
import type { WorldRegion } from './WorldMapView'

type CountryMeta = { id: string; name: string; feature: any; region: string }
type LeafletApi = any

type Props = {
  features: any[]
  countryByFeatureId: Map<any, CountryMeta>
  mapColor: string
  isVisited: (country: CountryMeta) => boolean
  onToggleCountry: (country: CountryMeta) => void
  placeMarkers: PersonMapPlace[]
  onOpenPlace?: (tripId: string, placeId: string) => void
  region: WorldRegion
}

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

// Continent shortcuts are deliberately framed with breathing room so the whole region is visible.
const REGION_VIEWS: Record<WorldRegion, { center: [number, number]; zoom: number }> = {
  world: { center: [16, 5], zoom: 2 },
  europe: { center: [52, 15], zoom: 3.75 },
  northAmerica: { center: [42, -103], zoom: 3.15 },
  southAmerica: { center: [-18, -61], zoom: 3.4 },
  asia: { center: [34, 88], zoom: 3.15 },
  africa: { center: [3, 20], zoom: 3.55 },
  oceania: { center: [-25, 134], zoom: 3.65 },
}

function loadLeaflet(): Promise<LeafletApi> {
  const existing = (window as any).L
  if (existing) return Promise.resolve(existing)

  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = LEAFLET_CSS
    document.head.appendChild(link)
  }

  return new Promise((resolve, reject) => {
    const present = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null
    if (present) {
      const finish = () => (window as any).L ? resolve((window as any).L) : reject(new Error('Detailed map library did not initialise.'))
      if ((window as any).L) finish()
      else {
        present.addEventListener('load', finish, { once: true })
        present.addEventListener('error', () => reject(new Error('Detailed map library could not be loaded.')), { once: true })
      }
      return
    }
    const script = document.createElement('script')
    script.src = LEAFLET_JS
    script.async = true
    script.onload = () => resolve((window as any).L)
    script.onerror = () => reject(new Error('Detailed map library could not be loaded.'))
    document.head.appendChild(script)
  })
}

export default function DetailedWorldMapCanvas({
  features,
  countryByFeatureId,
  mapColor,
  isVisited,
  onToggleCountry,
  placeMarkers,
  onOpenPlace,
  region,
}: Props) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const leafletRef = useRef<LeafletApi | null>(null)
  const mapRef = useRef<any>(null)
  const overlayRef = useRef<any>(null)
  const [mapError, setMapError] = React.useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!elementRef.current || mapRef.current) return

    loadLeaflet().then((L) => {
      if (cancelled || !elementRef.current || mapRef.current) return
      leafletRef.current = L
      const map = L.map(elementRef.current, {
        center: REGION_VIEWS.world.center,
        zoom: REGION_VIEWS.world.zoom,
        minZoom: 2,
        maxZoom: 18,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        scrollWheelZoom: true,
        wheelDebounceTime: 35,
        wheelPxPerZoomLevel: 70,
        worldCopyJump: true,
        preferCanvas: true,
      })

      const cartoKey = String(import.meta.env.VITE_CARTO_BASEMAP_KEY || '').trim()
      if (cartoKey) {
        // CARTO's light basemap stays visually quiet so Family Atlas travel colours remain dominant.
        L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoKey)}`, {
          maxZoom: 20,
          subdomains: 'abcd',
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        }).addTo(map)
      } else {
        // Never show CARTO's missing-key watermark or invalid-key tile seams. Development falls back cleanly.
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)
      }

      map.getContainer().addEventListener('wheel', (event: WheelEvent) => {
        event.stopPropagation()
      }, { passive: true })

      overlayRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      const preset = REGION_VIEWS[region]
      map.setView(preset.center, preset.zoom, { animate: false })
      requestAnimationFrame(() => map.invalidateSize())
    }).catch((error) => {
      if (!cancelled) setMapError(error instanceof Error ? error.message : 'Detailed map could not be loaded.')
    })

    return () => {
      cancelled = true
      if (mapRef.current) mapRef.current.remove()
      mapRef.current = null
      overlayRef.current = null
      leafletRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const preset = REGION_VIEWS[region]
    map.flyTo(preset.center, preset.zoom, { duration: 0.55 })
  }, [region])

  useEffect(() => {
    const L = leafletRef.current
    const overlay = overlayRef.current
    if (!L || !overlay) return
    overlay.clearLayers()

    const featureCollection = {
      type: 'FeatureCollection',
      features: features.filter((feature) => countryByFeatureId.has(feature.id)),
    }

    L.geoJSON(featureCollection, {
      style: (feature: any) => {
        const meta = feature ? countryByFeatureId.get(feature.id) : undefined
        const visited = meta ? isVisited(meta) : false
        return {
          color: visited ? '#58716e' : '#829795',
          weight: visited ? 0.9 : 0.55,
          fillColor: visited ? mapColor : '#ffffff',
          fillOpacity: visited ? 0.28 : 0.01,
        }
      },
      onEachFeature: (mapFeature: any, layer: any) => {
        const meta = countryByFeatureId.get(mapFeature.id)
        if (!meta) return
        layer.bindTooltip(meta.name, { sticky: true })
        layer.on('click', () => onToggleCountry(meta))
      },
    }).addTo(overlay)

    placeMarkers.forEach((place) => {
      if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return
      const marker = L.circleMarker([place.latitude, place.longitude], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: '#111111',
        fillOpacity: 1,
      }).addTo(overlay)
      const label = place.tripTitle ? `${place.name} · ${place.tripTitle}` : place.name
      marker.bindTooltip(label, { direction: 'top' })
      if (place.source === 'trip' && place.tripId && onOpenPlace) {
        marker.on('click', () => onOpenPlace(place.tripId!, place.id))
      }
    })
  }, [countryByFeatureId, features, isVisited, mapColor, onOpenPlace, onToggleCountry, placeMarkers])

  return (
    <div className="detailed-world-map-shell">
      <div className="world-map-zoom-hint">Zoom from continent to country, city and street level · drag to move · use the region buttons above for a quick jump</div>
      {mapError ? <div className="save-error" role="alert">{mapError}</div> : null}
      <div ref={elementRef} className="detailed-world-map" role="application" aria-label="Detailed interactive world travel map" />
    </div>
  )
}
