/** Kerangka abu-abu untuk tampilan loading. */
export function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-tint ${className}`} aria-hidden />;
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Bone className="aspect-[5/4] !rounded-[var(--radius-photo)]" />
          <Bone className="mt-3 h-5 w-2/3" />
          <Bone className="mt-2 h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}
