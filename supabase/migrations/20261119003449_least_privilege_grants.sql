revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

revoke update on public.schools, public.school_onboarding from authenticated;
grant update (status) on public.schools, public.school_onboarding to authenticated;

revoke insert, update on public.school_memberships from authenticated;
grant insert (school_id, user_id, role, status) on public.school_memberships to authenticated;
grant update (role, status) on public.school_memberships to authenticated;

revoke insert on public.school_invitations from authenticated;
revoke select on public.school_invitations from authenticated;
grant select (id, school_id, email, role, status, expires_at, accepted_by, accepted_at, invited_by, created_at, updated_at)
on public.school_invitations to authenticated;
