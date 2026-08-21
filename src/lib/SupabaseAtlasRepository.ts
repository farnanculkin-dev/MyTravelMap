import type { Atlas } from '../domain'
import type { AsyncAtlasRepository } from './AtlasRepository'
import { supabase } from './supabaseClient'

type AtlasRow = {
  id: string
  type: Atlas['type']
  name: string
  group_photo_path: string | null
  created_at: string
  updated_at: string
}

function toAtlas(row: AtlasRow): Atlas {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    ...(row.group_photo_path ? { groupPhotoUrl: row.group_photo_path } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SupabaseAtlasRepository implements AsyncAtlasRepository {
  async getAtlas(atlasId: string): Promise<Atlas | null> {
    const { data, error } = await supabase
      .from('atlases')
      .select('id, type, name, group_photo_path, created_at, updated_at')
      .eq('id', atlasId)
      .maybeSingle()

    if (error) throw new Error(`Could not load atlas: ${error.message}`)
    return data ? toAtlas(data as AtlasRow) : null
  }

  async saveAtlas(atlas: Atlas): Promise<void> {
    const { error } = await supabase.from('atlases').upsert({
      id: atlas.id,
      type: atlas.type,
      name: atlas.name,
      group_photo_path: atlas.groupPhotoUrl || null,
      created_at: atlas.createdAt,
      updated_at: atlas.updatedAt,
    })

    if (error) throw new Error(`Could not save atlas: ${error.message}`)
  }
}