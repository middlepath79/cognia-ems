import { selectSchoolAction } from "@/app/admin/actions";

type SchoolOption = { id: string; name: string };

export function SchoolSelector({ schools, pendingSchools }: { schools: SchoolOption[]; pendingSchools: SchoolOption[] }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="card w-full max-w-lg p-7 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">COGNIA EDUCATION MANAGEMENT</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Choose an institution workspace</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Select an approved institution you administer.</p>
        <div className="mt-6 space-y-3">
          {schools.map((school) => (
            <form action={selectSchoolAction} key={school.id}>
              <input type="hidden" name="schoolId" value={school.id} />
              <button className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:border-indigo-300">{school.name}</button>
            </form>
          ))}
        </div>
        {pendingSchools.length > 0 && <p className="mt-5 text-xs leading-5 text-slate-500">You also have {pendingSchools.length} institution{pendingSchools.length === 1 ? "" : "s"} awaiting platform review. Those workspaces will be available after approval.</p>}
        <form action="/auth/signout" method="post" className="mt-6"><button className="text-sm text-indigo-700">Sign out</button></form>
      </section>
    </main>
  );
}
