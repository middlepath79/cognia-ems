create or replace function public.create_school_invitation(
  target_school_id uuid,
  invite_email text,
  invite_role public.app_role,
  invite_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_invitation_id uuid;
  pending_staff_record_id uuid;
  normalized_email text := lower(trim(invite_email));
begin
  if not private.has_school_role(target_school_id, array['school_admin']::public.app_role[]) then
    raise exception 'School administrator access is required';
  end if;
  if invite_role not in ('school_admin', 'teacher', 'staff', 'student', 'parent') then
    raise exception 'This role cannot be invited to a school';
  end if;
  if normalized_email is null or position('@' in normalized_email) < 2 then
    raise exception 'Enter a valid email address';
  end if;
  if invite_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'A valid invitation token hash is required';
  end if;

  if invite_role in ('teacher', 'staff') then
    select sr.id
    into pending_staff_record_id
    from public.staff_records sr
    where sr.school_id = target_school_id
      and lower(trim(sr.email)) = normalized_email
      and sr.user_id is null
      and sr.account_status in ('pending', 'invited')
      and (
        (invite_role = 'teacher' and sr.staff_category = 'teaching')
        or (invite_role = 'staff' and sr.staff_category = 'non_teaching')
      )
    for update;
    if not found then
      raise exception 'Create a matching pending staff profile before inviting this role';
    end if;
  end if;

  insert into public.school_invitations (school_id, email, role, token_hash, invited_by, expires_at)
  values (target_school_id, normalized_email, invite_role, invite_token_hash, (select auth.uid()), now() + interval '7 days')
  returning id into new_invitation_id;

  if pending_staff_record_id is not null then
    update public.staff_records
    set account_status = 'invited'
    where id = pending_staff_record_id
      and school_id = target_school_id
      and user_id is null
      and account_status = 'pending';
  end if;
  return new_invitation_id;
end;
$$;
revoke all on function public.create_school_invitation(uuid, text, public.app_role, text)
  from public, anon, authenticated;

create or replace function public.accept_school_invitation(invite_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.school_invitations%rowtype;
  signed_in_email text;
  email_confirmed_at timestamptz;
  pending_staff_record_id uuid;
  linked_rows integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  select lower(trim(u.email)), u.email_confirmed_at
  into signed_in_email, email_confirmed_at
  from auth.users u
  where u.id = (select auth.uid());
  if not found or email_confirmed_at is null or signed_in_email is null then
    raise exception 'A confirmed email address is required';
  end if;
  if invite_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'A valid invitation token is required';
  end if;

  select *
  into invite
  from public.school_invitations i
  where i.token_hash = invite_token_hash
    and i.status = 'pending'
    and i.expires_at > now()
  for update;
  if not found or invite.email is distinct from signed_in_email then
    raise exception 'Invitation is invalid, expired, or belongs to another email account';
  end if;
  if not exists (
    select 1 from public.schools s
    where s.id = invite.school_id and s.status = 'active'
  ) then
    raise exception 'The invited institution is not active';
  end if;

  if invite.role in ('teacher', 'staff') then
    select sr.id
    into pending_staff_record_id
    from public.staff_records sr
    where sr.school_id = invite.school_id
      and lower(trim(sr.email)) = signed_in_email
      and sr.user_id is null
      and sr.account_status = 'invited'
      and (
        (invite.role = 'teacher' and sr.staff_category = 'teaching')
        or (invite.role = 'staff' and sr.staff_category = 'non_teaching')
      )
    for update;
    if not found then
      raise exception 'A matching invited staff profile is required';
    end if;
  end if;

  insert into public.school_memberships (school_id, user_id, role, status)
  values (invite.school_id, (select auth.uid()), invite.role, 'active');

  if pending_staff_record_id is not null then
    update public.staff_records
    set user_id = (select auth.uid()),
        account_status = 'active'
    where id = pending_staff_record_id
      and school_id = invite.school_id
      and lower(trim(email)) = signed_in_email
      and user_id is null
      and account_status = 'invited'
      and (
        (invite.role = 'teacher' and staff_category = 'teaching')
        or (invite.role = 'staff' and staff_category = 'non_teaching')
      );
    get diagnostics linked_rows = row_count;
    if linked_rows <> 1 then
      raise exception 'The staff profile could not be linked to this invitation';
    end if;
  end if;

  update public.school_invitations
  set status = 'accepted',
      accepted_by = (select auth.uid()),
      accepted_at = now()
  where id = invite.id
    and status = 'pending';
  get diagnostics linked_rows = row_count;
  if linked_rows <> 1 then
    raise exception 'The invitation could not be marked as accepted';
  end if;
  return invite.school_id;
end;
$$;
revoke all on function public.accept_school_invitation(text)
  from public, anon, authenticated;

create or replace function public.update_my_staff_contact(
  target_school_id uuid,
  target_phone text,
  target_address text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_school_id uuid;
  staff_record_id uuid;
  linked_rows integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  if target_phone is not null and char_length(target_phone) > 40 then
    raise exception 'Phone number must be 40 characters or fewer';
  end if;
  if target_address is not null and char_length(target_address) > 500 then
    raise exception 'Address must be 500 characters or fewer';
  end if;

  select sr.id, sr.school_id
  into staff_record_id, staff_school_id
  from public.staff_records sr
  where sr.school_id = target_school_id
    and sr.user_id = (select auth.uid())
    and sr.account_status = 'active';
  if not found
     or not private.has_school_role(staff_school_id, array['teacher', 'staff']::public.app_role[]) then
    raise exception 'Active staff profile access is required';
  end if;

  update public.staff_records
  set phone = nullif(trim(target_phone), ''),
      address = nullif(trim(target_address), '')
  where id = staff_record_id
    and school_id = staff_school_id
    and user_id = (select auth.uid())
    and account_status = 'active';
  get diagnostics linked_rows = row_count;
  if linked_rows <> 1 then
    raise exception 'Staff contact details could not be updated';
  end if;
end;
$$;
revoke all on function public.update_my_staff_contact(uuid, text, text)
  from public, anon, authenticated;

revoke all on function public.create_school_invitation(uuid, text, public.app_role, text) from public, anon;
grant execute on function public.create_school_invitation(uuid, text, public.app_role, text) to authenticated;
revoke all on function public.accept_school_invitation(text) from public, anon;
grant execute on function public.accept_school_invitation(text) to authenticated;
revoke all on function public.update_my_staff_contact(uuid, text, text) from public, anon;
grant execute on function public.update_my_staff_contact(uuid, text, text) to authenticated;
