import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Chrome } from "@/components/Chrome";

// All three are latin-only, so next/font self-hosts them with no build-time
// stalls (unlike a CJK face, which Google splits into ~120 chunks per weight).
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jb",
  display: "swap",
});

export const metadata: Metadata = {
  title: "parPdf",
  description: "Extract facts from PDFs and compare them across documents.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${grotesk.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider delayDuration={220}>
            <Chrome>{children}</Chrome>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
