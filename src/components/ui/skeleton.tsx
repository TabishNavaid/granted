import { cn } from "@/lib/utils";

/** A loading placeholder: a block of paper tint. It does not shimmer. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-paper-tint", className)} aria-hidden {...props} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="border-b border-rule py-5" aria-hidden>
      <Skeleton className="mb-3 h-4 w-1/2" />
      <SkeletonText lines={2} />
    </div>
  );
}
