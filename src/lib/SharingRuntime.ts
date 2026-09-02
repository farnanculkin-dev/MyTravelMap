import { supabase } from './supabaseClient'

export type ConnectedProfileSummary = {
  connectionId: string
  personId: string
  displayName: string
  relationshipLabel?: string
  connectionType: 'relative' | 'friend' | 'family'
  status: 'saved' | 'invited' | 'connected'
}

export type SharedTripSummary = {
  tripId: string
  title: string
  startDate?: string
  endDate?: string
  description?: string
  direction?: 'shared_by_me' | 'shared_with_me'
  sharedByName?: string
  connectionId?: string
}

export async function loadConnectedProfile(connectionId: string): Promise<ConnectedProfileSummary> {
  const { data, error } = await supabase.rpc('get_connected_profile', { p_connection_id: connectionId })
  if (error) throw new Error(`Could not load connected profile: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Connected profile not found.')
  return {
    connectionId: row.connection_id,
    personId: row.person_id,
    displayName: row.display_name,
    relationshipLabel: row.relationship_label || undefined,
    connectionType: row.connection_type,
    status: row.status,
  }
}

export async function loadSharedTripsForConnection(connectionId: string): Promise<SharedTripSummary[]> {
  const { data, error } = await supabase.rpc('get_shared_trips_for_connection', { p_connection_id: connectionId })
  if (error) throw new Error(`Could not load shared trips: ${error.message}`)
  return (data || []).map((row: any) => ({
    tripId: row.trip_id,
    title: row.title,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    description: row.description || undefined,
    direction: row.direction,
  }))
}

export async function loadTripsSharedWithMe(): Promise<SharedTripSummary[]> {
  const { data, error } = await supabase.rpc('get_trips_shared_with_me')
  if (error) throw new Error(`Could not load trips shared with you: ${error.message}`)
  return (data || []).map((row: any) => ({
    connectionId: row.connection_id,
    tripId: row.trip_id,
    title: row.title,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    description: row.description || undefined,
    sharedByName: row.shared_by_name || undefined,
  }))
}

export async function loadTripShareConnectionIds(tripId: string): Promise<string[]> {
  const { data, error } = await supabase.from('trip_connection_shares').select('connection_id').eq('trip_id', tripId)
  if (error) throw new Error(`Could not load trip sharing: ${error.message}`)
  return (data || []).map((row: any) => row.connection_id)
}

export async function setTripSharedWithConnection(tripId: string, connectionId: string, shared: boolean): Promise<void> {
  if (shared) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) throw new Error('You must be signed in to share a trip.')
    const { error } = await supabase.from('trip_connection_shares').upsert({ trip_id: tripId, connection_id: connectionId, shared_by_user_id: userData.user.id }, { onConflict: 'trip_id,connection_id' })
    if (error) throw new Error(`Could not share trip: ${error.message}`)
  } else {
    const { error } = await supabase.from('trip_connection_shares').delete().eq('trip_id', tripId).eq('connection_id', connectionId)
    if (error) throw new Error(`Could not remove trip sharing: ${error.message}`)
  }
}
