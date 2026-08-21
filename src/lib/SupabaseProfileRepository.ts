import type { Profile } from '../domain'
import type { AsyncProfileRepository } from './ProfileRepository'
import { supabase } from './supabaseClient'

type ProfileRow = {
  id: string
  atlas_id: string
  linked_user_id: string | null
  name: string
  photo_url: string | null
  map_colour: string
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    atlasId: row.atlas_id,
    name: row.name,
    ...(row.photo_url ? { photoUrl: row.photo_url } : {}),
    mapColour: row.map_colour,
    role: 'member',
  }
}

export class SupabaseProfileRepository implements AsyncProfileRepository {
  async getProfiles(atlasId: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, atlas_id, linked_user_id, name, photo_url, map_colour')
      .eq('atlas_id', atlasId)
      .order('name')

    if (error) throw new Error(`Could not load profiles: ${error.message}`)
    return (data as ProfileRow[]).map(toProfile)
  }

  async getProfile(atlasId: string, profileId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, atlas_id, linked_user_id, name, photo_url, map_colour')
      .eq('atlas_id', atlasId)
      .eq('id', profileId)
      .maybeSingle()

    if (error) throw new Error(`Could not load profile: ${error.message}`)
    return data ? toProfile(data as ProfileRow) : null
  }

  async saveProfile(profile: Profile): Promise<void> {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: profile.id,
      atlas_id: profile.atlasId,
      name: profile.name,
      photo_url: profile.photoUrl || null,
      map_colour: profile.mapColour,
    })

    if (profileError) throw new Error(`Could not save profile: ${profileError.message}`)
  }
}