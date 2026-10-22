import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Newsreader } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/brand";
import { canonicalUrl } from "@/lib/site-url";
import "./globals.css";

// Headlines: a text serif with an optical size axis, so it is crisp and composed at display sizes.
const display = Newsreader({ subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"], variable: "--font-newsreader", display: "swap" });
// Body and interface: a calm text face built for people who read with effort, so budgets and deadlines stay clear.
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-atkinson", display: "swap", adjustFontFallback: false, fallback: ["Helvetica Neue", "Arial", "sans-serif"] });

export const metadata: Metadata = {
  metadataBase: new URL(canonicalUrl()),
  title: { default: PRODUCT_NAME, template: `%s | ${PRODUCT_NAME}` },
  description: PRODUCT_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  alternates: { canonical: "./" },
  openGraph: { type: "website", siteName: PRODUCT_NAME, url: "./", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {/* Light is the brand. Night mode is parked until it has its own design. */}
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
