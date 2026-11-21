create function public.revoke_school_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_school_id uuid;
begin
  select i.school_id into invitation_school_id
  from public.school_invitations i
  where i.id = invitation_id and i.status = 'pending'
  for update;
  if not found then
    raise exception 'Invitation is not pending';
  end if;
  if not public.has_school_role(invitation_school_id, array['school_admin']::public.app_role[]) then
    raise exception 'School administrator access is required';
  end if;
  update public.school_invitations set status = 'revoked' where id = invitation_id;
end;
$$;

revoke all on function public.revoke_school_invitation(uuid) from public, anon;
grant execute on function public.revoke_school_invitation(uuid) to authenticated;
