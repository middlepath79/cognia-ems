-- Additive correction for deployments that need tenant-safe staff membership keys
-- or updated-at triggers on the staff, preference, and fee tables.

do $$
declare
  required_object text;
begin
  if to_regclass('public.school_memberships') is null
     or to_regprocedure('public.touch_updated_at()') is null then
    raise exception 'Apply the COGNIA foundation migrations before this correction.';
  end if;
  foreach required_object in array array[
    'public.staff_records',
    'public.institution_preferences',
    'public.fee_categories',
    'public.fee_structures',
    'public.fee_invoices'
  ] loop
    if to_regclass(required_object) is null then
      raise exception 'Required object % is missing. Apply the staff/fees migration first.', required_object;
    end if;
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.school_memberships
    group by school_id, user_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate school_memberships rows exist for one school and user. Resolve duplicates before applying this migration.';
  end if;
  if to_regclass('public.school_memberships') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.school_memberships'::regclass
         and contype = 'u'
         and pg_get_constraintdef(oid) like 'UNIQUE (school_id, user_id)%'
     ) then
    alter table public.school_memberships
      add constraint school_memberships_school_user_unique unique (school_id, user_id);
  end if;
end;
$$;

do $$
declare
  target_table text;
  trigger_name text;
begin
  foreach target_table in array array[
    'staff_records',
    'institution_preferences',
    'fee_categories',
    'fee_structures',
    'fee_invoices'
  ] loop
    if to_regclass('public.' || target_table) is not null then
      trigger_name := target_table || '_touch_updated_at';
      if not exists (
        select 1
        from pg_trigger
        where tgrelid = ('public.' || target_table)::regclass
          and tgname = trigger_name
          and not tgisinternal
      ) then
        execute format(
          'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
          trigger_name,
          target_table
        );
      end if;
    end if;
  end loop;
end;
$$;
