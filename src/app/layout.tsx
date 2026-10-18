import type { Metadata, Viewport } from "next";
import { Caveat, Nunito_Sans, Young_Serif } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/brand";
import "./globals.css";

const display = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const sans = Nunito_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const hand = Caveat({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-hand", display: "swap" });

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: PRODUCT_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe3" },
    { media: "(prefers-color-scheme: dark)", color: "#141229" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${hand.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
