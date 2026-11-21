create or replace function public.create_institution_onboarding(
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
  selected_period_label text;
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
  if selected_institution_type is null or selected_institution_type not in (
    'early_childhood', 'basic', 'secondary', 'technical_vocational', 'college',
    'polytechnic', 'monotechnic', 'university', 'postgraduate',
    'professional_research', 'mixed'
  ) then
    raise exception 'Choose a valid institution category';
  end if;
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid())) then
    raise exception 'A user profile is required';
  end if;

  selected_period_label := case
    when selected_institution_type in ('college', 'polytechnic', 'monotechnic', 'university', 'postgraduate', 'professional_research') then 'Semester'
    when selected_institution_type = 'mixed' then 'Period'
    else 'Term'
  end;

  insert into public.schools (name, slug, institution_type, academic_period_label)
    values (clean_name, clean_slug, selected_institution_type, selected_period_label)
    returning id into new_school_id;
  insert into public.school_memberships (school_id, user_id, role, status)
    values (new_school_id, (select auth.uid()), 'school_admin', 'active');
  insert into public.school_onboarding (school_id, submitted_by, status)
    values (new_school_id, (select auth.uid()), 'pending_review');
  return new_school_id;
end;
$$;
