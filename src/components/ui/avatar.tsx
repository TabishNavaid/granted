import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/** A person is round. Initials in ink on paper, inside an ink ring. */
export function Avatar({ name, className, size = "md" }: { name: string; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-round border-[1.5px] border-ink bg-paper font-body font-bold text-ink",
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
