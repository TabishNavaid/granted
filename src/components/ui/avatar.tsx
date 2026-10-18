import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function Avatar({ name, className, size = "md" }: { name: string; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-medium text-accent-soft-fg",
        size === "sm" && "size-7 text-xs",
        size === "md" && "size-9 text-sm",
        size === "lg" && "size-12 text-base",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
