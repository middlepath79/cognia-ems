-- COGNIA manual deployment script
-- Run once in Supabase SQL Editor after migrations 20261119000459 through 20261120130000.
-- This script does not reset, drop, or modify existing institutional records.
-- It creates staff, institution preference, and fee tables only.
-- Do not run this script if any target table or invoice-status function already exists.

do $$
declare
  missing text;
  existing_object text;
  required_key record;
begin
  foreach missing in array array[
    'public.schools','public.school_memberships','public.departments',
    'public.academic_sessions','public.academic_terms','public.class_arms',
    'public.academic_programmes','public.academic_levels','public.students'
  ] loop
    if to_regclass(missing) is null then
      raise exception 'Prerequisite object % is missing. Apply the earlier COGNIA migrations first.', missing;
    end if;
  end loop;
  if to_regprocedure('private.has_school_role(uuid, public.app_role[])') is null then
    raise exception 'Prerequisite function private.has_school_role is missing. Apply the private RLS helper migration first.';
  end if;
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception 'Prerequisite function public.touch_updated_at is missing. Apply the foundation migration first.';
  end if;
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'PostgreSQL 15 or newer is required for the scoped ON DELETE SET NULL constraints.';
  end if;

  for required_key in
    select * from (values
      ('public.departments', 'UNIQUE (id, school_id)%'),
      ('public.academic_sessions', 'UNIQUE (id, school_id)%'),
      ('public.academic_terms', 'UNIQUE (id, school_id, academic_session_id)%'),
      ('public.class_arms', 'UNIQUE (id, school_id)%'),
      ('public.academic_programmes', 'UNIQUE (id, school_id)%'),
      ('public.academic_levels', 'UNIQUE (id, school_id, programme_id)%'),
      ('public.students', 'UNIQUE (id, school_id)%')
    ) as key_definitions(table_name, definition_pattern)
  loop
    if not exists (
      select 1 from pg_constraint c
      where c.conrelid=to_regclass(required_key.table_name)
        and c.contype in ('u','p')
        and pg_get_constraintdef(c.oid) like required_key.definition_pattern
    ) then
      raise exception 'Required tenant-safe key is missing on %: %',
        required_key.table_name, required_key.definition_pattern;
    end if;
  end loop;

  foreach existing_object in array array[
    'public.staff_records','public.institution_preferences','public.fee_categories',
    'public.fee_structures','public.student_fee_assignments','public.fee_invoices',
    'public.fee_invoice_items','public.fee_payments'
  ] loop
    if to_regclass(existing_object) is not null then
      raise exception 'Object % already exists. This manual script is for a new deployment only; inspect existing objects before retrying.', existing_object;
    end if;
  end loop;
  if to_regprocedure('public.recalculate_invoice_status(uuid, uuid)') is not null then
    raise exception 'The invoice-status function already exists. Inspect it before applying this script.';
  end if;
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
  if not exists (
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

create table public.staff_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null,
  employee_number text not null check (
    char_length(trim(employee_number)) between 1 and 32
    and employee_number !~ '[[:cntrl:]]'
  ),
  first_name text not null check (char_length(trim(first_name)) between 1 and 100),
  middle_name text check (middle_name is null or char_length(trim(middle_name)) <= 100),
  surname text not null check (char_length(trim(surname)) between 1 and 100),
  email text check (email is null or char_length(trim(email)) <= 254),
  phone text check (phone is null or char_length(trim(phone)) <= 40),
  department_id uuid,
  designation text check (designation is null or char_length(designation) <= 120),
  employment_status text not null default 'active'
    check (employment_status in ('active','on_leave','suspended','terminated','retired')),
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time','part_time','contract','temporary','adjunct')),
  joined_on date,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id, user_id) references public.school_memberships(school_id,user_id) on delete cascade,
  foreign key (department_id, school_id) references public.departments(id,school_id) on delete set null (department_id),
  unique (school_id, user_id),
  unique (school_id, employee_number)
);
create index staff_records_school_directory_idx on public.staff_records (school_id, employment_status, surname, first_name);
create index staff_records_department_idx on public.staff_records (school_id, department_id);
create unique index staff_records_school_employee_number_ci_idx
  on public.staff_records (school_id, lower(trim(employee_number)));

create table public.institution_preferences (
  school_id uuid primary key references public.schools(id) on delete cascade,
  contact_email text,
  contact_phone text,
  address text,
  timezone text not null default 'UTC',
  currency text not null default 'USD',
  locale text not null default 'en',
  invoice_prefix text not null default 'INV' check (char_length(trim(invoice_prefix)) between 1 and 12),
  receipt_prefix text not null default 'RCT' check (char_length(trim(receipt_prefix)) between 1 and 12),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fee_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  code text,
  description text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);

create table public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  category_id uuid,
  academic_session_id uuid,
  academic_term_id uuid,
  structure_type text not null default 'basic' check (structure_type in ('basic','programme')),
  class_arm_id uuid,
  programme_id uuid,
  academic_level_id uuid,
  amount numeric(14,2) not null check (amount >= 0),
  due_date date,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, school_id) references public.fee_categories(id,school_id) on delete restrict,
  foreign key (academic_session_id, school_id) references public.academic_sessions(id,school_id) on delete restrict,
  foreign key (academic_term_id, school_id, academic_session_id) references public.academic_terms(id,school_id,academic_session_id) on delete restrict,
  foreign key (class_arm_id, school_id) references public.class_arms(id,school_id) on delete restrict,
  foreign key (programme_id, school_id) references public.academic_programmes(id,school_id) on delete restrict,
  foreign key (academic_level_id, school_id, programme_id) references public.academic_levels(id,school_id,programme_id) on delete restrict,
  unique (id, school_id)
);
create index fee_structures_school_period_idx on public.fee_structures (school_id, academic_session_id, academic_term_id, is_active);

create table public.student_fee_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  fee_structure_id uuid not null,
  amount numeric(14,2) not null check (amount >= 0),
  due_date date,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (student_id, school_id) references public.students(id,school_id) on delete restrict,
  foreign key (fee_structure_id, school_id) references public.fee_structures(id,school_id) on delete restrict,
  unique (school_id, student_id, fee_structure_id)
);

create table public.fee_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  invoice_number text not null,
  academic_session_id uuid,
  academic_term_id uuid,
  issued_at date not null default current_date,
  due_date date,
  subtotal numeric(14,2) not null check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total numeric(14,2) not null check (total >= 0),
  status text not null default 'issued' check (status in ('draft','issued','partially_paid','paid','void')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, school_id) references public.students(id,school_id) on delete restrict,
  foreign key (academic_session_id, school_id) references public.academic_sessions(id,school_id) on delete restrict,
  foreign key (academic_term_id, school_id, academic_session_id) references public.academic_terms(id,school_id,academic_session_id) on delete restrict,
  unique (school_id, invoice_number),
  unique (id, school_id)
);
create index fee_invoices_school_student_idx on public.fee_invoices (school_id, student_id, issued_at desc);
create index fee_invoices_school_status_idx on public.fee_invoices (school_id, status, due_date);

create table public.fee_invoice_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  invoice_id uuid not null,
  fee_category_id uuid,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  foreign key (invoice_id, school_id) references public.fee_invoices(id,school_id) on delete cascade,
  foreign key (fee_category_id, school_id) references public.fee_categories(id,school_id) on delete set null (fee_category_id),
  unique (id, school_id)
);

create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  invoice_id uuid not null,
  receipt_number text not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  payment_method text not null check (payment_method in ('cash','bank_transfer','card','cheque','mobile_money','other')),
  reference text,
  notes text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, school_id) references public.fee_invoices(id,school_id) on delete restrict,
  unique (school_id, receipt_number)
);
create index fee_payments_school_invoice_idx on public.fee_payments (school_id, invoice_id, paid_at desc);

alter table public.staff_records enable row level security;
alter table public.institution_preferences enable row level security;
alter table public.fee_categories enable row level security;
alter table public.fee_structures enable row level security;
alter table public.student_fee_assignments enable row level security;
alter table public.fee_invoices enable row level security;
alter table public.fee_invoice_items enable row level security;
alter table public.fee_payments enable row level security;

revoke all on public.staff_records, public.institution_preferences, public.fee_categories, public.fee_structures,
  public.student_fee_assignments, public.fee_invoices, public.fee_invoice_items, public.fee_payments
  from public, anon;
revoke delete on public.staff_records from authenticated;
grant select, insert, update on public.staff_records to authenticated;
grant select, insert, update, delete on public.institution_preferences, public.fee_categories,
  public.fee_structures, public.student_fee_assignments, public.fee_invoices, public.fee_invoice_items, public.fee_payments
  to authenticated;

create policy staff_records_admin_read on public.staff_records for select to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy staff_records_admin_insert on public.staff_records for insert to authenticated
  with check (
    private.has_school_role(school_id,array['school_admin']::public.app_role[])
    and created_by=(select auth.uid())
    and exists (
      select 1 from public.school_memberships m
      where m.school_id=staff_records.school_id
        and m.user_id=staff_records.user_id
        and m.status='active'
        and m.role in ('teacher','school_admin')
    )
  );
create policy staff_records_admin_update on public.staff_records for update to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]))
  with check (
    private.has_school_role(school_id,array['school_admin']::public.app_role[])
    and exists (
      select 1 from public.school_memberships m
      where m.school_id=staff_records.school_id
        and m.user_id=staff_records.user_id
        and m.status='active'
        and m.role in ('teacher','school_admin')
    )
  );
create policy institution_preferences_admin_manage on public.institution_preferences for all to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy fee_categories_admin_manage on public.fee_categories for all to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy fee_structures_admin_manage on public.fee_structures for all to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy fee_assignments_admin_manage on public.student_fee_assignments for all to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy fee_invoices_admin_manage on public.fee_invoices for all to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy fee_invoice_items_admin_manage on public.fee_invoice_items for all to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));
create policy fee_payments_admin_manage on public.fee_payments for all to authenticated
  using (private.has_school_role(school_id,array['school_admin']::public.app_role[]))
  with check (private.has_school_role(school_id,array['school_admin']::public.app_role[]));

create or replace function public.recalculate_invoice_status(target_invoice uuid, target_school uuid)
returns void language plpgsql security definer set search_path='' as $$
declare invoice_total numeric; paid_total numeric; invoice_status text;
begin
  if not private.has_school_role(target_school,array['school_admin']::public.app_role[]) then raise exception 'Institution administrator access is required'; end if;
  select i.total, i.status into invoice_total, invoice_status
  from public.fee_invoices i
  where i.id=target_invoice and i.school_id=target_school and i.status!='void';
  if not found then raise exception 'Invoice not found'; end if;
  if invoice_status='draft' then raise exception 'Draft invoices cannot have payments recalculated'; end if;
  select coalesce(sum(p.amount),0) into paid_total from public.fee_payments p where p.invoice_id=target_invoice and p.school_id=target_school;
  update public.fee_invoices
    set status=case
      when paid_total>=invoice_total then 'paid'
      when paid_total>0 then 'partially_paid'
      else 'issued'
    end
    where id=target_invoice and school_id=target_school;
end; $$;

revoke all on function public.recalculate_invoice_status(uuid,uuid) from public,anon;
grant execute on function public.recalculate_invoice_status(uuid,uuid) to authenticated;

do $$
declare
  target_table text;
  trigger_name text;
begin
  foreach target_table in array array[
    'staff_records','institution_preferences','fee_categories','fee_structures','fee_invoices'
  ] loop
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
  end loop;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'staff_records','institution_preferences','fee_categories','fee_structures',
    'student_fee_assignments','fee_invoices','fee_invoice_items','fee_payments'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=target_table and c.relrowsecurity
    ) then
      raise exception 'RLS verification failed for public.%', target_table;
    end if;
  end loop;
  if not exists (
    select 1 from pg_policy
    where polrelid='public.staff_records'::regclass
      and polname='staff_records_admin_insert'
  ) or not exists (
    select 1 from pg_policy
    where polrelid='public.staff_records'::regclass
      and polname='staff_records_admin_update'
  ) then
    raise exception 'Staff administrator RLS policies were not created.';
  end if;
  if has_table_privilege('anon','public.staff_records','SELECT')
     or has_table_privilege('authenticated','public.staff_records','DELETE') then
    raise exception 'Staff grants do not match the expected least-privilege configuration.';
  end if;
end;
$$;

-- Post-deployment verification
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'staff_records','institution_preferences','fee_categories','fee_structures',
    'student_fee_assignments','fee_invoices','fee_invoice_items','fee_payments'
  )
order by table_name;

select tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in (
    'staff_records','institution_preferences','fee_categories','fee_structures',
    'student_fee_assignments','fee_invoices','fee_invoice_items','fee_payments'
  )
order by tablename;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname='public'
  and tablename in (
    'staff_records','institution_preferences','fee_categories','fee_structures',
    'student_fee_assignments','fee_invoices','fee_invoice_items','fee_payments'
  )
order by tablename, policyname;

select conname, conrelid::regclass as table_name, pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace='public'::regnamespace
  and conrelid = any(array[
    'public.staff_records'::regclass,
    'public.institution_preferences'::regclass,
    'public.fee_categories'::regclass,
    'public.fee_structures'::regclass,
    'public.student_fee_assignments'::regclass,
    'public.fee_invoices'::regclass,
    'public.fee_invoice_items'::regclass,
    'public.fee_payments'::regclass
  ])
order by table_name, conname;

select routines.routine_name, routines.routine_type
from information_schema.routines
where routines.routine_schema='public'
  and routines.routine_name='recalculate_invoice_status';

select
  has_table_privilege('authenticated','public.staff_records','SELECT') as authenticated_can_select_staff,
  has_table_privilege('authenticated','public.staff_records','INSERT') as authenticated_can_insert_staff,
  has_table_privilege('authenticated','public.staff_records','UPDATE') as authenticated_can_update_staff,
  has_table_privilege('authenticated','public.staff_records','DELETE') as authenticated_can_delete_staff;
