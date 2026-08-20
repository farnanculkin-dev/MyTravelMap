import type { Profile } from '../domain'

export interface ProfileRepository {
  getProfiles(atlasId: string): Profile[]
  getProfile(atlasId: string, profileId: string): Profile | null
  saveProfile(profile: Profile): void
}