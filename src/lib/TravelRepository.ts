export type TravelRepository = {
  getVisited(profileId: string): string[]
  setVisited(profileId: string, visitedCountryIds: string[]): void
  getMapColor(profileId: string): string | null
  setMapColor(profileId: string, color: string): void
}
