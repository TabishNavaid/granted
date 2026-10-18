import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/", size = "md" }: { className?: string; href?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md font-display text-fg",
        size === "sm" && "text-lg",
        size === "md" && "text-xl",
        size === "lg" && "text-2xl",
        className,
      )}
      aria-label="Granted home"
    >
      <span aria-hidden className="inline-block size-[0.6em] rounded-full bg-accent" />
      <span className="tracking-tight">Granted</span>
    </Link>
  );
}
