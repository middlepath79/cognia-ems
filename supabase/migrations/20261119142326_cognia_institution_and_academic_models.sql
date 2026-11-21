-- Add institution-specific configuration without replacing the existing school
-- tenant, membership, academic session, department, or subject records.

alter table public.schools
  add column institution_type text not null default 'basic'
    check (institution_type in (
      'early_childhood', 'basic', 'secondary', 'technical_vocational',
      'college', 'polytechnic', 'monotechnic', 'university',
      'postgraduate', 'professional_research', 'mixed'
    )),
  add column logo_url text,
  add column academic_period_label text not null default 'Term'
    check (char_length(trim(academic_period_label)) between 3 and 24),
  add column grading_scale jsonb not null default '{"system":"percentage","maximum":100}'::jsonb
    check (jsonb_typeof(grading_scale) = 'object');

-- Academic periods are configurable per institution. Existing term rows stay
-- valid, while semester, trimester, quarter, and custom period names become valid.
alter table public.academic_terms
  drop constraint if exists academic_terms_name_check,
  add constraint academic_terms_name_check
    check (char_length(trim(name)) between 1 and 48);

create table public.faculties (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  code text check (code is null or char_length(trim(code)) between 1 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id)
);
create unique index faculties_school_name_idx on public.faculties (school_id, lower(trim(name)));
create unique index faculties_school_code_idx on public.faculties (school_id, lower(trim(code))) where code is not null;

alter table public.departments
  add column faculty_id uuid;
alter table public.departments
  add constraint departments_faculty_school_fkey
    foreign key (faculty_id, school_id) references public.faculties(id, school_id) on delete set null (faculty_id);
create index departments_faculty_idx on public.departments (school_id, faculty_id, name);

create table public.academic_programmes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  department_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 160),
  code text check (code is null or char_length(trim(code)) between 1 and 32),
  award text,
  duration_years numeric(3,1) check (duration_years is null or duration_years > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (department_id, school_id)
    references public.departments(id, school_id) on delete set null (department_id),
  unique (id, school_id)
);
create unique index academic_programmes_school_name_idx on public.academic_programmes (school_id, lower(trim(name)));
create unique index academic_programmes_school_code_idx on public.academic_programmes (school_id, lower(trim(code))) where code is not null;

create table public.academic_levels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  programme_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 80),
  sequence integer not null default 0 check (sequence >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (programme_id, school_id)
    references public.academic_programmes(id, school_id) on delete cascade,
  unique (id, school_id)
);
create unique index academic_levels_scope_name_idx on public.academic_levels
  (school_id, coalesce(programme_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)));

-- Existing subjects remain the shared curriculum entity. Credit units are
-- optional, so basic education records do not need university-only values.
alter table public.subjects
  add column credit_units numeric(4,1)
    check (credit_units is null or credit_units > 0);

create trigger faculties_touch_updated_at before update on public.faculties
  for each row execute function public.touch_updated_at();
create trigger academic_programmes_touch_updated_at before update on public.academic_programmes
  for each row execute function public.touch_updated_at();
create trigger academic_levels_touch_updated_at before update on public.academic_levels
  for each row execute function public.touch_updated_at();

alter table public.faculties enable row level security;
alter table public.academic_programmes enable row level security;
alter table public.academic_levels enable row level security;
revoke all on public.faculties, public.academic_programmes, public.academic_levels from public, anon;
grant select, insert, update, delete on public.faculties, public.academic_programmes, public.academic_levels to authenticated;

create policy faculties_read_school on public.faculties for select to authenticated
  using (private.is_school_member(school_id));
create policy faculties_insert_school_admin on public.faculties for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy faculties_update_school_admin on public.faculties for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy faculties_delete_school_admin on public.faculties for delete to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy academic_programmes_read_school on public.academic_programmes for select to authenticated
  using (private.is_school_member(school_id));
create policy academic_programmes_insert_school_admin on public.academic_programmes for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy academic_programmes_update_school_admin on public.academic_programmes for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy academic_programmes_delete_school_admin on public.academic_programmes for delete to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy academic_levels_read_school on public.academic_levels for select to authenticated
  using (private.is_school_member(school_id));
create policy academic_levels_insert_school_admin on public.academic_levels for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy academic_levels_update_school_admin on public.academic_levels for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy academic_levels_delete_school_admin on public.academic_levels for delete to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

-- New onboarding RPC keeps the existing two-argument function available for
-- already deployed clients while capturing the selected institution category.
create function public.create_institution_onboarding(
  institution_name text,
  institution_slug text,
  selected_institution_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_school_id uuid;
  clean_name text := trim(institution_name);
  clean_slug text := lower(trim(institution_slug));
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  if clean_name is null or char_length(clean_name) not between 2 and 160 then
    raise exception 'Enter an institution name between 2 and 160 characters';
  end if;
  if clean_slug is null or clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Enter a valid institution URL name';
  end if;
  if selected_institution_type not in (
    'early_childhood', 'basic', 'secondary', 'technical_vocational', 'college',
    'polytechnic', 'monotechnic', 'university', 'postgraduate',
    'professional_research', 'mixed'
  ) then
    raise exception 'Choose a valid institution category';
  end if;
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid())) then
    raise exception 'A user profile is required';
  end if;

  insert into public.schools (name, slug, institution_type)
    values (clean_name, clean_slug, selected_institution_type)
    returning id into new_school_id;
  insert into public.school_memberships (school_id, user_id, role, status)
    values (new_school_id, (select auth.uid()), 'school_admin', 'active');
  insert into public.school_onboarding (school_id, submitted_by, status)
    values (new_school_id, (select auth.uid()), 'pending_review');
  return new_school_id;
end;
$$;
revoke all on function public.create_institution_onboarding(text, text, text) from public, anon;
grant execute on function public.create_institution_onboarding(text, text, text) to authenticated;
