"use client";

export function SkeletonCard() {
  return (
    <div 
      className="rounded-lg sm:rounded-xl border border-border/30 bg-card/30 p-3 sm:p-4"
      role="presentation"
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="size-8 sm:size-10 rounded-md sm:rounded-lg animate-shimmer" />
          <div className="space-y-1.5">
            <div className="h-3.5 sm:h-4 w-24 sm:w-28 rounded animate-shimmer" />
            <div className="h-2.5 sm:h-3 w-16 sm:w-20 rounded animate-shimmer" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="h-4 w-12 rounded-full animate-shimmer" />
          <div className="h-4 w-14 rounded-full animate-shimmer" />
        </div>
      </div>
      
      {/* Description */}
      <div className="space-y-1.5 mb-3">
        <div className="h-2.5 sm:h-3 w-full rounded animate-shimmer" />
        <div className="h-2.5 sm:h-3 w-3/4 rounded animate-shimmer" />
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-md bg-background/30 p-2">
          <div className="h-2.5 w-14 rounded mb-1.5 animate-shimmer" />
          <div className="h-5 w-6 rounded animate-shimmer" />
        </div>
        <div className="rounded-md bg-background/30 p-2">
          <div className="h-2.5 w-14 rounded mb-1.5 animate-shimmer" />
          <div className="h-5 w-6 rounded animate-shimmer" />
        </div>
      </div>
      
      {/* Meta Info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-2.5 w-16 rounded animate-shimmer" />
        <div className="h-2.5 w-12 rounded animate-shimmer" />
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        <div className="h-7 sm:h-8 flex-1 rounded-md animate-shimmer" />
        <div className="h-7 sm:h-8 w-20 rounded-md animate-shimmer" />
      </div>
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div 
      className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4"
      aria-label="Loading programs"
      aria-busy="true"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div 
      className="grid grid-cols-3 gap-2 sm:gap-3"
      aria-label="Loading statistics"
      aria-busy="true"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg sm:rounded-xl border border-border/30 bg-card/30 p-3 sm:p-4">
          <div className="h-3 sm:h-4 w-16 rounded mb-2 animate-shimmer" />
          <div className="h-6 sm:h-8 w-8 sm:w-10 rounded animate-shimmer" />
        </div>
      ))}
    </div>
  );
}
