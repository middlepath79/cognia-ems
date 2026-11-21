-- Versioned institution result configuration, moderated final results, GPA records and transcript issue history.
-- The migration is intentionally additive and remains pending deployment.

alter table public.examinations
  add column contribution_weight numeric(7,3) not null default 0
  check (contribution_weight >= 0);

create table public.academic_grading_configurations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  version integer not null check (version > 0),
  is_active boolean not null default true,
  overall_maximum numeric(8,3) not null check (overall_maximum > 0),
  ca_maximum numeric(8,3) not null check (ca_maximum >= 0),
  examination_maximum numeric(8,3) not null check (examination_maximum >= 0),
  grade_bands jsonb not null default '[]'::jsonb check (jsonb_typeof(grade_bands)='array'),
  gpa_enabled boolean not null default false,
  gpa_scale_maximum numeric(6,3),
  gpa_method text not null default 'credit_weighted' check (gpa_method in ('credit_weighted','course_average')),
  repeat_policy text check (repeat_policy in ('latest','highest','all_attempts','exclude_repeats')),
  transfer_credit_policy text check (transfer_credit_policy in ('include','exclude')),
  standing_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(standing_rules)='array'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(school_id,version), unique(id,school_id),
  check (ca_maximum + examination_maximum = overall_maximum),
  check (not gpa_enabled or (gpa_scale_maximum is not null and gpa_scale_maximum > 0))
);
create unique index academic_grading_configuration_active_idx on public.academic_grading_configurations(school_id) where is_active;

create table public.academic_period_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  assessment_model text not null check (assessment_model in ('class','course')),
  subject_id uuid not null,
  class_arm_id uuid,
  programme_id uuid,
  academic_level_id uuid,
  academic_session_id uuid not null,
  academic_term_id uuid not null,
  configuration_id uuid not null,
  configuration_version integer not null,
  ca_contribution numeric(10,4),
  examination_contribution numeric(10,4),
  final_total numeric(10,4),
  grade text,
  grade_description text,
  grade_point numeric(8,4),
  missing_components jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_components)='array'),
  status text not null default 'draft' check (status in ('draft','submitted','under_review','approved','published')),
  correction_reason text,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,school_id),
  foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict,
  foreign key(subject_id,school_id) references public.subjects(id,school_id) on delete restrict,
  foreign key(class_arm_id,school_id) references public.class_arms(id,school_id) on delete restrict,
  foreign key(programme_id,school_id) references public.academic_programmes(id,school_id) on delete restrict,
  foreign key(academic_level_id,school_id,programme_id) references public.academic_levels(id,school_id,programme_id) on delete restrict,
  foreign key(academic_session_id,school_id) references public.academic_sessions(id,school_id) on delete restrict,
  foreign key(academic_term_id,school_id,academic_session_id) references public.academic_terms(id,school_id,academic_session_id) on delete restrict,
  foreign key(configuration_id,school_id) references public.academic_grading_configurations(id,school_id) on delete restrict,
  check ((assessment_model='class' and class_arm_id is not null and programme_id is null and academic_level_id is null) or (assessment_model='course' and class_arm_id is null and programme_id is not null and academic_level_id is not null)),
  check ((final_total is null and grade is null) or (final_total is not null and grade is not null))
);
create unique index academic_period_results_class_unique on public.academic_period_results(school_id,student_id,subject_id,class_arm_id,academic_session_id,academic_term_id) where assessment_model='class';
create unique index academic_period_results_course_unique on public.academic_period_results(school_id,student_id,subject_id,programme_id,academic_level_id,academic_session_id,academic_term_id) where assessment_model='course';
create index academic_period_results_scope_idx on public.academic_period_results(school_id,academic_session_id,academic_term_id,assessment_model,status);
create index academic_period_results_student_idx on public.academic_period_results(school_id,student_id,academic_session_id,academic_term_id,status);

create table public.academic_period_result_history (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, result_id uuid not null,
  previous_values jsonb, new_values jsonb not null, correction_reason text,
  changed_by uuid references auth.users(id) on delete set null, changed_at timestamptz not null default now(),
  foreign key(result_id,school_id) references public.academic_period_results(id,school_id) on delete restrict
);
create index academic_period_result_history_idx on public.academic_period_result_history(school_id,result_id,changed_at desc);

create table public.academic_period_gpas (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, student_id uuid not null,
  academic_session_id uuid not null, academic_term_id uuid not null,
  period_gpa numeric(10,5), cumulative_gpa numeric(10,5),
  academic_standing text, standing_reason text,
  applicable_credits numeric(10,2) not null default 0, quality_points numeric(12,5) not null default 0,
  included_courses integer not null default 0, excluded_courses jsonb not null default '[]'::jsonb,
  configuration_id uuid not null, configuration_version integer not null,
  calculation_context jsonb not null default '{}'::jsonb,
  calculated_by uuid references auth.users(id) on delete set null, calculated_at timestamptz not null default now(),
  unique(school_id,student_id,academic_session_id,academic_term_id), unique(id,school_id),
  foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict,
  foreign key(academic_session_id,school_id) references public.academic_sessions(id,school_id) on delete restrict,
  foreign key(academic_term_id,school_id,academic_session_id) references public.academic_terms(id,school_id,academic_session_id) on delete restrict,
  foreign key(configuration_id,school_id) references public.academic_grading_configurations(id,school_id) on delete restrict
);
create table public.academic_period_gpa_history (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, gpa_id uuid not null,
  previous_values jsonb, new_values jsonb not null, changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(), foreign key(gpa_id,school_id) references public.academic_period_gpas(id,school_id) on delete restrict
);
create index academic_period_gpa_history_lookup_idx on public.academic_period_gpa_history(school_id,gpa_id,changed_at desc);

create table public.academic_credit_adjustments (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, student_id uuid not null,
  adjustment_type text not null check(adjustment_type in ('transfer_credit','exemption')),
  subject_id uuid, academic_session_id uuid not null, academic_term_id uuid not null,
  credit_units numeric(7,2) not null check(credit_units>0), grade text, grade_point numeric(8,4),
  source_institution text, reason text not null check(char_length(trim(reason)) between 8 and 1000),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_by uuid not null references auth.users(id) on delete restrict,
  decided_by uuid references auth.users(id) on delete restrict, decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict,
  foreign key(subject_id,school_id) references public.subjects(id,school_id) on delete restrict,
  foreign key(academic_session_id,school_id) references public.academic_sessions(id,school_id) on delete restrict,
  foreign key(academic_term_id,school_id,academic_session_id) references public.academic_terms(id,school_id,academic_session_id) on delete restrict,
  unique(id,school_id)
);
create table public.academic_credit_adjustment_history (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, adjustment_id uuid not null,
  previous_values jsonb, new_values jsonb not null, changed_by uuid references auth.users(id) on delete set null, changed_at timestamptz not null default now(),
  foreign key(adjustment_id,school_id) references public.academic_credit_adjustments(id,school_id) on delete restrict
);
create index academic_credit_adjustment_history_lookup_idx on public.academic_credit_adjustment_history(school_id,adjustment_id,changed_at desc);

create table public.academic_progress_records (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, student_id uuid not null,
  academic_session_id uuid not null, academic_term_id uuid not null,
  structure_type text not null check(structure_type in ('basic','programme')),
  class_arm_id uuid, programme_id uuid, academic_level_id uuid,
  progression_status text not null check(progression_status in ('progressing','completed','deferred','suspended','withdrawn','academic_warning')),
  decision_reason text not null check(char_length(trim(decision_reason)) between 8 and 1000),
  is_published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  decided_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict,
  foreign key(academic_session_id,school_id) references public.academic_sessions(id,school_id) on delete restrict,
  foreign key(academic_term_id,school_id,academic_session_id) references public.academic_terms(id,school_id,academic_session_id) on delete restrict,
  foreign key(class_arm_id,school_id) references public.class_arms(id,school_id) on delete restrict,
  foreign key(programme_id,school_id) references public.academic_programmes(id,school_id) on delete restrict,
  foreign key(academic_level_id,school_id,programme_id) references public.academic_levels(id,school_id,programme_id) on delete restrict,
  check((structure_type='basic' and class_arm_id is not null and programme_id is null and academic_level_id is null) or (structure_type='programme' and class_arm_id is null and programme_id is not null and academic_level_id is not null)),
  unique(id,school_id)
);
create index academic_progress_records_student_idx on public.academic_progress_records(school_id,student_id,academic_session_id,academic_term_id);
create table public.academic_progress_record_history (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, progress_record_id uuid not null,
  previous_values jsonb, new_values jsonb not null, changed_by uuid references auth.users(id) on delete set null, changed_at timestamptz not null default now(),
  foreign key(progress_record_id,school_id) references public.academic_progress_records(id,school_id) on delete restrict
);

create table public.transcript_issues (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, student_id uuid not null,
  transcript_reference text not null, selected_session_id uuid, selected_term_id uuid,
  transcript_snapshot jsonb not null, issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(), correction_of uuid, voided_at timestamptz, void_reason text,
  unique(school_id,transcript_reference), unique(id,school_id),
  foreign key(student_id,school_id) references public.students(id,school_id) on delete restrict,
  foreign key(selected_session_id,school_id) references public.academic_sessions(id,school_id) on delete restrict,
  foreign key(selected_term_id,school_id,selected_session_id) references public.academic_terms(id,school_id,academic_session_id) on delete restrict,
  foreign key(correction_of,school_id) references public.transcript_issues(id,school_id) on delete restrict
);
create index transcript_issues_student_idx on public.transcript_issues(school_id,student_id,issued_at desc);

create or replace function private.validate_academic_grading_configuration(target jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare band jsonb; prior_max numeric:=null; nmin numeric; nmax numeric; grade_name text; gp numeric;
begin
 if jsonb_typeof(target->'grade_bands')<>'array' or jsonb_array_length(target->'grade_bands')=0 then return false; end if;
 for band in select value from jsonb_array_elements(target->'grade_bands') loop
  begin nmin:=(band->>'minimum')::numeric; nmax:=(band->>'maximum')::numeric; gp:=(band->>'gradePoint')::numeric; exception when others then return false; end;
  grade_name:=nullif(trim(band->>'grade'),'');
  if grade_name is null or nmin<0 or nmax<nmin or nmax>(target->>'overallMaximum')::numeric or gp<0 then return false; end if;
  if prior_max is null and nmin<>0 then return false; end if;
  if prior_max is not null and (nmin<=prior_max or nmin>prior_max+0.01) then return false; end if;
  prior_max:=nmax;
 end loop;
 if prior_max<>(target->>'overallMaximum')::numeric then return false; end if;
 if coalesce((target->>'gpaEnabled')::boolean,false) and (nullif(target->>'gpaScaleMaximum','') is null or (target->>'gpaScaleMaximum')::numeric<=0 or exists(select 1 from jsonb_array_elements(target->'grade_bands') b where nullif(b->>'gradePoint','') is null or (b->>'gradePoint')::numeric>(target->>'gpaScaleMaximum')::numeric)) then return false; end if;
 if jsonb_typeof(coalesce(target->'standingRules','[]'::jsonb))<>'array' then return false; end if;
 for band in select value from jsonb_array_elements(coalesce(target->'standingRules','[]'::jsonb)) loop
  begin nmin:=(band->>'minimumGpa')::numeric; nmax:=nullif(band->>'maximumGpa','')::numeric; exception when others then return false; end;
  if nmin<0 or nmin>(target->>'gpaScaleMaximum')::numeric or (nmax is not null and (nmax<nmin or nmax>(target->>'gpaScaleMaximum')::numeric)) or nullif(trim(band->>'standing'),'') is null then return false; end if;
 end loop;
 return true;
end $$;

create or replace function public.save_academic_grading_configuration(configuration jsonb,target_school_id uuid)
returns table(configuration_id uuid,configuration_version integer)
language plpgsql security definer set search_path='' as $$
declare next_version integer; maximum numeric; ca numeric; exam numeric; enabled boolean; existing_maximum numeric;
begin
 if target_school_id is null or not private.has_school_role(target_school_id,array['school_admin']::public.app_role[]) then raise exception 'Institution administrator access is required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_school_id::text||'academic-grading-config',0));
 maximum:=(configuration->>'overallMaximum')::numeric; ca:=(configuration->>'caMaximum')::numeric; exam:=(configuration->>'examinationMaximum')::numeric; enabled:=coalesce((configuration->>'gpaEnabled')::boolean,false);
 select coalesce(nullif(grading_scale->>'maximum','')::numeric,100) into existing_maximum from public.schools where id=target_school_id;
 if maximum is distinct from existing_maximum then raise exception 'Overall maximum must match the institution grading scale'; end if;
 if maximum<=0 or ca<0 or exam<0 or ca+exam<>maximum or not private.validate_academic_grading_configuration(configuration) then raise exception 'Grading bands and component maxima are invalid'; end if;
 if enabled and ((configuration->>'gpaScaleMaximum')::numeric<=0 or configuration->>'gpaMethod' not in ('credit_weighted','course_average') or configuration->>'repeatPolicy' not in ('latest','highest','all_attempts','exclude_repeats') or configuration->>'transferCreditPolicy' not in ('include','exclude')) then raise exception 'GPA settings are invalid'; end if;
 if exists(select 1 from public.examinations e where e.school_id=target_school_id and e.status<>'archived' group by e.assessment_model,e.subject_id,e.class_arm_id,e.programme_id,e.academic_level_id,e.academic_session_id,e.academic_term_id having sum(e.contribution_weight)>exam) then raise exception 'Examination contribution weights exceed the proposed examination maximum'; end if;
 select coalesce(max(version),0)+1 into next_version from public.academic_grading_configurations where school_id=target_school_id;
 update public.academic_grading_configurations set is_active=false where school_id=target_school_id and is_active;
 insert into public.academic_grading_configurations(school_id,version,is_active,overall_maximum,ca_maximum,examination_maximum,grade_bands,gpa_enabled,gpa_scale_maximum,gpa_method,repeat_policy,transfer_credit_policy,standing_rules,created_by)
 values(target_school_id,next_version,true,maximum,ca,exam,configuration->'grade_bands',enabled,nullif(configuration->>'gpaScaleMaximum','')::numeric,coalesce(configuration->>'gpaMethod','credit_weighted'),nullif(configuration->>'repeatPolicy',''),nullif(configuration->>'transferCreditPolicy',''),coalesce(configuration->'standingRules','[]'::jsonb),auth.uid()) returning id into configuration_id;
 configuration_version:=next_version; return next;
end $$;

create or replace function public.validate_examination_contribution_weight()
returns trigger language plpgsql security definer set search_path='' as $$
declare configured_max numeric;
begin
 if tg_op='UPDATE' and old.status<>'draft' and old.contribution_weight is distinct from new.contribution_weight then raise exception 'Published examination contribution weights are locked'; end if;
 select examination_maximum into configured_max from public.academic_grading_configurations where school_id=new.school_id and is_active;
 if configured_max is not null and new.status<>'archived' then
  perform pg_advisory_xact_lock(hashtextextended(new.school_id::text||new.academic_session_id::text||new.academic_term_id::text||coalesce(new.class_arm_id,new.programme_id)::text||new.subject_id::text||'exam',0));
  if (select coalesce(sum(contribution_weight),0) from public.examinations e where e.school_id=new.school_id and e.assessment_model=new.assessment_model and e.subject_id=new.subject_id and e.academic_session_id=new.academic_session_id and e.academic_term_id=new.academic_term_id and ((new.assessment_model='class' and e.class_arm_id=new.class_arm_id) or (new.assessment_model='course' and e.programme_id=new.programme_id and e.academic_level_id=new.academic_level_id)) and e.status<>'archived' and e.id<>new.id)+new.contribution_weight>configured_max then raise exception 'Examination contribution weights exceed the institution configured maximum (%)',configured_max; end if;
 end if;
 return new;
end $$;
create trigger examination_contribution_weight_check before insert or update of contribution_weight,status on public.examinations for each row execute function public.validate_examination_contribution_weight();

create or replace function public.audit_academic_period_result()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.academic_period_result_history(school_id,result_id,previous_values,new_values,correction_reason,changed_by)
 values(new.school_id,new.id,case when tg_op='UPDATE' then jsonb_build_object('caContribution',old.ca_contribution,'examinationContribution',old.examination_contribution,'finalTotal',old.final_total,'grade',old.grade,'gradeDescription',old.grade_description,'gradePoint',old.grade_point,'configurationVersion',old.configuration_version,'missingComponents',old.missing_components,'status',old.status) end,jsonb_build_object('caContribution',new.ca_contribution,'examinationContribution',new.examination_contribution,'finalTotal',new.final_total,'grade',new.grade,'gradeDescription',new.grade_description,'gradePoint',new.grade_point,'configurationVersion',new.configuration_version,'missingComponents',new.missing_components,'status',new.status),new.correction_reason,auth.uid());
 return new;
end $$;
create or replace function public.protect_academic_record_history()
returns trigger language plpgsql security definer set search_path='' as $$ begin raise exception 'Academic record audit history is immutable'; end $$;
create or replace function public.audit_academic_credit_adjustment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.academic_credit_adjustment_history(school_id,adjustment_id,previous_values,new_values,changed_by)
 values(new.school_id,new.id,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new),auth.uid());
 return new;
end $$;
create or replace function public.validate_academic_credit_adjustment()
returns trigger language plpgsql security definer set search_path='' as $$
declare scale_max numeric;
begin
 if not private.has_school_role(new.school_id,array['school_admin']::public.app_role[]) then raise exception 'Institution administrator access is required';end if;
 select gpa_scale_maximum into scale_max from public.academic_grading_configurations where school_id=new.school_id and is_active and gpa_enabled;
 if new.grade_point is not null and (scale_max is null or new.grade_point<0 or new.grade_point>scale_max) then raise exception 'Credit adjustment grade point is outside the active institution scale';end if;
 if tg_op='UPDATE' and old.status<>'pending' and (new.student_id,new.adjustment_type,new.subject_id,new.academic_session_id,new.academic_term_id,new.credit_units,new.grade,new.grade_point,new.source_institution,new.reason) is distinct from (old.student_id,old.adjustment_type,old.subject_id,old.academic_session_id,old.academic_term_id,old.credit_units,old.grade,old.grade_point,old.source_institution,old.reason) then raise exception 'Decided credit adjustments are immutable';end if;
 if tg_op='UPDATE' and old.status is distinct from new.status then new.decided_by:=auth.uid();new.decided_at:=now();end if;
 return new;
end $$;
create or replace function public.audit_academic_progress_record()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.academic_progress_record_history(school_id,progress_record_id,previous_values,new_values,changed_by)
 values(new.school_id,new.id,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new),auth.uid());return new;
end $$;
create or replace function public.validate_academic_progress_record()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.has_school_role(new.school_id,array['school_admin']::public.app_role[]) then raise exception 'Institution administrator access is required';end if;
 if tg_op='UPDATE' and (new.school_id,new.student_id,new.created_by,new.academic_session_id,new.academic_term_id,new.structure_type,new.class_arm_id,new.programme_id,new.academic_level_id) is distinct from (old.school_id,old.student_id,old.created_by,old.academic_session_id,old.academic_term_id,old.structure_type,old.class_arm_id,old.programme_id,old.academic_level_id) then raise exception 'Progression record identity and academic scope are immutable';end if;
 if new.structure_type='basic' and not exists(select 1 from public.student_enrolments se where se.school_id=new.school_id and se.student_id=new.student_id and se.structure_type='basic' and se.class_arm_id=new.class_arm_id and se.academic_session_id=new.academic_session_id and se.academic_term_id=new.academic_term_id) then raise exception 'Student has no matching class placement for this progression decision';end if;
 if new.structure_type='programme' and not exists(select 1 from public.student_enrolments se where se.school_id=new.school_id and se.student_id=new.student_id and se.structure_type='programme' and se.programme_id=new.programme_id and se.academic_level_id=new.academic_level_id and se.academic_session_id=new.academic_session_id and se.academic_term_id=new.academic_term_id) then raise exception 'Student has no matching programme placement for this progression decision';end if;
 if tg_op='UPDATE' and old.is_published and (new.progression_status,new.decision_reason,new.academic_session_id,new.academic_term_id,new.structure_type,new.class_arm_id,new.programme_id,new.academic_level_id) is distinct from (old.progression_status,old.decision_reason,old.academic_session_id,old.academic_term_id,old.structure_type,old.class_arm_id,old.programme_id,old.academic_level_id) then raise exception 'Published progression decisions are immutable; create a corrected record with a traceable reason';end if;
 if tg_op='UPDATE' and old.is_published and not new.is_published then raise exception 'Published progression decisions cannot be withdrawn';end if;
 if tg_op='UPDATE' and new.school_id is distinct from old.school_id then raise exception 'Institution scope is immutable';end if;
 return new;
end $$;

create or replace function public.recalculate_academic_period_result(
 target_student uuid,target_model text,target_subject uuid,target_session uuid,target_term uuid,
 target_class_arm uuid default null,target_programme uuid default null,target_level uuid default null,correction_reason text default null,target_school_id uuid default null
) returns public.academic_period_results
language plpgsql security definer set search_path='' as $$
declare target_school uuid:=target_school_id; cfg public.academic_grading_configurations%rowtype; result_row public.academic_period_results%rowtype;
 ca_count integer:=0; ca_done integer:=0; exam_count integer:=0; exam_done integer:=0; ca_weight numeric:=0; exam_weight numeric:=0; ca_value numeric:=0; exam_value numeric:=0; missing jsonb:='[]'::jsonb; total numeric; band jsonb; grade_name text; grade_desc text; grade_point_value numeric;
begin
 if target_school is null or not private.has_school_role(target_school,array['school_admin']::public.app_role[]) then raise exception 'Institution administrator access is required'; end if;
 if target_model not in ('class','course') then raise exception 'Academic model is invalid'; end if;
 select * into cfg from public.academic_grading_configurations where school_id=target_school and is_active;
 if not found then raise exception 'Configure institution grading before calculating final results'; end if;
 if target_model='class' and (target_class_arm is null or target_programme is not null or target_level is not null) or target_model='course' and (target_programme is null or target_level is null or target_class_arm is not null) then raise exception 'Academic scope is invalid'; end if;
 select count(*),count(*) filter(where sc.score is not null and sc.is_published),coalesce(sum(a.weight),0),coalesce(sum(case when sc.score is not null and sc.is_published then sc.score/a.maximum_marks*a.weight else 0 end),0)
 into ca_count,ca_done,ca_weight,ca_value
 from public.assessments a left join public.assessment_scores sc on sc.school_id=a.school_id and sc.assessment_id=a.id and sc.student_id=target_student
 where a.school_id=target_school and a.assessment_model=target_model and a.subject_id=target_subject and a.academic_session_id=target_session and a.academic_term_id=target_term and a.status in ('published','closed')
 and ((target_model='class' and a.class_arm_id=target_class_arm) or (target_model='course' and a.programme_id=target_programme and a.academic_level_id=target_level)) and private.is_assessment_eligible(a.id,target_student);
 select count(*),count(*) filter(where er.score is not null and er.status='published'),coalesce(sum(e.contribution_weight),0),coalesce(sum(case when er.score is not null and er.status='published' then er.score/e.maximum_marks*e.contribution_weight else 0 end),0)
 into exam_count,exam_done,exam_weight,exam_value
 from public.examinations e left join public.examination_results er on er.school_id=e.school_id and er.examination_id=e.id and er.student_id=target_student
 where e.school_id=target_school and e.assessment_model=target_model and e.subject_id=target_subject and e.academic_session_id=target_session and e.academic_term_id=target_term and e.status in ('published','closed')
 and ((target_model='class' and e.class_arm_id=target_class_arm) or (target_model='course' and e.programme_id=target_programme and e.academic_level_id=target_level)) and private.is_examination_eligible(e.id,target_student);
 if cfg.ca_maximum>0 and (ca_count=0 or ca_done<ca_count or ca_weight<=0) then missing:=missing||jsonb_build_array(jsonb_build_object('component','continuous_assessment','expected',ca_count,'completed',ca_done,'configuredWeight',cfg.ca_maximum,'availableWeight',ca_weight)); end if;
 if cfg.examination_maximum>0 and (exam_count=0 or exam_done<exam_count or exam_weight<>cfg.examination_maximum) then missing:=missing||jsonb_build_array(jsonb_build_object('component','examination','expected',exam_count,'completed',exam_done,'configuredWeight',cfg.examination_maximum,'availableWeight',exam_weight)); end if;
 if cfg.ca_maximum=0 and ca_count>0 or cfg.examination_maximum=0 and exam_count>0 then missing:=missing||jsonb_build_array(jsonb_build_object('component','configuration','reason','An active component has no configured contribution')); end if;
 if ca_weight>0 then ca_value:=ca_value/ca_weight*cfg.ca_maximum; end if;
 if jsonb_array_length(missing)=0 then total:=round(ca_value+exam_value,4); for band in select value from jsonb_array_elements(cfg.grade_bands) loop if total >= (band->>'minimum')::numeric and total <= (band->>'maximum')::numeric then grade_name:=band->>'grade';grade_desc:=band->>'description';grade_point_value:=nullif(band->>'gradePoint','')::numeric;exit;end if;end loop; if grade_name is null then missing:=jsonb_build_array(jsonb_build_object('component','grade','reason','No configured grade band covers the final total'));total:=null;end if;end if;
 perform pg_advisory_xact_lock(hashtextextended(target_school::text||target_student::text||target_model||target_subject::text||target_session::text||target_term::text||coalesce(target_class_arm,target_programme)::text||coalesce(target_level::text,''),0));
 select * into result_row from public.academic_period_results r where r.school_id=target_school and r.student_id=target_student and r.assessment_model=target_model and r.subject_id=target_subject and r.class_arm_id is not distinct from target_class_arm and r.programme_id is not distinct from target_programme and r.academic_level_id is not distinct from target_level and r.academic_session_id=target_session and r.academic_term_id=target_term for update;
 if found and result_row.status in ('approved','published') and (result_row.ca_contribution is distinct from case when jsonb_array_length(missing)=0 then ca_value else null end or result_row.examination_contribution is distinct from case when jsonb_array_length(missing)=0 then exam_value else null end or result_row.final_total is distinct from total or result_row.grade is distinct from grade_name or result_row.grade_point is distinct from grade_point_value or result_row.grade_description is distinct from grade_desc or result_row.configuration_version is distinct from cfg.version) and char_length(trim(coalesce(correction_reason,'')))<8 then raise exception 'Correcting approved or published final results requires a reason of at least 8 characters'; end if;
 if result_row.id is not null then
  update public.academic_period_results set configuration_id=cfg.id,configuration_version=cfg.version,ca_contribution=case when jsonb_array_length(missing)=0 then ca_value end,examination_contribution=case when jsonb_array_length(missing)=0 then exam_value end,final_total=total,grade=grade_name,grade_description=grade_desc,grade_point=grade_point_value,missing_components=missing,correction_reason=nullif(trim(correction_reason),''),updated_by=auth.uid(),updated_at=now() where id=result_row.id and school_id=target_school returning * into result_row;
 else
  insert into public.academic_period_results(school_id,student_id,assessment_model,subject_id,class_arm_id,programme_id,academic_level_id,academic_session_id,academic_term_id,configuration_id,configuration_version,ca_contribution,examination_contribution,final_total,grade,grade_description,grade_point,missing_components,status,correction_reason,updated_by)
  values(target_school,target_student,target_model,target_subject,target_class_arm,target_programme,target_level,target_session,target_term,cfg.id,cfg.version,case when jsonb_array_length(missing)=0 then ca_value end,case when jsonb_array_length(missing)=0 then exam_value end,total,grade_name,grade_desc,grade_point_value,missing,'draft',nullif(trim(correction_reason),''),auth.uid()) returning * into result_row;
 end if;
 if result_row.id is null then raise exception 'Final result insert failed'; end if;
 return result_row;
end $$;

create or replace function public.transition_academic_period_result(target_result uuid,target_status text,reason text default null,target_school_id uuid default null)
returns public.academic_period_results language plpgsql security definer set search_path='' as $$
declare target_school uuid:=target_school_id; current_row public.academic_period_results%rowtype;
begin
 if target_school is null or not private.has_school_role(target_school,array['school_admin']::public.app_role[]) then raise exception 'Institution administrator access is required';end if;
 select * into current_row from public.academic_period_results where id=target_result and school_id=target_school for update;if not found then raise exception 'Academic result not found';end if;
 if jsonb_array_length(current_row.missing_components)>0 then raise exception 'Incomplete academic results cannot be submitted or published';end if;
 if not ((current_row.status='draft' and target_status='submitted') or (current_row.status='submitted' and target_status='under_review') or (current_row.status='under_review' and target_status='approved') or (current_row.status='approved' and target_status='published')) then raise exception 'Invalid final result status transition';end if;
 update public.academic_period_results set status=target_status,correction_reason=nullif(trim(reason),''),updated_by=auth.uid() where id=target_result and school_id=target_school returning * into current_row;return current_row;
end $$;

create or replace function public.recalculate_student_gpa(target_student uuid,target_session uuid,target_term uuid,target_school_id uuid)
returns public.academic_period_gpas language plpgsql security definer set search_path='' as $$
declare target_school uuid:=target_school_id; cfg public.academic_grading_configurations%rowtype; period_points numeric:=0;period_credits numeric:=0;period_count integer:=0;cum_points numeric:=0;cum_credits numeric:=0;cum_count integer:=0;excluded jsonb:='[]'::jsonb;existing public.academic_period_gpas%rowtype;outrow public.academic_period_gpas%rowtype;calc_gpa numeric;calc_cgpa numeric;calculated_standing text;calculated_standing_reason text;standing_rule jsonb;period_session_start date;period_term_start date;result record;
begin
 if target_school is null or not private.has_school_role(target_school,array['school_admin']::public.app_role[]) then raise exception 'Institution administrator access is required';end if;
 select * into cfg from public.academic_grading_configurations where school_id=target_school and is_active and gpa_enabled;if not found then raise exception 'This institution has not configured GPA';end if;
 if cfg.repeat_policy is null or cfg.transfer_credit_policy is null then raise exception 'Configure repeat and transfer-credit policies before calculating GPA';end if;
 select ss.starts_on,t.starts_on into period_session_start,period_term_start from public.academic_sessions ss join public.academic_terms t on t.academic_session_id=ss.id and t.school_id=ss.school_id where ss.id=target_session and ss.school_id=target_school and t.id=target_term;
 if period_term_start is null then raise exception 'Academic period is outside this institution';end if;
 for result in select r.*,s.credit_units,ss.starts_on as session_start,t.starts_on as term_start from public.academic_period_results r join public.subjects s on s.id=r.subject_id and s.school_id=r.school_id join public.academic_sessions ss on ss.id=r.academic_session_id and ss.school_id=r.school_id join public.academic_terms t on t.id=r.academic_term_id and t.school_id=r.school_id where r.school_id=target_school and r.student_id=target_student and r.assessment_model='course' and r.status='published' and r.final_total is not null and (ss.starts_on,t.starts_on)<=(period_session_start,period_term_start) order by ss.starts_on,t.starts_on loop
  if result.grade_point is null then excluded:=excluded||jsonb_build_array(jsonb_build_object('resultId',result.id,'reason','Final grade has no configured grade point'));continue;end if;
 if result.credit_units is null or result.credit_units<=0 then excluded:=excluded||jsonb_build_array(jsonb_build_object('resultId',result.id,'reason','Course has no valid configured credit units'));continue;end if;
  if cfg.repeat_policy='exclude_repeats' and exists(select 1 from public.academic_period_results earlier join public.academic_sessions es on es.id=earlier.academic_session_id and es.school_id=earlier.school_id join public.academic_terms et on et.id=earlier.academic_term_id and et.school_id=earlier.school_id where earlier.school_id=result.school_id and earlier.student_id=result.student_id and earlier.subject_id=result.subject_id and earlier.programme_id=result.programme_id and earlier.status='published' and earlier.final_total is not null and (es.starts_on,et.starts_on)<(result.session_start,result.term_start)) then excluded:=excluded||jsonb_build_array(jsonb_build_object('resultId',result.id,'reason','Repeat excluded by institution policy'));continue;end if;
  if cfg.repeat_policy='latest' and exists(select 1 from public.academic_period_results newer join public.academic_sessions ns on ns.id=newer.academic_session_id and ns.school_id=newer.school_id join public.academic_terms nt on nt.id=newer.academic_term_id and nt.school_id=newer.school_id where newer.school_id=result.school_id and newer.student_id=result.student_id and newer.subject_id=result.subject_id and newer.programme_id=result.programme_id and newer.status='published' and newer.final_total is not null and (ns.starts_on,nt.starts_on)>(result.session_start,result.term_start) and (ns.starts_on,nt.starts_on)<=(period_session_start,period_term_start)) then excluded:=excluded||jsonb_build_array(jsonb_build_object('resultId',result.id,'reason','Superseded by later published course attempt'));continue;end if;
  if cfg.repeat_policy='highest' and exists(select 1 from public.academic_period_results better join public.academic_sessions bs on bs.id=better.academic_session_id and bs.school_id=better.school_id join public.academic_terms bt on bt.id=better.academic_term_id and bt.school_id=better.school_id where better.school_id=result.school_id and better.student_id=result.student_id and better.subject_id=result.subject_id and better.programme_id=result.programme_id and better.status='published' and better.final_total>result.final_total and (bs.starts_on,bt.starts_on)<=(period_session_start,period_term_start)) then excluded:=excluded||jsonb_build_array(jsonb_build_object('resultId',result.id,'reason','Lower attempt excluded by highest-grade policy'));continue;end if;
  period_credits:=period_credits+case when result.academic_session_id=target_session and result.academic_term_id=target_term then result.credit_units else 0 end;cum_credits:=cum_credits+result.credit_units;
  if cfg.gpa_method='credit_weighted' then period_points:=period_points+case when result.academic_session_id=target_session and result.academic_term_id=target_term then result.grade_point*result.credit_units else 0 end;cum_points:=cum_points+result.grade_point*result.credit_units;if result.academic_session_id=target_session and result.academic_term_id=target_term then period_count:=period_count+1;end if;cum_count:=cum_count+1;else if result.academic_session_id=target_session and result.academic_term_id=target_term then period_points:=period_points+result.grade_point;period_count:=period_count+1;end if;cum_points:=cum_points+result.grade_point;cum_count:=cum_count+1;end if;
 end loop;
 if cfg.transfer_credit_policy='include' then
  for result in select a.*,ss.starts_on as session_start,t.starts_on as term_start from public.academic_credit_adjustments a join public.academic_sessions ss on ss.id=a.academic_session_id and ss.school_id=a.school_id join public.academic_terms t on t.id=a.academic_term_id and t.school_id=a.school_id where a.school_id=target_school and a.student_id=target_student and a.status='approved' and a.adjustment_type='transfer_credit' and (ss.starts_on,t.starts_on)<=(period_session_start,period_term_start) loop
   if result.grade_point is null then excluded:=excluded||jsonb_build_array(jsonb_build_object('adjustmentId',result.id,'reason','Approved transfer has no configured grade point'));continue;end if;
   if cfg.gpa_method='credit_weighted' then
    cum_points:=cum_points+result.grade_point*result.credit_units;cum_credits:=cum_credits+result.credit_units;cum_count:=cum_count+1;
    if result.academic_session_id=target_session and result.academic_term_id=target_term then period_points:=period_points+result.grade_point*result.credit_units;period_credits:=period_credits+result.credit_units;period_count:=period_count+1;end if;
   else
    cum_points:=cum_points+result.grade_point;cum_count:=cum_count+1;cum_credits:=cum_credits+result.credit_units;
    if result.academic_session_id=target_session and result.academic_term_id=target_term then period_points:=period_points+result.grade_point;period_count:=period_count+1;period_credits:=period_credits+result.credit_units;end if;
   end if;
  end loop;
 elsif exists(select 1 from public.academic_credit_adjustments where school_id=target_school and student_id=target_student and status='approved' and adjustment_type='transfer_credit') then
  excluded:=excluded||jsonb_build_array(jsonb_build_object('reason','Approved transfer credits are excluded by institution policy'));
 end if;
 for result in select a.id from public.academic_credit_adjustments a join public.academic_sessions ss on ss.id=a.academic_session_id and ss.school_id=a.school_id join public.academic_terms t on t.id=a.academic_term_id and t.school_id=a.school_id where a.school_id=target_school and a.student_id=target_student and a.status='approved' and a.adjustment_type='exemption' and (ss.starts_on,t.starts_on)<=(period_session_start,period_term_start) loop
  excluded:=excluded||jsonb_build_array(jsonb_build_object('adjustmentId',result.id,'reason','Approved course exemption is tracked separately and excluded from GPA'));
 end loop;
 if cfg.gpa_method='credit_weighted' then calc_gpa:=case when period_credits>0 then round(period_points/period_credits,5) end;calc_cgpa:=case when cum_credits>0 then round(cum_points/cum_credits,5) end;else calc_gpa:=case when period_count>0 then round(period_points/period_count,5) end;calc_cgpa:=case when cum_count>0 then round(cum_points/cum_count,5) end;end if;
 for standing_rule in select value from jsonb_array_elements(cfg.standing_rules) loop
  if calc_cgpa is not null and calc_cgpa >= (standing_rule->>'minimumGpa')::numeric and (nullif(standing_rule->>'maximumGpa','') is null or calc_cgpa <= (standing_rule->>'maximumGpa')::numeric) then calculated_standing:=standing_rule->>'standing';calculated_standing_reason:=standing_rule->>'description';exit;end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(target_school::text||target_student::text||target_session::text||target_term::text||'gpa',0));
 select * into existing from public.academic_period_gpas where school_id=target_school and student_id=target_student and academic_session_id=target_session and academic_term_id=target_term for update;
 insert into public.academic_period_gpas(school_id,student_id,academic_session_id,academic_term_id,period_gpa,cumulative_gpa,academic_standing,standing_reason,applicable_credits,quality_points,included_courses,excluded_courses,configuration_id,configuration_version,calculation_context,calculated_by)
 values(target_school,target_student,target_session,target_term,calc_gpa,calc_cgpa,calculated_standing,calculated_standing_reason,period_credits,cum_points,period_count,excluded,cfg.id,cfg.version,jsonb_build_object('method',cfg.gpa_method,'repeatPolicy',cfg.repeat_policy,'transferCreditPolicy',cfg.transfer_credit_policy,'cumulativeThroughSession',target_session,'cumulativeThroughTerm',target_term),auth.uid())
 on conflict(school_id,student_id,academic_session_id,academic_term_id) do update set period_gpa=excluded.period_gpa,cumulative_gpa=excluded.cumulative_gpa,academic_standing=calculated_standing,standing_reason=calculated_standing_reason,applicable_credits=excluded.applicable_credits,quality_points=excluded.quality_points,included_courses=excluded.included_courses,excluded_courses=excluded.excluded_courses,configuration_id=excluded.configuration_id,configuration_version=excluded.configuration_version,calculation_context=excluded.calculation_context,calculated_by=excluded.calculated_by,calculated_at=now() returning * into outrow;
 if existing.id is not null then insert into public.academic_period_gpa_history(school_id,gpa_id,previous_values,new_values,changed_by) values(target_school,outrow.id,to_jsonb(existing),to_jsonb(outrow),auth.uid());end if;
 return outrow;
end $$;

create or replace function public.recalculate_gpa_after_published_result()
returns trigger language plpgsql security definer set search_path='' as $$
declare period_row record; changed_on_session date; changed_on_term date;
begin
 if new.assessment_model<>'course' or new.status<>'published' then return new; end if;
 if tg_op='UPDATE' and old.status='published' and (new.grade_point,new.final_total,new.grade,new.programme_id,new.academic_level_id) is not distinct from (old.grade_point,old.final_total,old.grade,old.programme_id,old.academic_level_id) then return new; end if;
 if not exists(select 1 from public.academic_grading_configurations c where c.school_id=new.school_id and c.is_active and c.gpa_enabled) then return new; end if;
 select ss.starts_on,t.starts_on into changed_on_session,changed_on_term from public.academic_sessions ss join public.academic_terms t on t.school_id=ss.school_id and t.academic_session_id=ss.id where ss.id=new.academic_session_id and ss.school_id=new.school_id and t.id=new.academic_term_id;
 for period_row in select distinct r.academic_session_id,r.academic_term_id,ss.starts_on session_start,t.starts_on term_start from public.academic_period_results r join public.academic_sessions ss on ss.id=r.academic_session_id and ss.school_id=r.school_id join public.academic_terms t on t.id=r.academic_term_id and t.school_id=r.school_id where r.school_id=new.school_id and r.student_id=new.student_id and r.assessment_model='course' and r.status='published' and (ss.starts_on,t.starts_on)>=(changed_on_session,changed_on_term) order by ss.starts_on,t.starts_on loop
  perform public.recalculate_student_gpa(new.student_id,period_row.academic_session_id,period_row.academic_term_id,new.school_id);
 end loop;
 return new;
end $$;

create or replace function public.protect_transcript_issue()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Transcript issues cannot be deleted'; end if;
 if old.voided_at is not null or new.voided_at is null or char_length(trim(coalesce(new.void_reason,'')))<8 or
   (new.id,new.school_id,new.student_id,new.transcript_reference,new.selected_session_id,new.selected_term_id,new.transcript_snapshot,new.issued_by,new.issued_at,new.correction_of)
   is distinct from
   (old.id,old.school_id,old.student_id,old.transcript_reference,old.selected_session_id,old.selected_term_id,old.transcript_snapshot,old.issued_by,old.issued_at,old.correction_of) then
  raise exception 'Transcript snapshots are immutable; only a traceable void is allowed';
 end if;
 return new;
end $$;

create or replace function public.issue_student_transcript(target_student uuid,target_session uuid default null,target_term uuid default null,target_school_id uuid default null,target_correction_of uuid default null)
returns public.transcript_issues language plpgsql security definer set search_path='' as $$
declare target_school uuid:=target_school_id; snap jsonb; ref text; issue public.transcript_issues%rowtype; school_row public.schools%rowtype; student_row public.students%rowtype;
begin
 if target_school is null or not private.has_school_role(target_school,array['school_admin']::public.app_role[]) then raise exception 'Institution administrator access is required';end if;
 select * into school_row from public.schools where id=target_school;select * into student_row from public.students where id=target_student and school_id=target_school;if not found then raise exception 'Student is not in this institution';end if;
 if target_term is not null and target_session is null then raise exception 'A session is required when selecting a term';end if;
 if target_correction_of is not null and not exists(select 1 from public.transcript_issues prior where prior.id=target_correction_of and prior.school_id=target_school and prior.student_id=target_student and prior.voided_at is not null) then raise exception 'A correction must reference a voided transcript for the same student';end if;
 select jsonb_build_object('student',jsonb_build_object('id',student_row.id,'studentNumber',student_row.student_number,'firstName',student_row.first_name,'middleName',student_row.middle_name,'surname',student_row.surname),'institution',jsonb_build_object('name',school_row.name,'type',school_row.institution_type,'logoUrl',school_row.logo_url),'issuedAt',now(),'results',coalesce((select jsonb_agg(jsonb_build_object('model',r.assessment_model,'subjectId',r.subject_id,'subject',s.name,'subjectCode',s.code,'credits',s.credit_units,'sessionId',r.academic_session_id,'session',ss.name,'termId',r.academic_term_id,'term',t.name,'caContribution',r.ca_contribution,'examinationContribution',r.examination_contribution,'finalTotal',r.final_total,'grade',r.grade,'gradeDescription',r.grade_description,'gradePoint',r.grade_point) order by ss.starts_on,t.starts_on,s.name) from public.academic_period_results r join public.subjects s on s.id=r.subject_id and s.school_id=r.school_id join public.academic_sessions ss on ss.id=r.academic_session_id and ss.school_id=r.school_id join public.academic_terms t on t.id=r.academic_term_id and t.school_id=r.school_id where r.school_id=target_school and r.student_id=target_student and r.status='published' and (target_session is null or r.academic_session_id=target_session) and (target_term is null or r.academic_term_id=target_term)), '[]'::jsonb),'gpa',coalesce((select jsonb_agg(jsonb_build_object('session',ss.name,'term',t.name,'periodGpa',g.period_gpa,'cumulativeGpa',g.cumulative_gpa,'credits',g.applicable_credits,'academicStanding',g.academic_standing,'standingReason',g.standing_reason) order by ss.starts_on,t.starts_on) from public.academic_period_gpas g join public.academic_sessions ss on ss.id=g.academic_session_id and ss.school_id=g.school_id join public.academic_terms t on t.id=g.academic_term_id and t.school_id=g.school_id where g.school_id=target_school and g.student_id=target_student and (target_session is null or g.academic_session_id=target_session) and (target_term is null or g.academic_term_id=target_term)), '[]'::jsonb)) into snap;
 snap:=jsonb_set(snap,'{student}',(snap->'student')||jsonb_build_object('dateOfBirth',student_row.date_of_birth,'gender',student_row.gender,'admissionDate',student_row.admission_date,'status',student_row.status),true);
 snap:=jsonb_set(snap,'{placements}',coalesce((select jsonb_agg(jsonb_build_object('structure',en.structure_type,'class',cl.name,'classArm',arm.name,'programme',pr.name,'level',lv.name,'department',dp.name,'faculty',fa.name,'session',ses.name,'term',trm.name) order by ses.starts_on,trm.starts_on) from public.student_enrolments en join public.academic_sessions ses on ses.id=en.academic_session_id and ses.school_id=en.school_id join public.academic_terms trm on trm.id=en.academic_term_id and trm.school_id=en.school_id left join public.class_arms arm on arm.id=en.class_arm_id and arm.school_id=en.school_id left join public.school_classes cl on cl.id=arm.class_id and cl.school_id=arm.school_id left join public.academic_programmes pr on pr.id=en.programme_id and pr.school_id=en.school_id left join public.academic_levels lv on lv.id=en.academic_level_id and lv.school_id=en.school_id left join public.departments dp on dp.id=pr.department_id and dp.school_id=pr.school_id left join public.faculties fa on fa.id=dp.faculty_id and fa.school_id=dp.school_id where en.school_id=target_school and en.student_id=target_student),'[]'::jsonb),true);
 snap:=jsonb_set(snap,'{progression}',coalesce((select jsonb_agg(jsonb_build_object('status',p.progression_status,'reason',p.decision_reason,'structure',p.structure_type,'session',ses.name,'term',trm.name) order by ses.starts_on,trm.starts_on) from public.academic_progress_records p join public.academic_sessions ses on ses.id=p.academic_session_id and ses.school_id=p.school_id join public.academic_terms trm on trm.id=p.academic_term_id and trm.school_id=p.school_id where p.school_id=target_school and p.student_id=target_student and p.is_published and (target_session is null or p.academic_session_id=target_session) and (target_term is null or p.academic_term_id=target_term)),'[]'::jsonb),true);
 ref:=upper(substr(encode(gen_random_bytes(12),'hex'),1,12));insert into public.transcript_issues(school_id,student_id,transcript_reference,selected_session_id,selected_term_id,transcript_snapshot,issued_by,correction_of) values(target_school,target_student,ref,target_session,target_term,snap,auth.uid(),target_correction_of) returning * into issue;return issue;
end $$;

create or replace function public.void_student_transcript(target_transcript uuid,reason text,target_school_id uuid)
returns public.transcript_issues language plpgsql security definer set search_path='' as $$
declare result public.transcript_issues%rowtype;
begin
 if not private.has_school_role(target_school_id,array['school_admin']::public.app_role[]) then raise exception 'Institution administrator access is required';end if;
 if char_length(trim(coalesce(reason,'')))<8 or char_length(reason)>1000 then raise exception 'A transcript void reason of at least 8 characters is required';end if;
 update public.transcript_issues set voided_at=now(),void_reason=trim(reason) where id=target_transcript and school_id=target_school_id and voided_at is null returning * into result;
 if result.id is null then raise exception 'Transcript issue not found or already voided';end if;
 return result;
end $$;

create or replace function private.can_manage_academic_period_result(target_school uuid,target_model text,target_arm uuid,target_programme uuid,target_level uuid,target_student uuid,target_subject uuid,target_session uuid,target_term uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.has_school_role(target_school,array['school_admin']::public.app_role[]) or
 (private.has_school_role(target_school,array['teacher']::public.app_role[]) and exists(
  select 1 from public.attendance_staff_assignments a left join public.class_arms arm on arm.id=target_arm and arm.school_id=target_school
  where a.school_id=target_school and a.teacher_user_id=(select auth.uid()) and a.is_active and a.academic_session_id=target_session
   and ((target_model='class' and a.assignment_type='class' and a.class_id=arm.class_id and (a.class_arm_id is null or a.class_arm_id=target_arm)
      and exists(select 1 from public.student_enrolments se where se.school_id=target_school and se.student_id=target_student and se.structure_type='basic' and se.class_arm_id=target_arm and se.academic_session_id=target_session and se.academic_term_id=target_term))
     or (target_model='course' and a.assignment_type='course' and a.subject_id=target_subject
      and exists(select 1 from public.course_enrolments ce join public.student_enrolments se on se.school_id=ce.school_id and se.student_id=ce.student_id where ce.school_id=target_school and ce.student_id=target_student and ce.subject_id=target_subject and ce.programme_id=target_programme and ce.academic_level_id=target_level and ce.academic_session_id=target_session and ce.academic_term_id=target_term and ce.is_active and se.structure_type='programme' and se.programme_id=target_programme and se.academic_level_id=target_level and se.academic_session_id=target_session and se.academic_term_id=target_term))))
$$;

alter table public.academic_grading_configurations enable row level security;
alter table public.academic_period_results enable row level security;
alter table public.academic_period_result_history enable row level security;
alter table public.academic_period_gpas enable row level security;
alter table public.academic_period_gpa_history enable row level security;
alter table public.academic_credit_adjustments enable row level security;
alter table public.academic_credit_adjustment_history enable row level security;
alter table public.academic_progress_records enable row level security;
alter table public.academic_progress_record_history enable row level security;
alter table public.transcript_issues enable row level security;
revoke all on public.academic_grading_configurations,public.academic_period_results,public.academic_period_result_history,public.academic_period_gpas,public.academic_period_gpa_history,public.academic_credit_adjustments,public.academic_credit_adjustment_history,public.academic_progress_records,public.academic_progress_record_history,public.transcript_issues from public,anon;
grant select on public.academic_grading_configurations,public.academic_period_results,public.academic_period_gpas,public.academic_credit_adjustments,public.academic_credit_adjustment_history,public.transcript_issues to authenticated;
grant select on public.academic_period_result_history,public.academic_period_gpa_history,public.academic_progress_record_history to authenticated;
grant insert,update on public.academic_credit_adjustments to authenticated;
grant select,insert,update on public.academic_progress_records to authenticated;
create policy academic_grading_configuration_read on public.academic_grading_configurations for select to authenticated using(private.has_school_role(school_id,array['school_admin','teacher','student']::public.app_role[]));
create policy academic_period_results_read on public.academic_period_results for select to authenticated using(private.can_manage_academic_period_result(school_id,assessment_model,class_arm_id,programme_id,academic_level_id,student_id,subject_id,academic_session_id,academic_term_id) or exists(select 1 from public.students s where s.id=academic_period_results.student_id and s.school_id=academic_period_results.school_id and s.auth_user_id=auth.uid() and academic_period_results.status='published'));
create policy academic_period_result_history_admin_read on public.academic_period_result_history for select to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy academic_period_gpas_read on public.academic_period_gpas for select to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[]) or exists(select 1 from public.students s where s.id=academic_period_gpas.student_id and s.school_id=academic_period_gpas.school_id and s.auth_user_id=auth.uid()));
create policy academic_period_gpa_history_admin_read on public.academic_period_gpa_history for select to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy academic_credit_adjustments_admin_read on public.academic_credit_adjustments for select to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy academic_credit_adjustments_admin_insert on public.academic_credit_adjustments for insert to authenticated with check(created_by=auth.uid() and private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy academic_credit_adjustments_admin_update on public.academic_credit_adjustments for update to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[])) with check(private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy academic_credit_adjustment_history_admin_read on public.academic_credit_adjustment_history for select to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy academic_progress_records_admin_or_student_read on public.academic_progress_records for select to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[]) or (is_published and exists(select 1 from public.students s where s.id=academic_progress_records.student_id and s.school_id=academic_progress_records.school_id and s.auth_user_id=auth.uid())));
create policy academic_progress_records_admin_insert on public.academic_progress_records for insert to authenticated with check(created_by=auth.uid() and private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy academic_progress_records_admin_update on public.academic_progress_records for update to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[])) with check(private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy academic_progress_record_history_admin_read on public.academic_progress_record_history for select to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy transcript_issues_admin_or_owner_read on public.transcript_issues for select to authenticated using(private.has_school_role(school_id,array['school_admin']::public.app_role[]) or exists(select 1 from public.students s where s.id=transcript_issues.student_id and s.school_id=transcript_issues.school_id and s.auth_user_id=auth.uid()));
create trigger academic_period_results_audit after insert or update on public.academic_period_results for each row execute function public.audit_academic_period_result();
create trigger academic_period_result_gpa_recalculate after insert or update on public.academic_period_results for each row execute function public.recalculate_gpa_after_published_result();
create trigger academic_period_result_history_immutable before update or delete on public.academic_period_result_history for each row execute function public.protect_academic_record_history();
create trigger academic_period_gpa_history_immutable before update or delete on public.academic_period_gpa_history for each row execute function public.protect_academic_record_history();
create trigger academic_credit_adjustments_validate before insert or update on public.academic_credit_adjustments for each row execute function public.validate_academic_credit_adjustment();
create trigger academic_credit_adjustments_audit after insert or update on public.academic_credit_adjustments for each row execute function public.audit_academic_credit_adjustment();
create trigger academic_credit_adjustment_history_immutable before update or delete on public.academic_credit_adjustment_history for each row execute function public.protect_academic_record_history();
create trigger academic_progress_records_audit after insert or update on public.academic_progress_records for each row execute function public.audit_academic_progress_record();
create trigger academic_progress_records_validate before insert or update on public.academic_progress_records for each row execute function public.validate_academic_progress_record();
create trigger academic_progress_record_history_immutable before update or delete on public.academic_progress_record_history for each row execute function public.protect_academic_record_history();
create trigger academic_progress_records_touch_updated before update on public.academic_progress_records for each row execute function public.touch_updated_at();
create trigger academic_period_results_touch_updated before update on public.academic_period_results for each row execute function public.touch_updated_at();
create trigger transcript_issues_immutable before update or delete on public.transcript_issues for each row execute function public.protect_transcript_issue();
revoke all on function private.validate_academic_grading_configuration(jsonb),private.can_manage_academic_period_result(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid),public.save_academic_grading_configuration(jsonb,uuid),public.validate_examination_contribution_weight(),public.audit_academic_period_result(),public.protect_academic_record_history(),public.protect_transcript_issue(),public.audit_academic_credit_adjustment(),public.validate_academic_credit_adjustment(),public.audit_academic_progress_record(),public.validate_academic_progress_record(),public.recalculate_gpa_after_published_result(),public.recalculate_academic_period_result(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid),public.transition_academic_period_result(uuid,text,text,uuid),public.recalculate_student_gpa(uuid,uuid,uuid,uuid),public.issue_student_transcript(uuid,uuid,uuid,uuid,uuid),public.void_student_transcript(uuid,text,uuid) from public,anon;
grant execute on function private.can_manage_academic_period_result(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid),public.save_academic_grading_configuration(jsonb,uuid),public.recalculate_academic_period_result(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid),public.transition_academic_period_result(uuid,text,text,uuid),public.recalculate_student_gpa(uuid,uuid,uuid,uuid),public.issue_student_transcript(uuid,uuid,uuid,uuid,uuid),public.void_student_transcript(uuid,text,uuid) to authenticated;
