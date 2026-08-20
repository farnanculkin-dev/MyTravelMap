import type { Atlas, Profile } from '../domain'
import type { AtlasRepository } from './AtlasRepository'
import type { ProfileRepository } from './ProfileRepository'

export class LocalSeedAtlasRepository implements AtlasRepository {
  constructor(private readonly atlas: Atlas) {}

  getAtlas(atlasId: string): Atlas | null {
    return this.atlas.id === atlasId ? this.atlas : null
  }

  saveAtlas(atlas: Atlas): void {
    if (atlas.id !== this.atlas.id) throw new Error('The local seed atlas cannot be replaced')
    Object.assign(this.atlas, atlas)
  }
}

export class LocalSeedProfileRepository implements ProfileRepository {
  constructor(private readonly profiles: Profile[]) {}

  getProfiles(atlasId: string): Profile[] {
    return this.profiles.filter((profile) => profile.atlasId === atlasId)
  }

  getProfile(atlasId: string, profileId: string): Profile | null {
    return this.profiles.find((profile) => profile.atlasId === atlasId && profile.id === profileId) || null
  }

  saveProfile(profile: Profile): void {
    const index = this.profiles.findIndex((current) => current.id === profile.id && current.atlasId === profile.atlasId)
    if (index === -1) this.profiles.push(profile)
    else this.profiles[index] = profile
  }
}