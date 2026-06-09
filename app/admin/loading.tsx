export default function AdminLoading() {
  return (
    <div className="space-y-5" aria-live="polite" aria-busy="true">
      <section className="app-card rounded-[24px] p-5">
        <div className="h-3 w-28 animate-pulse rounded-full bg-sky-200/80 dark:bg-white/10" />
        <div className="mt-3 h-8 w-[min(320px,75%)] animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/[0.08]" />
        <div className="mt-3 h-4 w-[min(520px,90%)] animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.05]" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="app-card rounded-[24px] p-4 sm:p-5">
            <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
            <div className="mt-4 h-8 w-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.06]" />
          </div>
        ))}
      </section>

      <section className="app-card overflow-hidden rounded-[28px]">
        <div className="border-b border-app px-4 py-3">
          <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
        </div>
        <div className="divide-y divide-[var(--border-soft)]">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center">
              <div>
                <div className="h-5 w-44 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                <div className="mt-2 h-4 w-56 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
              </div>
              <div className="h-4 w-32 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
              <div className="h-9 w-24 animate-pulse rounded-[18px] bg-slate-100 dark:bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
