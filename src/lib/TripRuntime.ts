import type { Trip } from '../domain'
import { supabase } from './supabaseClient'

type TripRow = {
  id: string
  created_in_atlas_id: string
  owner_person_id: string
  title: string
  start_date: string | null
  end_date: string | null
  description: string | null
  cover_photo_path: string | null
  visibility: 'atlas' | 'private'
  created_at: string
  updated_at: string
}

type ParticipantRow = { trip_id: string; person_id: string }
type CountryRow = { trip_id: string; country_id: string }
type PersonRow = { id: string; display_name: string }

async function signCover(path?: string | null) {
  if (!path) return undefined
  const { data, error } = await supabase.storage.from('atlas-media').createSignedUrl(path, 3600)
  if (error) throw new Error(`Could not load trip cover photo: ${error.message}`)
  return data.signedUrl
}

export async function loadTrips(atlasId: string): Promise<Trip[]> {
  const { data: tripRows, error: tripsError } = await supabase
    .from('trips')
    .select('id, created_in_atlas_id, owner_person_id, title, start_date, end_date, description, cover_photo_path, visibility, created_at, updated_at')
    .eq('created_in_atlas_id', atlasId)
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (tripsError) throw new Error(`Could not load trips: ${tripsError.message}`)
  const trips = (tripRows || []) as TripRow[]
  if (trips.length === 0) return []

  const tripIds = trips.map((trip) => trip.id)
  const [{ data: participantRows, error: participantError }, { data: countryRows, error: countryError }] = await Promise.all([
    supabase.from('trip_participants').select('trip_id, person_id').in('trip_id', tripIds),
    supabase.from('trip_countries').select('trip_id, country_id').in('trip_id', tripIds),
  ])
  if (participantError) throw new Error(`Could not load trip participants: ${participantError.message}`)
  if (countryError) throw new Error(`Could not load trip countries: ${countryError.message}`)

  const participants = (participantRows || []) as ParticipantRow[]
  const personIds = [...new Set(participants.map((row) => row.person_id))]
  let people: PersonRow[] = []
  if (personIds.length > 0) {
    const { data: personRows, error: peopleError } = await supabase
      .from('people')
      .select('id, display_name')
      .in('id', personIds)
    if (peopleError) throw new Error(`Could not load trip people: ${peopleError.message}`)
    people = (personRows || []) as PersonRow[]
  }
  const personNames = new Map(people.map((person) => [person.id, person.display_name]))
  const countries = (countryRows || []) as CountryRow[]

  return Promise.all(trips.map(async (row) => {
    const tripParticipants = participants.filter((participant) => participant.trip_id === row.id)
    const coverPhotoUrl = await signCover(row.cover_photo_path)
    return {
      id: row.id,
      atlasId: row.created_in_atlas_id,
      ownerPersonId: row.owner_person_id,
      title: row.title,
      ...(row.start_date ? { startDate: row.start_date } : {}),
      ...(row.end_date ? { endDate: row.end_date } : {}),
      ...(row.description ? { description: row.description } : {}),
      ...(coverPhotoUrl ? { coverPhotoUrl } : {}),
      visibility: row.visibility,
      participantIds: tripParticipants.map((participant) => participant.person_id),
      participantNames: tripParticipants.map((participant) => personNames.get(participant.person_id) || 'Family member'),
      countryIds: countries.filter((country) => country.trip_id === row.id).map((country) => country.country_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }))
}

export async function createTrip(input: {
  atlasId: string
  title: string
  startDate?: string
  endDate?: string
  description?: string
  visibility: 'atlas' | 'private'
  participantPersonIds: string[]
  countryIds: string[]
}): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('You must be signed in to create a trip.')

  const { data: ownerProfile, error: ownerError } = await supabase
    .from('profiles')
    .select('person_id')
    .eq('atlas_id', input.atlasId)
    .eq('linked_user_id', userData.user.id)
    .maybeSingle()
  if (ownerError) throw new Error(`Could not resolve your Family Atlas identity: ${ownerError.message}`)
  if (!ownerProfile?.person_id) throw new Error('Your Family Atlas profile is not linked to a Person identity.')

  const title = input.title.trim()
  if (!title) throw new Error('Trip name is required.')

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      created_in_atlas_id: input.atlasId,
      owner_person_id: ownerProfile.person_id,
      created_by_user_id: userData.user.id,
      title,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      description: input.description?.trim() || null,
      visibility: input.visibility,
    })
    .select('id')
    .single()
  if (tripError || !trip) throw new Error(`Could not create trip: ${tripError?.message || 'Unknown error'}`)

  const participantIds = [...new Set([ownerProfile.person_id, ...input.participantPersonIds].filter(Boolean))]
  try {
    const { error: participantError } = await supabase
      .from('trip_participants')
      .insert(participantIds.map((personId) => ({ trip_id: trip.id, person_id: personId })))
    if (participantError) throw new Error(`Could not save trip participants: ${participantError.message}`)

    const countryIds = [...new Set(input.countryIds.map((id) => id.trim()).filter(Boolean))]
    if (countryIds.length > 0) {
      const { error: countryError } = await supabase
        .from('trip_countries')
        .insert(countryIds.map((countryId) => ({ trip_id: trip.id, country_id: countryId })))
      if (countryError) throw new Error(`Could not save trip countries: ${countryError.message}`)
    }
  } catch (error) {
    await supabase.from('trips').delete().eq('id', trip.id)
    throw error
  }

  return trip.id
}

export async function updateTrip(input: {
  tripId: string
  title: string
  startDate?: string
  endDate?: string
  description?: string
  visibility: 'atlas' | 'private'
  participantPersonIds: string[]
  countryIds: string[]
}): Promise<void> {
  const title = input.title.trim()
  if (!title) throw new Error('Trip name is required.')

  const { data: currentTrip, error: currentError } = await supabase
    .from('trips')
    .select('owner_person_id')
    .eq('id', input.tripId)
    .single()
  if (currentError || !currentTrip) throw new Error(`Could not load trip for editing: ${currentError?.message || 'Unknown error'}`)

  const participantIds = [...new Set([currentTrip.owner_person_id, ...input.participantPersonIds].filter(Boolean))]
  const countryIds = [...new Set(input.countryIds.map((id) => id.trim()).filter(Boolean))]

  const { error: tripError } = await supabase
    .from('trips')
    .update({
      title,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      description: input.description?.trim() || null,
      visibility: input.visibility,
    })
    .eq('id', input.tripId)
  if (tripError) throw new Error(`Could not update trip: ${tripError.message}`)

  const { error: removeParticipantsError } = await supabase.from('trip_participants').delete().eq('trip_id', input.tripId)
  if (removeParticipantsError) throw new Error(`Could not update trip participants: ${removeParticipantsError.message}`)
  if (participantIds.length > 0) {
    const { error: participantError } = await supabase
      .from('trip_participants')
      .insert(participantIds.map((personId) => ({ trip_id: input.tripId, person_id: personId })))
    if (participantError) throw new Error(`Could not save trip participants: ${participantError.message}`)
  }

  const { error: removeCountriesError } = await supabase.from('trip_countries').delete().eq('trip_id', input.tripId)
  if (removeCountriesError) throw new Error(`Could not update trip countries: ${removeCountriesError.message}`)
  if (countryIds.length > 0) {
    const { error: countryError } = await supabase
      .from('trip_countries')
      .insert(countryIds.map((countryId) => ({ trip_id: input.tripId, country_id: countryId })))
    if (countryError) throw new Error(`Could not save trip countries: ${countryError.message}`)
  }
}
