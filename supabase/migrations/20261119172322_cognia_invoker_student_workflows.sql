-- Both workflow RPCs use the caller's grants and RLS policies. Their tenant
-- checks remain defense in depth while row access stays under authenticated RLS.
alter function public.convert_admission_application(uuid, uuid) security invoker;
alter function public.save_student_enrolment(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, date) security invoker;
