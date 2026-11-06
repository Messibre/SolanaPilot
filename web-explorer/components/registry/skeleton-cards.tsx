"use client";

export function SkeletonGrid() {
  return (
    <div
      className="rounded-lg border border-border bg-surface overflow-hidden"
      aria-label="Loading registry programs"
      aria-busy="true"
    >
      <div className="border-b border-border bg-surface-2/60 px-4 py-3 flex gap-4">
        <div className="h-4 w-28 rounded bg-surface-2 animate-pulse" />
        <div className="h-4 w-32 rounded bg-surface-2 animate-pulse" />
        <div className="h-4 w-24 rounded bg-surface-2 animate-pulse" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-36 rounded bg-surface-2 animate-pulse" />
              <div className="h-3 w-20 rounded bg-surface-2/60 animate-pulse" />
            </div>
            <div className="h-4 w-24 rounded bg-surface-2 font-mono animate-pulse" />
            <div className="h-4 w-20 rounded bg-surface-2 font-mono animate-pulse" />
            <div className="h-4 w-12 rounded bg-surface-2 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div
      className="grid grid-cols-3 gap-3"
      aria-label="Loading statistics"
      aria-busy="true"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4 space-y-2">
          <div className="h-3.5 w-16 rounded bg-surface-2 animate-pulse" />
          <div className="h-7 w-12 rounded bg-surface-2 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
