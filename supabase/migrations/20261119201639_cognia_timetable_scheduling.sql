create table public.learning_venues (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  code text check (code is null or char_length(trim(code)) between 1 and 32),
  venue_type text not null check (char_length(trim(venue_type)) between 1 and 48),
  capacity integer check (capacity is null or capacity > 0),
  building text check (building is null or char_length(building) <= 120),
  description text check (description is null or char_length(description) <= 500),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,school_id)
);
create unique index learning_venues_school_name_idx on public.learning_venues(school_id,lower(trim(name)));
create unique index learning_venues_school_code_idx on public.learning_venues(school_id,lower(trim(code))) where code is not null;

create table public.timetable_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_session_id uuid not null,
  academic_term_id uuid not null,
  scheduling_model text not null check (scheduling_model in ('class','course')),
  name text not null check (char_length(trim(name)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(academic_session_id,school_id) references public.academic_sessions(id,school_id) on delete restrict,
  foreign key(academic_term_id,school_id,academic_session_id) references public.academic_terms(id,school_id,academic_session_id) on delete restrict,
  unique(id,school_id)
);
create index timetable_plans_school_status_idx on public.timetable_plans(school_id,status,academic_session_id,academic_term_id);

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  timetable_plan_id uuid not null,
  scheduling_model text not null check (scheduling_model in ('class','course')),
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null, ends_at time not null check (ends_at > starts_at),
  class_id uuid, class_arm_id uuid, subject_id uuid,
  programme_id uuid, academic_level_id uuid,
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  venue_id uuid,
  session_kind text not null default 'lesson' check (session_kind in ('lesson','lecture','practical','tutorial','workshop','other')),
  description text check (description is null or char_length(description) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((scheduling_model='class' and class_id is not null and subject_id is not null and programme_id is null and academic_level_id is null) or (scheduling_model='course' and class_id is null and class_arm_id is null and subject_id is not null and programme_id is not null and academic_level_id is not null)),
  foreign key(timetable_plan_id,school_id) references public.timetable_plans(id,school_id) on delete restrict,
  foreign key(class_id,school_id) references public.school_classes(id,school_id) on delete restrict,
  foreign key(class_arm_id,school_id,class_id) references public.class_arms(id,school_id,class_id) on delete restrict,
  foreign key(subject_id,school_id) references public.subjects(id,school_id) on delete restrict,
  foreign key(programme_id,school_id) references public.academic_programmes(id,school_id) on delete restrict,
  foreign key(academic_level_id,school_id,programme_id) references public.academic_levels(id,school_id,programme_id) on delete restrict,
  foreign key(venue_id,school_id) references public.learning_venues(id,school_id) on delete restrict,
  unique(id,school_id)
);
create index timetable_entries_plan_day_idx on public.timetable_entries(school_id,timetable_plan_id,weekday,starts_at);
create index timetable_entries_staff_idx on public.timetable_entries(school_id,staff_user_id,weekday,starts_at) where is_active;
create index timetable_entries_venue_idx on public.timetable_entries(school_id,venue_id,weekday,starts_at) where is_active and venue_id is not null;
create index timetable_entries_class_idx on public.timetable_entries(school_id,class_id,class_arm_id,weekday,starts_at) where is_active and scheduling_model='class';
create index timetable_entries_course_idx on public.timetable_entries(school_id,subject_id,programme_id,academic_level_id,weekday,starts_at) where is_active and scheduling_model='course';

create function private.validate_timetable_entry() returns trigger
language plpgsql security definer set search_path = '' as $$
declare plan public.timetable_plans%rowtype; clash boolean; institution_type text;
begin
  select * into plan from public.timetable_plans where id=new.timetable_plan_id and school_id=new.school_id;
  if not found or plan.status='archived' then raise exception using errcode='23514',message='Choose a non-archived timetable plan.'; end if;
  if plan.scheduling_model<>new.scheduling_model then raise exception using errcode='23514',message='Entry type must match the timetable model.'; end if;
  select s.institution_type into institution_type from public.schools s where s.id=new.school_id;
  if (new.scheduling_model='class' and institution_type in ('college','polytechnic','monotechnic','university','postgraduate','professional_research'))
    or (new.scheduling_model='course' and institution_type in ('early_childhood','basic','secondary')) then
    raise exception using errcode='23514',message='The schedule model does not match this institution type.';
  end if;
  if not new.is_active then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.school_id::text||':'||plan.academic_session_id::text||':'||plan.academic_term_id::text||':'||new.weekday::text,0));
  if new.scheduling_model='class' then
    if not exists(select 1 from public.subjects s where s.id=new.subject_id and s.school_id=new.school_id and s.is_active)
      or (new.class_arm_id is not null and not exists(select 1 from public.class_arms a where a.id=new.class_arm_id and a.school_id=new.school_id and a.class_id=new.class_id)) then
      raise exception using errcode='23503',message='Class, arm, or subject must belong to this institution.';
    end if;
  else
    if not exists(select 1 from public.subjects s where s.id=new.subject_id and s.school_id=new.school_id and s.is_active and (s.programme_id is null or s.programme_id=new.programme_id) and (s.academic_level_id is null or s.academic_level_id=new.academic_level_id)) then
      raise exception using errcode='23503',message='Course does not match the selected programme and level.';
    end if;
  end if;
  if not exists(select 1 from public.attendance_staff_assignments a where a.school_id=new.school_id and a.teacher_user_id=new.staff_user_id and a.academic_session_id=plan.academic_session_id and a.is_active and a.assignment_type=new.scheduling_model and ((new.scheduling_model='class' and a.class_id=new.class_id and (a.class_arm_id is null or a.class_arm_id is not distinct from new.class_arm_id)) or (new.scheduling_model='course' and a.subject_id=new.subject_id))) then
    raise exception using errcode='42501',message='This teacher or lecturer has no active assignment for the selected class or course and session.';
  end if;
  if new.venue_id is not null and not exists(select 1 from public.learning_venues v where v.id=new.venue_id and v.school_id=new.school_id and v.is_active) then
    raise exception using errcode='23503',message='Choose an active venue in this institution.';
  end if;
  select exists(
    select 1 from public.timetable_entries e join public.timetable_plans p on p.id=e.timetable_plan_id and p.school_id=e.school_id
    where e.school_id=new.school_id and e.id is distinct from new.id and e.is_active and p.status<>'archived'
      and p.academic_session_id=plan.academic_session_id and p.academic_term_id=plan.academic_term_id and e.weekday=new.weekday
      and new.starts_at<e.ends_at and new.ends_at>e.starts_at
      and (e.staff_user_id=new.staff_user_id
        or (new.venue_id is not null and e.venue_id=new.venue_id)
        or (new.scheduling_model='class' and e.scheduling_model='class' and e.class_id=new.class_id and (e.class_arm_id is null or new.class_arm_id is null or e.class_arm_id=new.class_arm_id))
        or (new.scheduling_model='course' and e.scheduling_model='course' and exists(
          select 1 from public.course_enrolments x join public.course_enrolments y on y.school_id=x.school_id and y.student_id=x.student_id
          join public.academic_terms term on term.school_id=plan.school_id and term.id=plan.academic_term_id and term.academic_session_id=plan.academic_session_id
          where x.school_id=new.school_id and y.school_id=new.school_id and x.subject_id=new.subject_id and x.programme_id=new.programme_id and x.academic_level_id=new.academic_level_id
            and y.subject_id=e.subject_id and y.programme_id=e.programme_id and y.academic_level_id=e.academic_level_id
            and x.academic_session_id=plan.academic_session_id and y.academic_session_id=plan.academic_session_id
            and x.academic_term_id=plan.academic_term_id and y.academic_term_id=plan.academic_term_id
            and x.is_active and y.is_active and x.starts_on<=term.ends_on and (x.ends_on is null or x.ends_on>=term.starts_on)
            and y.starts_on<=term.ends_on and (y.ends_on is null or y.ends_on>=term.starts_on)
        ))
      )
  ) into clash;
  if clash then raise exception using errcode='23P01',message='Scheduling conflict: staff, venue, class arm, or an enrolled student already has an overlapping session.'; end if;
  return new;
end;
$$;
create trigger timetable_entry_conflict_guard before insert or update on public.timetable_entries for each row execute function private.validate_timetable_entry();

create function private.revalidate_timetable_on_publish() returns trigger
language plpgsql security definer set search_path = '' as $$
declare entry_id uuid;
begin
  if new.status='published' and old.status is distinct from new.status then
    for entry_id in select id from public.timetable_entries where school_id=new.school_id and timetable_plan_id=new.id and is_active order by weekday,starts_at loop
      update public.timetable_entries set updated_at=clock_timestamp() where id=entry_id and school_id=new.school_id;
    end loop;
  end if;
  return new;
end;
$$;
create trigger timetable_publish_conflict_guard before update of status on public.timetable_plans for each row execute function private.revalidate_timetable_on_publish();

create function private.validate_course_enrolment_timetable_conflict() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d smallint; clash boolean;
begin
  if not new.is_active then return new; end if;
  for d in
    select distinct a.weekday
    from public.timetable_entries a join public.timetable_plans ap on ap.id=a.timetable_plan_id and ap.school_id=a.school_id
    join public.timetable_entries b on b.school_id=a.school_id and b.weekday=a.weekday
    join public.timetable_plans bp on bp.id=b.timetable_plan_id and bp.school_id=b.school_id
    join public.course_enrolments other on other.school_id=new.school_id and other.student_id=new.student_id and other.subject_id=b.subject_id and other.programme_id=b.programme_id and other.academic_level_id=b.academic_level_id and other.academic_session_id=bp.academic_session_id and other.academic_term_id=bp.academic_term_id and other.is_active
    where a.school_id=new.school_id and a.scheduling_model='course' and a.subject_id=new.subject_id and a.programme_id=new.programme_id and a.academic_level_id=new.academic_level_id and ap.status<>'archived'
      and b.scheduling_model='course' and b.subject_id<>new.subject_id and bp.status<>'archived'
      and ap.academic_session_id=new.academic_session_id and bp.academic_session_id=new.academic_session_id and ap.academic_term_id=new.academic_term_id and bp.academic_term_id=new.academic_term_id
      and a.starts_at<b.ends_at and a.ends_at>b.starts_at
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.school_id::text||':'||new.academic_session_id::text||':'||new.academic_term_id::text||':'||d::text,0));
  end loop;
  select exists(
    select 1 from public.timetable_entries a join public.timetable_plans ap on ap.id=a.timetable_plan_id and ap.school_id=a.school_id
    join public.timetable_entries b on b.school_id=a.school_id and b.weekday=a.weekday
    join public.timetable_plans bp on bp.id=b.timetable_plan_id and bp.school_id=b.school_id
    join public.course_enrolments other on other.school_id=new.school_id and other.student_id=new.student_id and other.subject_id=b.subject_id and other.programme_id=b.programme_id and other.academic_level_id=b.academic_level_id and other.academic_session_id=bp.academic_session_id and other.academic_term_id=bp.academic_term_id and other.is_active
    join public.academic_terms term on term.school_id=ap.school_id and term.id=ap.academic_term_id and term.academic_session_id=ap.academic_session_id
    where a.school_id=new.school_id and a.scheduling_model='course' and a.subject_id=new.subject_id and a.programme_id=new.programme_id and a.academic_level_id=new.academic_level_id and a.is_active and ap.status<>'archived'
      and b.scheduling_model='course' and b.subject_id<>new.subject_id and b.is_active and bp.status<>'archived'
      and ap.academic_session_id=new.academic_session_id and bp.academic_session_id=new.academic_session_id and ap.academic_term_id=new.academic_term_id and bp.academic_term_id=new.academic_term_id
      and a.starts_at<b.ends_at and a.ends_at>b.starts_at and new.starts_on<=term.ends_on and (new.ends_on is null or new.ends_on>=term.starts_on)
  ) into clash;
  if clash then raise exception using errcode='23P01',message='Course enrolment creates a student timetable conflict with another enrolled course.'; end if;
  return new;
end;
$$;
create trigger course_enrolment_timetable_conflict_guard before insert or update of is_active,starts_on,ends_on,subject_id,programme_id,academic_level_id,academic_session_id,academic_term_id on public.course_enrolments for each row execute function private.validate_course_enrolment_timetable_conflict();

create function private.can_read_timetable(target_school_id uuid,target_entry_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare e public.timetable_entries%rowtype; p public.timetable_plans%rowtype;
begin
  select * into e from public.timetable_entries where id=target_entry_id and school_id=target_school_id and is_active;
  if not found then return false; end if;
  select * into p from public.timetable_plans where id=e.timetable_plan_id and school_id=e.school_id;
  if p.status='archived' then return false; end if;
  if private.has_school_role(target_school_id,array['school_admin']::public.app_role[]) then return true; end if;
  if p.status<>'published' then return false; end if;
  if private.has_school_role(target_school_id,array['teacher']::public.app_role[]) then
    return e.staff_user_id=(select auth.uid()) and exists(select 1 from public.attendance_staff_assignments a where a.school_id=e.school_id and a.teacher_user_id=(select auth.uid()) and a.academic_session_id=p.academic_session_id and a.is_active);
  end if;
  if private.has_school_role(target_school_id,array['student']::public.app_role[]) then
    return exists(select 1 from public.students s where s.school_id=e.school_id and s.auth_user_id=(select auth.uid()) and (
      (e.scheduling_model='class' and exists(select 1 from public.student_enrolments x where x.school_id=s.school_id and x.student_id=s.id and x.structure_type='basic' and x.class_arm_id in (select a.id from public.class_arms a where a.school_id=e.school_id and a.class_id=e.class_id and (e.class_arm_id is null or a.id=e.class_arm_id)) and x.academic_session_id=p.academic_session_id and x.academic_term_id=p.academic_term_id and x.is_current))
      or (e.scheduling_model='course' and exists(select 1 from public.course_enrolments x where x.school_id=s.school_id and x.student_id=s.id and x.subject_id=e.subject_id and x.programme_id=e.programme_id and x.academic_level_id=e.academic_level_id and x.academic_session_id=p.academic_session_id and x.academic_term_id=p.academic_term_id and x.is_active))
    ));
  end if;
  return false;
end;
$$;

alter table public.learning_venues enable row level security;
alter table public.timetable_plans enable row level security;
alter table public.timetable_entries enable row level security;
revoke all on public.learning_venues,public.timetable_plans,public.timetable_entries from public,anon;
grant select,insert,update on public.learning_venues,public.timetable_plans,public.timetable_entries to authenticated;
create policy timetable_venues_read on public.learning_venues for select to authenticated using (private.has_school_role(school_id,array['school_admin','teacher','student','parent']::public.app_role[]));
create policy timetable_venues_admin_insert on public.learning_venues for insert to authenticated with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy timetable_venues_admin_update on public.learning_venues for update to authenticated using (private.has_school_role(school_id,array['school_admin']::public.app_role[])) with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy timetable_plans_read on public.timetable_plans for select to authenticated using (private.has_school_role(school_id,array['school_admin']::public.app_role[]) or (status='published' and private.has_school_role(school_id,array['teacher','student']::public.app_role[])));
create policy timetable_plans_admin_insert on public.timetable_plans for insert to authenticated with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy timetable_plans_admin_update on public.timetable_plans for update to authenticated using (private.has_school_role(school_id,array['school_admin']::public.app_role[])) with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy timetable_entries_read on public.timetable_entries for select to authenticated using (private.can_read_timetable(school_id,id));
create policy timetable_entries_admin_insert on public.timetable_entries for insert to authenticated with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy timetable_entries_admin_update on public.timetable_entries for update to authenticated using (private.has_school_role(school_id,array['school_admin']::public.app_role[])) with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
grant execute on function private.can_read_timetable(uuid,uuid) to authenticated;

insert into public.role_permissions(role,permission)
values ('school_admin'::public.app_role,'school.academics.timetable.manage')
on conflict(role,permission) do nothing;

revoke all on function private.validate_timetable_entry() from public,anon;
revoke all on function private.revalidate_timetable_on_publish() from public,anon;
revoke all on function private.validate_course_enrolment_timetable_conflict() from public,anon;
revoke all on function private.can_read_timetable(uuid,uuid) from public,anon;
