-- Continuous assessment and coursework. All academic references are tenant scoped.
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assessment_model text not null check (assessment_model in ('class','course')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text check (description is null or char_length(description)<=2000),
  assessment_type text not null check (char_length(trim(assessment_type)) between 1 and 60),
  academic_session_id uuid not null,
  academic_term_id uuid not null,
  class_id uuid,
  class_arm_id uuid,
  subject_id uuid,
  programme_id uuid,
  academic_level_id uuid,
  maximum_marks numeric(8,2) not null check (maximum_marks>0),
  weight numeric(7,3) not null check (weight>0),
  assessment_date date,
  submission_deadline timestamptz,
  instructions text check (instructions is null or char_length(instructions)<=10000),
  accepted_formats text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  is_coursework boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,school_id),
  check ((assessment_model='class' and class_id is not null and subject_id is not null and class_arm_id is not null and programme_id is null and academic_level_id is null)
      or (assessment_model='course' and class_id is null and class_arm_id is null and subject_id is not null and programme_id is not null and academic_level_id is not null)),
  foreign key(academic_session_id,school_id) references public.academic_sessions(id,school_id) on delete restrict,
  foreign key(academic_term_id,school_id,academic_session_id) references public.academic_terms(id,school_id,academic_session_id) on delete restrict,
  foreign key(class_id,school_id) references public.school_classes(id,school_id) on delete restrict,
  foreign key(class_arm_id,school_id,class_id) references public.class_arms(id,school_id,class_id) on delete restrict,
  foreign key(subject_id,school_id) references public.subjects(id,school_id) on delete restrict,
  foreign key(programme_id,school_id) references public.academic_programmes(id,school_id) on delete restrict,
  foreign key(academic_level_id,school_id,programme_id) references public.academic_levels(id,school_id,programme_id) on delete restrict
);
create index assessments_scope_idx on public.assessments(school_id,academic_session_id,academic_term_id,status);
create index assessments_class_idx on public.assessments(school_id,class_id,class_arm_id,subject_id) where assessment_model='class';
create index assessments_course_idx on public.assessments(school_id,programme_id,academic_level_id,subject_id) where assessment_model='course';

create table public.assessment_scores (
  id uuid primary key default gen_random_uuid(), school_id uuid not null,
  assessment_id uuid not null, student_id uuid not null, score numeric(8,2),
  remarks text check (remarks is null or char_length(remarks)<=1000),
  is_published boolean not null default false, submitted_at timestamptz,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(school_id,assessment_id,student_id), unique(id,school_id),
  foreign key(assessment_id,school_id) references public.assessments(id,school_id) on delete restrict,
  foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict,
  check(score is null or score>=0)
);
create index assessment_scores_student_idx on public.assessment_scores(school_id,student_id,assessment_id);

create table public.assessment_score_history (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, score_id uuid not null,
  assessment_id uuid not null, student_id uuid not null, previous_score numeric(8,2), new_score numeric(8,2),
  previous_remarks text, new_remarks text, previous_published boolean, new_published boolean,
  changed_by uuid references auth.users(id) on delete set null, changed_at timestamptz not null default now(),
  foreign key(score_id,school_id) references public.assessment_scores(id,school_id) on delete restrict,
  foreign key(assessment_id,school_id) references public.assessments(id,school_id) on delete restrict,
  foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict
);
create index assessment_score_history_lookup_idx on public.assessment_score_history(school_id,score_id,changed_at desc);

create table public.coursework_submissions (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, assessment_id uuid not null,
  student_id uuid not null, storage_path text not null check(char_length(storage_path) between 1 and 500),
  original_filename text not null check(char_length(original_filename) between 1 and 255),
  content_type text not null check(char_length(content_type)<=120), file_size bigint not null check(file_size between 1 and 20971520),
  submission_status text not null default 'submitted' check(submission_status in ('submitted','late','graded','returned')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(school_id,assessment_id,student_id), unique(id,school_id),
  foreign key(assessment_id,school_id) references public.assessments(id,school_id) on delete restrict,
  foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict
);
create index coursework_submissions_assessment_idx on public.coursework_submissions(school_id,assessment_id,submission_status);

create table public.assessment_resources (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, assessment_id uuid not null,
 title text not null check(char_length(trim(title)) between 1 and 160), storage_path text not null check(char_length(storage_path)<=500),
 content_type text not null check(char_length(content_type)<=120), file_size bigint not null check(file_size between 1 and 20971520),
 uploaded_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(),
 foreign key(assessment_id,school_id) references public.assessments(id,school_id) on delete restrict,
 unique(school_id,storage_path)
);
create index assessment_resources_assessment_idx on public.assessment_resources(school_id,assessment_id,created_at);

create table public.coursework_submission_history (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, submission_id uuid not null,
 assessment_id uuid not null, student_id uuid not null, previous_path text, new_path text not null,
 previous_status text, new_status text not null,
 changed_by uuid references auth.users(id) on delete set null, changed_at timestamptz not null default now(),
 foreign key(assessment_id,school_id) references public.assessments(id,school_id) on delete restrict,
 foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict,
 foreign key(submission_id,school_id) references public.coursework_submissions(id,school_id) on delete restrict
);
create index coursework_submission_history_lookup_idx on public.coursework_submission_history(school_id,submission_id,changed_at desc);

create or replace function private.can_manage_assessment(target_school uuid,target_model text,target_class uuid,target_arm uuid,target_subject uuid,target_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.has_school_role(target_school,array['school_admin']::public.app_role[]) or
 (private.has_school_role(target_school,array['teacher']::public.app_role[]) and exists(
   select 1 from public.attendance_staff_assignments a where a.school_id=target_school and a.teacher_user_id=(select auth.uid()) and a.is_active and a.academic_session_id=target_session
    and ((target_model='class' and a.assignment_type='class' and a.class_id=target_class and (a.class_arm_id is null or a.class_arm_id=target_arm))
      or (target_model='course' and a.assignment_type='course' and a.subject_id=target_subject))))
$$;

create or replace function private.is_assessment_eligible(target_assessment uuid,target_student uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare a public.assessments%rowtype;
begin
 select * into a from public.assessments where id=target_assessment;
 if not found then return false; end if;
 if a.assessment_model='class' then return exists(
  select 1 from public.student_enrolments e join public.students s on s.id=e.student_id and s.school_id=e.school_id
  where e.school_id=a.school_id and e.student_id=target_student and e.structure_type='basic' and e.is_current
   and e.class_arm_id=a.class_arm_id and e.academic_session_id=a.academic_session_id and e.academic_term_id=a.academic_term_id
   and e.starts_on<=coalesce(a.assessment_date,current_date) and (e.ends_on is null or e.ends_on>=coalesce(a.assessment_date,current_date)) and s.status in ('active','admitted'));
 end if;
 return exists(select 1 from public.course_enrolments ce join public.students s on s.id=ce.student_id and s.school_id=ce.school_id
  join public.student_enrolments e on e.school_id=ce.school_id and e.student_id=ce.student_id and e.is_current and e.structure_type='programme'
  where ce.school_id=a.school_id and ce.student_id=target_student and ce.subject_id=a.subject_id and ce.programme_id=a.programme_id and ce.academic_level_id=a.academic_level_id
   and ce.academic_session_id=a.academic_session_id and ce.academic_term_id=a.academic_term_id and ce.is_active
   and e.programme_id=a.programme_id and e.academic_level_id=a.academic_level_id and e.academic_session_id=a.academic_session_id and e.academic_term_id=a.academic_term_id
   and ce.starts_on<=coalesce(a.assessment_date,current_date) and (ce.ends_on is null or ce.ends_on>=coalesce(a.assessment_date,current_date)) and s.status in ('active','admitted'));
end $$;

create or replace function private.can_student_view_assessment(target_assessment uuid,target_student uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare a public.assessments%rowtype;
begin
 select * into a from public.assessments where id=target_assessment;
 if not found then return false; end if;
 if a.assessment_model='class' then return exists(select 1 from public.student_enrolments e where e.school_id=a.school_id and e.student_id=target_student and e.structure_type='basic' and e.class_arm_id=a.class_arm_id and e.academic_session_id=a.academic_session_id and e.academic_term_id=a.academic_term_id and e.starts_on<=coalesce(a.assessment_date,current_date) and (e.ends_on is null or e.ends_on>=coalesce(a.assessment_date,current_date))); end if;
 return exists(select 1 from public.course_enrolments ce join public.student_enrolments e on e.school_id=ce.school_id and e.student_id=ce.student_id where ce.school_id=a.school_id and ce.student_id=target_student and ce.subject_id=a.subject_id and ce.programme_id=a.programme_id and ce.academic_level_id=a.academic_level_id and ce.academic_session_id=a.academic_session_id and ce.academic_term_id=a.academic_term_id and ce.starts_on<=coalesce(a.assessment_date,current_date) and (ce.ends_on is null or ce.ends_on>=coalesce(a.assessment_date,current_date)) and e.structure_type='programme' and e.programme_id=a.programme_id and e.academic_level_id=a.academic_level_id and e.academic_session_id=a.academic_session_id and e.academic_term_id=a.academic_term_id and e.starts_on<=coalesce(a.assessment_date,current_date) and (e.ends_on is null or e.ends_on>=coalesce(a.assessment_date,current_date)));
end $$;

create or replace function public.get_assessment_roster(target_assessment uuid)
returns table(student_id uuid,student_number text,first_name text,middle_name text,surname text,score numeric,remarks text,is_published boolean)
language plpgsql stable security definer set search_path='' as $$
declare a public.assessments%rowtype;
begin
 select * into a from public.assessments where id=target_assessment;
 if not found or not private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id) then raise exception 'Assessment access is not allowed'; end if;
 return query select s.id,s.student_number,s.first_name,s.middle_name,s.surname,sc.score,sc.remarks,coalesce(sc.is_published,false)
 from public.students s left join public.assessment_scores sc on sc.school_id=s.school_id and sc.student_id=s.id and sc.assessment_id=a.id
 where s.school_id=a.school_id and private.is_assessment_eligible(a.id,s.id) order by s.surname,s.first_name,s.student_number;
end $$;

create or replace function public.validate_assessment_score()
returns trigger language plpgsql security definer set search_path='' as $$
declare a public.assessments%rowtype;
begin
 select * into a from public.assessments where id=new.assessment_id and school_id=new.school_id for update;
 if not found or not private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id) then raise exception 'Assessment management is not allowed'; end if;
 if tg_op='INSERT' or old.assessment_id is distinct from new.assessment_id or old.student_id is distinct from new.student_id then
  if not private.is_assessment_eligible(a.id,new.student_id) and not exists(select 1 from public.coursework_submissions cs where cs.school_id=new.school_id and cs.assessment_id=a.id and cs.student_id=new.student_id) then raise exception 'Student is not eligible for this assessment'; end if;
 end if;
 if new.score is not null and (new.score<0 or new.score>a.maximum_marks) then raise exception 'Score must be between zero and maximum marks'; end if;
 if tg_op='UPDATE' and old.is_published and (old.score is distinct from new.score or old.remarks is distinct from new.remarks or not new.is_published)
  and not private.has_school_role(a.school_id,array['school_admin']::public.app_role[]) then raise exception 'Published scores require administrator correction'; end if;
 return new;
end $$;

create or replace function public.audit_assessment_score()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.assessment_score_history(school_id,score_id,assessment_id,student_id,previous_score,new_score,previous_remarks,new_remarks,previous_published,new_published,changed_by)
 values(new.school_id,new.id,new.assessment_id,new.student_id,case when tg_op='UPDATE' then old.score end,new.score,case when tg_op='UPDATE' then old.remarks end,new.remarks,case when tg_op='UPDATE' then old.is_published end,new.is_published,(select auth.uid()));
 return new;
end $$;

create or replace function public.validate_assessment_weight()
returns trigger language plpgsql security definer set search_path='' as $$
declare configured_max numeric; total_weight numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended(new.school_id::text||new.academic_session_id::text||new.academic_term_id::text||coalesce(new.class_arm_id,new.programme_id)::text||new.subject_id::text,0));
 select coalesce(nullif(s.grading_scale->>'maximum','')::numeric,100) into configured_max from public.schools s where s.id=new.school_id;
 select coalesce(sum(weight),0) into total_weight from public.assessments a where a.school_id=new.school_id and a.academic_session_id=new.academic_session_id and a.academic_term_id=new.academic_term_id and a.subject_id=new.subject_id and a.status<>'archived' and a.id<>new.id and ((new.assessment_model='class' and a.class_arm_id=new.class_arm_id) or (new.assessment_model='course' and a.programme_id=new.programme_id and a.academic_level_id=new.academic_level_id));
 if new.status<>'archived' and total_weight+new.weight>configured_max then raise exception 'Assessment weights exceed this institution grade maximum (%)',configured_max; end if;
 return new;
end $$;

create or replace function public.protect_published_assessment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status<>'draft' and (new.title,new.description,new.assessment_type,new.academic_session_id,new.academic_term_id,new.class_id,new.class_arm_id,new.subject_id,new.programme_id,new.academic_level_id,new.maximum_marks,new.weight,new.assessment_date,new.submission_deadline,new.instructions,new.accepted_formats,new.is_coursework)
   is distinct from
   (old.title,old.description,old.assessment_type,old.academic_session_id,old.academic_term_id,old.class_id,old.class_arm_id,old.subject_id,old.programme_id,old.academic_level_id,old.maximum_marks,old.weight,old.assessment_date,old.submission_deadline,old.instructions,old.accepted_formats,old.is_coursework)
 then raise exception 'Published assessment configuration is locked'; end if;
 return new;
end $$;

create or replace function public.validate_assessment_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare institution_type text;
begin
 select s.institution_type into institution_type from public.schools s where s.id=new.school_id;
 if (institution_type in ('early_childhood','basic','secondary') and new.assessment_model<>'class') or
    (institution_type not in ('early_childhood','basic','secondary') and new.assessment_model<>'course') then
  raise exception 'Assessment model does not match institution structure';
 end if;
 if not exists(select 1 from public.subjects s where s.id=new.subject_id and s.school_id=new.school_id and s.is_active
    and (new.assessment_model<>'course' or (s.programme_id is null or s.programme_id=new.programme_id))
    and (new.assessment_model<>'course' or (s.academic_level_id is null or s.academic_level_id=new.academic_level_id))) then
  raise exception 'Assessment subject is inactive or outside the academic context';
 end if;
 if new.assessment_model='course' and not exists(select 1 from public.academic_levels l join public.academic_programmes p on p.id=l.programme_id and p.school_id=l.school_id where l.id=new.academic_level_id and l.school_id=new.school_id and l.programme_id=new.programme_id and l.is_active and p.is_active) then raise exception 'Programme or academic level is inactive'; end if;
 if new.assessment_model='class' and not exists(select 1 from public.class_arms ca where ca.id=new.class_arm_id and ca.class_id=new.class_id and ca.school_id=new.school_id) then raise exception 'Class arm is mismatched'; end if;
 return new;
end $$;

create or replace function public.audit_coursework_submission()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.coursework_submission_history(school_id,submission_id,assessment_id,student_id,previous_path,new_path,previous_status,new_status,changed_by)
 values(new.school_id,new.id,new.assessment_id,new.student_id,case when tg_op='UPDATE' then old.storage_path end,new.storage_path,case when tg_op='UPDATE' then old.submission_status end,new.submission_status,(select auth.uid()));
 return new;
end $$;

create or replace function public.validate_coursework_submission()
returns trigger language plpgsql security definer set search_path='' as $$
declare a public.assessments%rowtype; student_owner uuid;
begin
 select * into a from public.assessments where id=new.assessment_id and school_id=new.school_id;
 if not found or not a.is_coursework then raise exception 'Coursework assessment was not found'; end if;
 select s.auth_user_id into student_owner from public.students s where s.id=new.student_id and s.school_id=new.school_id;
 if tg_op='INSERT' then
  if a.status<>'published' then raise exception 'Coursework is not open'; end if;
  if not private.is_assessment_eligible(a.id,new.student_id) then raise exception 'Student is not eligible for this coursework'; end if;
  new.submitted_at:=clock_timestamp();
  new.submission_status:=case when a.submission_deadline is not null and clock_timestamp()>a.submission_deadline then 'late' else 'submitted' end;
 elsif old.storage_path is distinct from new.storage_path then
  if old.submission_status<>'returned' or student_owner is distinct from (select auth.uid()) then raise exception 'Only the student may replace returned coursework'; end if;
  if a.status<>'published' then raise exception 'Coursework is not open'; end if;
  if not private.is_assessment_eligible(a.id,new.student_id) then raise exception 'Student is not eligible to resubmit this coursework'; end if;
  new.submitted_at:=clock_timestamp();
  new.submission_status:=case when a.submission_deadline is not null and clock_timestamp()>a.submission_deadline then 'late' else 'submitted' end;
 end if;
 return new;
end $$;

create trigger assessments_weight_check before insert or update of weight,status on public.assessments for each row execute function public.validate_assessment_weight();
create trigger assessments_protect_published before update on public.assessments for each row execute function public.protect_published_assessment();
create trigger assessments_validate_scope before insert or update of school_id,assessment_model,subject_id,class_id,class_arm_id,programme_id,academic_level_id on public.assessments for each row execute function public.validate_assessment_scope();
create trigger assessments_touch_updated before update on public.assessments for each row execute function public.touch_updated_at();
create trigger assessment_scores_validate before insert or update on public.assessment_scores for each row execute function public.validate_assessment_score();
create trigger assessment_scores_audit after insert or update on public.assessment_scores for each row execute function public.audit_assessment_score();
create trigger coursework_submissions_audit after insert or update on public.coursework_submissions for each row execute function public.audit_coursework_submission();
create trigger coursework_submissions_validate before insert or update on public.coursework_submissions for each row execute function public.validate_coursework_submission();

alter table public.assessments enable row level security;
alter table public.assessment_scores enable row level security;
alter table public.assessment_score_history enable row level security;
alter table public.coursework_submissions enable row level security;
alter table public.assessment_resources enable row level security;
alter table public.coursework_submission_history enable row level security;
revoke all on public.assessments,public.assessment_scores,public.assessment_score_history,public.coursework_submissions,public.assessment_resources,public.coursework_submission_history from public,anon;
grant select,insert,update on public.assessments,public.assessment_scores,public.coursework_submissions,public.assessment_resources to authenticated;
grant select on public.assessment_score_history to authenticated;
grant select on public.coursework_submission_history to authenticated;
grant delete on public.assessment_resources to authenticated;
create policy assessments_read_manage on public.assessments for select to authenticated using (private.can_manage_assessment(school_id,assessment_model,class_id,class_arm_id,subject_id,academic_session_id) or (status<>'draft' and exists(select 1 from public.students s where s.school_id=assessments.school_id and s.auth_user_id=(select auth.uid()) and private.can_student_view_assessment(assessments.id,s.id))));
create policy assessments_insert_manage on public.assessments for insert to authenticated with check (created_by=(select auth.uid()) and private.can_manage_assessment(school_id,assessment_model,class_id,class_arm_id,subject_id,academic_session_id));
create policy assessments_update_manage on public.assessments for update to authenticated using (private.can_manage_assessment(school_id,assessment_model,class_id,class_arm_id,subject_id,academic_session_id) and (private.has_school_role(school_id,array['school_admin']::public.app_role[]) or (is_coursework and created_by=(select auth.uid())))) with check (private.can_manage_assessment(school_id,assessment_model,class_id,class_arm_id,subject_id,academic_session_id) and (private.has_school_role(school_id,array['school_admin']::public.app_role[]) or (is_coursework and created_by=(select auth.uid()))));
create policy assessment_scores_read_own_or_assigned on public.assessment_scores for select to authenticated using ((is_published and exists(select 1 from public.assessments a join public.students s on s.school_id=a.school_id where a.id=assessment_scores.assessment_id and a.school_id=assessment_scores.school_id and a.status<>'draft' and s.id=assessment_scores.student_id and s.auth_user_id=(select auth.uid()))) or exists(select 1 from public.assessments a where a.id=assessment_scores.assessment_id and a.school_id=assessment_scores.school_id and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id)));
create policy assessment_scores_insert_assigned on public.assessment_scores for insert to authenticated with check (updated_by=(select auth.uid()) and exists(select 1 from public.assessments a where a.id=assessment_scores.assessment_id and a.school_id=assessment_scores.school_id and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id)));
create policy assessment_scores_update_assigned on public.assessment_scores for update to authenticated using (exists(select 1 from public.assessments a where a.id=assessment_scores.assessment_id and a.school_id=assessment_scores.school_id and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id))) with check (updated_by=(select auth.uid()) and exists(select 1 from public.assessments a where a.id=assessment_scores.assessment_id and a.school_id=assessment_scores.school_id and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id)));
create policy assessment_score_history_read_authorized on public.assessment_score_history for select to authenticated using (private.has_school_role(school_id,array['school_admin']::public.app_role[]) or exists(select 1 from public.assessments a where a.id=assessment_score_history.assessment_id and a.school_id=assessment_score_history.school_id and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id)));
create policy coursework_read_owner_or_assigned on public.coursework_submissions for select to authenticated using ((exists(select 1 from public.students s where s.id=coursework_submissions.student_id and s.school_id=coursework_submissions.school_id and s.auth_user_id=(select auth.uid())) and exists(select 1 from public.assessments a where a.id=coursework_submissions.assessment_id and a.school_id=coursework_submissions.school_id and a.status<>'draft')) or exists(select 1 from public.assessments a where a.id=coursework_submissions.assessment_id and a.school_id=coursework_submissions.school_id and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id)));
create policy coursework_insert_owner on public.coursework_submissions for insert to authenticated with check (exists(select 1 from public.students s where s.id=coursework_submissions.student_id and s.school_id=coursework_submissions.school_id and s.auth_user_id=(select auth.uid())) and storage_path like school_id::text||'/'||assessment_id::text||'/'||student_id::text||'/%' and submission_status in ('submitted','late') and private.is_assessment_eligible(assessment_id,student_id) and exists(select 1 from public.assessments a where a.id=coursework_submissions.assessment_id and a.school_id=coursework_submissions.school_id and a.is_coursework and a.status='published'));
create policy coursework_update_assigned on public.coursework_submissions for update to authenticated using (exists(select 1 from public.assessments a where a.id=coursework_submissions.assessment_id and a.school_id=coursework_submissions.school_id and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id))) with check (exists(select 1 from public.assessments a where a.id=coursework_submissions.assessment_id and a.school_id=coursework_submissions.school_id and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id)));
create policy coursework_resubmit_returned on public.coursework_submissions for update to authenticated using (submission_status='returned' and exists(select 1 from public.students s where s.id=coursework_submissions.student_id and s.school_id=coursework_submissions.school_id and s.auth_user_id=(select auth.uid()))) with check (submission_status in ('submitted','late') and storage_path like school_id::text||'/'||assessment_id::text||'/'||student_id::text||'/%' and private.is_assessment_eligible(assessment_id,student_id) and exists(select 1 from public.students s where s.id=coursework_submissions.student_id and s.school_id=coursework_submissions.school_id and s.auth_user_id=(select auth.uid())));
create policy assessment_resources_read on public.assessment_resources for select to authenticated using (exists(select 1 from public.assessments a where a.id=assessment_resources.assessment_id and a.school_id=assessment_resources.school_id and (private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id) or (a.status<>'draft' and exists(select 1 from public.students s where s.school_id=a.school_id and s.auth_user_id=(select auth.uid()) and private.can_student_view_assessment(a.id,s.id))))));
create policy assessment_resources_insert_assigned on public.assessment_resources for insert to authenticated with check (uploaded_by=(select auth.uid()) and exists(select 1 from public.assessments a where a.id=assessment_resources.assessment_id and a.school_id=assessment_resources.school_id and a.status='draft' and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id)) and storage_path like school_id::text||'/'||assessment_id::text||'/resources/%');
create policy assessment_resources_delete_assigned on public.assessment_resources for delete to authenticated using (exists(select 1 from public.assessments a where a.id=assessment_resources.assessment_id and a.school_id=assessment_resources.school_id and a.status='draft' and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id)));
create policy coursework_history_read_assigned on public.coursework_submission_history for select to authenticated using (private.has_school_role(school_id,array['school_admin']::public.app_role[]) or exists(select 1 from public.assessments a where a.id=coursework_submission_history.assessment_id and a.school_id=coursework_submission_history.school_id and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id)));
revoke all on function private.can_manage_assessment(uuid,text,uuid,uuid,uuid,uuid),private.is_assessment_eligible(uuid,uuid),private.can_student_view_assessment(uuid,uuid) from public,anon;
grant execute on function private.can_manage_assessment(uuid,text,uuid,uuid,uuid,uuid),private.is_assessment_eligible(uuid,uuid),private.can_student_view_assessment(uuid,uuid) to authenticated;
revoke all on function public.get_assessment_roster(uuid),public.validate_assessment_score(),public.audit_assessment_score(),public.validate_assessment_weight(),public.protect_published_assessment(),public.validate_assessment_scope(),public.audit_coursework_submission(),public.validate_coursework_submission() from public,anon;
grant execute on function public.get_assessment_roster(uuid) to authenticated;

insert into public.role_permissions(role,permission) values ('school_admin','school.assessments.manage'),('teacher','school.assessments.assigned.manage') on conflict do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cognia-coursework','cognia-coursework',false,20971520,array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy cognia_coursework_read_authorized on storage.objects for select to authenticated using(bucket_id='cognia-coursework' and exists(select 1 from public.coursework_submissions cs join public.assessments a on a.id=cs.assessment_id and a.school_id=cs.school_id where cs.storage_path=name and ((a.status<>'draft' and exists(select 1 from public.students s where s.id=cs.student_id and s.school_id=cs.school_id and s.auth_user_id=(select auth.uid()))) or private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id))));
create policy cognia_coursework_upload_owner on storage.objects for insert to authenticated with check(bucket_id='cognia-coursework' and exists(select 1 from public.students s where s.auth_user_id=(select auth.uid()) and split_part(name,'/',1)=s.school_id::text and split_part(name,'/',3)=s.id::text) and exists(select 1 from public.assessments a where a.id::text=split_part(name,'/',2) and a.school_id::text=split_part(name,'/',1) and a.is_coursework and a.status='published'));
create policy cognia_coursework_upload_resource on storage.objects for insert to authenticated with check(bucket_id='cognia-coursework' and exists(select 1 from public.assessments a where a.id::text=split_part(name,'/',2) and a.school_id::text=split_part(name,'/',1) and a.status='draft' and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id) and split_part(name,'/',3)='resources'));
create policy cognia_coursework_read_resource on storage.objects for select to authenticated using(bucket_id='cognia-coursework' and exists(select 1 from public.assessment_resources r join public.assessments a on a.id=r.assessment_id and a.school_id=r.school_id where r.storage_path=name and (private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id) or (a.status<>'draft' and exists(select 1 from public.students s where s.school_id=a.school_id and s.auth_user_id=(select auth.uid()) and private.can_student_view_assessment(a.id,s.id))))));
create policy cognia_coursework_read_returned_submission on storage.objects for select to authenticated using(bucket_id='cognia-coursework' and exists(select 1 from public.coursework_submissions cs where cs.storage_path=name and exists(select 1 from public.students s where s.id=cs.student_id and s.school_id=cs.school_id and s.auth_user_id=(select auth.uid()))));
create policy cognia_coursework_upload_revision on storage.objects for insert to authenticated with check(bucket_id='cognia-coursework' and exists(select 1 from public.coursework_submissions cs join public.students s on s.id=cs.student_id and s.school_id=cs.school_id where cs.submission_status='returned' and s.auth_user_id=(select auth.uid()) and split_part(name,'/',1)=cs.school_id::text and split_part(name,'/',2)=cs.assessment_id::text and split_part(name,'/',3)=cs.student_id::text));
create policy cognia_coursework_cleanup_unlinked on storage.objects for delete to authenticated using(bucket_id='cognia-coursework' and not exists(select 1 from public.coursework_submissions cs where cs.storage_path=name) and not exists(select 1 from public.assessment_resources r where r.storage_path=name) and (exists(select 1 from public.students s where s.auth_user_id=(select auth.uid()) and s.school_id::text=split_part(name,'/',1) and s.id::text=split_part(name,'/',3)) or exists(select 1 from public.assessments a where a.id::text=split_part(name,'/',2) and a.school_id::text=split_part(name,'/',1) and split_part(name,'/',3)='resources' and private.can_manage_assessment(a.school_id,a.assessment_model,a.class_id,a.class_arm_id,a.subject_id,a.academic_session_id))));
