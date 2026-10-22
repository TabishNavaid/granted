import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/brand";
import { canonicalUrl } from "@/lib/site-url";
import "./globals.css";

// Everything people read and click: Public Sans, made by the U.S. Web Design System for public services and forms.
const sans = Public_Sans({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-public", display: "swap" });
// Identifiers people already work with (solicitation numbers, NAICS codes, dates, counts).
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(canonicalUrl()),
  title: { default: PRODUCT_NAME, template: `%s | ${PRODUCT_NAME}` },
  description: PRODUCT_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  alternates: { canonical: "./" },
  openGraph: { type: "website", siteName: PRODUCT_NAME, url: "./", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

// Background jobs run after the response in the same function (src/lib/jobs/runner.ts); give them room.
export const maxDuration = 300;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {/* Light is the brand. Night mode is parked until it has its own design. */}
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
        {/* Page views only, no cookies. Active on Vercel; does nothing elsewhere. */}
        <Analytics />
      </body>
    </html>
  );
}
