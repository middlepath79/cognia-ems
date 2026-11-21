-- Cover the composite tenant-scoped foreign keys added for academic structures.
create index academic_levels_programme_school_idx
  on public.academic_levels (programme_id, school_id);
create index academic_programmes_department_school_idx
  on public.academic_programmes (department_id, school_id);
create index departments_faculty_school_idx
  on public.departments (faculty_id, school_id);
