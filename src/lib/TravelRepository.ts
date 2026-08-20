import type { ProfileTravel } from '../domain'

export type TravelRepository = {
  getProfileTravel(profileId: string): ProfileTravel
  setProfileTravel(profileTravel: ProfileTravel): void
  getVisited(profileId: string): string[]
  setVisited(profileId: string, visitedCountryIds: string[]): void
  getMapColor(profileId: string): string | null
  setMapColor(profileId: string, color: string): void
}

export interface AsyncTravelRepository {
  getProfileTravel(profileId: string): Promise<ProfileTravel>
  setProfileTravel(profileTravel: ProfileTravel): Promise<void>
  getVisited(profileId: string): Promise<string[]>
  setVisited(profileId: string, visitedCountryIds: string[]): Promise<void>
  getMapColor(profileId: string): Promise<string | null>
  setMapColor(profileId: string, color: string): Promise<void>
}
