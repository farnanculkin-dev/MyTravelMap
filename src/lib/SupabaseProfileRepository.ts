import type { Profile } from '../domain'
import type { AsyncProfileRepository } from './ProfileRepository'
import { supabase } from './supabaseClient'

type ProfileRow = {
  id: string
  person_id: string
  profile_key: string
  atlas_id: string
  linked_user_id: string | null
  name: string
  photo_path: string | null
  role: Profile['role']
  map_colour: string
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    personId: row.person_id,
    profileKey: row.profile_key,
    atlasId: row.atlas_id,
    name: row.name,
    ...(row.photo_path ? { photoUrl: row.photo_path } : {}),
    mapColour: row.map_colour,
    role: row.role,
  }
}

export class SupabaseProfileRepository implements AsyncProfileRepository {
  async getProfiles(atlasId: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, person_id, profile_key, atlas_id, linked_user_id, name, photo_path, map_colour, role')
      .eq('atlas_id', atlasId)
      .order('name')

    if (error) throw new Error(`Could not load profiles: ${error.message}`)
    return (data as ProfileRow[]).map(toProfile)
  }

  async getProfile(atlasId: string, profileId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, person_id, profile_key, atlas_id, linked_user_id, name, photo_path, map_colour, role')
      .eq('atlas_id', atlasId)
      .eq('id', profileId)
      .maybeSingle()

    if (error) throw new Error(`Could not load profile: ${error.message}`)
    return data ? toProfile(data as ProfileRow) : null
  }

  async saveProfile(profile: Profile): Promise<void> {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: profile.id,
      ...(profile.personId ? { person_id: profile.personId } : {}),
      atlas_id: profile.atlasId,
      name: profile.name,
      photo_path: profile.photoUrl || null,
      profile_key: profile.profileKey || profile.id,
      map_colour: profile.mapColour,
    })

    if (profileError) throw new Error(`Could not save profile: ${profileError.message}`)
  }
}
