-- Phase 4D examination scheduling and raw examination results.
-- CA remains separate and is not synthesized or included in examination marks.
create table public.examinations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assessment_model text not null check(assessment_model in ('class','course')),
  name text not null check(char_length(trim(name)) between 1 and 160),
  examination_type text not null check(char_length(trim(examination_type)) between 1 and 60),
  academic_session_id uuid not null,
  academic_term_id uuid not null,
  class_id uuid,
  class_arm_id uuid,
  subject_id uuid not null,
  programme_id uuid,
  academic_level_id uuid,
  examination_date date,
  starts_at time,
  ends_at time,
  venue text check(venue is null or char_length(venue)<=160),
  maximum_marks numeric(8,4) not null check(maximum_marks>0 and scale(maximum_marks)<=2),
  instructions text check(instructions is null or char_length(instructions)<=10000),
  status text not null default 'draft' check(status in ('draft','published','closed','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,school_id),
  check((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and starts_at<ends_at)),
  check((assessment_model='class' and class_id is not null and class_arm_id is not null and programme_id is null and academic_level_id is null)
     or (assessment_model='course' and class_id is null and class_arm_id is null and programme_id is not null and academic_level_id is not null)),
  foreign key(academic_session_id,school_id) references public.academic_sessions(id,school_id) on delete restrict,
  foreign key(academic_term_id,school_id,academic_session_id) references public.academic_terms(id,school_id,academic_session_id) on delete restrict,
  foreign key(class_id,school_id) references public.school_classes(id,school_id) on delete restrict,
  foreign key(class_arm_id,school_id,class_id) references public.class_arms(id,school_id,class_id) on delete restrict,
  foreign key(subject_id,school_id) references public.subjects(id,school_id) on delete restrict,
  foreign key(programme_id,school_id) references public.academic_programmes(id,school_id) on delete restrict,
  foreign key(academic_level_id,school_id,programme_id) references public.academic_levels(id,school_id,programme_id) on delete restrict
);
create index examinations_period_idx on public.examinations(school_id,academic_session_id,academic_term_id,status);
create index examinations_class_scope_idx on public.examinations(school_id,class_arm_id,subject_id) where assessment_model='class';
create index examinations_course_scope_idx on public.examinations(school_id,programme_id,academic_level_id,subject_id) where assessment_model='course';

create table public.examination_results (
  id uuid primary key default gen_random_uuid(), school_id uuid not null,
  examination_id uuid not null, student_id uuid not null,
  score numeric(8,4) check(score is null or (score>=0 and scale(score)<=2)),
  remarks text check(remarks is null or char_length(remarks)<=1000),
  status text not null default 'draft' check(status in ('draft','submitted','under_review','approved','published')),
  correction_reason text check(correction_reason is null or char_length(correction_reason)<=1000),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(school_id,examination_id,student_id), unique(id,school_id),
  foreign key(examination_id,school_id) references public.examinations(id,school_id) on delete restrict,
  foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict
);
create index examination_results_student_idx on public.examination_results(school_id,student_id,examination_id,status);

create table public.examination_result_history (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, result_id uuid not null,
  examination_id uuid not null, student_id uuid not null,
  previous_score numeric(8,4), new_score numeric(8,4), previous_status text, new_status text not null,
  previous_remarks text, new_remarks text, correction_reason text,
  changed_by uuid references auth.users(id) on delete set null, changed_at timestamptz not null default now(),
  foreign key(result_id,school_id) references public.examination_results(id,school_id) on delete restrict,
  foreign key(examination_id,school_id) references public.examinations(id,school_id) on delete restrict,
  foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict
);
create index examination_result_history_lookup_idx on public.examination_result_history(school_id,result_id,changed_at desc);

create or replace function private.can_manage_examination(target_school uuid,target_model text,target_class uuid,target_arm uuid,target_subject uuid,target_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.has_school_role(target_school,array['school_admin']::public.app_role[]) or
 (private.has_school_role(target_school,array['teacher']::public.app_role[]) and exists(
  select 1 from public.attendance_staff_assignments a where a.school_id=target_school and a.teacher_user_id=(select auth.uid()) and a.is_active and a.academic_session_id=target_session
   and ((target_model='class' and a.assignment_type='class' and a.class_id=target_class and (a.class_arm_id is null or a.class_arm_id=target_arm))
     or (target_model='course' and a.assignment_type='course' and a.subject_id=target_subject))))
$$;

create or replace function private.is_examination_eligible(target_exam uuid,target_student uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare e public.examinations%rowtype; exam_day date;
begin
 select * into e from public.examinations where id=target_exam;
 if not found then return false; end if;
 if not private.can_manage_examination(e.school_id,e.assessment_model,e.class_id,e.class_arm_id,e.subject_id,e.academic_session_id)
   and not exists(select 1 from public.students own where own.id=target_student and own.school_id=e.school_id and own.auth_user_id=(select auth.uid())) then return false; end if;
 exam_day:=coalesce(e.examination_date,current_date);
 if e.assessment_model='class' then return exists(select 1 from public.student_enrolments se join public.students s on s.id=se.student_id and s.school_id=se.school_id
  where se.school_id=e.school_id and se.student_id=target_student and s.status in ('active','admitted') and se.structure_type='basic' and se.class_arm_id=e.class_arm_id and se.academic_session_id=e.academic_session_id and se.academic_term_id=e.academic_term_id and se.is_current and se.starts_on<=exam_day and (se.ends_on is null or se.ends_on>=exam_day)); end if;
 return exists(select 1 from public.course_enrolments ce join public.students s on s.id=ce.student_id and s.school_id=ce.school_id join public.student_enrolments se on se.school_id=ce.school_id and se.student_id=ce.student_id
  where ce.school_id=e.school_id and ce.student_id=target_student and s.status in ('active','admitted') and ce.subject_id=e.subject_id and ce.programme_id=e.programme_id and ce.academic_level_id=e.academic_level_id and ce.academic_session_id=e.academic_session_id and ce.academic_term_id=e.academic_term_id and ce.is_active and ce.starts_on<=exam_day and (ce.ends_on is null or ce.ends_on>=exam_day)
   and se.structure_type='programme' and se.programme_id=e.programme_id and se.academic_level_id=e.academic_level_id and se.academic_session_id=e.academic_session_id and se.academic_term_id=e.academic_term_id and se.is_current and se.starts_on<=exam_day and (se.ends_on is null or se.ends_on>=exam_day));
end $$;

create or replace function public.get_examination_roster(target_examination uuid)
returns table(student_id uuid,student_number text,first_name text,middle_name text,surname text,score numeric,remarks text,result_status text)
language plpgsql stable security definer set search_path='' as $$
declare e public.examinations%rowtype;
begin
 select * into e from public.examinations where id=target_examination;
 if not found or not private.can_manage_examination(e.school_id,e.assessment_model,e.class_id,e.class_arm_id,e.subject_id,e.academic_session_id) then raise exception 'Examination access is not allowed'; end if;
 return query select s.id,s.student_number,s.first_name,s.middle_name,s.surname,r.score,r.remarks,r.status from public.students s left join public.examination_results r on r.school_id=s.school_id and r.student_id=s.id and r.examination_id=e.id
 where s.school_id=e.school_id and private.is_examination_eligible(e.id,s.id) order by s.surname,s.first_name,s.student_number;
end $$;

create or replace function public.validate_examination()
returns trigger language plpgsql security definer set search_path='' as $$
declare institution_type text;
begin
 select s.institution_type into institution_type from public.schools s where s.id=new.school_id;
 if (institution_type in ('early_childhood','basic','secondary') and new.assessment_model<>'class') or (institution_type not in ('early_childhood','basic','secondary','mixed') and new.assessment_model<>'course') then raise exception 'Examination model does not match institution structure'; end if;
 if not exists(select 1 from public.subjects s where s.id=new.subject_id and s.school_id=new.school_id and s.is_active and (new.assessment_model<>'course' or s.programme_id is null or s.programme_id=new.programme_id) and (new.assessment_model<>'course' or s.academic_level_id is null or s.academic_level_id=new.academic_level_id)) then raise exception 'Subject is inactive or outside the selected academic context'; end if;
 if new.assessment_model='class' and not exists(select 1 from public.class_arms a where a.id=new.class_arm_id and a.school_id=new.school_id and a.class_id=new.class_id) then raise exception 'Class arm does not match class'; end if;
 if new.assessment_model='course' and not exists(select 1 from public.academic_levels l join public.academic_programmes p on p.id=l.programme_id and p.school_id=l.school_id where l.id=new.academic_level_id and l.school_id=new.school_id and l.programme_id=new.programme_id and l.is_active and p.is_active) then raise exception 'Programme or academic level is inactive'; end if;
 if tg_op='UPDATE' and ((old.status='archived' and new.status<>'archived') or (old.status='draft' and new.status not in ('draft','published','archived')) or (old.status='published' and new.status not in ('published','closed','archived')) or (old.status='closed' and new.status not in ('closed','archived'))) then raise exception 'Invalid examination status transition'; end if;
 if tg_op='UPDATE' and old.status<>'draft' and (new.name,new.examination_type,new.academic_session_id,new.academic_term_id,new.class_id,new.class_arm_id,new.subject_id,new.programme_id,new.academic_level_id,new.examination_date,new.starts_at,new.ends_at,new.venue,new.maximum_marks,new.instructions) is distinct from (old.name,old.examination_type,old.academic_session_id,old.academic_term_id,old.class_id,old.class_arm_id,old.subject_id,old.programme_id,old.academic_level_id,old.examination_date,old.starts_at,old.ends_at,old.venue,old.maximum_marks,old.instructions) then raise exception 'Published examination configuration is locked'; end if;
 if tg_op='UPDATE' and (new.school_id is distinct from old.school_id or new.created_by is distinct from old.created_by) then raise exception 'Examination institution and creator scope are immutable'; end if;
 return new;
end $$;

create or replace function public.validate_examination_result()
returns trigger language plpgsql security definer set search_path='' as $$
declare e public.examinations%rowtype; admin_user boolean;
begin
 select * into e from public.examinations where id=new.examination_id and school_id=new.school_id for update;
 if not found or not private.can_manage_examination(e.school_id,e.assessment_model,e.class_id,e.class_arm_id,e.subject_id,e.academic_session_id) then raise exception 'Examination management is not allowed'; end if;
 if e.status='archived' then raise exception 'Archived examination results are read-only'; end if;
 if tg_op='UPDATE' and (new.school_id is distinct from old.school_id or new.examination_id is distinct from old.examination_id or new.student_id is distinct from old.student_id) then raise exception 'Result institution, examination, and student scope are immutable'; end if;
 if new.score is not null and (new.score<0 or new.score>e.maximum_marks) then raise exception 'Score is outside the permitted range'; end if;
 if new.score is not null and scale(new.score)>2 then raise exception 'Scores allow at most two decimal places'; end if;
 if new.status<>'draft' and e.status not in ('published','closed') then raise exception 'Publish the examination before submitting or reviewing results'; end if;
 admin_user:=private.has_school_role(e.school_id,array['school_admin']::public.app_role[]);
 if tg_op='INSERT' then
  if not private.is_examination_eligible(e.id,new.student_id) then raise exception 'Student is not eligible for this examination'; end if;
  if new.status not in ('draft','submitted') then raise exception 'Invalid initial result status'; end if;
 elsif old.score is distinct from new.score or old.remarks is distinct from new.remarks then
  if old.status in ('approved','published') and (not admin_user or char_length(trim(coalesce(new.correction_reason,'')))<8) then raise exception 'Approved or published result corrections require an administrator and a reason'; end if;
  if old.status not in ('approved','published') and not private.is_examination_eligible(e.id,new.student_id) then raise exception 'Student is not eligible for this examination'; end if;
 end if;
 if tg_op='UPDATE' then
  if old.status='draft' and new.status not in ('draft','submitted') then raise exception 'Draft results must be submitted before review'; end if;
  if old.status='submitted' and new.status not in ('submitted','draft','under_review') then raise exception 'Submitted results must enter review'; end if;
  if old.status='under_review' and new.status not in ('under_review','submitted','approved') then raise exception 'Results under review must be approved first'; end if;
  if old.status='approved' and new.status not in ('approved','published') then raise exception 'Approved results may only be published'; end if;
  if old.status='published' and new.status<>'published' then raise exception 'Published results cannot be unpublished'; end if;
  if old.status in ('submitted','under_review','approved','published') and new.status is distinct from old.status and not admin_user then raise exception 'Only administrators may review, approve, or publish results'; end if;
 end if;
 return new;
end $$;

create or replace function public.audit_examination_result()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.examination_result_history(school_id,result_id,examination_id,student_id,previous_score,new_score,previous_status,new_status,previous_remarks,new_remarks,correction_reason,changed_by)
 values(new.school_id,new.id,new.examination_id,new.student_id,case when tg_op='UPDATE' then old.score end,new.score,case when tg_op='UPDATE' then old.status end,new.status,case when tg_op='UPDATE' then old.remarks end,new.remarks,new.correction_reason,(select auth.uid()));
 return new;
end $$;

create or replace function public.protect_examination_result_audit()
returns trigger language plpgsql security definer set search_path='' as $$ begin raise exception 'Result audit history is immutable'; end $$;

create trigger examinations_validate before insert or update on public.examinations for each row execute function public.validate_examination();
create trigger examinations_touch_updated before update on public.examinations for each row execute function public.touch_updated_at();
create trigger examination_results_validate before insert or update on public.examination_results for each row execute function public.validate_examination_result();
create trigger examination_results_audit after insert or update on public.examination_results for each row execute function public.audit_examination_result();
create trigger examination_results_touch_updated before update on public.examination_results for each row execute function public.touch_updated_at();
create trigger examination_result_history_immutable before update or delete on public.examination_result_history for each row execute function public.protect_examination_result_audit();

alter table public.examinations enable row level security;
alter table public.examination_results enable row level security;
alter table public.examination_result_history enable row level security;
revoke all on public.examinations,public.examination_results,public.examination_result_history from public,anon;
grant select,insert,update on public.examinations,public.examination_results to authenticated;
grant select on public.examination_result_history to authenticated;
create policy examinations_read_authorized on public.examinations for select to authenticated using(private.can_manage_examination(school_id,assessment_model,class_id,class_arm_id,subject_id,academic_session_id) or (status in ('published','closed') and exists(select 1 from public.students s where s.school_id=examinations.school_id and s.auth_user_id=(select auth.uid()) and private.is_examination_eligible(examinations.id,s.id))));
create policy examinations_insert_admin on public.examinations for insert to authenticated with check(created_by=(select auth.uid()) and private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy examinations_update_admin on public.examinations for update to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[])) with check(private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy examination_results_read_authorized on public.examination_results for select to authenticated using((status='published' and exists(select 1 from public.students s where s.id=examination_results.student_id and s.school_id=examination_results.school_id and s.auth_user_id=(select auth.uid()))) or exists(select 1 from public.examinations e where e.id=examination_results.examination_id and e.school_id=examination_results.school_id and private.can_manage_examination(e.school_id,e.assessment_model,e.class_id,e.class_arm_id,e.subject_id,e.academic_session_id)));
create policy examination_results_insert_assigned on public.examination_results for insert to authenticated with check(updated_by=(select auth.uid()) and status in ('draft','submitted') and exists(select 1 from public.examinations e where e.id=examination_results.examination_id and e.school_id=examination_results.school_id and private.can_manage_examination(e.school_id,e.assessment_model,e.class_id,e.class_arm_id,e.subject_id,e.academic_session_id)));
create policy examination_results_update_assigned on public.examination_results for update to authenticated using(exists(select 1 from public.examinations e where e.id=examination_results.examination_id and e.school_id=examination_results.school_id and private.can_manage_examination(e.school_id,e.assessment_model,e.class_id,e.class_arm_id,e.subject_id,e.academic_session_id))) with check(updated_by=(select auth.uid()) and exists(select 1 from public.examinations e where e.id=examination_results.examination_id and e.school_id=examination_results.school_id and private.can_manage_examination(e.school_id,e.assessment_model,e.class_id,e.class_arm_id,e.subject_id,e.academic_session_id)));
create policy examination_history_read_authorized on public.examination_result_history for select to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[]) or exists(select 1 from public.examinations e where e.id=examination_result_history.examination_id and e.school_id=examination_result_history.school_id and private.can_manage_examination(e.school_id,e.assessment_model,e.class_id,e.class_arm_id,e.subject_id,e.academic_session_id)));

revoke all on function private.can_manage_examination(uuid,text,uuid,uuid,uuid,uuid),private.is_examination_eligible(uuid,uuid),public.get_examination_roster(uuid),public.validate_examination(),public.validate_examination_result(),public.audit_examination_result(),public.protect_examination_result_audit() from public,anon;
grant execute on function private.can_manage_examination(uuid,text,uuid,uuid,uuid,uuid),private.is_examination_eligible(uuid,uuid),public.get_examination_roster(uuid) to authenticated;
