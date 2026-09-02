import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PersonMapPlace } from '../lib/TripContentRuntime'
import type { WorldRegion } from './WorldMapView'

type CountryMeta = { id: string; name: string; feature: any; region: string }

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

const REGION_VIEWS: Record<WorldRegion, { center: [number, number]; zoom: number }> = {
  world: { center: [15, 0], zoom: 2 },
  americas: { center: [15, -80], zoom: 3 },
  asia: { center: [32, 90], zoom: 3 },
  africa: { center: [5, 20], zoom: 3 },
  oceania: { center: [-22, 145], zoom: 4 },
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
  const mapRef = useRef<L.Map | null>(null)
  const overlayRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return

    const map = L.map(elementRef.current, {
      center: REGION_VIEWS.world.center,
      zoom: REGION_VIEWS.world.zoom,
      minZoom: 2,
      maxZoom: 18,
      scrollWheelZoom: true,
      wheelDebounceTime: 35,
      wheelPxPerZoomLevel: 70,
      worldCopyJump: true,
      preferCanvas: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    const overlay = L.layerGroup().addTo(map)
    mapRef.current = map
    overlayRef.current = overlay

    requestAnimationFrame(() => map.invalidateSize())

    return () => {
      map.remove()
      mapRef.current = null
      overlayRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const preset = REGION_VIEWS[region]
    map.setView(preset.center, preset.zoom, { animate: true })
  }, [region])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.clearLayers()

    const featureCollection = {
      type: 'FeatureCollection',
      features: features.filter((feature) => countryByFeatureId.has(feature.id)),
    } as any

    L.geoJSON(featureCollection, {
      style: (feature) => {
        const meta = feature ? countryByFeatureId.get((feature as any).id) : undefined
        const visited = meta ? isVisited(meta) : false
        return {
          color: visited ? mapColor : '#56706d',
          weight: visited ? 1.4 : 0.8,
          fillColor: visited ? mapColor : '#ffffff',
          fillOpacity: visited ? 0.24 : 0.025,
        }
      },
      onEachFeature: (feature, layer) => {
        const meta = countryByFeatureId.get((feature as any).id)
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
        marker.on('click', (event) => {
          L.DomEvent.stopPropagation(event)
          onOpenPlace(place.tripId!, place.id)
        })
      }
    })
  }, [countryByFeatureId, features, isVisited, mapColor, onOpenPlace, onToggleCountry, placeMarkers])

  return (
    <div className="detailed-world-map-shell">
      <div className="world-map-zoom-hint">Zoom from world level right down to cities and streets · drag to move · use the region buttons above for a quick jump</div>
      <div ref={elementRef} className="detailed-world-map" role="application" aria-label="Detailed interactive world travel map" />
    </div>
  )
}
