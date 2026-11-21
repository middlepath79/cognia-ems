create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_school_member(target_school_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.school_memberships m where m.school_id=target_school_id and m.user_id=(select auth.uid()) and m.status='active');
$$;
create function private.is_platform_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_administrators p where p.user_id=(select auth.uid()));
$$;
create function private.has_school_role(target_school_id uuid, allowed_roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.school_memberships m where m.school_id=target_school_id and m.user_id=(select auth.uid()) and m.status='active' and m.role=any(allowed_roles));
$$;
revoke all on function private.is_school_member(uuid), private.is_platform_super_admin(), private.has_school_role(uuid,public.app_role[]) from public, anon;
grant execute on function private.is_school_member(uuid), private.is_platform_super_admin(), private.has_school_role(uuid,public.app_role[]) to authenticated;

create or replace function public.create_school_invitation(target_school_id uuid, invite_email text, invite_role public.app_role, invite_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_invitation_id uuid; normalized_email text := lower(trim(invite_email));
begin
  if not private.has_school_role(target_school_id,array['school_admin']::public.app_role[]) then raise exception 'School administrator access is required'; end if;
  if invite_role not in ('school_admin','teacher','student','parent') then raise exception 'This role cannot be invited to a school'; end if;
  if normalized_email is null or position('@' in normalized_email)<2 then raise exception 'Enter a valid email address'; end if;
  if invite_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'A valid invitation token hash is required'; end if;
  insert into public.school_invitations(school_id,email,role,token_hash,invited_by,expires_at) values(target_school_id,normalized_email,invite_role,invite_token_hash,(select auth.uid()),now()+interval '7 days') returning id into new_invitation_id;
  return new_invitation_id;
end; $$;
create or replace function public.revoke_school_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare invitation_school_id uuid;
begin
  select i.school_id into invitation_school_id from public.school_invitations i where i.id=invitation_id and i.status='pending' for update;
  if not found then raise exception 'Invitation is not pending'; end if;
  if not private.has_school_role(invitation_school_id,array['school_admin']::public.app_role[]) then raise exception 'School administrator access is required'; end if;
  update public.school_invitations set status='revoked' where id=invitation_id;
end; $$;
create or replace function public.approve_school_onboarding(target_school_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_super_admin() then raise exception 'Platform administrator access is required'; end if;
  update public.schools set status='active' where id=target_school_id and status='pending_review';
  if not found then raise exception 'School is not pending review'; end if;
  update public.school_onboarding set status='active' where school_id=target_school_id and status='pending_review';
end; $$;

drop policy schools_read_member on public.schools;
drop policy schools_update_platform_admin on public.schools;
drop policy memberships_read_self_or_admin on public.school_memberships;
drop policy onboarding_read_submitter_or_platform_admin on public.school_onboarding;
drop policy onboarding_update_platform_admin on public.school_onboarding;
drop policy invitations_read_school_admin on public.school_invitations;
drop policy invitations_insert_school_admin on public.school_invitations;
drop policy memberships_read_platform_admin on public.school_memberships;
drop policy memberships_insert_platform_admin on public.school_memberships;
drop policy memberships_update_platform_admin on public.school_memberships;
drop policy profiles_read_platform_admin on public.profiles;

drop function public.is_school_member(uuid);
drop function public.is_platform_super_admin();
drop function public.has_school_role(uuid, public.app_role[]);

grant select on public.platform_administrators to authenticated;
create policy schools_read_member on public.schools for select to authenticated
using (private.is_school_member(id) or private.is_platform_super_admin());
create policy schools_update_platform_admin on public.schools for update to authenticated
using (private.is_platform_super_admin()) with check (private.is_platform_super_admin());
create policy memberships_read_self_or_admin on public.school_memberships for select to authenticated
using (user_id=(select auth.uid()) or private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy onboarding_read_submitter_or_platform_admin on public.school_onboarding for select to authenticated
using (submitted_by=(select auth.uid()) or private.is_platform_super_admin());
create policy onboarding_update_platform_admin on public.school_onboarding for update to authenticated
using (private.is_platform_super_admin()) with check (private.is_platform_super_admin());
create policy invitations_read_school_admin on public.school_invitations for select to authenticated
using (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy invitations_insert_school_admin on public.school_invitations for insert to authenticated
with check (invited_by=(select auth.uid()) and role in ('school_admin','teacher','student','parent') and private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy memberships_read_platform_admin on public.school_memberships for select to authenticated
using (private.is_platform_super_admin());
create policy memberships_insert_platform_admin on public.school_memberships for insert to authenticated
with check (private.is_platform_super_admin() and role<>'platform_super_admin');
create policy memberships_update_platform_admin on public.school_memberships for update to authenticated
using (private.is_platform_super_admin()) with check (private.is_platform_super_admin() and role<>'platform_super_admin');
create policy profiles_read_platform_admin on public.profiles for select to authenticated
using (private.is_platform_super_admin());
