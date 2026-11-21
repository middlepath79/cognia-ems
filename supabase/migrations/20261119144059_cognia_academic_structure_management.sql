-- Add reversible archive state and course applicability to the existing
-- institution-scoped academic entities.
alter table public.faculties
  add column is_active boolean not null default true;
alter table public.departments
  add column is_active boolean not null default true;
alter table public.academic_programmes
  add column is_active boolean not null default true;
alter table public.academic_levels
  add column is_active boolean not null default true;

alter table public.subjects
  add column is_active boolean not null default true,
  add column programme_id uuid,
  add column academic_level_id uuid,
  add column academic_period_name text
    check (academic_period_name is null or char_length(trim(academic_period_name)) between 1 and 48);

alter table public.subjects
  add constraint subjects_programme_school_fkey
    foreign key (programme_id, school_id)
    references public.academic_programmes(id, school_id) on delete set null (programme_id),
  add constraint subjects_level_school_fkey
    foreign key (academic_level_id, school_id)
    references public.academic_levels(id, school_id) on delete set null (academic_level_id);

create index subjects_programme_school_idx on public.subjects (programme_id, school_id);
create index subjects_level_school_idx on public.subjects (academic_level_id, school_id);
create index faculties_school_active_idx on public.faculties (school_id, is_active, name);
create index departments_school_active_idx on public.departments (school_id, is_active, name);
create index academic_programmes_school_active_idx on public.academic_programmes (school_id, is_active, name);
create index academic_levels_school_active_idx on public.academic_levels (school_id, is_active, sequence, name);
create index subjects_school_active_idx on public.subjects (school_id, is_active, name);
