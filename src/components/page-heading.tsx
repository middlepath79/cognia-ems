export default function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1><p className="mt-1.5 text-sm text-slate-500">{description}</p></div>
      {action}
    </div>
  );
}
