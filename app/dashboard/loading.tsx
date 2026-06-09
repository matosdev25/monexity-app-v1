export default function DashboardLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden text-slate-950 dark:text-white">
      <header className="shrink-0">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="h-4 w-28 animate-pulse rounded-full bg-sky-200/80 dark:bg-white/10" />

            <div className="mt-3 h-10 w-[min(520px,85%)] animate-pulse rounded-2xl bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:bg-white/[0.06]" />

            <div className="mt-3 h-5 w-[min(420px,70%)] animate-pulse rounded-full bg-white/70 dark:bg-white/[0.05]" />

            <div className="mt-4 h-4 w-24 animate-pulse rounded-full bg-white/60 dark:bg-white/[0.04]" />
          </div>

          <div className="flex shrink-0 items-center justify-center">
            <div className="h-16 w-16 animate-pulse rounded-[22px] border border-white/60 bg-white/70 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] sm:h-20 sm:w-20" />
          </div>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="flex min-h-0 flex-col gap-4">
          <div className="rounded-[30px] border border-white/60 bg-white/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="h-4 w-28 animate-pulse rounded-full bg-sky-200/80 dark:bg-white/10" />
            <div className="mt-3 h-8 w-64 animate-pulse rounded-2xl bg-white/80 dark:bg-white/[0.06]" />
            <div className="mt-3 h-4 w-48 animate-pulse rounded-full bg-white/70 dark:bg-white/[0.05]" />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
                >
                  <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                  <div className="mt-4 h-8 w-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.06]" />
                  <div className="mt-3 h-4 w-28 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/60 bg-white/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="h-8 w-40 animate-pulse rounded-2xl bg-white/80 dark:bg-white/[0.06]" />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="h-5 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                      <div className="mt-3 h-4 w-40 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.05]" />
                    </div>

                    <div className="h-7 w-10 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/60 bg-white/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <div className="h-4 w-32 animate-pulse rounded-full bg-sky-200/80 dark:bg-white/10" />
          <div className="mt-3 h-8 w-52 animate-pulse rounded-2xl bg-white/80 dark:bg-white/[0.06]" />

          <div className="mt-4 grid gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
              >
                <div className="h-5 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="h-8 w-36 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.06]" />
                    <div className="mt-3 h-4 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.05]" />
                  </div>

                  <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="h-[52px] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
