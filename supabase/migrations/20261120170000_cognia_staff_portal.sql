-- Requires 1400 and 1600, in that order. Apply once after confirming this portal
-- extension is absent; the schema additions are intentionally not replayable.
do $$
declare
  required_object text;
  portal_column text;
  invitation_role_check text;
begin
  foreach required_object in array array[
    'public.staff_records',
    'public.school_invitations',
    'public.school_memberships',
    'public.role_permissions',
    'public.profiles'
  ] loop
    if to_regclass(required_object) is null then
      raise exception 'Required object % is missing. Apply the earlier COGNIA migrations first.', required_object;
    end if;
  end loop;

  if to_regprocedure('private.has_school_role(uuid, public.app_role[])') is null
     or not exists (
       select 1
       from pg_enum e
       join pg_type t on t.oid = e.enumtypid
       join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'public'
         and t.typname = 'app_role'
         and e.enumlabel = 'staff'
     )
     or not exists (
       select 1 from pg_constraint
       where conrelid = 'public.school_memberships'::regclass
         and contype in ('u', 'p')
         and pg_get_constraintdef(oid) like 'UNIQUE (school_id, user_id)%'
     ) then
    raise exception 'The private role helper, staff role, or tenant-safe membership key is missing.';
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.staff_records'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.school_memberships'::regclass
      and c.convalidated
      and c.confdeltype = 'c'
      and array(
        select a.attname::text
        from unnest(c.conkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = key_column.attnum
        order by key_column.ordinality
      ) = array['school_id', 'user_id']::text[]
      and array(
        select a.attname::text
        from unnest(c.confkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.confrelid
         and a.attnum = key_column.attnum
        order by key_column.ordinality
      ) = array['school_id', 'user_id']::text[]
  ) then
    raise exception 'The tenant-scoped staff membership foreign key from migration 1400 is missing.';
  end if;

  select pg_get_constraintdef(c.oid)
  into invitation_role_check
  from pg_constraint c
  where c.conrelid = 'public.school_invitations'::regclass
    and c.conname = 'school_invitations_role_check'
    and c.contype = 'c';
  if invitation_role_check is null
     or position('school_admin' in lower(invitation_role_check)) = 0
     or position('teacher' in lower(invitation_role_check)) = 0
     or position('student' in lower(invitation_role_check)) = 0
     or position('parent' in lower(invitation_role_check)) = 0
     or position('platform_super_admin' in lower(invitation_role_check)) > 0 then
    raise exception 'The expected invitation role check is missing or has an unexpected definition.';
  end if;

  if exists (
    select 1
    from public.staff_records
    where email is not null
    group by school_id, lower(trim(email))
    having count(*) > 1
  ) then
    raise exception 'Duplicate normalized staff emails exist within an institution; resolve them before adding the unique index.';
  end if;

  foreach portal_column in array array[
    'staff_category',
    'profile_photo_url',
    'gender',
    'date_of_birth',
    'address',
    'reporting_manager_id',
    'account_status'
  ] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'staff_records'
        and column_name = portal_column
    ) then
      raise exception 'Staff Portal column % already exists. Inspect the migration state instead of replaying 1700.', portal_column;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.school_invitations'::regclass
      and polname = 'invitations_insert_school_admin'
  ) or not exists (
    select 1 from pg_policy
    where polrelid = 'public.staff_records'::regclass
      and polname = 'staff_records_admin_insert'
  ) or not exists (
    select 1 from pg_policy
    where polrelid = 'public.staff_records'::regclass
      and polname = 'staff_records_admin_update'
  ) then
    raise exception 'Expected migration-1400 administrator policies are missing.';
  end if;
end;
$$;

-- Disable the older invitation RPCs until migration 1800 installs the hardened versions.
revoke all on function public.create_school_invitation(uuid, text, public.app_role, text) from public, anon, authenticated;
revoke all on function public.accept_school_invitation(text) from public, anon, authenticated;

insert into public.role_permissions (role, permission)
values ('staff', 'school.self.read')
on conflict (role, permission) do nothing;

do $$
begin
  if exists (
    select 1 from pg_policy
    where polrelid = 'public.profiles'::regclass
      and polname = 'profiles_read_school_admin'
  ) then
    alter policy profiles_read_school_admin on public.profiles
    to authenticated
    using (
      exists (
        select 1
        from public.school_memberships m
        where m.user_id = profiles.id
          and private.has_school_role(m.school_id, array['school_admin']::public.app_role[])
      )
    );
  else
    create policy profiles_read_school_admin on public.profiles for select to authenticated
    using (
      exists (
        select 1
        from public.school_memberships m
        where m.user_id = profiles.id
          and private.has_school_role(m.school_id, array['school_admin']::public.app_role[])
      )
    );
  end if;
end;
$$;

alter table public.staff_records
  alter column user_id drop not null,
  add column staff_category text not null default 'non_teaching'
    check (staff_category in ('teaching', 'non_teaching')),
  add column profile_photo_url text
    check (profile_photo_url is null or char_length(profile_photo_url) <= 2048),
  add column gender text
    check (gender is null or gender in ('female', 'male', 'non_binary', 'prefer_not_to_say')),
  add column date_of_birth date,
  add column address text
    check (address is null or char_length(address) <= 500),
  add column reporting_manager_id uuid,
  add column account_status text not null default 'active'
    check (account_status in ('pending', 'invited', 'active', 'deactivated'));

alter table public.staff_records
  add constraint staff_records_id_school_id_unique unique (id, school_id),
  add constraint staff_records_reporting_manager_school_fkey
    foreign key (reporting_manager_id, school_id)
    references public.staff_records(id, school_id)
    on delete set null (reporting_manager_id);

update public.staff_records sr
set staff_category = case when m.role = 'teacher' then 'teaching' else 'non_teaching' end,
    account_status = case when m.status = 'active' then 'active' else 'deactivated' end
from public.school_memberships m
where m.school_id = sr.school_id
  and m.user_id = sr.user_id;

create unique index staff_records_school_email_ci_idx
  on public.staff_records (school_id, lower(trim(email)))
  where email is not null;
create index staff_records_reporting_manager_idx
  on public.staff_records (school_id, reporting_manager_id)
  where reporting_manager_id is not null;

do $$
declare
  role_check text;
begin
  select pg_get_constraintdef(c.oid)
  into role_check
  from pg_constraint c
  where c.conrelid = 'public.school_invitations'::regclass
    and c.conname = 'school_invitations_role_check'
    and c.contype = 'c';

  if role_check is null then
    raise exception 'Expected school_invitations_role_check from the foundation migration is missing.';
  elsif position('staff' in lower(role_check)) > 0 then
    if position('school_admin' in lower(role_check)) = 0
       or position('teacher' in lower(role_check)) = 0
       or position('student' in lower(role_check)) = 0
       or position('parent' in lower(role_check)) = 0 then
      raise exception 'The existing invitation role constraint has an unexpected definition.';
    end if;
  elsif position('school_admin' in lower(role_check)) > 0
     and position('teacher' in lower(role_check)) > 0
     and position('student' in lower(role_check)) > 0
     and position('parent' in lower(role_check)) > 0
     and position('platform_super_admin' in lower(role_check)) = 0 then
    -- This replaces only the known four-role whitelist; no rows or table objects are removed.
    alter table public.school_invitations drop constraint school_invitations_role_check;
    alter table public.school_invitations
      add constraint school_invitations_role_check
      check (role in ('school_admin', 'teacher', 'staff', 'student', 'parent'));
  else
    raise exception 'The existing invitation role constraint has an unexpected definition.';
  end if;
end;
$$;

alter policy invitations_insert_school_admin on public.school_invitations
  to authenticated
  with check (
    invited_by = (select auth.uid())
    and role in ('school_admin', 'teacher', 'staff', 'student', 'parent')
    and private.has_school_role(school_id, array['school_admin']::public.app_role[])
  );

alter policy staff_records_admin_insert on public.staff_records
  to authenticated
  with check (
    private.has_school_role(school_id, array['school_admin']::public.app_role[])
    and created_by = (select auth.uid())
    and (
      (user_id is null and email is not null and account_status = 'pending')
      or exists (
        select 1
        from public.school_memberships m
        where m.school_id = staff_records.school_id
          and m.user_id = staff_records.user_id
          and m.status = 'active'
          and m.role in ('teacher', 'staff', 'school_admin')
      )
    )
  );

alter policy staff_records_admin_update on public.staff_records
  to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (
    private.has_school_role(school_id, array['school_admin']::public.app_role[])
    and (
      (user_id is null and email is not null)
      or exists (
        select 1
        from public.school_memberships m
        where m.school_id = staff_records.school_id
          and m.user_id = staff_records.user_id
          and m.status in ('active', 'suspended')
          and m.role in ('teacher', 'staff', 'school_admin')
      )
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.staff_records'::regclass
      and polname = 'staff_records_self_read'
  ) then
    create policy staff_records_self_read on public.staff_records for select to authenticated
    using (
      user_id = (select auth.uid())
      and account_status = 'active'
      and private.has_school_role(school_id, array['teacher', 'staff']::public.app_role[])
    );
  end if;
end;
$$;

create or replace function public.set_staff_account_status(
  target_staff_record_id uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid;
  target_user_id uuid;
  target_role public.app_role;
  affected_rows integer;
begin
  if target_status is null or target_status not in ('active', 'deactivated') then
    raise exception 'Choose a valid account status';
  end if;
  select school_id, user_id
  into target_school_id, target_user_id
  from public.staff_records
  where id = target_staff_record_id
  for update;
  if not found then
    raise exception 'Staff profile not found';
  end if;
  if not private.has_school_role(target_school_id, array['school_admin']::public.app_role[]) then
    raise exception 'School administrator access is required';
  end if;
  if target_user_id is null then
    raise exception 'An unlinked staff profile has no account to change';
  end if;
  select role into target_role
  from public.school_memberships
  where school_id = target_school_id
    and user_id = target_user_id
  for update;
  if not found or target_role not in ('teacher', 'staff') then
    raise exception 'Only a staff or teacher account can be changed here';
  end if;
  update public.school_memberships
  set status = case when target_status = 'active' then 'active'::public.membership_status else 'suspended'::public.membership_status end
  where school_id = target_school_id
    and user_id = target_user_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'The staff membership status could not be changed';
  end if;
  update public.staff_records
  set account_status = target_status
  where id = target_staff_record_id
    and school_id = target_school_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'The staff profile status could not be changed';
  end if;
end;
$$;
revoke all on function public.set_staff_account_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_staff_account_status(uuid, text) to authenticated;

create or replace function public.get_staff_reporting_manager(target_staff_record_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_school_id uuid;
  manager_id uuid;
  manager_name text;
begin
  select school_id, reporting_manager_id
  into target_school_id, manager_id
  from public.staff_records
  where id = target_staff_record_id
    and user_id = (select auth.uid())
    and account_status = 'active';
  if not found or not private.has_school_role(target_school_id, array['teacher', 'staff']::public.app_role[]) then
    raise exception 'Active staff profile access is required';
  end if;
  if manager_id is null then
    return null;
  end if;
  select concat_ws(' ', manager.first_name, manager.middle_name, manager.surname)
  into manager_name
  from public.staff_records manager
  where manager.id = manager_id
    and manager.school_id = target_school_id;
  return manager_name;
end;
$$;
revoke all on function public.get_staff_reporting_manager(uuid) from public, anon, authenticated;
grant execute on function public.get_staff_reporting_manager(uuid) to authenticated;

