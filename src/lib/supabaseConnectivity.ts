import { supabase } from './supabaseClient'

export async function checkSupabaseConnectivity(): Promise<boolean> {
  const { error } = await supabase.from('atlases').select('id').limit(1)

  if (!error) {
    console.info('[Supabase] Connectivity check succeeded.')
    return true
  }

  if (error.status === 401 || error.status === 403) {
    console.info('[Supabase] Reachable; request was rejected by RLS without authentication.')
    return true
  }

  console.warn('[Supabase] Connectivity check failed:', error.message)
  return false
}