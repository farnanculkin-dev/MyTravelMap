import { supabase } from './supabaseClient'

const DEVELOP_REVIEW_ORIGIN = 'https://my-travel-map-git-develop-farnanculkin-devs-projects.vercel.app'

export type AtlasConnection = {
  id: string
  personId: string
  displayName: string
  relationshipLabel?: string
  connectionType: 'relative' | 'friend' | 'family'
  email?: string
  status: 'saved' | 'invited' | 'connected'
}

type ConnectionRow = {
  id: string
  person_id: string
  relationship_label: string | null
  connection_type: AtlasConnection['connectionType']
  email: string | null
  status: AtlasConnection['status']
  people: { display_name: string } | { display_name: string }[] | null
}

function invitationRedirectUrl(): string {
  const origin = window.location.hostname.endsWith('.vercel.app') ? DEVELOP_REVIEW_ORIGIN : window.location.origin
  return `${origin}/?connectionInvite=1`
}

export async function loadAtlasConnections(atlasId: string): Promise<AtlasConnection[]> {
  const { data, error } = await supabase
    .from('atlas_connections')
    .select('id, person_id, relationship_label, connection_type, email, status, people!atlas_connections_person_id_fkey(display_name)')
    .eq('atlas_id', atlasId)
    .order('created_at')

  if (error) throw new Error(`Could not load connections: ${error.message}`)
  return ((data || []) as ConnectionRow[]).map((row) => {
    const person = Array.isArray(row.people) ? row.people[0] : row.people
    return {
      id: row.id,
      personId: row.person_id,
      displayName: person?.display_name || 'Connection',
      relationshipLabel: row.relationship_label || undefined,
      connectionType: row.connection_type,
      email: row.email || undefined,
      status: row.status,
    }
  })
}

export async function createAtlasConnection(input: {
  atlasId: string
  displayName: string
  relationshipLabel?: string
  connectionType: AtlasConnection['connectionType']
  email?: string
}): Promise<{ connectionId: string; personId: string }> {
  const { data, error } = await supabase.rpc('create_atlas_connection', {
    p_atlas_id: input.atlasId,
    p_display_name: input.displayName.trim(),
    p_relationship_label: input.relationshipLabel?.trim() || null,
    p_connection_type: input.connectionType,
    p_email: input.email?.trim() || null,
  })
  if (error) throw new Error(`Could not add connection: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.connection_id || !row?.person_id) throw new Error('Connection was created but no identifier was returned.')
  return { connectionId: row.connection_id, personId: row.person_id }
}

export async function inviteAtlasConnection(connectionId: string, email: string): Promise<void> {
  const cleanedEmail = email.trim()
  const { data, error } = await supabase.functions.invoke('invite-atlas-connection', {
    body: {
      connectionId,
      email: cleanedEmail,
      redirectTo: invitationRedirectUrl(),
    },
  })

  if (error) throw new Error(`Connection invitation could not be sent: ${error.message}`)
  if (data?.error) throw new Error(String(data.error))
}

export async function consumePendingConnectionInvitation(): Promise<void> {
  const { error } = await supabase.rpc('consume_atlas_connection_invitation')
  if (error) throw new Error(`Could not apply the pending connection invitation: ${error.message}`)
}
