create type public.app_role as enum (
  'platform_super_admin',
  'school_admin',
  'teacher',
  'student',
  'parent'
);

create type public.school_status as enum ('pending_review', 'active', 'suspended');
create type public.membership_status as enum ('active', 'invited', 'suspended');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Platform administrators are provisioned only by a trusted database operator.
create table public.platform_administrators (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.school_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null check (role <> 'platform_super_admin'),
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create table public.role_permissions (
  role public.app_role not null,
  permission text not null check (permission ~ '^[a-z][a-z0-9_.-]*$'),
  primary key (role, permission)
);

insert into public.role_permissions (role, permission) values
  ('platform_super_admin', 'platform.schools.manage'),
  ('platform_super_admin', 'platform.memberships.manage'),
  ('platform_super_admin', 'platform.invitations.manage'),
  ('school_admin', 'school.settings.manage'),
  ('school_admin', 'school.memberships.manage'),
  ('school_admin', 'school.invitations.manage'),
  ('school_admin', 'school.records.manage'),
  ('teacher', 'school.classes.assigned.read'),
  ('teacher', 'school.attendance.assigned.manage'),
  ('teacher', 'school.assessments.assigned.manage'),
  ('student', 'school.self.read'),
  ('parent', 'school.children.authorized.read');

create table public.school_onboarding (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  status public.school_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  role public.app_role not null check (role in ('school_admin', 'teacher', 'student', 'parent')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'accepted') = (accepted_at is not null and accepted_by is not null))
);

create index school_memberships_user_status_idx on public.school_memberships (user_id, status);
create index school_memberships_school_role_idx on public.school_memberships (school_id, role, status);
create index school_onboarding_submitter_idx on public.school_onboarding (submitted_by, status);
create index school_invitations_school_status_idx on public.school_invitations (school_id, status, expires_at);
create index school_invitations_email_idx on public.school_invitations (email, status);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger schools_touch_updated_at before update on public.schools
for each row execute function public.touch_updated_at();
create trigger school_memberships_touch_updated_at before update on public.school_memberships
for each row execute function public.touch_updated_at();
create trigger school_onboarding_touch_updated_at before update on public.school_onboarding
for each row execute function public.touch_updated_at();
create trigger school_invitations_touch_updated_at before update on public.school_invitations
for each row execute function public.touch_updated_at();

create function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), ''));
  return new;
end;
$$;

create trigger on_auth_user_created_profile after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create function public.is_school_member(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.school_memberships m
    where m.school_id = target_school_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create function public.is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_administrators p
    where p.user_id = (select auth.uid())
  );
$$;

create function public.has_school_role(target_school_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.school_memberships m
    where m.school_id = target_school_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (allowed_roles)
  );
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function public.is_school_member(uuid) from public, anon;
revoke all on function public.is_platform_super_admin() from public, anon;
revoke all on function public.has_school_role(uuid, public.app_role[]) from public, anon;
grant execute on function public.is_school_member(uuid) to authenticated;
grant execute on function public.is_platform_super_admin() to authenticated;
grant execute on function public.has_school_role(uuid, public.app_role[]) to authenticated;

create function public.create_school_onboarding(school_name text, school_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_school_id uuid;
  clean_name text := trim(school_name);
  clean_slug text := lower(trim(school_slug));
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  if clean_name is null or char_length(clean_name) not between 2 and 160 then
    raise exception 'Enter a school name between 2 and 160 characters';
  end if;
  if clean_slug is null or clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Enter a valid school URL name';
  end if;
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid())) then
    raise exception 'A user profile is required';
  end if;

  insert into public.schools (name, slug) values (clean_name, clean_slug)
  returning id into new_school_id;
  insert into public.school_memberships (school_id, user_id, role, status)
  values (new_school_id, (select auth.uid()), 'school_admin', 'active');
  insert into public.school_onboarding (school_id, submitted_by, status)
  values (new_school_id, (select auth.uid()), 'pending_review');
  return new_school_id;
end;
$$;

create function public.create_school_invitation(
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
  normalized_email text := lower(trim(invite_email));
begin
  if not public.has_school_role(target_school_id, array['school_admin']::public.app_role[]) then
    raise exception 'School administrator access is required';
  end if;
  if invite_role not in ('school_admin', 'teacher', 'student', 'parent') then
    raise exception 'This role cannot be invited to a school';
  end if;
  if normalized_email is null or position('@' in normalized_email) < 2 then
    raise exception 'Enter a valid email address';
  end if;
  if invite_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'A valid invitation token hash is required';
  end if;
  insert into public.school_invitations (school_id, email, role, token_hash, invited_by, expires_at)
  values (target_school_id, normalized_email, invite_role, invite_token_hash, (select auth.uid()), now() + interval '7 days')
  returning id into new_invitation_id;
  return new_invitation_id;
end;
$$;

create function public.accept_school_invitation(invite_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.school_invitations%rowtype;
  signed_in_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  select lower(u.email) into signed_in_email from auth.users u where u.id = (select auth.uid());
  select * into invite from public.school_invitations i
  where i.token_hash = invite_token_hash and i.status = 'pending' and i.expires_at > now()
  for update;
  if not found or invite.email <> signed_in_email then
    raise exception 'Invitation is invalid, expired, or belongs to another account';
  end if;
  insert into public.school_memberships (school_id, user_id, role, status)
  values (invite.school_id, (select auth.uid()), invite.role, 'active');
  update public.school_invitations
  set status = 'accepted', accepted_by = (select auth.uid()), accepted_at = now()
  where id = invite.id;
  return invite.school_id;
end;
$$;

revoke all on function public.create_school_onboarding(text, text) from public, anon;
revoke all on function public.create_school_invitation(uuid, text, public.app_role, text) from public, anon;
revoke all on function public.accept_school_invitation(text) from public, anon;
grant execute on function public.create_school_onboarding(text, text) to authenticated;
grant execute on function public.create_school_invitation(uuid, text, public.app_role, text) to authenticated;
grant execute on function public.accept_school_invitation(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.platform_administrators enable row level security;
alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;
alter table public.role_permissions enable row level security;
alter table public.school_onboarding enable row level security;
alter table public.school_invitations enable row level security;

revoke all on public.profiles, public.schools, public.school_memberships,
  public.platform_administrators, public.role_permissions, public.school_onboarding,
  public.school_invitations from anon;
grant select, update on public.profiles to authenticated;
grant select on public.schools, public.school_memberships, public.role_permissions,
  public.school_onboarding, public.school_invitations to authenticated;
grant update on public.schools, public.school_onboarding to authenticated;
grant insert on public.school_invitations to authenticated;

create policy profiles_read_self on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy platform_administrator_read_self on public.platform_administrators for select to authenticated
using (user_id = (select auth.uid()));

create policy schools_read_member on public.schools for select to authenticated
using (public.is_school_member(id) or public.is_platform_super_admin());
create policy schools_update_platform_admin on public.schools for update to authenticated
using (public.is_platform_super_admin()) with check (public.is_platform_super_admin());

create policy memberships_read_self_or_school_admin on public.school_memberships for select to authenticated
using (user_id = (select auth.uid()) or public.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy role_permissions_read_authenticated on public.role_permissions for select to authenticated
using (true);

create policy onboarding_read_submitter_or_platform_admin on public.school_onboarding for select to authenticated
using (
  submitted_by = (select auth.uid())
  or public.is_platform_super_admin()
);
create policy onboarding_update_platform_admin on public.school_onboarding for update to authenticated
using (public.is_platform_super_admin()) with check (public.is_platform_super_admin());

create policy invitations_read_school_admin on public.school_invitations for select to authenticated
using (public.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy invitations_insert_school_admin on public.school_invitations for insert to authenticated
with check (
  invited_by = (select auth.uid())
  and role in ('school_admin', 'teacher', 'student', 'parent')
  and public.has_school_role(school_id, array['school_admin']::public.app_role[])
);
