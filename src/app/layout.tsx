import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";

import { Providers } from "@/components/common/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mindraft — Where ideas take shape",
    template: "%s · Mindraft",
  },
  description:
    "Trasforma pensieri disordinati in progetti chiari, visuali e realizzabili.",
  applicationName: "Mindraft",
  authors: [{ name: "Mindraft" }],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7FC" },
    { media: "(prefers-color-scheme: dark)", color: "#101223" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} antialiased`}>
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Vai al contenuto
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
