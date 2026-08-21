import { CUSTOMER_ZERO_PROFILES } from '../data/customerZero'
import { getStoredImage } from './ImageStorage'
import { LocalStorageTravelRepository } from './LocalStorageTravelRepository'
import { supabase } from './supabaseClient'

const CUSTOMER_ZERO_KEYS = ['mum', 'dad', 'amelia', 'dylan', 'cian'] as const
const DEFAULT_MAP_COLOURS: Record<string, string> = Object.fromEntries(
  CUSTOMER_ZERO_PROFILES.map((profile) => [profile.id, profile.mapColour]),
)
const localTravelRepository = new LocalStorageTravelRepository()

type CloudProfile = {
  id: string
  profile_key: string
  atlas_id: string
  name: string
  map_colour: string | null
  photo_path: string | null
  linked_user_id: string | null
  role: 'admin' | 'member' | 'child'
}

type CloudTravel = {
  profile_id: string
  visited_country_ids: string[] | null
}

export interface MigrationSummary {
  atlasId: string
  profilesFound: number
  profilesCreated: number
  travelRecordsFound: number
  travelRecordsCreated: number
  profileTravelMigrated: number
  coloursMigrated: number
  groupPhotoMigrated: boolean
  profilePhotosMigrated: number
  skipped: string[]
  warnings: string[]
  errors: string[]
}

function extensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([a-z0-9.+-]+);/i)
  const extension = match?.[1]?.toLowerCase()
  return extension === 'jpeg' ? 'jpg' : extension || 'webp'
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',', 2)
  if (!header || !encoded) throw new Error('Invalid local image data')
  const mime = header.match(/^data:([^;]+);base64$/)?.[1]
  if (!mime) throw new Error('Unsupported local image format')
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mime })
}

async function uploadPrivateImage(path: string, dataUrl: string): Promise<void> {
  const { error } = await supabase.storage
    .from('atlas-media')
    .upload(path, dataUrlToBlob(dataUrl), { contentType: dataUrl.slice(5, dataUrl.indexOf(';')), upsert: false })
  if (error && !error.message.toLowerCase().includes('already exists')) throw new Error(error.message)
}

function localTravel(profileKey: string): string[] {
  return localTravelRepository.getVisited(profileKey)
}

function localColour(profileKey: string): string {
  return localTravelRepository.getMapColor(profileKey) || DEFAULT_MAP_COLOURS[profileKey]
}

export async function migrateCustomerZero(atlasId: string): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    atlasId,
    profilesFound: 0,
    profilesCreated: 0,
    travelRecordsFound: 0,
    travelRecordsCreated: 0,
    profileTravelMigrated: 0,
    coloursMigrated: 0,
    groupPhotoMigrated: false,
    profilePhotosMigrated: 0,
    skipped: [],
    warnings: [],
    errors: [],
  }

  const { data: existingProfiles, error: profileLoadError } = await supabase
    .from('profiles')
    .select('id, profile_key, atlas_id, name, map_colour, photo_path, linked_user_id, role')
    .eq('atlas_id', atlasId)

  if (profileLoadError) throw new Error(`Could not load cloud profiles: ${profileLoadError.message}`)
  const profilesByKey = new Map((existingProfiles as CloudProfile[]).map((profile) => [profile.profile_key, profile]))
  summary.profilesFound = profilesByKey.size

  for (const profileKey of CUSTOMER_ZERO_KEYS) {
    let cloudProfile = profilesByKey.get(profileKey)
    if (!cloudProfile) {
      const seed = CUSTOMER_ZERO_PROFILES.find((profile) => profile.id === profileKey)!
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          atlas_id: atlasId,
          profile_key: profileKey,
          name: seed.name,
          map_colour: localColour(profileKey),
          linked_user_id: null,
          photo_path: null,
          role: seed.role,
        })
        .select('id, profile_key, atlas_id, name, map_colour, photo_path, linked_user_id, role')
        .single()

      if (error) {
        summary.errors.push(`Could not create ${seed.name}: ${error.message}`)
        continue
      }
      cloudProfile = data as CloudProfile
      profilesByKey.set(profileKey, cloudProfile)
      summary.profilesCreated += 1
    }

    const localPhoto = getStoredImage('profile', profileKey)
    if (localPhoto && !cloudProfile.photo_path) {
      const path = `${atlasId}/profiles/${cloudProfile.id}/profile-photo.${extensionFromDataUrl(localPhoto)}`
      try {
        await uploadPrivateImage(path, localPhoto)
        const { error } = await supabase.from('profiles').update({ photo_path: path }).eq('id', cloudProfile.id)
        if (error) throw new Error(error.message)
        summary.profilePhotosMigrated += 1
      } catch (error) {
        summary.errors.push(`Could not migrate ${profileKey} profile photo: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    } else if (localPhoto && cloudProfile.photo_path) {
      summary.skipped.push(`${profileKey} profile photo already exists in cloud`)
    }

    const colour = localColour(profileKey)
    const hasMeaningfulLocalColour = localColour(profileKey) !== DEFAULT_MAP_COLOURS[profileKey]
    const cloudHasOnlySeedColour = !cloudProfile.map_colour || cloudProfile.map_colour === DEFAULT_MAP_COLOURS[profileKey]
    if (hasMeaningfulLocalColour && cloudHasOnlySeedColour) {
      const { error } = await supabase.from('profiles').update({ map_colour: colour }).eq('id', cloudProfile.id)
      if (error) summary.errors.push(`Could not migrate ${profileKey} map colour: ${error.message}`)
      else summary.coloursMigrated += 1
    } else {
      summary.skipped.push(`${profileKey} cloud map colour already exists`)
    }

    const { data: travelData, error: travelLoadError } = await supabase
      .from('profile_travel')
      .select('profile_id, visited_country_ids')
      .eq('profile_id', cloudProfile.id)
      .maybeSingle()

    if (travelLoadError) {
      summary.errors.push(`Could not load ${profileKey} travel data: ${travelLoadError.message}`)
      continue
    }
    const cloudTravel = travelData as CloudTravel | null
    if (cloudTravel) summary.travelRecordsFound += 1
    if (!cloudTravel) {
      const { error } = await supabase.from('profile_travel').insert({
        profile_id: cloudProfile.id,
        visited_country_ids: localTravel(profileKey),
      })
      if (error) summary.errors.push(`Could not create ${profileKey} travel row: ${error.message}`)
      else {
        summary.travelRecordsCreated += 1
        summary.profileTravelMigrated += 1
      }
    } else if ((cloudTravel.visited_country_ids || []).length === 0 && localTravel(profileKey).length > 0) {
      const { error } = await supabase.from('profile_travel').update({ visited_country_ids: localTravel(profileKey) }).eq('profile_id', cloudProfile.id)
      if (error) summary.errors.push(`Could not migrate ${profileKey} travel data: ${error.message}`)
      else summary.profileTravelMigrated += 1
    } else {
      summary.skipped.push(`${profileKey} cloud travel data already exists`)
    }
  }

  const localGroupPhoto = getStoredImage('group')
  if (localGroupPhoto) {
    const { data: atlas, error: atlasError } = await supabase.from('atlases').select('group_photo_path').eq('id', atlasId).single()
    if (atlasError) summary.errors.push(`Could not load Atlas photo path: ${atlasError.message}`)
    else if (!atlas.group_photo_path) {
      const path = `${atlasId}/group/group-photo.${extensionFromDataUrl(localGroupPhoto)}`
      try {
        await uploadPrivateImage(path, localGroupPhoto)
        const { error } = await supabase.from('atlases').update({ group_photo_path: path }).eq('id', atlasId)
        if (error) throw new Error(error.message)
        summary.groupPhotoMigrated = true
      } catch (error) {
        summary.errors.push(`Could not migrate group photo: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    } else summary.skipped.push('group photo already exists in cloud')
  }

  return summary
}