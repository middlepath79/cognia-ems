create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');
alter table public.class_arms add constraint class_arms_id_school_class_unique unique (id, school_id, class_id);

-- Attendance staff assignments scope teachers/lecturers to the class arms or
-- courses they may manage in one academic session.
create table public.attendance_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_user_id uuid not null,
  assignment_type text not null check (assignment_type in ('class', 'course')),
  academic_session_id uuid not null,
  class_id uuid,
  class_arm_id uuid,
  subject_id uuid,
  is_active boolean not null default true,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (assignment_type = 'class' and class_id is not null and subject_id is null)
    or (assignment_type = 'course' and class_id is null and class_arm_id is null and subject_id is not null)
  ),
  foreign key (school_id, teacher_user_id) references public.school_memberships(school_id, user_id) on delete restrict,
  foreign key (academic_session_id, school_id) references public.academic_sessions(id, school_id) on delete restrict,
  foreign key (class_id, school_id) references public.school_classes(id, school_id) on delete restrict,
  foreign key (class_arm_id, school_id, class_id) references public.class_arms(id, school_id, class_id) on delete restrict,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete restrict,
  unique (id, school_id)
);
create index attendance_staff_assignments_teacher_idx on public.attendance_staff_assignments (school_id, teacher_user_id, is_active, academic_session_id);
create unique index attendance_staff_class_assignment_idx on public.attendance_staff_assignments (school_id, teacher_user_id, academic_session_id, class_id, class_arm_id) where assignment_type = 'class' and is_active;
create unique index attendance_staff_course_assignment_idx on public.attendance_staff_assignments (school_id, teacher_user_id, academic_session_id, subject_id) where assignment_type = 'course' and is_active;

-- Course registration is an explicit roster. Attendance never infers course
-- eligibility from a programme or level.
create table public.course_enrolments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  subject_id uuid not null,
  academic_session_id uuid not null,
  academic_term_id uuid not null,
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_on is null or starts_on <= ends_on),
  foreign key (student_id, school_id) references public.students(id, school_id) on delete restrict,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete restrict,
  foreign key (academic_session_id, school_id) references public.academic_sessions(id, school_id) on delete restrict,
  foreign key (academic_term_id, school_id, academic_session_id) references public.academic_terms(id, school_id, academic_session_id) on delete restrict,
  unique (school_id, student_id, subject_id, academic_session_id, academic_term_id),
  unique (id, school_id)
);
create index course_enrolments_roster_idx on public.course_enrolments (school_id, subject_id, academic_session_id, academic_term_id, is_active, student_id);
create index course_enrolments_student_idx on public.course_enrolments (student_id, school_id);

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_model text not null check (attendance_model in ('class', 'course')),
  attendance_date date not null,
  academic_session_id uuid not null,
  academic_term_id uuid not null,
  class_id uuid,
  class_arm_id uuid,
  subject_id uuid,
  lecture_label text check (lecture_label is null or char_length(trim(lecture_label)) between 1 and 80),
  session_label text not null default 'Daily attendance' check (char_length(trim(session_label)) between 1 and 80),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (attendance_model = 'class' and class_id is not null and subject_id is null and lecture_label is null)
    or (attendance_model = 'course' and class_id is null and class_arm_id is null and subject_id is not null and lecture_label is not null)
  ),
  foreign key (academic_session_id, school_id) references public.academic_sessions(id, school_id) on delete restrict,
  foreign key (academic_term_id, school_id, academic_session_id) references public.academic_terms(id, school_id, academic_session_id) on delete restrict,
  foreign key (class_id, school_id) references public.school_classes(id, school_id) on delete restrict,
  foreign key (class_arm_id, school_id, class_id) references public.class_arms(id, school_id, class_id) on delete restrict,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete restrict,
  unique (id, school_id)
);
create unique index attendance_class_session_unique_idx on public.attendance_sessions
  (school_id, academic_session_id, academic_term_id, attendance_date, class_id, coalesce(class_arm_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where attendance_model = 'class';
create unique index attendance_course_session_unique_idx on public.attendance_sessions
  (school_id, academic_session_id, academic_term_id, attendance_date, subject_id, lecture_label)
  where attendance_model = 'course';
create index attendance_sessions_school_date_idx on public.attendance_sessions (school_id, attendance_date desc, attendance_model);
create index attendance_sessions_class_idx on public.attendance_sessions (class_id, class_arm_id, attendance_date desc) where attendance_model = 'class';
create index attendance_sessions_subject_idx on public.attendance_sessions (subject_id, attendance_date desc) where attendance_model = 'course';

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_session_id uuid not null,
  student_id uuid not null,
  status public.attendance_status not null,
  remarks text check (remarks is null or char_length(remarks) <= 500),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (attendance_session_id, school_id) references public.attendance_sessions(id, school_id) on delete restrict,
  foreign key (student_id, school_id) references public.students(id, school_id) on delete restrict,
  unique (school_id, attendance_session_id, student_id),
  unique (id, school_id)
);
create index attendance_records_session_idx on public.attendance_records (school_id, attendance_session_id, status);
create index attendance_records_student_idx on public.attendance_records (school_id, student_id, recorded_at desc);

create table public.attendance_change_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_record_id uuid not null,
  attendance_session_id uuid not null,
  student_id uuid not null,
  previous_status public.attendance_status,
  new_status public.attendance_status not null,
  previous_remarks text,
  new_remarks text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  foreign key (attendance_record_id, school_id) references public.attendance_records(id, school_id) on delete restrict,
  foreign key (attendance_session_id, school_id) references public.attendance_sessions(id, school_id) on delete restrict,
  foreign key (student_id, school_id) references public.students(id, school_id) on delete restrict
);
create index attendance_change_history_record_idx on public.attendance_change_history (school_id, attendance_record_id, changed_at desc);

create function private.can_manage_attendance_scope(
  target_school_id uuid, target_model text, target_class_id uuid,
  target_class_arm_id uuid, target_subject_id uuid, target_session_id uuid
)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if private.has_school_role(target_school_id, array['school_admin']::public.app_role[]) then return true; end if;
  if not private.has_school_role(target_school_id, array['teacher']::public.app_role[]) then return false; end if;
  return exists (
    select 1 from public.attendance_staff_assignments a
    where a.school_id=target_school_id and a.teacher_user_id=(select auth.uid())
      and a.assignment_type=target_model and a.academic_session_id=target_session_id and a.is_active
      and ((target_model='class' and a.class_id=target_class_id and (a.class_arm_id is null or a.class_arm_id=target_class_arm_id))
        or (target_model='course' and a.subject_id=target_subject_id))
  );
end;
$$;

create function private.can_manage_attendance_session(target_session_id uuid, target_school_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.attendance_sessions a
    where a.id=target_session_id and a.school_id=target_school_id
      and private.can_manage_attendance_scope(a.school_id, a.attendance_model, a.class_id, a.class_arm_id, a.subject_id, a.academic_session_id)
  );
$$;

create function private.is_attendance_eligible(target_session_id uuid, target_school_id uuid, target_student_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare a public.attendance_sessions%rowtype;
begin
  select * into a from public.attendance_sessions where id=target_session_id and school_id=target_school_id;
  if not found then return false; end if;
  if a.attendance_model='class' then
    return exists (
      select 1 from public.student_enrolments e
      join public.class_arms ca on ca.id=e.class_arm_id and ca.school_id=e.school_id
      join public.students s on s.id=e.student_id and s.school_id=e.school_id
      where e.school_id=target_school_id and e.student_id=target_student_id and e.structure_type='basic'
        and e.academic_session_id=a.academic_session_id and e.academic_term_id=a.academic_term_id
        and ca.class_id=a.class_id and (a.class_arm_id is null or e.class_arm_id=a.class_arm_id)
        and e.starts_on <= a.attendance_date and (e.ends_on is null or e.ends_on >= a.attendance_date)
        and s.status <> 'applicant'::public.student_status
        and not exists (
          select 1 from public.student_enrolments newer
          where newer.school_id=e.school_id and newer.student_id=e.student_id
            and newer.starts_on > e.starts_on and newer.starts_on <= a.attendance_date
            and (newer.ends_on is null or newer.ends_on >= a.attendance_date)
        )
    );
  end if;
  return exists (
    select 1 from public.course_enrolments e
    join public.students s on s.id=e.student_id and s.school_id=e.school_id
    where e.school_id=target_school_id and e.student_id=target_student_id and e.subject_id=a.subject_id
      and e.academic_session_id=a.academic_session_id and e.academic_term_id=a.academic_term_id
      and e.starts_on <= a.attendance_date and (e.ends_on >= a.attendance_date or (e.ends_on is null and e.is_active))
      and s.status <> 'applicant'::public.student_status
  );
end;
$$;

create function public.get_attendance_roster(target_school_id uuid, target_session_id uuid)
returns table (
  student_id uuid, student_number text, first_name text, middle_name text, surname text,
  attendance_status public.attendance_status, remarks text
)
language plpgsql stable security definer set search_path = '' as $$
declare a public.attendance_sessions%rowtype;
begin
  select * into a from public.attendance_sessions where id=target_session_id and school_id=target_school_id;
  if not found or not private.can_manage_attendance_session(target_session_id,target_school_id) then
    raise exception 'Attendance session access is not allowed';
  end if;
  if a.attendance_model='class' then
    return query
      select s.id,s.student_number,s.first_name,s.middle_name,s.surname,r.status,r.remarks
      from public.student_enrolments e
      join public.class_arms ca on ca.id=e.class_arm_id and ca.school_id=e.school_id
      join public.students s on s.id=e.student_id and s.school_id=e.school_id
      left join public.attendance_records r on r.school_id=s.school_id and r.attendance_session_id=a.id and r.student_id=s.id
      where e.school_id=target_school_id and e.structure_type='basic' and e.academic_session_id=a.academic_session_id
        and e.academic_term_id=a.academic_term_id and ca.class_id=a.class_id
        and (a.class_arm_id is null or e.class_arm_id=a.class_arm_id)
        and e.starts_on <= a.attendance_date and (e.ends_on is null or e.ends_on >= a.attendance_date)
        and s.status <> 'applicant'::public.student_status
        and not exists (
          select 1 from public.student_enrolments newer
          where newer.school_id=e.school_id and newer.student_id=e.student_id
            and newer.starts_on > e.starts_on and newer.starts_on <= a.attendance_date
            and (newer.ends_on is null or newer.ends_on >= a.attendance_date)
        )
      order by s.surname,s.first_name,s.student_number;
  else
    return query
      select s.id,s.student_number,s.first_name,s.middle_name,s.surname,r.status,r.remarks
      from public.course_enrolments e
      join public.students s on s.id=e.student_id and s.school_id=e.school_id
      left join public.attendance_records r on r.school_id=s.school_id and r.attendance_session_id=a.id and r.student_id=s.id
      where e.school_id=target_school_id and e.subject_id=a.subject_id
        and e.academic_session_id=a.academic_session_id and e.academic_term_id=a.academic_term_id
        and e.starts_on <= a.attendance_date and (e.ends_on >= a.attendance_date or (e.ends_on is null and e.is_active))
        and s.status <> 'applicant'::public.student_status
      order by s.surname,s.first_name,s.student_number;
  end if;
end;
$$;

create function public.record_attendance_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into public.attendance_change_history (
      school_id,attendance_record_id,attendance_session_id,student_id,previous_status,new_status,
      previous_remarks,new_remarks,changed_by
    ) values (
      new.school_id,new.id,new.attendance_session_id,new.student_id,
      null,new.status,null,new.remarks,(select auth.uid())
    );
  elsif old.status is distinct from new.status or old.remarks is distinct from new.remarks then
    insert into public.attendance_change_history (
      school_id,attendance_record_id,attendance_session_id,student_id,previous_status,new_status,
      previous_remarks,new_remarks,changed_by
    ) values (
      new.school_id,new.id,new.attendance_session_id,new.student_id,
      old.status,new.status,old.remarks,new.remarks,(select auth.uid())
    );
  end if;
  return new;
end;
$$;

create trigger attendance_sessions_touch_updated_at before update on public.attendance_sessions
  for each row execute function public.touch_updated_at();
create trigger attendance_records_touch_updated_at before update on public.attendance_records
  for each row execute function public.touch_updated_at();
create trigger attendance_records_audit after insert or update on public.attendance_records
  for each row execute function public.record_attendance_change();

alter table public.attendance_staff_assignments enable row level security;
alter table public.course_enrolments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_change_history enable row level security;

revoke all on public.attendance_staff_assignments, public.course_enrolments, public.attendance_sessions,
  public.attendance_records, public.attendance_change_history from public, anon;
grant select, insert, update, delete on public.attendance_staff_assignments to authenticated;
grant select, insert, update on public.course_enrolments to authenticated;
grant select, insert, update on public.attendance_sessions to authenticated;
grant select, insert, update on public.attendance_records to authenticated;
grant select on public.attendance_change_history to authenticated;

revoke all on function private.can_manage_attendance_scope(uuid,text,uuid,uuid,uuid,uuid),
  private.can_manage_attendance_session(uuid,uuid), private.is_attendance_eligible(uuid,uuid,uuid),
  public.record_attendance_change() from public, anon;
grant execute on function private.can_manage_attendance_scope(uuid,text,uuid,uuid,uuid,uuid),
  private.can_manage_attendance_session(uuid,uuid), private.is_attendance_eligible(uuid,uuid,uuid) to authenticated;
revoke all on function public.get_attendance_roster(uuid,uuid) from public, anon;
grant execute on function public.get_attendance_roster(uuid,uuid) to authenticated;

create policy attendance_assignments_read_admin_or_self on public.attendance_staff_assignments for select to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[])
    or (teacher_user_id=(select auth.uid()) and private.has_school_role(school_id,array['teacher']::public.app_role[])));
create policy attendance_assignments_admin_manage on public.attendance_staff_assignments for all to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id,array['school_admin']::public.app_role[])
    and (not is_active or exists (select 1 from public.school_memberships m where m.school_id=attendance_staff_assignments.school_id and m.user_id=attendance_staff_assignments.teacher_user_id and m.role='teacher' and m.status='active')));

create policy course_enrolments_read_authorized on public.course_enrolments for select to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[])
    or private.can_manage_attendance_scope(school_id,'course',null,null,subject_id,academic_session_id)
    or exists (select 1 from public.students s where s.id=course_enrolments.student_id and s.school_id=course_enrolments.school_id and s.auth_user_id=(select auth.uid())));
create policy course_enrolments_admin_insert on public.course_enrolments for insert to authenticated
  with check (created_by=(select auth.uid()) and private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy course_enrolments_admin_update on public.course_enrolments for update to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));

create policy attendance_sessions_read_assigned on public.attendance_sessions for select to authenticated
  using (private.can_manage_attendance_scope(school_id,attendance_model,class_id,class_arm_id,subject_id,academic_session_id));
create policy attendance_sessions_insert_assigned on public.attendance_sessions for insert to authenticated
  with check (created_by=(select auth.uid()) and updated_by=(select auth.uid())
    and private.can_manage_attendance_scope(school_id,attendance_model,class_id,class_arm_id,subject_id,academic_session_id));
create policy attendance_sessions_update_assigned on public.attendance_sessions for update to authenticated
  using (private.can_manage_attendance_scope(school_id,attendance_model,class_id,class_arm_id,subject_id,academic_session_id))
  with check (updated_by=(select auth.uid())
    and private.can_manage_attendance_scope(school_id,attendance_model,class_id,class_arm_id,subject_id,academic_session_id));

create policy attendance_records_read_assigned_or_self on public.attendance_records for select to authenticated
  using (private.can_manage_attendance_session(attendance_session_id,school_id)
    or exists (select 1 from public.students s where s.id=attendance_records.student_id and s.school_id=attendance_records.school_id and s.auth_user_id=(select auth.uid())));
create policy attendance_records_insert_assigned on public.attendance_records for insert to authenticated
  with check (recorded_by=(select auth.uid())
    and private.can_manage_attendance_session(attendance_session_id,school_id)
    and private.is_attendance_eligible(attendance_session_id,school_id,student_id));
create policy attendance_records_update_assigned on public.attendance_records for update to authenticated
  using (private.can_manage_attendance_session(attendance_session_id,school_id)
    and private.is_attendance_eligible(attendance_session_id,school_id,student_id))
  with check (private.can_manage_attendance_session(attendance_session_id,school_id)
    and private.is_attendance_eligible(attendance_session_id,school_id,student_id));

create policy attendance_change_history_read_assigned on public.attendance_change_history for select to authenticated
  using (private.can_manage_attendance_session(attendance_session_id,school_id));

insert into public.role_permissions(role,permission) values ('school_admin','school.attendance.manage')
on conflict do nothing;
