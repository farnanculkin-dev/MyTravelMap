-- Connection RPCs are intentionally callable only by authenticated users.
revoke all on function public.create_atlas_connection(uuid,text,text,text,text) from public, anon;
revoke all on function public.invite_atlas_connection(uuid,text) from public, anon;
revoke all on function public.consume_atlas_connection_invitation() from public, anon;

grant execute on function public.create_atlas_connection(uuid,text,text,text,text) to authenticated;
grant execute on function public.invite_atlas_connection(uuid,text) to authenticated;
grant execute on function public.consume_atlas_connection_invitation() to authenticated;
