import { supabase } from './supabaseClient'

export type GuestPerson = {
  id: string
  displayName: string
}

type GuestPersonRow = {
  id: string
  display_name: string
}

export async function loadGuestPeople(excludedPersonIds: string[] = []): Promise<GuestPerson[]> {
  const { data, error } = await supabase
    .from('people')
    .select('id, display_name')
    .eq('person_type', 'guest')
    .order('display_name')

  if (error) throw new Error(`Could not load people: ${error.message}`)
  const excluded = new Set(excludedPersonIds)
  return ((data || []) as GuestPersonRow[])
    .filter((person) => !excluded.has(person.id))
    .map((person) => ({ id: person.id, displayName: person.display_name }))
}

export async function createGuestPerson(displayName: string): Promise<GuestPerson> {
  const name = displayName.trim()
  if (!name) throw new Error('Name is required.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('You must be signed in to add a person.')

  const { data, error } = await supabase
    .from('people')
    .insert({
      display_name: name,
      created_by_user_id: userData.user.id,
      person_type: 'guest',
    })
    .select('id, display_name')
    .single()

  if (error || !data) throw new Error(`Could not add person: ${error?.message || 'Unknown error'}`)
  const row = data as GuestPersonRow
  return { id: row.id, displayName: row.display_name }
}
