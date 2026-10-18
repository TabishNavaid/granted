import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The wordmark: the product name in Archivo at full width, printed twice.
 * Pink sits under, offset down and left; blue prints on top with multiply,
 * so the overlap shows the blue-over-pink overprint of a two-ink job.
 */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <span className={cn("wordmark", size === "sm" && "text-xl", size === "md" && "text-2xl", size === "lg" && "text-4xl", size === "xl" && "text-6xl", className)}>
      <span className="wordmark-under" aria-hidden>
        {PRODUCT_NAME}
      </span>
      <span className="wordmark-over">{PRODUCT_NAME}</span>
    </span>
  );
}

export function Logo({ className, href = "/", size = "md" }: { className?: string; href?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <Link href={href} className={cn("inline-flex items-center", className)} aria-label={`${PRODUCT_NAME} home`}>
      <Wordmark size={size} />
    </Link>
  );
}
