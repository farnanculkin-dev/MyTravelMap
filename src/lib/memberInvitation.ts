import { supabase } from './supabaseClient'

export async function inviteMum(atlasId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc('create_atlas_member_invitation', {
    p_atlas_id: atlasId,
    p_profile_key: 'mum',
    p_email: email.trim(),
  })
  if (error) throw new Error(`Could not create Mum's invitation: ${error.message}`)

  const { error: emailError } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin },
  })
  if (emailError) throw new Error(`Invitation was prepared, but the sign-in email could not be sent: ${emailError.message}`)
}

export async function consumePendingInvitation(): Promise<void> {
  const { error } = await supabase.rpc('consume_atlas_member_invitation')
  if (error) throw new Error(`Could not apply the pending Atlas invitation: ${error.message}`)
}