import PageHeading from "@/components/page-heading";

export default function StaffLoading() {
  return (
    <>
      <PageHeading title="Staff Management" description="Loading your employee directory…" />
      <div aria-label="Loading staff directory" aria-busy="true">
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="mt-4 h-7 w-14 rounded bg-slate-100" />
              <div className="mt-4 h-3 w-32 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="h-20 border-b border-slate-100 bg-slate-50" />
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-20 border-b border-slate-100 last:border-0" />)}
        </div>
      </div>
    </>
  );
}
