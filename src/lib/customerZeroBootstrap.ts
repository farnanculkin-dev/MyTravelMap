import type { AtlasType, ProfileRole } from '../domain'
import { supabase } from './supabaseClient'

export interface AtlasMembership {
  atlasId: string
  profileId: string
  role: ProfileRole
}

type MembershipRow = {
  atlas_id: string
  role: ProfileRole
}

type LinkedProfileRow = {
  id: string
}

type BootstrapResult = {
  atlas_id: string
  profile_id: string
}

export async function getCurrentUserAtlasMembership(): Promise<AtlasMembership | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw new Error(`Could not verify the signed-in user: ${userError.message}`)
  if (!userData.user) return null

  const { data, error } = await supabase
    .from('atlas_members')
    .select('atlas_id, role')
    .eq('user_id', userData.user.id)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Could not load Atlas membership: ${error.message}`)
  const membership = data as MembershipRow | null
  if (!membership) return null

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('atlas_id', membership.atlas_id)
    .eq('linked_user_id', userData.user.id)
    .maybeSingle()

  if (profileError) throw new Error(`Could not load your linked Atlas profile: ${profileError.message}`)
  const profile = profileData as LinkedProfileRow | null
  if (!profile) throw new Error('Your Atlas membership has no linked personal profile.')

  return { atlasId: membership.atlas_id, profileId: profile.id, role: membership.role }
}

export async function createCustomerZeroAtlas({
  atlasName,
  atlasType,
  profileName,
  mapColour,
}: {
  atlasName: string
  atlasType: AtlasType
  profileName: string
  mapColour: string
}): Promise<AtlasMembership> {
  const { data, error } = await supabase.rpc('create_atlas_with_admin_profile', {
    p_atlas_name: atlasName,
    p_atlas_type: atlasType,
    p_profile_key: 'dad',
    p_profile_name: profileName,
    p_map_colour: mapColour,
  })

  if (error) throw new Error(`Could not create your Family Atlas: ${error.message}`)

  const result = Array.isArray(data) ? data[0] : data
  const bootstrapResult = result as BootstrapResult | null
  if (!bootstrapResult?.atlas_id || !bootstrapResult.profile_id) {
    throw new Error('The Family Atlas was created, but the server returned no Atlas or profile ID.')
  }

  const membership = await getCurrentUserAtlasMembership()
  if (!membership || membership.atlasId !== bootstrapResult.atlas_id || membership.profileId !== bootstrapResult.profile_id || membership.role !== 'admin') {
    throw new Error('The Atlas was created, but the authenticated admin membership could not be confirmed.')
  }

  return {
    atlasId: bootstrapResult.atlas_id,
    profileId: bootstrapResult.profile_id,
    role: membership.role,
  }
}