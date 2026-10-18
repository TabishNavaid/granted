import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The wordmark: the product name in the headline face, a touch more
 * informal than the headlines, in deep crayon blue. No drawn mark yet.
 */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap font-display font-bold leading-none tracking-[-0.02em] text-ink [font-variation-settings:'INFM'_70,'BNCE'_25]",
        size === "sm" && "text-[1.4rem]",
        size === "md" && "text-[1.65rem]",
        size === "lg" && "text-4xl",
        size === "xl" && "text-6xl",
        className,
      )}
    >
      {PRODUCT_NAME}
    </span>
  );
}

export function Logo({ className, href = "/", size = "md" }: { className?: string; href?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <Link href={href} className={cn("inline-flex items-center rounded-sm", className)} aria-label={`${PRODUCT_NAME} home`}>
      <Wordmark size={size} />
    </Link>
  );
}
