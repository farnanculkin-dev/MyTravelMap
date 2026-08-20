import type { Profile } from '../domain'
import type { AsyncProfileRepository } from './ProfileRepository'
import { supabase } from './supabaseClient'

type ProfileRow = {
  id: string
  name: string
  photo_url: string | null
  map_colour: string
}

type AtlasMemberRow = {
  profile_id: string
  role: Profile['role']
}

function toProfile(row: ProfileRow, atlasId: string, role: Profile['role']): Profile {
  return {
    id: row.id,
    atlasId,
    name: row.name,
    ...(row.photo_url ? { photoUrl: row.photo_url } : {}),
    mapColour: row.map_colour,
    role,
  }
}

export class SupabaseProfileRepository implements AsyncProfileRepository {
  async getProfiles(atlasId: string): Promise<Profile[]> {
    const { data: memberData, error: memberError } = await supabase
      .from('atlas_members')
      .select('profile_id, role')
      .eq('atlas_id', atlasId)

    if (memberError) throw new Error(`Could not load atlas members: ${memberError.message}`)
    const members = memberData as AtlasMemberRow[]
    if (members.length === 0) return []

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, photo_url, map_colour')
      .in('id', members.map((member) => member.profile_id))

    if (error) throw new Error(`Could not load profiles: ${error.message}`)
    const profilesById = new Map((data as ProfileRow[]).map((profile) => [profile.id, profile]))
    return members
      .map((member) => {
        const profile = profilesById.get(member.profile_id)
        return profile ? toProfile(profile, atlasId, member.role) : null
      })
      .filter((profile): profile is Profile => profile !== null)
  }

  async getProfile(atlasId: string, profileId: string): Promise<Profile | null> {
    const { data: memberData, error: memberError } = await supabase
      .from('atlas_members')
      .select('profile_id, role')
      .eq('atlas_id', atlasId)
      .eq('profile_id', profileId)
      .maybeSingle()

    if (memberError) throw new Error(`Could not load atlas member: ${memberError.message}`)
    if (!memberData) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, photo_url, map_colour')
      .eq('id', profileId)
      .maybeSingle()

    if (error) throw new Error(`Could not load profile: ${error.message}`)
    return data ? toProfile(data as ProfileRow, atlasId, (memberData as AtlasMemberRow).role) : null
  }

  async saveProfile(profile: Profile): Promise<void> {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: profile.id,
      name: profile.name,
      photo_url: profile.photoUrl || null,
      map_colour: profile.mapColour,
    })

    if (profileError) throw new Error(`Could not save profile: ${profileError.message}`)

    const { error: memberError } = await supabase.from('atlas_members').upsert({
      atlas_id: profile.atlasId,
      profile_id: profile.id,
      role: profile.role,
    })

    if (memberError) throw new Error(`Could not save atlas membership: ${memberError.message}`)
  }
}