import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/nav/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IaC Sentinal — AI-Assisted Terraform Drift Remediation Mission Control",
  description:
    "Tactical operations interface for monitoring infrastructure drift, synthesizing LLM remediation, executing isolated sandbox validation, and automated GitHub PR creation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} min-h-[100dvh] antialiased bg-[#0a0a0a] text-[#eaeaea]`}
    >
      <body className="min-h-[100dvh] flex flex-col tactical-grid">
        <Suspense fallback={<div className="h-21 border-b border-white/[0.08] bg-[#0a0a0a]" />}>
          <Navbar />
        </Suspense>
        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="border-t border-white/[0.08] bg-[#070707] py-3 px-6 text-center text-[11px] font-mono text-[#52525b] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#e61919]" />
            <span>IAC SENTINAL TELEMETRY SYSTEM // SEC-LEVEL 4</span>
          </div>
          <div className="text-[#71717a]">
            The LLM proposes. Terraform validates. A human engineer approves.
          </div>
          <div>EST. 2026 // DECLASSIFIED INFRASTRUCTURE DEFENSE</div>
        </footer>
      </body>
    </html>
  );
}
