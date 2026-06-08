import type { Metadata } from "next";
import { SERVICE_TITLE } from "@/lib/service-brand";
import "./globals.css";

export const metadata: Metadata = {
  title: SERVICE_TITLE,
  description: "Local-first itinerary planner",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
