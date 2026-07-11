import { SERVICE_TITLE } from "@/lib/service-brand";
import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
