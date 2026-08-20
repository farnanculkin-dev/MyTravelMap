import type { ProfileTravel } from '../domain'

export type TravelRepository = {
  getProfileTravel(profileId: string): ProfileTravel
  setProfileTravel(profileTravel: ProfileTravel): void
  getVisited(profileId: string): string[]
  setVisited(profileId: string, visitedCountryIds: string[]): void
  getMapColor(profileId: string): string | null
  setMapColor(profileId: string, color: string): void
}
