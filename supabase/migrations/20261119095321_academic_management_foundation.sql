create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 4 and 32),
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on <= ends_on),
  unique (school_id, name),
  unique (id, school_id)
);

create unique index academic_sessions_one_active_per_school_idx
  on public.academic_sessions (school_id) where is_active;
create index academic_sessions_school_dates_idx
  on public.academic_sessions (school_id, starts_on desc);

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_session_id uuid not null,
  name text not null check (name in ('First', 'Second', 'Third')),
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on <= ends_on),
  foreign key (academic_session_id, school_id)
    references public.academic_sessions (id, school_id) on delete cascade,
  unique (school_id, academic_session_id, name),
  unique (id, school_id)
);

create unique index academic_terms_one_active_per_school_idx
  on public.academic_terms (school_id) where is_active;
create index academic_terms_session_dates_idx
  on public.academic_terms (school_id, academic_session_id, starts_on);

create table public.school_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id)
);

create unique index school_classes_school_name_idx
  on public.school_classes (school_id, lower(trim(name)));
create index school_classes_school_sort_idx
  on public.school_classes (school_id, sort_order, name);

create table public.class_arms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 32),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (class_id, school_id)
    references public.school_classes (id, school_id) on delete cascade
);

create unique index class_arms_class_name_idx
  on public.class_arms (class_id, lower(trim(name)));
create index class_arms_school_class_sort_idx
  on public.class_arms (school_id, class_id, sort_order, name);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id)
);

create unique index departments_school_name_idx
  on public.departments (school_id, lower(trim(name)));

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  department_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 120),
  code text check (code is null or char_length(trim(code)) between 1 and 32),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (department_id, school_id)
    references public.departments (id, school_id) on delete restrict,
  unique (id, school_id)
);

create unique index subjects_school_name_idx
  on public.subjects (school_id, lower(trim(name)));
create unique index subjects_school_code_idx
  on public.subjects (school_id, lower(trim(code))) where code is not null;
create index subjects_school_department_idx
  on public.subjects (school_id, department_id, name);

create trigger academic_sessions_touch_updated_at before update on public.academic_sessions
  for each row execute function public.touch_updated_at();
create trigger academic_terms_touch_updated_at before update on public.academic_terms
  for each row execute function public.touch_updated_at();
create trigger school_classes_touch_updated_at before update on public.school_classes
  for each row execute function public.touch_updated_at();
create trigger class_arms_touch_updated_at before update on public.class_arms
  for each row execute function public.touch_updated_at();
create trigger departments_touch_updated_at before update on public.departments
  for each row execute function public.touch_updated_at();
create trigger subjects_touch_updated_at before update on public.subjects
  for each row execute function public.touch_updated_at();

alter table public.academic_sessions enable row level security;
alter table public.academic_terms enable row level security;
alter table public.school_classes enable row level security;
alter table public.class_arms enable row level security;
alter table public.departments enable row level security;
alter table public.subjects enable row level security;

revoke all on public.academic_sessions, public.academic_terms, public.school_classes,
  public.class_arms, public.departments, public.subjects from public, anon;
grant select, insert, update, delete on public.academic_sessions, public.academic_terms,
  public.school_classes, public.class_arms, public.departments, public.subjects to authenticated;

create policy academic_sessions_read_school on public.academic_sessions for select to authenticated
  using (private.is_school_member(school_id));
create policy academic_sessions_insert_school_admin on public.academic_sessions for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy academic_sessions_update_school_admin on public.academic_sessions for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy academic_sessions_delete_school_admin on public.academic_sessions for delete to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy academic_terms_read_school on public.academic_terms for select to authenticated
  using (private.is_school_member(school_id));
create policy academic_terms_insert_school_admin on public.academic_terms for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy academic_terms_update_school_admin on public.academic_terms for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy academic_terms_delete_school_admin on public.academic_terms for delete to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy school_classes_read_school on public.school_classes for select to authenticated
  using (private.is_school_member(school_id));
create policy school_classes_insert_school_admin on public.school_classes for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy school_classes_update_school_admin on public.school_classes for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy school_classes_delete_school_admin on public.school_classes for delete to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy class_arms_read_school on public.class_arms for select to authenticated
  using (private.is_school_member(school_id));
create policy class_arms_insert_school_admin on public.class_arms for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy class_arms_update_school_admin on public.class_arms for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy class_arms_delete_school_admin on public.class_arms for delete to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy departments_read_school on public.departments for select to authenticated
  using (private.is_school_member(school_id));
create policy departments_insert_school_admin on public.departments for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy departments_update_school_admin on public.departments for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy departments_delete_school_admin on public.departments for delete to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create policy subjects_read_school on public.subjects for select to authenticated
  using (private.is_school_member(school_id));
create policy subjects_insert_school_admin on public.subjects for insert to authenticated
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy subjects_update_school_admin on public.subjects for update to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy subjects_delete_school_admin on public.subjects for delete to authenticated
  using (private.has_school_role(school_id, array['school_admin']::public.app_role[]));

create function public.set_active_academic_session(target_school_id uuid, target_session_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.has_school_role(target_school_id, array['school_admin']::public.app_role[]) then
    raise exception 'School administrator access is required';
  end if;
  if not exists (select 1 from public.academic_sessions where id = target_session_id and school_id = target_school_id) then
    raise exception 'Academic session was not found for this school';
  end if;

  update public.academic_terms
    set is_active = false
    where school_id = target_school_id and is_active and academic_session_id <> target_session_id;
  update public.academic_sessions
    set is_active = false
    where school_id = target_school_id and is_active and id <> target_session_id;
  update public.academic_sessions
    set is_active = true
    where id = target_session_id and school_id = target_school_id;
end;
$$;

create function public.set_active_academic_term(target_school_id uuid, target_term_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.has_school_role(target_school_id, array['school_admin']::public.app_role[]) then
    raise exception 'School administrator access is required';
  end if;
  if not exists (
    select 1 from public.academic_terms t
    join public.academic_sessions s on s.id = t.academic_session_id and s.school_id = t.school_id
    where t.id = target_term_id and t.school_id = target_school_id and s.is_active
  ) then
    raise exception 'Choose a term in the active academic session';
  end if;

  update public.academic_terms
    set is_active = false
    where school_id = target_school_id and is_active and id <> target_term_id;
  update public.academic_terms
    set is_active = true
    where id = target_term_id and school_id = target_school_id;
end;
$$;

revoke all on function public.set_active_academic_session(uuid, uuid) from public, anon;
revoke all on function public.set_active_academic_term(uuid, uuid) from public, anon;
grant execute on function public.set_active_academic_session(uuid, uuid) to authenticated;
grant execute on function public.set_active_academic_term(uuid, uuid) to authenticated;
