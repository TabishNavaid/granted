import type { Metadata, Viewport } from "next";
import { Archivo, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InkFilters } from "@/components/brand/filters";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/brand";
import "./globals.css";

// Headlines: a grotesque with a real width axis, used big like poster lettering.
const display = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
// Body and interface: a sturdy text serif, set in blue ink like a typeset notice.
const body = Source_Serif_4({ subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s – ${PRODUCT_NAME}` },
  description: PRODUCT_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b2b4b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <InkFilters />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
