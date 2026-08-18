export type TravelRepository = {
  getVisited(profileId: string): string[]
  setVisited(profileId: string, visitedCountryIds: string[]): void
}
