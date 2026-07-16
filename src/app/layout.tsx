import { SERVICE_TITLE } from "@/lib/service-brand";
import type { Metadata } from "next";
import { Karla, Lora } from "next/font/google";
import "./globals.css";

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: SERVICE_TITLE,
  description: "View itineraries and routes at a glance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${karla.variable} ${lora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
