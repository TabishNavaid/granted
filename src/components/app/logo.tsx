import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";

/** The lockup: the mark and the name in Public Sans semibold. */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap font-sans font-semibold leading-none tracking-[-0.02em] text-ink",
        size === "sm" && "gap-1.5 text-[1.125rem]",
        size === "md" && "gap-2 text-[1.3rem]",
        size === "lg" && "gap-2.5 text-3xl",
        size === "xl" && "gap-3 text-5xl",
        className,
      )}
    >
      <LogoMark className={cn(size === "sm" && "h-5 w-5", size === "md" && "h-6 w-6", size === "lg" && "h-9 w-9", size === "xl" && "h-14 w-14")} />
      {PRODUCT_NAME}
    </span>
  );
}

export function Logo({ className, href = "/", size = "md" }: { className?: string; href?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <Link href={href} className={cn("inline-flex items-center rounded-sm", className)} title={`${PRODUCT_NAME} home`}>
      <Wordmark size={size} />
    </Link>
  );
}
