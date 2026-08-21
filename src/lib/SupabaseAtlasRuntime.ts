import type { Atlas, Profile } from '../domain'
import { SupabaseAtlasRepository } from './SupabaseAtlasRepository'
import { SupabaseProfileRepository } from './SupabaseProfileRepository'
import { SupabaseTravelRepository } from './SupabaseTravelRepository'
import { supabase } from './supabaseClient'

export interface CloudAtlasData {
  atlas: Atlas
  profiles: Profile[]
  visitedByProfile: Record<string, string[]>
  groupImage: string | null
  profileImages: Record<string, string | null>
}

async function signedUrl(path: string | undefined): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from('atlas-media').createSignedUrl(path, 3600)
  if (error) throw new Error(`Could not load private media: ${error.message}`)
  return data.signedUrl
}

export async function loadSupabaseAtlas(atlasId: string): Promise<CloudAtlasData> {
  const atlasRepo = new SupabaseAtlasRepository()
  const profileRepo = new SupabaseProfileRepository()
  const travelRepo = new SupabaseTravelRepository()
  const atlas = await atlasRepo.getAtlas(atlasId)
  if (!atlas) throw new Error('Your Family Atlas could not be found.')
  const profiles = await profileRepo.getProfiles(atlasId)
  const customerZeroOrder = ['mum', 'dad', 'amelia', 'dylan', 'cian']
  profiles.sort((left, right) => {
    const leftIndex = customerZeroOrder.indexOf(left.profileKey || '')
    const rightIndex = customerZeroOrder.indexOf(right.profileKey || '')
    if (leftIndex === -1 && rightIndex === -1) return left.name.localeCompare(right.name)
    if (leftIndex === -1) return 1
    if (rightIndex === -1) return -1
    return leftIndex - rightIndex
  })
  const travelEntries = await Promise.all(profiles.map(async (profile) => [profile.id, await travelRepo.getVisited(profile.id)] as const))
  const profileImages = Object.fromEntries(await Promise.all(profiles.map(async (profile) => [profile.id, await signedUrl(profile.photoUrl)] as const)))
  return {
    atlas,
    profiles,
    visitedByProfile: Object.fromEntries(travelEntries),
    groupImage: await signedUrl(atlas.groupPhotoUrl),
    profileImages,
  }
}

export async function saveCloudVisited(profileId: string, visitedCountryIds: string[]): Promise<void> {
  await new SupabaseTravelRepository().setVisited(profileId, visitedCountryIds)
}

export async function saveCloudMapColour(profileId: string, color: string): Promise<void> {
  await new SupabaseTravelRepository().setMapColor(profileId, color)
}

export async function uploadCloudMedia({
  atlasId,
  profileId,
  kind,
  dataUrl,
}: {
  atlasId: string
  profileId?: string
  kind: 'group' | 'profile'
  dataUrl: string
}): Promise<string> {
  const extension = dataUrl.match(/^data:image\/([a-z0-9.+-]+);/i)?.[1]?.replace('jpeg', 'jpg') || 'webp'
  const path = kind === 'group'
    ? `${atlasId}/group/group-photo.${extension}`
    : `${atlasId}/profiles/${profileId}/profile-photo.${extension}`
  const [header, encoded] = dataUrl.split(',', 2)
  const mime = header.match(/^data:([^;]+);base64$/)?.[1]
  if (!mime || !encoded) throw new Error('Invalid image data')
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const { error: uploadError } = await supabase.storage.from('atlas-media').upload(path, new Blob([bytes], { type: mime }), { contentType: mime, upsert: true })
  if (uploadError) throw new Error(`Could not upload private photo: ${uploadError.message}`)
  const table = kind === 'group' ? 'atlases' : 'profiles'
  const column = kind === 'group' ? 'group_photo_path' : 'photo_path'
  const key = kind === 'group' ? atlasId : profileId
  const { error } = await supabase.from(table).update({ [column]: path }).eq('id', key)
  if (error) throw new Error(`Could not save private photo path: ${error.message}`)
  return (await signedUrl(path)) || ''
}