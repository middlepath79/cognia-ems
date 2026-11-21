create policy memberships_read_platform_admin on public.school_memberships
for select to authenticated
using (public.is_platform_super_admin());

create policy memberships_insert_platform_admin on public.school_memberships
for insert to authenticated
with check (public.is_platform_super_admin() and role <> 'platform_super_admin');

create policy memberships_update_platform_admin on public.school_memberships
for update to authenticated
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin() and role <> 'platform_super_admin');

create policy profiles_read_platform_admin on public.profiles
for select to authenticated
using (public.is_platform_super_admin());

grant insert, update on public.school_memberships to authenticated;

create function public.approve_school_onboarding(target_school_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_super_admin() then
    raise exception 'Platform administrator access is required';
  end if;
  update public.schools set status = 'active' where id = target_school_id and status = 'pending_review';
  if not found then
    raise exception 'School is not pending review';
  end if;
  update public.school_onboarding set status = 'active' where school_id = target_school_id and status = 'pending_review';
end;
$$;

revoke all on function public.approve_school_onboarding(uuid) from public, anon;
grant execute on function public.approve_school_onboarding(uuid) to authenticated;
