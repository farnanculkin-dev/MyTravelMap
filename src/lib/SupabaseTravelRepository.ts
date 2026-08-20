import type { ProfileTravel } from '../domain'
import type { AsyncTravelRepository } from './TravelRepository'
import { supabase } from './supabaseClient'

type ProfileTravelRow = {
  profile_id: string
  visited_country_ids: string[] | null
}

export class SupabaseTravelRepository implements AsyncTravelRepository {
  async getProfileTravel(profileId: string): Promise<ProfileTravel> {
    const { data, error } = await supabase
      .from('profile_travel')
      .select('profile_id, visited_country_ids')
      .eq('profile_id', profileId)
      .maybeSingle()

    if (error) throw new Error(`Could not load travel data: ${error.message}`)
    const row = data as ProfileTravelRow | null
    return {
      profileId,
      visitedCountryIds: row?.visited_country_ids || [],
    }
  }

  async setProfileTravel(profileTravel: ProfileTravel): Promise<void> {
    const { error } = await supabase.from('profile_travel').upsert({
      profile_id: profileTravel.profileId,
      visited_country_ids: profileTravel.visitedCountryIds,
    })

    if (error) throw new Error(`Could not save travel data: ${error.message}`)
  }

  async getVisited(profileId: string): Promise<string[]> {
    return (await this.getProfileTravel(profileId)).visitedCountryIds
  }

  async setVisited(profileId: string, visitedCountryIds: string[]): Promise<void> {
    await this.setProfileTravel({ profileId, visitedCountryIds })
  }

  async getMapColor(profileId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('map_colour')
      .eq('id', profileId)
      .maybeSingle()

    if (error) throw new Error(`Could not load map colour: ${error.message}`)
    return (data as { map_colour?: string | null } | null)?.map_colour || null
  }

  async setMapColor(profileId: string, color: string): Promise<void> {
    const { error } = await supabase.from('profiles').update({ map_colour: color }).eq('id', profileId)
    if (error) throw new Error(`Could not save map colour: ${error.message}`)
  }
}