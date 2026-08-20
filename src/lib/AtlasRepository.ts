import type { Atlas } from '../domain'

export interface AtlasRepository {
  getAtlas(atlasId: string): Atlas | null
  saveAtlas(atlas: Atlas): void
}

export interface AsyncAtlasRepository {
  getAtlas(atlasId: string): Promise<Atlas | null>
  saveAtlas(atlas: Atlas): Promise<void>
}