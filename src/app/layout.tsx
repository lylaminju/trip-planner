import GoogleAnalytics from "@/components/GoogleAnalytics";
import {
  SERVICE_DESCRIPTION,
  SERVICE_TITLE,
  THEME_COLOR,
} from "@/lib/service-brand";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: SERVICE_TITLE,
  description: SERVICE_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: THEME_COLOR,
  // Draw into the display cutout areas so env(safe-area-inset-*) resolves to
  // real values; without this the installed app letterboxes on notched iPhones.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
