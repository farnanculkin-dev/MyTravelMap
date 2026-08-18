import type { TravelRepository } from './TravelRepository'

const KEY_PREFIX = 'mytravelmap:v1:profile:'
const COLOR_SUFFIX = ':map-color'

export class LocalStorageTravelRepository implements TravelRepository {
  getVisited(profileId: string): string[] {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + profileId)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
      return []
    } catch (e) {
      console.error('Error reading visited data', e)
      return []
    }
  }

  setVisited(profileId: string, visitedCountryIds: string[]): void {
    try {
      localStorage.setItem(KEY_PREFIX + profileId, JSON.stringify(visitedCountryIds))
    } catch (e) {
      console.error('Error saving visited data', e)
    }
  }

  getMapColor(profileId: string): string | null {
    try {
      return localStorage.getItem(KEY_PREFIX + profileId + COLOR_SUFFIX)
    } catch (e) {
      console.error('Error reading map colour', e)
      return null
    }
  }

  setMapColor(profileId: string, color: string): void {
    try {
      localStorage.setItem(KEY_PREFIX + profileId + COLOR_SUFFIX, color)
    } catch (e) {
      console.error('Error saving map colour', e)
    }
  }
}
