create type public.student_status as enum (
  'applicant', 'admitted', 'active', 'deferred', 'suspended', 'withdrawn', 'graduated'
);

-- Add the composite keys required by tenant-safe student references.
alter table public.class_arms add constraint class_arms_id_school_unique unique (id, school_id);
alter table public.academic_terms add constraint academic_terms_id_school_session_unique unique (id, school_id, academic_session_id);
alter table public.academic_levels add constraint academic_levels_id_school_programme_unique unique (id, school_id, programme_id);

create table public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  application_reference text not null,
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  middle_name text check (middle_name is null or char_length(trim(middle_name)) <= 100),
  surname text not null check (char_length(trim(surname)) between 1 and 100),
  date_of_birth date,
  gender text check (gender is null or char_length(trim(gender)) between 1 and 32),
  email text check (email is null or char_length(trim(email)) <= 254),
  phone text check (phone is null or char_length(trim(phone)) <= 40),
  residential_address text check (residential_address is null or char_length(residential_address) <= 500),
  applied_class_arm_id uuid,
  applied_programme_id uuid,
  applied_academic_level_id uuid,
  academic_session_id uuid,
  academic_term_id uuid,
  application_status text not null default 'submitted'
    check (application_status in ('submitted', 'reviewing', 'accepted', 'rejected', 'waitlisted', 'withdrawn', 'converted')),
  applied_at date not null default current_date,
  decision_date date,
  decision_notes text check (decision_notes is null or char_length(decision_notes) <= 1000),
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  unique (school_id, application_reference),
  check (
    (applied_class_arm_id is not null and applied_programme_id is null and applied_academic_level_id is null)
    or (applied_class_arm_id is null and applied_programme_id is not null)
  ),
  foreign key (applied_class_arm_id, school_id)
    references public.class_arms(id, school_id) on delete restrict,
  foreign key (applied_programme_id, school_id)
    references public.academic_programmes(id, school_id) on delete restrict,
  foreign key (applied_academic_level_id, school_id, applied_programme_id)
    references public.academic_levels(id, school_id, programme_id) on delete restrict,
  foreign key (academic_session_id, school_id)
    references public.academic_sessions(id, school_id) on delete restrict,
  foreign key (academic_term_id, school_id, academic_session_id)
    references public.academic_terms(id, school_id, academic_session_id) on delete restrict
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_number text not null unique,
  admission_application_id uuid unique,
  auth_user_id uuid references auth.users(id) on delete set null,
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  middle_name text check (middle_name is null or char_length(trim(middle_name)) <= 100),
  surname text not null check (char_length(trim(surname)) between 1 and 100),
  date_of_birth date,
  gender text check (gender is null or char_length(trim(gender)) between 1 and 32),
  email text check (email is null or char_length(trim(email)) <= 254),
  phone text check (phone is null or char_length(trim(phone)) <= 40),
  residential_address text check (residential_address is null or char_length(residential_address) <= 500),
  profile_photo_path text,
  admission_date date not null default current_date,
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (admission_application_id, school_id)
    references public.admission_applications(id, school_id) on delete restrict,
  unique (school_id, auth_user_id)
);
create index students_school_name_idx on public.students (school_id, surname, first_name, middle_name);
create index students_school_status_idx on public.students (school_id, status, admission_date desc);
create index students_school_application_idx on public.students (school_id, admission_application_id) where admission_application_id is not null;

create table public.student_enrolments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  structure_type text not null check (structure_type in ('basic', 'programme')),
  class_arm_id uuid,
  programme_id uuid,
  academic_level_id uuid,
  academic_session_id uuid not null,
  academic_term_id uuid not null,
  starts_on date not null default current_date,
  ends_on date,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on <= ends_on),
  check (
    (structure_type = 'basic' and class_arm_id is not null and programme_id is null and academic_level_id is null)
    or (structure_type = 'programme' and class_arm_id is null and programme_id is not null and academic_level_id is not null)
  ),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete restrict,
  foreign key (class_arm_id, school_id) references public.class_arms(id, school_id) on delete restrict,
  foreign key (programme_id, school_id) references public.academic_programmes(id, school_id) on delete restrict,
  foreign key (academic_level_id, school_id, programme_id)
    references public.academic_levels(id, school_id, programme_id) on delete restrict,
  foreign key (academic_session_id, school_id) references public.academic_sessions(id, school_id) on delete restrict,
  foreign key (academic_term_id, school_id, academic_session_id)
    references public.academic_terms(id, school_id, academic_session_id) on delete restrict,
  unique (id, school_id)
);
create unique index student_enrolments_one_current_idx on public.student_enrolments (school_id, student_id) where is_current;
create index student_enrolments_student_history_idx on public.student_enrolments (school_id, student_id, starts_on desc);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  middle_name text check (middle_name is null or char_length(trim(middle_name)) <= 100),
  surname text not null check (char_length(trim(surname)) between 1 and 100),
  email text check (email is null or char_length(trim(email)) <= 254),
  phone text check (phone is null or char_length(trim(phone)) <= 40),
  residential_address text check (residential_address is null or char_length(residential_address) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id)
);
create index guardians_school_name_idx on public.guardians (school_id, surname, first_name);

create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  guardian_id uuid not null,
  relationship text not null check (char_length(trim(relationship)) between 1 and 48),
  is_emergency_contact boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete restrict,
  foreign key (guardian_id, school_id) references public.guardians(id, school_id) on delete restrict,
  unique (school_id, student_id, guardian_id),
  unique (id, school_id)
);
create index student_guardians_student_idx on public.student_guardians (school_id, student_id, is_active);
create index student_guardians_guardian_idx on public.student_guardians (school_id, guardian_id, is_active);

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (char_length(trim(file_name)) between 1 and 200),
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  document_type text not null default 'other' check (char_length(trim(document_type)) between 1 and 48),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete restrict,
  unique (id, school_id)
);
create index student_documents_student_idx on public.student_documents (school_id, student_id, created_at desc);

create table public.student_status_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  previous_status public.student_status,
  new_status public.student_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete restrict
);
create index student_status_history_student_idx on public.student_status_history (school_id, student_id, changed_at desc);

create table public.student_number_counters (
  counter_year integer primary key,
  last_number bigint not null check (last_number > 0)
);

create function public.generate_student_number(target_school_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_year integer := extract(year from now())::integer;
  next_number bigint;
begin
  if (select auth.uid()) is null or not private.has_school_role(target_school_id, array['school_admin']::public.app_role[]) then
    raise exception 'Institution administrator access is required';
  end if;
  insert into public.student_number_counters (counter_year, last_number)
    values (current_year, 1)
  on conflict (counter_year) do update set last_number = public.student_number_counters.last_number + 1
  returning last_number into next_number;
  return 'COG-' || current_year::text || '-' || lpad(next_number::text, 6, '0');
end;
$$;
revoke all on function public.generate_student_number(uuid) from public, anon;
grant execute on function public.generate_student_number(uuid) to authenticated;

create function public.record_student_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.student_status_history (school_id, student_id, previous_status, new_status, changed_by)
      values (new.school_id, new.id, null, new.status, (select auth.uid()));
  elsif new.status is distinct from old.status then
    insert into public.student_status_history (school_id, student_id, previous_status, new_status, changed_by)
      values (new.school_id, new.id, old.status, new.status, (select auth.uid()));
  end if;
  return new;
end;
$$;
revoke all on function public.record_student_status_change() from public, anon, authenticated;

create trigger students_touch_updated_at before update on public.students
  for each row execute function public.touch_updated_at();
create trigger students_record_status after insert or update on public.students
  for each row execute function public.record_student_status_change();
create trigger admission_applications_touch_updated_at before update on public.admission_applications
  for each row execute function public.touch_updated_at();
create trigger student_enrolments_touch_updated_at before update on public.student_enrolments
  for each row execute function public.touch_updated_at();
create trigger guardians_touch_updated_at before update on public.guardians
  for each row execute function public.touch_updated_at();
create trigger student_guardians_touch_updated_at before update on public.student_guardians
  for each row execute function public.touch_updated_at();

alter table public.student_number_counters enable row level security;
alter table public.students enable row level security;
alter table public.admission_applications enable row level security;
alter table public.student_enrolments enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_documents enable row level security;
alter table public.student_status_history enable row level security;

revoke all on public.student_number_counters, public.students, public.admission_applications,
  public.student_enrolments, public.guardians, public.student_guardians,
  public.student_documents, public.student_status_history from public, anon;
grant select, insert, update on public.students, public.admission_applications,
  public.student_enrolments, public.guardians, public.student_guardians to authenticated;
grant select, insert, delete on public.student_documents to authenticated;
grant select on public.student_status_history to authenticated;

create policy students_read_authorized on public.students for select to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]) or auth_user_id = (select auth.uid()));
create policy students_insert_school_admin on public.students for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy students_update_school_admin on public.students for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy admissions_read_school_admin on public.admission_applications for select to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy admissions_insert_school_admin on public.admission_applications for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy admissions_update_school_admin on public.admission_applications for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy student_enrolments_read_authorized on public.student_enrolments for select to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[])
    or exists (select 1 from public.students s where s.id = student_enrolments.student_id and s.school_id = student_enrolments.school_id and s.auth_user_id = (select auth.uid())));
create policy student_enrolments_insert_school_admin on public.student_enrolments for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy student_enrolments_update_school_admin on public.student_enrolments for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy guardians_read_school_admin on public.guardians for select to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy guardians_insert_school_admin on public.guardians for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy guardians_update_school_admin on public.guardians for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy student_guardians_read_school_admin on public.student_guardians for select to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy student_guardians_insert_school_admin on public.student_guardians for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy student_guardians_update_school_admin on public.student_guardians for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy student_documents_read_school_admin on public.student_documents for select to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy student_documents_insert_school_admin on public.student_documents for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy student_documents_delete_school_admin on public.student_documents for delete to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy student_status_history_read_authorized on public.student_status_history for select to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[])
    or exists (select 1 from public.students s where s.id = student_status_history.student_id and s.school_id = student_status_history.school_id and s.auth_user_id = (select auth.uid())));
create policy student_status_history_insert_school_admin on public.student_status_history for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-records', 'student-records', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy student_records_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'student-records' and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.has_school_role(((storage.foldername(name))[1])::uuid, array['school_admin']::public.app_role[])
    else false end);
create policy student_records_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'student-records' and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.has_school_role(((storage.foldername(name))[1])::uuid, array['school_admin']::public.app_role[])
    else false end);
create policy student_records_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'student-records' and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.has_school_role(((storage.foldername(name))[1])::uuid, array['school_admin']::public.app_role[])
    else false end);
