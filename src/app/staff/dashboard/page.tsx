import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/school-workspace";
import { canAccessTeacherWorkspace } from "@/lib/staff-utils";
import StaffContactForm from "./contact-form";

function PortalError({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section role="alert" className="card max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">Staff portal unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        <form action="/auth/signout" method="post" className="mt-5">
          <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Sign out</button>
        </form>
      </section>
    </main>
  );
}

function safePhotoUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function dateLabel(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString();
}

export default async function StaffDashboardPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") redirect("/login");

  const { data: memberships, error: membershipError } = await supabase
    .from("school_memberships")
    .select("school_id,role")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["staff", "teacher"]);
  if (membershipError) {
    console.error("Unable to load staff portal membership", membershipError.message);
    return <PortalError message="Your institution access could not be verified. Please try again or contact your institution administrator." />;
  }
  if (!memberships?.length) redirect("/portal");

  const cookieStore = await cookies();
  const selectedSchoolId = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value;
  const membership = memberships.find((item) => item.school_id === selectedSchoolId) ?? memberships[0];
  const [{ data: school, error: schoolError }, { data: staff, error: staffError }] = await Promise.all([
    supabase
      .from("schools")
      .select("id,name,status")
      .eq("id", membership.school_id)
      .maybeSingle(),
    supabase
      .from("staff_records")
      .select("id,employee_number,first_name,middle_name,surname,email,phone,profile_photo_url,gender,date_of_birth,address,staff_category,department_id,designation,employment_status,employment_type,joined_on,reporting_manager_id")
      .eq("school_id", membership.school_id)
      .eq("user_id", userId)
      .eq("account_status", "active")
      .maybeSingle(),
  ]);
  if (schoolError || staffError) {
    console.error("Unable to load staff portal profile", {
      schoolError: schoolError?.message,
      staffError: staffError?.message,
    });
    return <PortalError message="Your personal staff profile could not be loaded. Contact your institution administrator to verify the Staff schema and your account link." />;
  }
  if (!school || school.status !== "active") redirect("/portal?status=suspended");

  let departmentName: string | null = null;
  let managerName: string | null = null;
  let relatedDataError = false;
  if (staff?.department_id) {
    const { data, error } = await supabase
      .from("departments")
      .select("name")
      .eq("school_id", membership.school_id)
      .eq("id", staff.department_id)
      .maybeSingle();
    if (error) {
      relatedDataError = true;
      console.error("Unable to load staff department", error.message);
    } else {
      departmentName = data?.name ?? null;
    }
  }
  if (staff?.reporting_manager_id) {
    const { data, error } = await supabase.rpc("get_staff_reporting_manager", {
      target_staff_record_id: staff.id,
    });
    if (error) {
      relatedDataError = true;
      console.error("Unable to load staff reporting manager", error.message);
    } else {
      managerName = data;
    }
  }

  const fullName = staff
    ? [staff.first_name, staff.middle_name, staff.surname].filter(Boolean).join(" ")
    : "Staff member";
  const photoUrl = safePhotoUrl(staff?.profile_photo_url ?? null);
  const employmentValue = (value: string | null | undefined) => value?.replaceAll("_", " ") ?? "Not recorded";

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[.18em] text-indigo-600">COGNIA STAFF PORTAL</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{school.name}</h1>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Sign out</button>
          </form>
        </header>

        {staff ? (
          <>
            <section className="card mb-5 flex flex-wrap items-center gap-5 p-5 sm:p-7">
              <div
                role={photoUrl ? "img" : undefined}
                aria-label={photoUrl ? `${fullName} profile photograph` : undefined}
                className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-indigo-100 bg-cover bg-center text-xl font-bold text-indigo-800"
                style={photoUrl ? { backgroundImage: `url("${photoUrl}")` } : undefined}
              >
                {!photoUrl && fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
              </div>
              <div className="min-w-[220px] flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Welcome back</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">{fullName}</h2>
                <p className="mt-1 text-sm text-slate-600">{staff.designation || "Staff member"}{departmentName ? ` · ${departmentName}` : ""}</p>
                <p className="mt-2 font-mono text-xs text-slate-500">Employee ID: {staff.employee_number}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold capitalize text-emerald-800">{employmentValue(staff.employment_status)}</span>
            </section>

            {relatedDataError && <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Some department or reporting information could not be loaded. Please contact your administrator if this continues.</p>}

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="card p-5 sm:p-6">
                <h2 className="text-sm font-bold text-slate-900">My employment</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Info label="Employee ID" value={staff.employee_number} />
                  <Info label="Job title" value={staff.designation || "Not recorded"} />
                  <Info label="Department" value={departmentName || "Not assigned"} />
                  <Info label="Staff category" value={employmentValue(staff.staff_category)} />
                  <Info label="Employment type" value={employmentValue(staff.employment_type)} />
                  <Info label="Date employed" value={dateLabel(staff.joined_on)} />
                  <Info label="Employment status" value={employmentValue(staff.employment_status)} />
                  <Info label="Reporting manager" value={managerName || "Not assigned"} />
                </dl>
              </section>

              <section className="card p-5 sm:p-6">
                <h2 className="text-sm font-bold text-slate-900">My profile</h2>
                <p className="mt-1 text-xs text-slate-500">Employment and account details are managed by your institution.</p>
                <dl className="mt-4 grid gap-4">
                  <Info label="Name" value={fullName} />
                  <Info label="Email" value={staff.email || "Not recorded"} />
                  {staff.gender && <Info label="Gender" value={employmentValue(staff.gender)} />}
                  {staff.date_of_birth && <Info label="Date of birth" value={dateLabel(staff.date_of_birth)} />}
                </dl>
                <StaffContactForm phone={staff.phone ?? ""} address={staff.address ?? ""} />
              </section>
            </div>
          </>
        ) : (
          <section role="alert" className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">Your staff profile is not linked yet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Your account is active, but the institution has not linked an employee profile to it. Contact your administrator.</p>
          </section>
        )}

        <section className="card mt-5 p-5 sm:p-6">
          <h2 className="text-sm font-bold text-slate-900">My work</h2>
          {canAccessTeacherWorkspace(membership.role, staff.staff_category) ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-slate-50" href="/admin/attendance">Attendance workspace</Link>
              <Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-slate-50" href="/admin/timetable">Timetable</Link>
              <Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-slate-50" href="/admin/assessments">Assessments</Link>
              <Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-slate-50" href="/admin/examinations">Examinations</Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No additional work tools have been assigned to your staff role.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold capitalize text-slate-800">{value}</dd>
    </div>
  );
}
