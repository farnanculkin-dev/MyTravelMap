import type { Atlas } from '../domain'

export interface AtlasRepository {
  getAtlas(atlasId: string): Atlas | null
  saveAtlas(atlas: Atlas): void
}