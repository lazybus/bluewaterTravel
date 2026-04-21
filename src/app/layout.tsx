import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bluewatertravels.ca"),
  title: {
    default: "Bluewater Travels",
    template: "%s | Bluewater Travels",
  },
  description:
    "Offline-first Bruce Peninsula trip planning with curated logistics, conditions, and itinerary warnings.",
  applicationName: "Bluewater Travels",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bluewater Travels",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-sand text-ink">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
