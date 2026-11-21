# Supabase authentication setup

The multi-school migrations are applied to the connected Supabase project. Keep the project URL and publishable key in the app root `.env.local`; never add a secret or service-role key to a `NEXT_PUBLIC_` variable.

## Auth URL configuration

In the Supabase Dashboard, configure the Auth site URL for the deployed application and add the local and deployed callback URLs to the redirect URL allowlist:

- `http://localhost:3000/auth/callback`
- `https://<your-domain>/auth/callback`

Enable email/password sign-in and email confirmation for production. Password reset and invitation verification return through `/auth/callback`.

## Bootstrap the first Platform Super Admin

Public sign-up cannot create a Platform Super Admin. After the trusted operator creates and verifies the intended administrator account, find that account's UUID in **Authentication → Users**. Then, as a trusted database owner in the Supabase SQL editor, insert that UUID into `public.platform_administrators`:

```sql
insert into public.platform_administrators (user_id)
values ('<verified-auth-user-uuid>');
```

Do not expose this table to application writes or let users choose this role at registration. After the insert, that user can sign in and use `/platform` to approve pending school registrations.

## Migrations

The sequence below is the complete repository migration order through Staff. The version history table is not proof that all objects are present; compare it with the live catalog before deployment.

### Definitive deployment order

The historical prerequisite chain through Phase 4F must already be deployed in lexical order. The exact final Staff sequence is:

1. `20261119000459_multi_school_foundation.sql`
2. `20261119001500_invitation_revocation.sql`
3. `20261119001925_platform_administration.sql`
4. `20261119002724_private_rls_helpers.sql`
5. `20261119003449_least_privilege_grants.sql`
6. `20261119095321_academic_management_foundation.sql`
7. `20261119142326_cognia_institution_and_academic_models.sql`
8. `20261119142505_cognia_academic_foreign_key_indexes.sql`
9. `20261119142743_cognia_default_academic_period_labels.sql`
10. `20261119144059_cognia_academic_structure_management.sql`
11. `20261119165748_cognia_student_information.sql`
12. `20261119165833_cognia_admission_conversion.sql`
13. `20261119171409_cognia_admission_placement_conversion.sql`
14. `20261119171602_cognia_atomic_student_placement.sql`
15. `20261119172322_cognia_invoker_student_workflows.sql`
16. `20261119172451_cognia_student_fk_indexes.sql`
17. `20261119181207_cognia_attendance_management.sql`
18. `20261119182151_cognia_attendance_student_history.sql`
19. `20261119183000_cognia_attendance_member_read_policies.sql`
20. `20261119193411_cognia_course_attendance_context.sql`
21. `20261119201639_cognia_timetable_scheduling.sql`
22. `20261119202613_cognia_timetable_archive_read.sql`
23. `20261119203000_cognia_timetable_visibility_and_roster_lock.sql`
24. `20261119210000_cognia_assessment_coursework.sql`
25. `20261119220000_cognia_examinations_results.sql`
26. `20261120120000_cognia_academic_results_gpa_transcripts.sql`
27. `20261120130000_cognia_phase4f_reporting_indexes.sql`
28. `20261120140000_cognia_staff_fees_settings.sql`
29. `20261120160000_cognia_staff_role.sql`
30. `20261120170000_cognia_staff_portal.sql`
31. `20261120180000_staff_invitation_and_contact_security.sql`

**Skip `20261120150000_cognia_staff_fees_setup_correction.sql`.** Its membership unique-key and updated-at-trigger corrections are already included in 1400. It is retained only for historical reference and is not part of a fresh deployment sequence. If it was already applied to an existing project, leave that state unchanged; do not rerun it or try to reverse it.

Run each file separately in Supabase SQL Editor and wait for it to finish successfully before proceeding. In particular, run 1600 by itself and let its transaction commit before running 1700, which uses the newly-added enum value. Do not enable the application between 1700 and 1800: 1700 revokes the legacy invitation RPC grants, and 1800 installs and grants the hardened replacements.

### Staff migration dependencies

| Migration | Required objects / behavior |
|---|---|
| `20261120140000` | Requires the academic foundation, tenant-composite academic keys, `public.app_role`, `private.has_school_role(uuid, public.app_role[])`, `public.touch_updated_at()`, and PostgreSQL 15+. It creates the eight Staff/Fees/Settings tables, RLS policies, timestamp triggers, the `(school_id,user_id)` membership key when absent, and `recalculate_invoice_status(uuid,uuid)`. |
| `20261120150000` | **Skip.** Its duplicate-pair guard, membership key, and updated-at triggers are already in 1400. |
| `20261120160000` | Adds `staff` to `public.app_role`. It is repeatable, but must be run separately and committed before 1700 uses that enum label. |
| `20261120170000` | Requires 1400 and 1600, the private role helper, staff membership key/FK, profiles, invitations, and the expected 1400 policies. It validates the FK by ordered catalog column IDs, referenced table, validation state, and delete action—not by matching `pg_get_constraintdef` formatting or a constraint name. Adds staff portal fields, account status, tenant-safe reporting-manager FK/indexes, and staff policies. It keeps the existing composite membership FK; it does not drop/recreate that FK or replace policies by dropping them. It widens the known invitation role check to include `staff`. |
| `20261120180000` | Replaces invitation RPCs with confirmed-email, expiry, single-use, school-active, and staff-profile-link checks; adds the limited contact RPC. It requires `auth.users(id,email,email_confirmed_at)` and the complete 1700 schema. |

**Helper compatibility correction:** `20261119002724_private_rls_helpers.sql` defines `private.has_school_role(target_school_id uuid, allowed_roles public.app_role[]) returns boolean` as a stable `SECURITY DEFINER` SQL function with `search_path = ''`. It queries `public.school_memberships` for the caller from `auth.uid()`, an active membership, and a role in the supplied array. It revokes execute from `public` and `anon`, grants schema usage and function execute to `authenticated`. The Staff RPCs run as `SECURITY DEFINER`; staff RLS policies run as `authenticated`, who have the explicit helper and schema grants. The incompatible references in 1700/1800 have been corrected to call `private.has_school_role(...)`; no public helper is restored.

Migration 1700 revokes execution on the older invitation RPCs before changing the schema. Migration 1800 revokes execution immediately after creating each hardened `SECURITY DEFINER` RPC, then grants it only to `authenticated` after all replacements are defined. Invitation acceptance verifies authenticated identity, confirmed and matching email, pending status, future expiry, active school, and the matching teacher/staff profile. Membership insertion, profile linking, and invitation acceptance are one database transaction; row-count failures raise and roll the transaction back.

The 1700 membership-FK preflight validates ordered referencing/referenced columns from `pg_constraint`, not the display text returned by `pg_get_constraintdef`. The reported FK-preflight error occurs in the first, read-only `DO` block before any mutation. If the live catalog query below confirms the expected validated FK and matching unique key, rerun the corrected 1700 source. If it does not, stop; inspect rows for orphaned or cross-school links before preparing a forward repair.

### Safety / rerun assessment

- **1400:** first-time only. It aborts if any of its eight tables or invoice RPC already exists. It is safe only when all prerequisites pass and its target objects are absent. A previous SQL Editor attempt may have committed; the local workspace cannot establish its outcome.
- **1500:** skip; redundant in a new sequence.
- **1600:** idempotent enum addition. Run separately so the new enum value is committed before 1700.
- **1700:** one-time schema extension. It stops before changing schema if portal columns already exist. It safely alters existing policies in place. Its only constraint replacement is the invitation role check: the block validates the expected original four-role definition (or recognizes an already widened check) before replacing it. The membership FK is preserved. If the file fails after changing columns, do not replay it; inspect actual state and prepare a reviewed forward repair.
- **1800:** repeatable only for the expected COGNIA function signatures. It uses `CREATE OR REPLACE FUNCTION`, so do not run it over custom functions with the same signatures. Its RPC ACLs are revoked immediately after each definition and granted to `authenticated` only after all definitions are installed.
- Do not use `supabase/deployments/20261120140000_staff_fees_settings_manual.sql` in addition to 1400.
- Supabase SQL Editor execution does not necessarily register migration-file versions in `supabase_migrations.schema_migrations`. Do not insert version rows manually or treat history as proof of schema state. Record manual execution through the approved change process; reconcile with the CLI migration history only after comparing the actual schema.

### Pre-deployment checklist

1. Confirm the Supabase project/ref and take a recoverable backup under the normal change process.
2. Confirm migrations through `20261120130000` and all prerequisite objects are present.
3. Because 1400 was previously attempted, confirm through the normal deployment/change process whether its tables and invoice RPC were committed. Do not rerun 1400 if any target exists; do not infer success or rollback from the SQL Editor error alone.
4. If 1400 is not applied and all its targets are absent, apply the exact sequence above. Skip 1500. Stop at the first error; do not rerun a partially completed file.
5. Apply 1700 and 1800 consecutively after successful 1600, then run the post-deployment checks below and controlled role-based tests.

### Post-deployment checks

- Confirm all required objects below and the four Staff migration outcomes; 1500 is intentionally skipped. Do not manually mark versions as applied.
- Confirm eight 1400 tables exist with RLS enabled, expected FKs/unique constraints and admin policies; authenticated users have no `DELETE` privilege on `staff_records`, and `anon` has no access.
- Confirm `app_role` includes `staff`, role permission `school.self.read` exists, and the staff self-read / school-admin policies are present.
- Confirm all expected RPC signatures exist, their bodies call `private.has_school_role`, and execute is granted to `authenticated` but not `anon`/`public`.
- Confirm updated-at triggers and staff constraints exist; verify the profile-linking and contact RPCs on a controlled test institution/account before enabling staff invitations.
- Test RLS and RPC behavior as school admin, teacher, non-teaching staff, and unauthenticated user. Catalog checks alone do not prove row-level behavior.

### Recovery instructions

If a migration errors or the resulting schema differs from expectations, stop deployment and preserve the error output. Do not reset the project or drop objects. A failure in the initial read-only 1700 preflight has made no schema changes; after resolving its specific prerequisite and confirming the live catalog, the corrected source can be run. For any error after a migration begins modifying schema, do not rerun the whole file: compare the live catalog with the intended definitions and have a database owner prepare and review a narrowly scoped forward-only repair or restore from the approved backup. Reconcile Supabase migration history only after the actual schema is verified through the normal migration workflow; never mark an unsuccessful migration as applied.

### Optional read-only verification SQL

These queries are optional, read-only post-deployment checks and were not executed as part of this task. Supabase SQL Editor does not automatically record manually executed migration files. Check whether a migration-history table exists before running the version query; its absence is not evidence that migrations ran or failed.

**Migration history table presence and PostgreSQL version**

```sql
select to_regclass('supabase_migrations.schema_migrations') as migration_history_table;

select current_setting('server_version') as server_version,
       current_setting('server_version_num')::integer >= 150000 as supports_scoped_set_null;
```

Only if the previous query returns a migration-history table, inspect its recorded versions:

```sql
select version
from supabase_migrations.schema_migrations
where version in (
  '20261119000459','20261119001500','20261119001925','20261119002724',
  '20261119003449','20261119095321','20261119142326','20261119142505',
  '20261119142743','20261119144059','20261119165748','20261119165833',
  '20261119171409','20261119171602','20261119172322','20261119172451',
  '20261119181207','20261119182151','20261119183000','20261119193411',
  '20261119201639','20261119202613','20261119203000','20261119210000',
  '20261119220000','20261120120000','20261120130000','20261120140000',
  '20261120160000','20261120170000','20261120180000'
)
order by version;
```

**Staff membership FK and referenced unique key**

```sql
with targets as (
  select to_regclass('public.staff_records') as staff_oid,
         to_regclass('public.school_memberships') as memberships_oid
),
candidate_fk as (
  select
    c.oid,
    c.conname,
    c.conrelid,
    c.confrelid,
    c.convalidated,
    c.confdeltype,
    c.confmatchtype,
    array(
      select a.attname::text
      from unnest(c.conkey) with ordinality as key_column(attnum, ordinality)
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = key_column.attnum
      order by key_column.ordinality
    ) as referencing_columns,
    array(
      select a.attname::text
      from unnest(c.confkey) with ordinality as key_column(attnum, ordinality)
      join pg_attribute a
        on a.attrelid = c.confrelid
       and a.attnum = key_column.attnum
      order by key_column.ordinality
    ) as referenced_columns
  from targets t
  join pg_constraint c
    on c.conrelid = t.staff_oid
   and c.confrelid = t.memberships_oid
   and c.contype = 'f'
)
select
  t.staff_oid is not null as staff_records_exists,
  t.memberships_oid is not null as school_memberships_exists,
  f.conname as foreign_key_name,
  f.referencing_columns,
  f.confrelid::regclass as referenced_table,
  f.referenced_columns,
  f.convalidated,
  case
    when f.oid is null then null
    when f.confdeltype = 'c' then 'CASCADE'
    when f.confdeltype = 'r' then 'RESTRICT'
    when f.confdeltype = 'n' then 'SET NULL'
    when f.confdeltype = 'd' then 'SET DEFAULT'
    else 'NO ACTION'
  end as on_delete,
  f.confmatchtype,
  (
    select string_agg(uq.conname::text, ', ' order by uq.conname::text)
    from pg_constraint uq
    where uq.conrelid = t.memberships_oid
      and uq.contype in ('p', 'u')
      and array(
        select a.attname::text
        from unnest(uq.conkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = uq.conrelid
         and a.attnum = key_column.attnum
        order by key_column.ordinality
      ) = f.referenced_columns
  ) as referenced_unique_constraint_names,
  pg_get_constraintdef(f.oid) as catalog_definition
from targets t
left join candidate_fk f on true;
```

**Required dependency columns and existing target-table columns**

```sql
with expected(table_name, column_name) as (
  values
    ('schools','id'), ('schools','status'),
    ('school_memberships','school_id'), ('school_memberships','user_id'),
    ('school_memberships','role'), ('school_memberships','status'),
    ('departments','id'), ('departments','school_id'),
    ('academic_sessions','id'), ('academic_sessions','school_id'),
    ('academic_terms','id'), ('academic_terms','school_id'), ('academic_terms','academic_session_id'),
    ('class_arms','id'), ('class_arms','school_id'),
    ('academic_programmes','id'), ('academic_programmes','school_id'),
    ('academic_levels','id'), ('academic_levels','school_id'), ('academic_levels','programme_id'),
    ('students','id'), ('students','school_id'),
    ('role_permissions','role'), ('role_permissions','permission'),
    ('school_invitations','id'), ('school_invitations','school_id'), ('school_invitations','email'),
    ('school_invitations','role'), ('school_invitations','token_hash'), ('school_invitations','invited_by'),
    ('school_invitations','status'), ('school_invitations','expires_at'),
    ('school_invitations','accepted_by'), ('school_invitations','accepted_at'),
    ('staff_records','id'), ('staff_records','school_id'), ('staff_records','user_id'),
    ('staff_records','employee_number'), ('staff_records','first_name'), ('staff_records','middle_name'),
    ('staff_records','surname'), ('staff_records','email'), ('staff_records','phone'),
    ('staff_records','department_id'), ('staff_records','designation'),
    ('staff_records','employment_status'), ('staff_records','employment_type'),
    ('staff_records','joined_on'), ('staff_records','created_by'), ('staff_records','staff_category'),
    ('staff_records','account_status'), ('staff_records','reporting_manager_id'),
    ('staff_records','address'), ('staff_records','profile_photo_url'), ('staff_records','gender'),
    ('staff_records','date_of_birth')
)
select e.table_name, e.column_name,
       (c.column_name is not null) as exists_now
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
order by e.table_name, e.column_name;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'staff_records','institution_preferences','fee_categories','fee_structures',
    'student_fee_assignments','fee_invoices','fee_invoice_items','fee_payments'
  )
order by table_name, ordinal_position;

select table_schema, table_name, column_name, data_type
from information_schema.columns
where table_schema = 'auth'
  and table_name = 'users'
  and column_name in ('id', 'email', 'email_confirmed_at')
order by column_name;
```

**Target object presence, constraints, unique keys, and foreign keys**

```sql
select name, to_regclass('public.' || name) is not null as exists_now
from unnest(array[
  'staff_records','institution_preferences','fee_categories','fee_structures',
  'student_fee_assignments','fee_invoices','fee_invoice_items','fee_payments'
]) as names(name)
order by name;

select c.conrelid::regclass as table_name, c.conname, c.contype,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class r on r.oid = c.conrelid
join pg_namespace n on n.oid = r.relnamespace
where n.nspname = 'public'
  and r.relname in (
    'school_memberships','departments','academic_sessions','academic_terms',
    'class_arms','academic_programmes','academic_levels','students','school_invitations',
    'staff_records','institution_preferences','fee_categories','fee_structures',
    'student_fee_assignments','fee_invoices','fee_invoice_items','fee_payments'
  )
order by r.relname, c.conname;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'staff_records','institution_preferences','fee_categories','fee_structures',
    'student_fee_assignments','fee_invoices','fee_invoice_items','fee_payments'
  )
order by tablename, indexname;
```

**Role/helper/RPC presence and function grants**

```sql
select t.typname, e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typname = 'app_role'
order by e.enumsortorder;

select role, permission
from public.role_permissions
where role = 'staff'
order by permission;

select signature, to_regprocedure(signature) is not null as exists_now
from unnest(array[
  'private.has_school_role(uuid,public.app_role[])',
  'public.has_school_role(uuid,public.app_role[])',
  'public.touch_updated_at()',
  'public.recalculate_invoice_status(uuid,uuid)',
  'public.create_school_invitation(uuid,text,public.app_role,text)',
  'public.accept_school_invitation(text)',
  'public.set_staff_account_status(uuid,text)',
  'public.get_staff_reporting_manager(uuid)',
  'public.update_my_staff_contact(uuid,text,text)'
]) as signatures(signature)
order by signature;

select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (
  ('private','has_school_role'), ('public','has_school_role'),
  ('public','create_school_invitation'), ('public','accept_school_invitation'),
  ('public','set_staff_account_status'), ('public','get_staff_reporting_manager'),
  ('public','update_my_staff_contact'), ('public','recalculate_invoice_status')
)
order by n.nspname, p.proname, arguments;
```

**RLS, policies, triggers, and table grants**

```sql
select c.oid::regclass as table_name, c.relrowsecurity as rls_enabled,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'staff_records','institution_preferences','fee_categories','fee_structures',
    'student_fee_assignments','fee_invoices','fee_invoice_items','fee_payments'
  )
order by c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'staff_records','school_invitations','profiles','school_memberships'
  )
order by tablename, policyname;

select t.tgrelid::regclass as table_name, t.tgname,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class r on r.oid = t.tgrelid
join pg_namespace n on n.oid = r.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and r.relname in (
    'staff_records','institution_preferences','fee_categories','fee_structures','fee_invoices'
  )
order by r.relname, t.tgname;
```

**Preflight duplicate checks** (run only if the named tables exist)

```sql
select school_id, user_id, count(*) as row_count
from public.school_memberships
group by school_id, user_id
having count(*) > 1;

select school_id, lower(trim(email)) as normalized_email, count(*) as row_count
from public.staff_records
where email is not null
group by school_id, lower(trim(email))
having count(*) > 1;

select school_id, lower(trim(employee_number)) as normalized_employee_number, count(*) as row_count
from public.staff_records
group by school_id, lower(trim(employee_number))
having count(*) > 1;
```

The Supabase CLI is not installed in this workspace. For future CLI use, install the CLI, authenticate, and link the project before syncing migrations; review each migration first. Never run reset or push commands without explicit deployment approval.

The staff portal migrations add a tenant-scoped `staff` membership role for non-teaching employees, support pending staff profiles and role-appropriate invitations, and let institution administrators suspend or reactivate staff/teacher memberships. The invitation/contact security migration requires confirmed email and a matching pending staff profile before teacher/staff membership creation; contact updates are restricted to the authenticated user’s phone and address. Staff can read only their own active profile; employment fields remain administrator-managed. Teaching staff retain the existing teacher workspace permissions.

## Invitations

School admins can create a seven-day invitation link from **Admin → Invitations** or from a new staff profile. Teaching employees use the teacher role; non-teaching employees use the staff role. The raw token is only shown once; only its SHA-256 hash is stored. The app does not send email. Share the generated URL through an approved channel, and configure Supabase email confirmation for new invitees. Acceptance checks the authenticated account email against the invitation email in the database, then links a matching pending staff profile.
