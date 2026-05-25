import type { Metadata } from "next";
import { Fraunces } from "next/font/google";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Mwenye Nyumba — Rent reminders, sent right.",
  description: "Manage tenants, send invoices, track payments. A calm, modern rent-collection workspace for landlords.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (

    <html lang="en" className={`${fraunces.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-paper min-h-screen">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}