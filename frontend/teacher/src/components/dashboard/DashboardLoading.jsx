export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-white/70 bg-white/75 p-6 shadow-panel backdrop-blur-xl">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton mt-4 h-10 w-72 max-w-full" />
        <div className="skeleton mt-3 h-4 w-[34rem] max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-white/70 bg-white/75 p-4 shadow-panel">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton mt-4 h-9 w-20" />
            <div className="skeleton mt-5 h-4 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="skeleton h-96 rounded-lg" />
        <div className="skeleton h-96 rounded-lg" />
      </div>
    </div>
  );
}
